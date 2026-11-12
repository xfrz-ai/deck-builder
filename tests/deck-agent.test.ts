import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { FileRepository, atomicWrite } from "../lib/deck-service/file-repository";
import { DeckService } from "../lib/deck-service/deck-service";
import { DeckError } from "../lib/deck-service/deck-document";
import { createDeckHttpServer } from "../lib/deck-service/http-server";
import { getDeckSpecCatalog } from "../lib/deck-spec/layout-catalog";
import { createEditorStore } from "../store/editor-store";

const spec = { version: 1 as const, title: "Agent test", slides: [
  { layout: "wknd-cover-brand", content: { title: "Local Deck" } },
  { layout: "wknd-thank-you", content: { subtitle: "Thank you." } },
] };
const isCode = (code: string) => (error: unknown) => error instanceof DeckError && error.code === code;
async function fixture(t: { after: (fn: () => unknown) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "deck-agent-test-"));
  const repository = new FileRepository(directory);
  await repository.initialize();
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, repository, service: new DeckService(repository) };
}

test("31 supported catalog layouts build and survive repository restart", async t => {
  const { service, directory } = await fixture(t);
  const catalog = getDeckSpecCatalog();
  assert.equal(catalog.layouts.length, 31);
  for (const layout of catalog.layouts) {
    const deck = await service.create({ requestId: layout.id, spec: { slides: [{ layout: layout.id, content: layout.example }] } });
    assert.equal(deck.validation, "estimated");
    assert.equal(deck.presentation.slides.length, 1);
    assert.equal(deck.sources[deck.presentation.slides[0].id].stale, false);
    const restarted = new DeckService(new FileRepository(directory));
    assert.deepEqual(await restarted.get(deck.presentation.id), deck);
    const editor = createEditorStore(deck.presentation, { persist: false });
    const saved = await service.save({ deckId: deck.presentation.id, expectedRevision: 1, requestId: "normalized-save", presentation: editor.getState().presentation });
    assert.ok(Object.values(saved.sources).every(source => !source.stale), `Loading ${layout.id} must not invalidate its source.`);
  }
});

test("stable identity, one-slide updates, insert position, and persistent idempotent retries", async t => {
  const { service, directory } = await fixture(t);
  const created = await service.create({ requestId: "create", spec });
  const deckId = created.presentation.id;
  const slideId = created.presentation.slides[0].id;
  assert.deepEqual(await service.create({ requestId: "create", spec }), created);
  const args = { deckId, slideId, expectedRevision: 1, requestId: "update", contentPatch: { title: "Revised" } };
  const updated = await service.update(args);
  assert.equal(updated.presentation.id, deckId);
  assert.equal(updated.presentation.slides[0].id, slideId);
  assert.deepEqual(updated.presentation.slides[1], created.presentation.slides[1]);
  const restarted = new DeckService(new FileRepository(directory));
  assert.deepEqual(await restarted.update(args), updated);
  await assert.rejects(service.update({ ...args, contentPatch: { title: "Different" } }), isCode("REQUEST_ID_REUSED"));
  const added = await service.add({ deckId, expectedRevision: 2, requestId: "insert", afterSlideId: slideId, slideSpec: spec.slides[1] });
  assert.equal(added.presentation.slides.length, 3);
  assert.deepEqual(added.presentation.slides[2], created.presentation.slides[1]);
  // A lost old Save acknowledgement must not advance a browser to a newer revision
  // while falsely marking its old draft as current.
  await assert.rejects(restarted.update(args), isCode("REQUEST_ALREADY_APPLIED"));
  assert.equal((await stat(join(directory, "decks", `${deckId}.json`))).mode & 0o777, 0o600);
  assert.equal((await readdir(join(directory, "decks"))).filter(name => name.endsWith(".tmp")).length, 0);
});

