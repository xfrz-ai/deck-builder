import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { FileRepository, atomicWrite } from "../lib/deck-service/file-repository";
import { DeckService } from "../lib/deck-service/deck-service";
import { DeckError } from "../lib/deck-service/deck-document";
import { createDeckHttpServer } from "../lib/deck-service/http-server";
import { runCli } from "../lib/deck-cli/cli";
import { COMMANDS } from "../lib/deck-cli/commands";
import { GUIDE_TOPICS } from "../lib/deck-cli/guide";
import { getDeckSpecCatalog } from "../lib/deck-spec/layout-catalog";

const deck = { version: 1 as const, title: "CLI test", slides: [
  { layout: "wknd-cover-brand", content: { title: "Kopi" } },
  { layout: "wknd-full-text-statement", content: { title: "Loyal,\ntapi lelah.", columns: [{ body: "Satu." }, { body: "Dua." }, { body: "Tiga [X]." }] } },
  { layout: "wknd-thank-you", content: { subtitle: "Terima kasih." } },
] };
const isCode = (code: string) => (error: unknown) => error instanceof DeckError && error.code === code;

async function repository(t: { after: (fn: () => unknown) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "deck-cli-test-"));
  const repo = new FileRepository(directory);
  await repo.initialize();
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, repo };
}

// A deck service on a free loopback port, plus a CLI runner that captures output.
async function serve(t: { after: (fn: () => unknown) => void }, directory: string, service: DeckService) {
  const connection = { url: "http://127.0.0.1:0", appUrl: "http://localhost:3000", token: "cli-test-secret-token" };
  const server = createDeckHttpServer(service, connection);
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  connection.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }));
  await atomicWrite(join(directory, "connection.json"), connection);
  return async (args: string[], stdin = "") => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(args, {
      dataDir: directory,
      guide: { skillDir: resolve("skills/wknd-deck"), playbook: resolve("docs/agent-guide/playbook.md") },
      stdout: text => { out.push(text); },
      stderr: text => { err.push(text); },
      readStdin: async () => stdin,
      openUrl: async () => undefined,
    });
    return { code, out: out.join("\n"), err: err.join("\n") };
  };
}

test("service: move, duplicate, delete and deck settings keep sources revisable", async t => {
  const { repo } = await repository(t);
  const service = new DeckService(repo);
  const created = await service.create({ requestId: "create", spec: deck });
  const deckId = created.presentation.id;
  const [cover, statement, closing] = created.presentation.slides.map(slide => slide.id);

  const moved = await service.moveSlide({ deckId, expectedRevision: 1, requestId: "move", slideId: closing });
  assert.deepEqual(moved.presentation.slides.map(slide => slide.id), [closing, cover, statement]);
  const back = await service.moveSlide({ deckId, expectedRevision: 2, requestId: "back", slideId: closing, afterSlideId: statement });
  assert.deepEqual(back.presentation.slides.map(slide => slide.id), [cover, statement, closing]);
  await assert.rejects(service.moveSlide({ deckId, expectedRevision: 3, requestId: "self", slideId: cover, afterSlideId: cover }), isCode("INVALID_MOVE"));

  const duplicated = await service.duplicateSlide({ deckId, expectedRevision: 3, requestId: "duplicate", slideId: statement });
  const copy = duplicated.presentation.slides[2];
  assert.notEqual(copy.id, statement);
  assert.deepEqual(duplicated.sources[copy.id].spec, duplicated.sources[statement].spec);
  assert.equal(duplicated.sources[copy.id].stale, false);
  const revised = await service.update({ deckId, expectedRevision: 4, requestId: "revise-copy", slideId: copy.id, contentPatch: { title: "Setia,\ntapi lelah." } });
  assert.equal(revised.sources[statement].spec.content?.title, "Loyal,\ntapi lelah.");

  const removed = await service.removeSlide({ deckId, expectedRevision: 5, requestId: "remove", slideId: copy.id });
  assert.equal(removed.presentation.slides.length, 3);
  assert.equal(Object.hasOwn(removed.sources, copy.id), false);

  const themed = await service.updateSettings({ deckId, expectedRevision: 6, requestId: "theme", title: "Baru", theme: "yellow", footer: { note: "Rahasia" } });
  assert.equal(themed.presentation.title, "Baru");
  assert.deepEqual(themed.defaults, { theme: "yellow", footer: { note: "Rahasia" } });
  assert.ok(themed.presentation.slides.every(slide => slide.themeId === "yellow"));
  assert.ok(Object.values(themed.sources).every(source => !source.stale), "Rebuilt template slides stay revisable.");
  const plain = await service.updateSettings({ deckId, expectedRevision: 7, requestId: "plain", theme: "none" });
  assert.deepEqual(plain.defaults, { footer: { note: "Rahasia" } });

  const single = await service.create({ requestId: "single", spec: { slides: [deck.slides[0]] } });
  await assert.rejects(service.removeSlide({ deckId: single.presentation.id, expectedRevision: 1, requestId: "last", slideId: single.presentation.slides[0].id }), isCode("LAST_SLIDE"));
});

