import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import { FileRepository, atomicWrite } from "../lib/deck-service/file-repository";
import { DeckService } from "../lib/deck-service/deck-service";
import { DeckError } from "../lib/deck-service/deck-document";
import { createDeckHttpServer } from "../lib/deck-service/http-server";
import { watchLibraryEvents } from "../lib/local-deck/event-client";
import { LiveDeckSession } from "../lib/local-deck/live-session";
import { createEditorStore } from "../store/editor-store";

const owner = "test-owner-token-0000000000000001";
const cover = { layout: "wknd-cover-brand", content: { title: "Live deck" } };
const close = { layout: "wknd-thank-you", content: { subtitle: "Thank you" } };
const code = (expected: string) => (error: unknown) => error instanceof DeckError && error.code === expected;
async function fixture(t: { after: (fn: () => unknown) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "agent-library-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new FileRepository(directory); await repository.initialize();
  return { directory, repository, service: new DeckService(repository) };
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 150; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail("Acceptance condition was not reached.");
}

test("a live deck is immediately listed, owned, incrementally built and explicitly completed", async t => {
  const { service } = await fixture(t);
  const created = await service.create({ requestId: "live", live: true, plannedSlides: 2, spec: { title: "Library job", slides: [cover] } }, owner);
  const deckId = created.presentation.id;
  const runId = created.agentWork!.id;
  assert.equal(created.agentWork?.status, "working");
  assert.ok(!("ownerHash" in created.agentWork!));
  const listed = await service.list();
  assert.equal(listed.decks.length, 1);
  assert.equal(listed.decks[0].slideCount, 1);
  assert.equal(listed.decks[0].agentWork?.status, "working");
  assert.ok(!JSON.stringify(listed).includes("elements"));
  assert.ok(!JSON.stringify(listed).includes(owner));
  assert.ok(!JSON.stringify(listed).includes("ownerHash"));
  await assert.rejects(service.add({ deckId, expectedRevision: 1, requestId: "unauthorized", slideSpec: close }), code("WORK_OWNER_REQUIRED"));
  await assert.rejects(service.startWork({ deckId, expectedRevision: 1, requestId: "second" }, "another-owner-token"), code("WORK_BUSY"));
  await assert.rejects(service.finishWork({ deckId, expectedRevision: 1, requestId: "too-early", runId, ownerToken: owner, status: "completed" }), code("INCOMPLETE_DECK"));
  assert.equal((await service.get(deckId)).revision, 1);
  const added = await service.add({ deckId, expectedRevision: 1, requestId: "add", slideSpec: close, runId, ownerToken: owner });
  assert.equal(added.agentWork?.lastSlideId, added.presentation.slides[1].id);
  const args = { deckId, expectedRevision: 2, requestId: "finish", runId, ownerToken: owner, status: "completed" as const };
  const finished = await service.finishWork(args);
  assert.equal(finished.revision, 3);
  assert.equal(finished.agentWork?.status, "completed");
  assert.deepEqual(finished.presentation, added.presentation);
  assert.deepEqual(await service.finishWork(args), finished);
  assert.equal((await service.list()).decks[0].agentWork?.status, "completed");
});

test("interrupted work can be resumed after restart, old owners cannot mutate the new run", async t => {
  const { service, repository } = await fixture(t);
  const created = await service.create({ requestId: "live", live: true, plannedSlides: 2, spec: { slides: [cover] } }, owner);
  const restarted = new DeckService(repository);
  const deckId = created.presentation.id;
  assert.equal((await restarted.get(deckId)).agentWork?.status, "interrupted");
  await assert.rejects(restarted.add({ deckId, expectedRevision: 1, requestId: "old", slideSpec: close, runId: created.agentWork!.id, ownerToken: owner }), code("WORK_INTERRUPTED"));
  const nextOwner = "new-owner-token-0000000000000002";
  const resumed = await restarted.startWork({ deckId, expectedRevision: 1, requestId: "resume", plannedSlides: 2 }, nextOwner);
  await assert.rejects(restarted.add({ deckId, expectedRevision: 2, requestId: "wrong-owner", slideSpec: close, runId: created.agentWork!.id, ownerToken: owner }), code("WORK_OWNER_REQUIRED"));
  const added = await restarted.add({ deckId, expectedRevision: 2, requestId: "new-owner", slideSpec: close, runId: resumed.agentWork!.id, ownerToken: nextOwner });
  assert.equal(added.presentation.slides.length, 2);
});

test("failed status writes leave the active job intact; corrupt deck files do not hide valid Library cards", async t => {
  const { service, repository, directory } = await fixture(t);
  const deck = await service.create({ requestId: "live", live: true, plannedSlides: 1, spec: { slides: [cover] } }, owner);
  const write = repository.write.bind(repository);
  repository.write = async () => { throw new Error("Disk full"); };
  await assert.rejects(service.finishWork({ deckId: deck.presentation.id, expectedRevision: 1, requestId: "finish", runId: deck.agentWork!.id, ownerToken: owner, status: "completed" }));
  repository.write = write;
  assert.equal((await service.get(deck.presentation.id)).agentWork?.status, "working");
  assert.equal((await service.get(deck.presentation.id)).revision, 1);
  await atomicWrite(join(directory, "decks", "corrupt.json"), { not: "a deck" });
  const list = await service.list();
  assert.equal(list.decks.length, 1); assert.equal(list.unavailableCount, 1);
});

test("idle work is shown as interrupted and an explicit new run replaces its stale owner", async t => {
  const { service, repository } = await fixture(t);
  const deck = await service.create({ requestId: "idle", live: true, plannedSlides: 2, spec: { slides: [cover] } }, owner);
  const stored = await repository.read(deck.presentation.id);
  stored.agentWork!.updatedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  await repository.write(stored);
  assert.equal((await service.list()).decks[0].agentWork?.status, "interrupted");
  await assert.rejects(service.add({ deckId: deck.presentation.id, expectedRevision: 1, requestId: "idle-owner", slideSpec: close, runId: deck.agentWork!.id, ownerToken: owner }), code("WORK_INTERRUPTED"));
  const resumed = await service.startWork({ deckId: deck.presentation.id, expectedRevision: 1, requestId: "take-over", plannedSlides: 2 }, "replacement-owner-token");
  assert.equal(resumed.agentWork?.status, "working");
  await assert.rejects(service.add({ deckId: deck.presentation.id, expectedRevision: 2, requestId: "stale-owner", slideSpec: close, runId: deck.agentWork!.id, ownerToken: owner }), code("WORK_OWNER_REQUIRED"));
});

test("deletion checks revision, removes content durably, and prevents agent retries or stale saves from resurrecting it", async t => {
  const { service, repository, directory } = await fixture(t);
  const create = { requestId: "to-delete", live: true, spec: { title: "Delete me", slides: [cover] } };
  const deck = await service.create(create, owner);
  const kept = await service.create({ requestId: "keep", spec: { slides: [cover] } });
  const deckId = deck.presentation.id;
  const updated = await service.add({ deckId, expectedRevision: 1, requestId: "add", slideSpec: close, runId: deck.agentWork!.id, ownerToken: owner });
  await assert.rejects(service.remove({ deckId, expectedRevision: 1 }), code("REVISION_CONFLICT"));
  assert.equal((await service.get(deckId)).revision, 2);
  const events: string[] = [];
  const sub = service.events.subscribe(deckId, undefined, event => events.push(event.type)); t.after(sub.close);
  await service.remove({ deckId, expectedRevision: 2 });
  assert.deepEqual(events, ["document.deleted"]);
  assert.deepEqual((await service.list()).decks.map(item => item.id), [kept.presentation.id]);
  assert.equal((await service.list()).unavailableCount, 0);
  await assert.rejects(service.get(deckId), code("DECK_DELETED"));
  await assert.rejects(service.save({ deckId, expectedRevision: 2, requestId: "stale-save", presentation: updated.presentation }), code("DECK_DELETED"));
  await assert.rejects(service.add({ deckId, expectedRevision: 2, requestId: "late-agent", slideSpec: close, runId: deck.agentWork!.id, ownerToken: owner }), code("DECK_DELETED"));
  await assert.rejects(service.create(create, owner), code("DECK_DELETED"));
  await service.remove({ deckId, expectedRevision: 2 });
  assert.deepEqual(events, ["document.deleted"], "A lost response can be retried without a second deletion.");
  const restarted = new DeckService(repository);
  await assert.rejects(restarted.create(create, owner), code("DECK_DELETED"));
  assert.deepEqual((await restarted.list()).decks.map(item => item.id), [kept.presentation.id]);
  const marker = JSON.parse(await readFile(join(directory, "decks", `${deckId}.json`), "utf8"));
  assert.equal(marker.deleted, true);
  assert.equal(marker.revision, 3);
  assert.deepEqual(Object.keys(marker).sort(), ["deckId", "deleted", "deletedAt", "revision", "storageVersion"]);
});

test("a failed deletion leaves the deck readable and publishes no deleted event", async t => {
  const { service, repository } = await fixture(t);
  const deck = await service.create({ requestId: "keep-on-failure", spec: { slides: [cover] } });
  const events: string[] = [];
  const sub = service.events.subscribe(deck.presentation.id, undefined, event => events.push(event.type)); t.after(sub.close);
  repository.remove = async () => { throw new Error("Disk failure"); };
  await assert.rejects(service.remove({ deckId: deck.presentation.id, expectedRevision: 1 }));
  assert.deepEqual(await service.get(deck.presentation.id), deck);
  assert.equal((await service.list()).decks.length, 1);
  assert.deepEqual(events, []);
});

test("deletion stops a live editor while preserving its unsaved draft", async t => {
  const { service } = await fixture(t);
  const deck = await service.create({ requestId: "open-tab", spec: { slides: [cover] } });
  const store = createEditorStore(deck.presentation, { persist: false });
  let saves = 0;
  const session = new LiveDeckSession(store, deck, { url: "http://127.0.0.1:1", token: "test" }, () => true, {
    load: () => service.get(deck.presentation.id),
    save: async () => { saves++; return deck; },
    watch: async (callbacks, signal) => {
      const sub = service.events.subscribe(deck.presentation.id, undefined, callbacks.event);
      await new Promise<void>(resolve => signal.addEventListener("abort", () => { sub.close(); resolve(); }, { once: true }));
    },
  }, true);
  t.after(() => session.stop()); session.start();
  store.getState().updatePresentationTitle("Keep this unsaved draft");
  await service.remove({ deckId: deck.presentation.id, expectedRevision: 1 });
  assert.equal(session.getSnapshot().deleted, true);
  assert.equal(session.getSnapshot().dirty, true);
  assert.equal(session.getSnapshot().canLoad, false);
  assert.equal(session.getSnapshot().connection, "deleted");
  assert.equal(store.getState().presentation.title, "Keep this unsaved draft");
  await session.save();
  assert.equal(saves, 0);
});

test("Follow AI targets committed slides; manual navigation and pause retain user control", async t => {
  const { service } = await fixture(t);
  const document = await service.create({ requestId: "base", spec: { slides: [cover, close] } });
  const store = createEditorStore(document.presentation, { persist: false });
  const session = new LiveDeckSession(store, document, { url: "http://127.0.0.1:1", token: "test" }, () => false, {
    load: () => service.get(document.presentation.id),
    save: async () => { throw new Error("not used"); },
    watch: async (callbacks, signal) => {
      const subscription = service.events.subscribe(document.presentation.id, undefined, callbacks.event);
      await new Promise<void>(resolve => signal.addEventListener("abort", () => { subscription.close(); resolve(); }, { once: true }));
    },
  }, true);
  t.after(() => session.stop()); session.start();
  const target = document.presentation.slides[1].id;
  await service.update({ deckId: document.presentation.id, slideId: target, expectedRevision: 1, requestId: "follow", contentPatch: { subtitle: "Updated live" } });
  await until(() => session.getSnapshot().revision === 2);
  assert.equal(store.getState().activeSlideId, target);
  assert.equal(session.getSnapshot().highlightSlideId, target);
  store.getState().selectSlide(document.presentation.slides[0].id);
  assert.equal(session.getSnapshot().follow, false);
  session.setPaused(true);
  await service.update({ deckId: document.presentation.id, slideId: target, expectedRevision: 2, requestId: "paused", contentPatch: { subtitle: "More changes" } });
  await until(() => session.getSnapshot().canLoad);
  assert.equal(session.getSnapshot().revision, 2);
  session.setPaused(false);
  assert.equal(session.getSnapshot().revision, 3);
  assert.equal(store.getState().activeSlideId, document.presentation.slides[0].id);
});

test("authenticated Library discovery streams new deck commits and lazy cover separately", async t => {
  const { service } = await fixture(t);
  const connection = { url: "http://127.0.0.1:0", appUrl: "http://localhost:3000", token: "library-test-secret" };
  const server = createDeckHttpServer(service, connection);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  connection.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => new Promise<void>(resolve => { server.closeEventStreams(); server.close(() => resolve()); server.closeAllConnections(); }));
  assert.equal((await fetch(`${connection.url}/decks`)).status, 401);
  assert.equal((await fetch(`${connection.url}/events`)).status, 401);
  const abort = new AbortController(); t.after(() => abort.abort());
  const events: string[] = [];
  const watching = watchLibraryEvents(connection, { event: value => events.push(value.type), status: () => undefined }, abort.signal);
  await until(() => events.includes("connection.sync"));
  const deck = await service.create({ requestId: "listed", spec: { slides: [cover] } });
  await until(() => events.includes("document.committed"));
  const headers = { Authorization: `Bearer ${connection.token}` };
  const list = await (await fetch(`${connection.url}/decks`, { headers })).json();
  assert.equal(list.decks[0].id, deck.presentation.id);
  assert.ok(!("coverSlide" in list.decks[0]));
  const preview = await (await fetch(`${connection.url}/decks/${deck.presentation.id}/cover`, { headers })).json();
  assert.equal(preview.slide.id, deck.presentation.slides[0].id);
  const endpoint = `${connection.url}/decks/${deck.presentation.id}`;
  assert.equal((await fetch(endpoint, { method: "DELETE" })).status, 401);
  const preflight = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: connection.appUrl, "Access-Control-Request-Method": "DELETE" } });
  assert.ok(preflight.headers.get("access-control-allow-methods")?.includes("DELETE"));
  const remove = { method: "DELETE", headers: { ...headers, "Content-Type": "application/json", Origin: connection.appUrl }, body: JSON.stringify({ deckId: deck.presentation.id, expectedRevision: 1 }) };
  assert.equal((await fetch(endpoint, { ...remove, headers: { ...remove.headers, Origin: "http://untrusted.test" } })).status, 403);
  assert.equal((await fetch(endpoint, { ...remove, body: JSON.stringify({ deckId: "wrong-deck", expectedRevision: 1 }) })).status, 400);
  assert.equal((await fetch(endpoint, remove)).status, 200);
  await until(() => events.includes("document.deleted"));
  assert.equal((await fetch(endpoint, remove)).status, 200);
  assert.equal((await fetch(endpoint, { headers })).status, 410);
  assert.equal((await fetch(`${endpoint}/events`, { headers })).status, 410);
  const after = await (await fetch(`${connection.url}/decks`, { headers })).json();
  assert.deepEqual(after.decks, []); assert.equal(after.unavailableCount, 0);
  abort.abort(); await watching;
});
