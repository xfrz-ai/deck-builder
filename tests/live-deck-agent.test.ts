import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { DeckService } from "../lib/deck-service/deck-service";
import { FileRepository } from "../lib/deck-service/file-repository";
import { DeckEvents } from "../lib/deck-service/events";
import type { DeckEvent } from "../lib/deck-service/event-types";
import { createDeckHttpServer } from "../lib/deck-service/http-server";
import type { DeckSnapshot } from "../lib/deck-service/deck-document";
import { createEditorStore } from "../store/editor-store";
import { LiveDeckSession, type SessionTransport } from "../lib/local-deck/live-session";
import { LocalDeckClientError } from "../lib/local-deck/client";
import { SseParser, watchDeckEvents } from "../lib/local-deck/event-client";

const spec = { slides: [{ layout: "wknd-cover-brand", content: { title: "Original" } }, { layout: "wknd-thank-you", content: { subtitle: "Thanks" } }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail("Condition was not reached.");
}
async function fixture(t: { after: (callback: () => unknown) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "live-deck-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new FileRepository(directory); await repository.initialize();
  const service = new DeckService(repository);
  const document = await service.create({ spec, requestId: "create" });
  return { service, document, repository };
}
function event(document: DeckSnapshot, revision: number, sequence = revision, type: DeckEvent["type"] = "document.committed"): DeckEvent {
  const instance = "00000000-0000-4000-8000-000000000001";
  return { id: `${instance}:${sequence}`, instance, sequence, deckId: document.presentation.id, revision, type, operation: "update", source: "agent", changedSlideIds: [document.presentation.slides[0].id] };
}
function client(document: DeckSnapshot, t: { after: (callback: () => unknown) => void }) {
  const store = createEditorStore(document.presentation, { persist: false });
  let current = structuredClone(document);
  let loading: (() => Promise<DeckSnapshot>) | undefined;
  let saving: SessionTransport["save"] = async () => { throw new Error("Save not configured"); };
  let input = false;
  let calls = 0;
  const api: SessionTransport = {
    load: async () => { calls++; return loading ? loading() : structuredClone(current); },
    save: (...args) => saving(...args),
    watch: async (_callbacks, signal) => new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })),
  };
  const session = new LiveDeckSession(store, document, { url: "http://127.0.0.1:8790", token: "test" }, () => input, api);
  t.after(() => session.stop()); session.start();
  return { session, store, setCurrent: (value: DeckSnapshot) => { current = value; }, setLoad: (value: () => Promise<DeckSnapshot>) => { loading = value; }, setSave: (value: SessionTransport["save"]) => { saving = value; }, setInput: (value: boolean) => { input = value; }, loadCalls: () => calls };
}

test("event bus is bounded, scoped to one deck, replayable and isolated from listener failures", () => {
  const events = new DeckEvents(2);
  const input = { type: "document.committed" as const, deckId: "deck-one", revision: 1, source: "agent" as const, changedSlideIds: ["one"] };
  const received: DeckEvent[] = [];
  const first = events.publish(input);
  const sub = events.subscribe("deck-one", first.id, value => received.push(value));
  events.subscribe("deck-one", first.id, () => { throw new Error("disconnected subscriber"); });
  events.publish({ ...input, deckId: "deck-two" });
  const third = events.publish({ ...input, revision: 2 });
  assert.deepEqual(received.map(value => value.revision), [2]);
  assert.equal(events.subscribe("deck-one", first.id, () => undefined).reset, false);
  assert.deepEqual(events.subscribe("deck-one", first.id, () => undefined).replay.map(value => value.id), [third.id]);
  events.publish({ ...input, revision: 3 });
  assert.equal(events.subscribe("deck-one", first.id, () => undefined).reset, true);
  assert.equal(new DeckEvents().subscribe("deck-one", third.id, () => undefined).reset, true);
  sub.close();
});