test("service: check reports every problem without saving, layout usage counts recent decks", async t => {
  const { repo } = await repository(t);
  const service = new DeckService(repo);
  assert.deepEqual(service.check(deck), { valid: true, kind: "deck", slideCount: 3, errors: [], warnings: [] });
  const broken = service.check({ ...deck, slides: [{ layout: "nope", content: {} }, { layout: "wknd-cover-brand", content: { title: "W".repeat(40) } }] });
  assert.equal(broken.valid, false);
  assert.deepEqual(broken.errors.map(error => error.path), ["slides[0].layout", "slides[1].content.title"]);
  const slide = service.check({ layout: "wknd-cover-brand", content: { title: "W".repeat(40) } });
  assert.equal(slide.kind, "slide");
  assert.equal(slide.errors[0].path, "content.title");
  assert.equal(service.check({ slides: [], extra: true }).valid, false);
  assert.deepEqual(await repo.ids(), [], "check never saves.");

  await service.create({ requestId: "a", spec: deck });
  await service.create({ requestId: "b", spec: { slides: [deck.slides[0], deck.slides[2]] } });
  const usage = await service.layoutUsage();
  assert.equal(usage.decks, 2);
  assert.deepEqual(usage.layouts[0], { layout: "wknd-cover-brand", decks: 2, slides: 2 });
  assert.ok(usage.unused.includes("wknd-cover-star"));
  assert.equal((await service.layoutUsage({ decks: 1 })).decks, 1);
});

test("cli: live build checks first, then saves slide by slide and never prints secrets", async t => {
  const { directory, repo } = await repository(t);
  const cli = await serve(t, directory, new DeckService(repo));

  const broken = await cli(["deck", "create", "-", "--live"], JSON.stringify({ ...deck, slides: [deck.slides[0], { layout: "wknd-nope", content: {} }] }));
  assert.equal(broken.code, 1);
  assert.match(broken.err, /CHECK_FAILED/);
  assert.match(broken.err, /slide 2 \(wknd-nope\) · layout: Unknown layout "wknd-nope"\. Run `wknd-deck layouts`/);
  assert.deepEqual(await repo.ids(), [], "A failed check saves nothing.");

  const built = await cli(["deck", "create", "-", "--live"], JSON.stringify(deck));
  assert.equal(built.code, 0, built.err);
  assert.match(built.out, /3\/3  wknd-thank-you/);
  const [deckId] = await repo.ids();
  const document = await repo.read(deckId);
  assert.equal(document.agentWork?.status, "completed");
  assert.equal(document.presentation.slides.length, 3);
  assert.deepEqual(await readdir(join(directory, "agent-runs")), [], "Finished runs drop their token.");

  const shown = await cli(["deck", "show", deckId]);
  assert.match(shown.out, /  2  slide-[0-9a-f]{8}  wknd-full-text-statement   Loyal, \/ tapi lelah\./);
  assert.match(shown.out, /Placeholders:\n  slide 2: \[X\]/);
  for (const args of [["deck", "show", deckId, "--json"], ["slide", "show", deckId, "1", "--json"], ["decks", "--json"]]) {
    const { out } = await cli(args);
    assert.doesNotMatch(out, /token|editorUrl|libraryUrl|previewUrl|cli-test-secret/i, args.join(" "));
    assert.equal(JSON.parse(out).ok, true);
  }
});