test("concurrent updates and stale browser saves cannot overwrite the committed revision", async t => {
  const { service, repository } = await fixture(t);
  const deck = await service.create({ requestId: "create", spec });
  const deckId = deck.presentation.id;
  const results = await Promise.allSettled(["One", "Two"].map(title => service.update({ deckId, slideId: deck.presentation.slides[0].id, expectedRevision: 1, requestId: title, contentPatch: { title } })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(isCode("REVISION_CONFLICT")(rejected.reason));
  const current = await repository.read(deckId);
  await assert.rejects(service.save({ deckId, expectedRevision: 1, requestId: "stale-save", presentation: deck.presentation }), isCode("REVISION_CONFLICT"));
  assert.deepEqual(await repository.read(deckId), current);
});

test("invalid builder input and unsupported layouts never commit partial output", async t => {
  const { service, directory } = await fixture(t);
  await assert.rejects(service.create({ requestId: "partial", spec: { slides: [...spec.slides, { layout: "wknd-image-split" }] } }), isCode("UNSUPPORTED_LAYOUT"));
  await assert.rejects(service.create({ requestId: "overflow", spec: { slides: [{ layout: "wknd-cover-brand", content: { title: "W".repeat(200) } }] } }), isCode("BUILD_FAILED"));
  await assert.rejects(service.create({ requestId: "shape", spec: { slides: [{ layout: "wknd-questions", content: { steps: [] } }] } }), isCode("BUILD_FAILED"));
  await assert.rejects(service.create({ requestId: "remote", spec: { slides: [{ layout: "wknd-image-chapter", content: { title: "Test", background: "https://example.com/test.png" } }] } }), isCode("EXTERNAL_ASSET"));
  assert.deepEqual(await readdir(join(directory, "decks")), []);
  const full = await service.create({ requestId: "full", spec: { slides: Array.from({ length: 60 }, () => spec.slides[0]) } });
  await assert.rejects(service.add({ deckId: full.presentation.id, expectedRevision: 1, requestId: "over", slideSpec: spec.slides[0] }), isCode("SLIDE_LIMIT"));
  assert.equal((await service.get(full.presentation.id)).revision, 1);
  const tooMany = structuredClone(full.presentation);
  tooMany.slides.push({ id: "manual-extra", background: "#FFFFFF", elements: [] });
  await assert.rejects(service.save({ deckId: full.presentation.id, expectedRevision: 1, requestId: "oversize-save", presentation: tooMany }), isCode("SLIDE_LIMIT"));
});

test("manual saves mark only changed sources stale, explicit rebuild preserves deck identity", async t => {
  const { service } = await fixture(t);
  const created = await service.create({ requestId: "create", spec });
  const presentation = structuredClone(created.presentation);
  const target = presentation.slides[0];
  const title = target.elements.find(element => element.type === "text" && element.text === "Local Deck");
  assert.ok(title?.type === "text"); title.text = "Manual";
  const saved = await service.save({ deckId: presentation.id, expectedRevision: 1, requestId: "manual", presentation });
  assert.equal(saved.sources[target.id].stale, true);
  assert.equal(saved.sources[presentation.slides[1].id].stale, false);
  await assert.rejects(service.update({ deckId: presentation.id, slideId: target.id, expectedRevision: 2, requestId: "patch", contentPatch: { title: "Agent" } }), isCode("SLIDE_SOURCE_STALE"));
  const rebuilt = await service.update({ deckId: presentation.id, slideId: target.id, expectedRevision: 2, requestId: "rebuild", slideSpec: spec.slides[0], replaceManual: true });
  assert.equal(rebuilt.sources[target.id].stale, false);
  assert.equal(rebuilt.revision, 3);
});

test("failed writes leave the previous document intact; writer lock excludes a second service", async t => {
  const { service, repository, directory } = await fixture(t);
  const deck = await service.create({ requestId: "create", spec });
  const before = await readFile(join(directory, "decks", `${deck.presentation.id}.json`), "utf8");
  const write = repository.write.bind(repository);
  repository.write = async () => { throw new Error("simulated disk error"); };
  await assert.rejects(service.update({ deckId: deck.presentation.id, slideId: deck.presentation.slides[0].id, expectedRevision: 1, requestId: "fail", contentPatch: { title: "Changed" } }));
  assert.equal(await readFile(join(directory, "decks", `${deck.presentation.id}.json`), "utf8"), before);
  repository.write = write;
  const release = await repository.acquireWriter();
  await assert.rejects(new FileRepository(directory).acquireWriter(), isCode("SERVICE_ALREADY_RUNNING"));
  await release();
});

test("nonpersisted editor store never reads or writes legacy localStorage", async t => {
  const { service } = await fixture(t);
  const deck = await service.create({ requestId: "create", spec });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("Legacy storage accessed"); } } });
  try {
    const store = createEditorStore(deck.presentation, { persist: false });
    store.getState().updatePresentationTitle("Local editor");
    assert.equal(store.getState().presentation.title, "Local editor");
    store.getState().undo();
    assert.equal(store.getState().presentation.title, deck.presentation.title);
    await store.persist.rehydrate();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("authenticated loopback API, exact backup, ten real MCP stdio tools and the plan_deck prompt", async t => {
  const { service, directory } = await fixture(t);
  const connection = { url: "http://127.0.0.1:0", appUrl: "http://localhost:3000", token: "test-local-secret" };
  const server = createDeckHttpServer(service, connection);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  connection.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  await atomicWrite(join(directory, "connection.json"), connection);
  assert.equal((await fetch(`${connection.url}/health`)).status, 401);
  assert.equal((await fetch(`${connection.url}/health`, { headers: { Authorization: `Bearer ${connection.token}`, Origin: "http://evil.example" } })).status, 403);
  const deniedHost = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(`${connection.url}/health`, { headers: { Authorization: `Bearer ${connection.token}`, Host: "evil.example" } }, response => {
      response.resume(); response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject); request.end();
  });
  assert.equal(deniedHost, 403);
  const raw = ' {"state":{"presentation":"original inline images"},"version":4} ';
  const backup = await fetch(`${connection.url}/backups`, { method: "POST", headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json", Origin: connection.appUrl }, body: JSON.stringify({ raw }) });
  assert.equal(backup.headers.get("access-control-allow-origin"), connection.appUrl);
  const { backupId } = await backup.json();
  assert.equal(JSON.parse(await readFile(join(directory, "backups", `${backupId}.json`), "utf8")).raw, raw);
  const transport = new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "scripts/deck-mcp.ts"], cwd: resolve("."), env: { ...process.env as Record<string, string>, DECK_DATA_DIR: directory }, stderr: "pipe" });
  const client = new Client({ name: "deck-agent-test", version: "1" });
  t.after(() => client.close());
  await client.connect(transport);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ["list_layouts", "get_brand_styles", "create_deck", "get_deck", "add_slide", "update_slide", "preview_deck", "start_deck_run", "finish_deck", "get_deck_playbook"].sort());
  const playbook = await client.callTool({ name: "get_deck_playbook", arguments: {} });
  assert.notEqual(playbook.isError, true);
  assert.match(String((playbook.structuredContent as { playbook: string }).playbook), /Storyline \(approval point\)/);
  const prompts = await client.listPrompts();
  assert.deepEqual(prompts.prompts.map(prompt => prompt.name), ["plan_deck"]);
  const planned = await client.getPrompt({ name: "plan_deck", arguments: { brief: "Pitch untuk [Nama Klien]" } });
  const promptText = (planned.messages[0].content as { text: string }).text;
  assert.match(promptText, /WKND deck playbook/);
  assert.match(promptText, /Pitch untuk \[Nama Klien\]/);
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false, JSON.stringify(result.content));
    return result.structuredContent as Record<string, unknown>;
  }
  const catalog = await call("list_layouts", {});
  assert.equal((catalog.layouts as unknown[]).length, 31);
  const styles = await call("get_brand_styles", {});
  assert.equal(styles.fontFamily, "Plus Jakarta Sans");
  const created = await call("create_deck", { requestId: "stdio-create", spec });
  const slides = created.slides as { id: string }[];
  const updated = await call("update_slide", { deckId: created.deckId, slideId: slides[0].id, expectedRevision: 1, requestId: "stdio-update", contentPatch: { title: "Via MCP" } });
  assert.equal(updated.revision, 2);
  const fetched = await call("get_deck", { deckId: created.deckId });
  assert.equal(fetched.revision, 2);
  const preview = await call("preview_deck", { deckId: created.deckId, revision: 2 });
  assert.equal(new URL(String(preview.previewUrl)).pathname, "/preview");
  assert.equal(preview.screenshot, null);
  const added = await call("add_slide", { deckId: created.deckId, expectedRevision: 2, requestId: "stdio-add", slideSpec: spec.slides[1] });
  assert.equal(added.revision, 3);
  const invalid = await client.callTool({ name: "add_slide", arguments: { deckId: created.deckId, expectedRevision: 3, requestId: "unsupported", slideSpec: { layout: "wknd-image-split" } } });
  assert.equal(invalid.isError, true);
  assert.equal((invalid.structuredContent as { error: { code: string } }).error.code, "UNSUPPORTED_LAYOUT");
});