test("events describe durable commits, never failed writes or idempotent replay as new commits", async t => {
  const { service, repository, document } = await fixture(t);
  const received: DeckEvent[] = [];
  const subscription = service.events.subscribe(document.presentation.id, undefined, value => received.push(value));
  t.after(subscription.close);
  const gate = deferred<void>();
  const write = repository.write.bind(repository);
  repository.write = async value => { await gate.promise; await write(value); };
  const args = { deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "update", contentPatch: { title: "Updated" } };
  const operation = service.update(args);
  await waitFor(() => received.length === 1);
  assert.equal(received[0].type, "operation.started");
  assert.equal((await service.get(document.presentation.id)).revision, 1);
  gate.resolve(); await operation;
  assert.equal(received.at(-1)?.type, "document.committed");
  assert.equal((await service.get(document.presentation.id)).revision, 2);
  const count = received.length; await service.update(args); assert.equal(received.length, count);
  repository.write = async () => { throw new Error("disk failure"); };
  await assert.rejects(service.update({ ...args, expectedRevision: 2, requestId: "fail" }));
  assert.equal(received.at(-1)?.type, "operation.failed");
  assert.equal(received.filter(value => value.type === "document.committed").length, 1);
  assert.equal((await service.get(document.presentation.id)).revision, 2);
});

test("SSE parser handles split CRLF, multiline frames and incomplete data without leaking partial events", () => {
  const frames: { id: string; event: string; data: string }[] = [];
  const parser = new SseParser(frame => frames.push(frame));
  const text = ': heartbeat\r\nid: abc\r\nevent: test\r\ndata: {"name":\r\ndata: "cafe"}\r\n\r\nid: def\ndata: complete\n\ndata: incomplete';
  for (const character of text) parser.push(character);
  assert.deepEqual(frames, [{ id: "abc", event: "test", data: '{"name":\n"cafe"}' }, { id: "def", event: "message", data: "complete" }]);
});

test("clean remote update preserves navigation/zoom, clears stale history, and remains saved", async t => {
  const { service, document } = await fixture(t);
  const browser = client(document, t);
  browser.store.getState().updatePresentationTitle("Temporary draft");
  browser.store.getState().undo();
  assert.equal(browser.store.getState().redoStack.length, 1);
  browser.store.getState().selectSlide(document.presentation.slides[1].id);
  browser.store.getState().setZoom(0.75);
  const updated = await service.update({ deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "remote", contentPatch: { title: "Live" } });
  browser.setCurrent(updated); browser.session.receive(event(document, 2));
  await waitFor(() => browser.session.getSnapshot().revision === 2);
  assert.deepEqual(browser.store.getState().presentation, updated.presentation);
  assert.equal(browser.session.getSnapshot().dirty, false);
  assert.equal(browser.store.getState().activeSlideId, document.presentation.slides[1].id);
  assert.equal(browser.store.getState().zoom, 0.75);
  assert.deepEqual(browser.store.getState().undoStack, []);
  assert.deepEqual(browser.store.getState().redoStack, []);
  browser.session.receive(event(document, 1));
  assert.equal(browser.session.getSnapshot().revision, 2);
});

test("typing during snapshot fetch and canvas gestures hold changes until safe; discard is explicit", async t => {
  const { service, document } = await fixture(t);
  const browser = client(document, t);
  const updated = await service.update({ deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "remote", contentPatch: { title: "Live" } });
  const gate = deferred<DeckSnapshot>(); browser.setLoad(() => gate.promise);
  browser.session.receive(event(document, 2));
  browser.store.getState().updatePresentationTitle("My draft");
  gate.resolve(updated);
  await waitFor(() => browser.session.getSnapshot().canLoad);
  assert.equal(browser.session.getSnapshot().revision, 1);
  assert.equal(browser.store.getState().presentation.title, "My draft");
  browser.setInput(true); browser.session.loadServer(true); assert.equal(browser.session.getSnapshot().revision, 1);
  browser.setInput(false); browser.session.setInteracting(true); browser.session.loadServer(true); assert.equal(browser.session.getSnapshot().revision, 1);
  browser.session.setInteracting(false); assert.equal(browser.session.getSnapshot().revision, 1);
  browser.session.loadServer(); assert.equal(browser.session.getSnapshot().revision, 1);
  browser.session.loadServer(true); assert.equal(browser.session.getSnapshot().revision, 2);
  assert.equal(browser.session.getSnapshot().dirty, false);
});

test("an unchanged active input also blocks application and is retried after interaction ends", async t => {
  const { service, document } = await fixture(t);
  const browser = client(document, t); browser.setInput(true);
  const updated = await service.update({ deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "remote", contentPatch: { title: "Live" } });
  browser.setCurrent(updated); browser.session.receive(event(document, 2));
  await waitFor(() => browser.session.getSnapshot().canLoad);
  assert.equal(browser.session.getSnapshot().revision, 1);
  browser.setInput(false); browser.session.retryApply();
  assert.equal(browser.session.getSnapshot().revision, 2);
});