test("cli: slides by number or short id, guarded deletes, and revisions handled for the agent", async t => {
  const { directory, repo } = await repository(t);
  const service = new DeckService(repo);
  const cli = await serve(t, directory, service);
  const created = await service.create({ requestId: "create", spec: deck });
  const deckId = created.presentation.id;
  const ids = created.presentation.slides.map(slide => slide.id);

  // Inline JSON works where agent permission rules block heredocs and pipes.
  const inline = await cli(["check", JSON.stringify(deck.slides[0], null, 2)]);
  assert.equal(inline.code, 0, inline.err);
  assert.match(inline.out, /OK: valid slide spec\./);
  const several = await cli(["layouts", "show", "wknd-cover-brand", "wknd-thank-you"]);
  assert.match(several.out, /^wknd-cover-brand — [\s\S]*\n\nwknd-thank-you — /);
  const unknown = await cli(["layouts", "show", "wknd-cover-brand", "wknd-nope"]);
  assert.match(unknown.err, /Unknown template: wknd-nope/);

  // Templates by look: "two columns, text and a photo".
  const byShape = await cli(["layouts", "--shape", "two-column"]);
  assert.equal(byShape.code, 0, byShape.err);
  assert.match(byShape.out, /wknd-image-text-photo .*\[text-image, two-column\]/);
  assert.match(byShape.out, /wknd-image-two-studies/);
  assert.doesNotMatch(byShape.out, /wknd-cover-brand/);
  const all = await cli(["layouts"]);
  assert.match(all.out, /Shapes \(filter with --shape <shape>\):\n {2}text-image/);
  const badShape = await cli(["layouts", "--shape", "hexagon"]);
  assert.equal(badShape.code, 2);
  assert.match(badShape.err, /Unknown shape "hexagon"\. Shapes: text-image, /);
  const none = await cli(["layouts", "--category", "cover", "--shape", "numbers"]);
  assert.equal(none.code, 0, none.err);
  assert.match(none.out, /No cover template has the shape "numbers"/);
  const counts = await cli(["layouts", "show", "wknd-full-text-statement"]);
  assert.match(counts.out, /columns +0, 2 or 3 items/);

  const patched = await cli(["slide", "update", deckId, "2", "--patch", JSON.stringify({ title: "Setia,\ntapi lelah." })]);
  assert.equal(patched.code, 0, patched.err);
  assert.equal((await repo.read(deckId)).sources[ids[1]].spec.content?.title, "Setia,\ntapi lelah.");

  // A browser save in between does not make the agent's next command fail.
  const current = await service.get(deckId);
  await service.save({ deckId, expectedRevision: current.revision, requestId: "browser", presentation: current.presentation });
  const moved = await cli(["slide", "move", deckId, ids[2].slice(0, 14), "--first"]);
  assert.equal(moved.code, 0, moved.err);
  assert.deepEqual((await repo.read(deckId)).presentation.slides.map(slide => slide.id), [ids[2], ids[0], ids[1]]);

  const refused = await cli(["slide", "delete", deckId, "1"]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /CONFIRMATION_REQUIRED/);
  const deleted = await cli(["slide", "delete", deckId, "1", "--yes"]);
  assert.equal(deleted.code, 0, deleted.err);
  assert.equal((await repo.read(deckId)).presentation.slides.length, 2);

  const added = await cli(["slide", "add", deckId, "-", "--after", "1", "--json"], JSON.stringify(deck.slides[2]));
  assert.equal(JSON.parse(added.out).slide.number, 2);
  const missing = await cli(["slide", "update", deckId, "9", "--patch", "{}"]);
  assert.match(missing.err, /no slide 9/);
  const invalid = await cli(["check", "-"], "{oops");
  assert.equal(invalid.code, 2);
  assert.match(invalid.err, /INVALID_JSON/);
});

test("cli: open live runs belong to their agent, and interrupted runs are taken over safely", async t => {
  const { directory, repo } = await repository(t);
  const cli = await serve(t, directory, new DeckService(repo));
  const opened = await cli(["deck", "create", "-", "--live", "--planned", "3"], JSON.stringify({ ...deck, slides: [deck.slides[0]] }));
  assert.equal(opened.code, 0, opened.err);
  assert.match(opened.out, /stays open: 2 more slides planned/);
  const [deckId] = await repo.ids();
  const [runFile] = await readdir(join(directory, "agent-runs"));

  // Without the stored token this CLI is just another agent.
  await rm(join(directory, "agent-runs", runFile));
  const busy = await cli(["slide", "add", deckId, "-"], JSON.stringify(deck.slides[2]));
  assert.match(busy.err, /DECK_BUSY/);

  // A restarted service interrupts the run; the next command starts a fresh one.
  const restarted = await serve(t, directory, new DeckService(new FileRepository(directory)));
  const takenOver = await restarted(["slide", "add", deckId, "-"], JSON.stringify(deck.slides[2]));
  assert.equal(takenOver.code, 0, takenOver.err);
  const document = await repo.read(deckId);
  assert.equal(document.presentation.slides.length, 2);
  assert.equal(document.agentWork?.status, "completed", "A run started only for one change is closed again.");
});