test("Save acknowledgment cannot overwrite edits made during save or an event racing it", async t => {
  const { service, document } = await fixture(t);
  const browser = client(document, t);
  browser.store.getState().updatePresentationTitle("Sent draft");
  const sent = browser.store.getState().presentation;
  const saved = await service.save({ deckId: sent.id, expectedRevision: 1, requestId: "save", presentation: sent });
  const updated = await service.update({ deckId: sent.id, slideId: sent.slides[0].id, expectedRevision: 2, requestId: "agent", contentPatch: { title: "Remote" } });
  const gate = deferred<DeckSnapshot>(); browser.setSave(() => gate.promise); browser.setCurrent(updated);
  const saving = browser.session.save();
  browser.session.receive(event(document, 2)); browser.session.receive(event(document, 3));
  browser.store.getState().updatePresentationTitle("New draft after Save started");
  await waitFor(() => browser.session.getSnapshot().canLoad);
  gate.resolve(saved); await saving;
  assert.equal(browser.session.getSnapshot().revision, 2);
  assert.equal(browser.store.getState().presentation.title, "New draft after Save started");
  assert.equal(browser.session.getSnapshot().dirty, true);
  assert.equal(browser.session.getSnapshot().pendingRevision, 3);
});

test("a lost acknowledgment retries the same receipt; a newer server revision keeps the old draft", async t => {
  const { document } = await fixture(t);
  const browser = client(document, t); browser.store.getState().updatePresentationTitle("Draft");
  const requests: string[] = [];
  browser.setSave(async (_revision, _presentation, requestId) => { requests.push(requestId); throw new LocalDeckClientError("Already saved, newer changes exist", "REQUEST_ALREADY_APPLIED", 3); });
  const newer = structuredClone(document); newer.revision = 3; browser.setCurrent(newer);
  await browser.session.save(); await browser.session.save();
  assert.equal(requests[0], requests[1]);
  await waitFor(() => browser.session.getSnapshot().canLoad);
  assert.equal(browser.session.getSnapshot().revision, 1);
  assert.equal(browser.store.getState().presentation.title, "Draft");
});

test("reconnect sync fetches a missed durable revision even if its event was lost", async t => {
  const { service, document } = await fixture(t);
  const browser = client(document, t);
  const updated = await service.update({ deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "remote", contentPatch: { title: "Recovered" } });
  browser.setCurrent(updated);
  browser.session.receive({ ...event(document, 1, 0, "connection.sync"), instance: randomUUID(), reset: true });
  await waitFor(() => browser.session.getSnapshot().revision === 2);
  assert.equal(browser.session.getSnapshot().dirty, false);
});

test("authenticated stream reconnects, scopes events, and stops cleanly on abort", async t => {
  const { service, document } = await fixture(t);
  const connection = { url: "http://127.0.0.1:0", appUrl: "http://localhost:3000", token: "local-test-secret" };
  const server = createDeckHttpServer(service, connection);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  connection.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => new Promise<void>(resolve => { server.closeEventStreams(); server.close(() => resolve()); server.closeAllConnections(); }));
  const path = `${connection.url}/decks/${document.presentation.id}/events`;
  assert.equal((await fetch(path)).status, 401);
  assert.equal((await fetch(path, { headers: { Authorization: `Bearer ${connection.token}`, Origin: "http://evil.example" } })).status, 403);
  const received: DeckEvent[] = [];
  const abort = new AbortController(); t.after(() => abort.abort());
  const watching = watchDeckEvents(connection, document.presentation.id, { event: value => received.push(value), status: () => undefined }, abort.signal);
  await waitFor(() => received.some(value => value.type === "connection.sync"));
  const other = await service.create({ spec, requestId: "other" });
  await service.update({ deckId: document.presentation.id, slideId: document.presentation.slides[0].id, expectedRevision: 1, requestId: "live", contentPatch: { title: "Streamed" } });
  await waitFor(() => received.some(value => value.type === "document.committed" && value.revision === 2));
  assert.ok(received.every(value => value.deckId !== other.presentation.id));
  server.closeEventStreams();
  await waitFor(() => received.filter(value => value.type === "connection.sync").length === 2);
  abort.abort(); await watching;
});