test("cli: help lists every command, and the skill's command table matches the registry", async () => {
  const out: string[] = [];
  const io = { dataDir: tmpdir(), guide: { skillDir: resolve("skills/wknd-deck"), playbook: resolve("docs/agent-guide/playbook.md") }, stdout: (text: string) => { out.push(text); }, stderr: () => undefined, readStdin: async () => "", openUrl: async () => undefined };
  assert.equal(await runCli(["--help"], io), 0);
  for (const command of COMMANDS) assert.ok(out[0].includes(command.usage), command.name);
  assert.equal(await runCli(["guide", "storytelling"], io), 0);
  assert.match(out[1], /^## 2\. Storytelling/);
  assert.doesNotMatch(out[1], /## 3\. Copywriting/);
  const { skillCommandTable } = await import("../scripts/sync-skill-commands");
  const skill = await import("node:fs/promises").then(fs => fs.readFile("skills/wknd-deck/SKILL.md", "utf8"));
  assert.ok(skill.includes(skillCommandTable()), "Run `npm run skill:sync` to update the command table in SKILL.md.");
});

test("cli: a slide edited by hand is shown as manual and only replaced with --replace-manual; open opens the editor", async t => {
  const { directory, repo } = await repository(t);
  const service = new DeckService(repo);
  const cli = await serve(t, directory, service);
  const created = await service.create({ requestId: "create", spec: deck });
  const deckId = created.presentation.id;

  // The user changes a column of slide 2 in the editor.
  const presentation = structuredClone(created.presentation);
  const column = presentation.slides[1].elements.find(element => element.type === "text" && element.text === "Satu.");
  assert.ok(column?.type === "text");
  column.text = "Diedit tangan.";
  await service.save({ deckId, expectedRevision: created.revision, requestId: "browser-edit", presentation });

  const shown = await cli(["deck", "show", deckId]);
  assert.match(shown.out, /\n {2}2 .*\(manual\)/);
  const slide = await cli(["slide", "show", deckId, "2"]);
  assert.match(slide.out, /manual: edited by hand[\s\S]*Diedit tangan\./);
  const refused = await cli(["slide", "update", deckId, "2", "--patch", JSON.stringify({ title: "Baru." })]);
  assert.notEqual(refused.code, 0);
  assert.match(refused.err, /Slide 2 was edited by hand[\s\S]*wknd-deck slide update deck-\S+ 2 --spec '<complete slide spec>' --replace-manual/);
  assert.doesNotMatch(refused.err, /slideSpec|replaceManual/);
  const patchOnly = await cli(["slide", "update", deckId, "2", "--patch", JSON.stringify({ title: "Baru." }), "--replace-manual"]);
  assert.match(patchOnly.err, /--replace-manual needs a complete --spec/);
  const replaced = await cli(["slide", "update", deckId, "2", "--spec", JSON.stringify(deck.slides[1]), "--replace-manual"]);
  assert.equal(replaced.code, 0, replaced.err);
  assert.doesNotMatch((await cli(["deck", "show", deckId])).out, /\(manual\)/);

  const opened = await cli(["open", deckId]);
  assert.equal(opened.code, 0, opened.err);
  assert.match(opened.out, /Opened deck-/);

  // Finishing a live build with slides missing points to --partial.
  const live = await cli(["deck", "create", JSON.stringify({ ...deck, slides: [deck.slides[0]] }), "--live", "--planned", "3"]);
  assert.equal(live.code, 0, live.err);
  const liveId = /deck-[0-9a-f]+/.exec(live.out)![0];
  assert.match(live.out, /wknd-deck slide add deck-\S+ '<slide spec>'/);
  const early = await cli(["deck", "finish", liveId]);
  assert.match(early.err, /The plan is 3 slides, but 1 are saved\. .*wknd-deck deck finish deck-\S+ --partial/);
  assert.equal((await cli(["deck", "finish", liveId, "--partial"])).code, 0);

  // A title with more lines than its box says so, instead of a character count.
  const lines = await cli(["check", JSON.stringify({ layout: "wknd-stats", content: { title: "Dua\nbaris", stats: [{ value: "1", label: "A" }, { value: "2", label: "B" }] } })]);
  assert.match(lines.out + lines.err, /Too many lines for this layout: only 1 line fits, and the text has 2/);
});

// The skill is the agent's contract: every command, option, guide topic,
// shape and template it names has to exist, or the agent plans with
// something the CLI refuses.
test("skill: SKILL.md and the playbook only name commands, options, topics, shapes and templates that exist", async () => {
  const { readFile } = await import("node:fs/promises");
  const skill = (await readFile("skills/wknd-deck/SKILL.md", "utf8"))
    .replace(/<!-- commands:start[\s\S]*<!-- commands:end -->/, "");
  const playbook = await readFile("docs/agent-guide/playbook.md", "utf8");
  const catalog = getDeckSpecCatalog();
  const layoutIds = new Set(catalog.layouts.map(layout => layout.id));
  const names = new Set(COMMANDS.map(command => command.name));
  const firstWords = new Set(COMMANDS.map(command => command.name.split(" ")[0]));

  // Inline code spans, and the lines of sh code blocks.
  const snippets = [
    ...[...skill.matchAll(/```sh\n([\s\S]*?)```/g)].flatMap(match => match[1].split("\n")),
    ...[...skill.replace(/```[\s\S]*?```/g, "").matchAll(/`([^`\n]+)`/g)].map(match => match[1]),
  ].map(text => text.trim()).filter(Boolean);

  let checked = 0;
  for (const snippet of snippets) {
    const prefixed = snippet.startsWith("wknd-deck");
    const words = snippet.replace(/^wknd-deck\s*/, "").split(/\s+/).filter(Boolean);
    if (!words.length || words[0].startsWith("<")) continue;
    // Two lowercase words read as a command, such as `element list`.
    if (!prefixed && !firstWords.has(words[0]) && !/^[a-z]+ [a-z]+/.test(snippet)) continue;
    const name = names.has(`${words[0]} ${words[1]}`) ? `${words[0]} ${words[1]}` : words[0];
    const command = COMMANDS.find(item => item.name === name);
    assert.ok(command, `SKILL.md names "wknd-deck ${words.join(" ")}", which is not a command.`);
    checked++;
    const rest = words.slice(name.split(" ").length);
    for (const [index, word] of rest.entries()) {
      if (!word.startsWith("--")) continue;
      const option = word.slice(2);
      assert.ok(option === "json" || option === "help" || Object.hasOwn(command.options ?? {}, option), `SKILL.md uses ${word} on "${name}", which has no such option.`);
      if (option === "shape" && rest[index + 1] && !rest[index + 1].startsWith("<")) assert.ok(rest[index + 1] in catalog.shapes, `Unknown shape ${rest[index + 1]}.`);
    }
    if (name === "guide") for (const topic of rest.filter(word => /^[a-z-]+$/.test(word))) assert.ok((GUIDE_TOPICS as readonly string[]).includes(topic), `SKILL.md names guide topic "${topic}", which does not exist.`);
  }
  assert.ok(checked > 20, `Only ${checked} commands were found in SKILL.md; the parser is probably broken.`);

  // Every guide topic in the references table exists, and every topic is listed.
  const tableTopics = [...skill.slice(skill.indexOf("## 7. References")).matchAll(/^\| `([a-z-]+)` \|/gm)].map(match => match[1]);
  assert.deepEqual(tableTopics.sort(), [...GUIDE_TOPICS].sort());

  for (const [file, text] of [["SKILL.md", skill], ["playbook.md", playbook]]) {
    for (const [, id] of text.matchAll(/"layout":\s*"([^"<]+)"/g)) assert.ok(layoutIds.has(id), `${file} uses layout "${id}" in an example, which is not in the catalog.`);
    for (const [id] of text.matchAll(/\bwknd-[a-z0-9-]+/g)) {
      if (id === "wknd-deck") continue;
      assert.ok(layoutIds.has(id), `${file} names template ${id}, which is not in the catalog.`);
    }
  }
});
