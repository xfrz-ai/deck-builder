#!/usr/bin/env node
// A/B comparison of the two agent paths on the same briefs:
//   A  MCP tools + playbook (the "Create with AI" path today)
//   B  wknd-deck CLI + skill (the new path)
// Both run headless Claude Code (`claude -p`) with the user's own login, the
// same model and the same follow-up messages, against one throwaway deck
// service with its own data folder (.deck-compare), so the user's decks and
// the desktop app are untouched. Results go to .deck-compare/reports/<time>/.
//
//   node scripts/compare-agents.mjs [--briefs klinik,logistik] [--runs 3] [--paths A,B] [--model <id>]
//   node scripts/compare-agents.mjs --view      (serve .deck-compare to look at the decks)

import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { deckMcpServer } from "./deck-mcp-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(ROOT, ".deck-compare");
const PORT = Number(process.env.COMPARE_SERVICE_PORT ?? 8892);
const TURN_TIMEOUT_MS = 20 * 60_000;
const TSX_LOADER = resolve(ROOT, "node_modules/tsx/dist/loader.mjs");

const BRIEFS = {
  klinik: [
    "Tolong bikin deck proposal untuk Senyum Sehat, jaringan 14 klinik gigi di Jabodetabek. Mereka mau redesign aplikasi booking.",
    "Tujuan: direksi Senyum Sehat menyetujui fase discovery dan design selama 12 minggu.",
    "Audiens: direksi (CEO, COO, Head of Digital), tidak terlalu teknis, khawatir soal biaya dan gangguan ke operasional klinik.",
    "Konteks: aplikasi sekarang rating 2,9 di Play Store, 40% booking masih lewat WhatsApp admin, dan pasien sering lupa jadwal kontrol.",
    "Fakta: 14 klinik, 38 dokter, sekitar 9.000 booking per bulan. Harga belum ada, pakai placeholder. Tim kami: 1 project lead, 2 product designer, 1 UX researcher, 3 engineer.",
    "Format: sekitar 12 slide, bahasa Indonesia, dipresentasikan langsung.",
  ].join("\n"),
  logistik: [
    "Bikin deck project update bulan ini untuk KirimCepat, aplikasi kurir instan untuk UMKM. Kami sedang membangun aplikasi driver versi baru.",
    "Audiens: tim product dan operasional KirimCepat, sudah paham konteksnya.",
    "Tujuan: mereka setuju menunda fitur multi-drop ke fase berikutnya supaya launch tetap 15 Januari 2027.",
    "Progres: sprint 6 dari 8 selesai, onboarding driver dan navigasi sudah jadi, pembayaran COD masih uji coba, 23 bug terbuka (4 kritis).",
    "Risiko: integrasi peta dan izin lokasi di Android 14.",
    "Format: sekitar 9 slide, bahasa Indonesia, dikirim sebagai dokumen.",
  ].join("\n"),
};
// Sent in order while the run has not finished a deck yet.
const FOLLOW_UPS = [
  "Oke, setuju. Langsung build sekarang ya.",
  "Lanjut build sekarang dengan asumsi kamu, tidak perlu tanya lagi.",
];

const REPLY_RULES = "- Never paste Library, editor or preview links, and never print tokens; just say the deck is ready in the Library.\n- Write in the user's language. Keep replies short: plain text with simple numbered or bulleted lists, no tables or headings.";
const PROMPTS = {
  A: `You are the WKND deck agent.\n- Plan, write and build presentations only with the deck_builder tools. Call get_deck_playbook before planning a new deck and follow it: brief, one storyline approval, then write the copy and build live without asking again.\n- You have no file, shell or web access.\n${REPLY_RULES}`,
  B: `You are the WKND deck agent.\n- Plan, write and build presentations only with the wknd-deck command, which you run with the Bash tool. Use the wknd-deck skill before planning a new deck and follow it.\n- You have no other shell commands and no web access. You may write and edit JSON spec files in ./specs/ only.\n${REPLY_RULES}`,
};

// ---------------------------------------------------------------------------
// Deck service
// ---------------------------------------------------------------------------

async function startService({ appUrl } = {}) {
  await mkdir(DATA_DIR, { recursive: true });
  const child = spawn(process.execPath, ["--import", TSX_LOADER, resolve(ROOT, "scripts/deck-service.ts")], {
    cwd: ROOT,
    env: { ...process.env, DECK_DATA_DIR: DATA_DIR, DECK_SERVICE_PORT: String(PORT), TSX_TSCONFIG_PATH: resolve(ROOT, "tsconfig.json"), ...(appUrl ? { DECK_APP_URL: appUrl } : {}) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let log = "";
  child.stderr.on("data", (chunk) => { log += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((done) => setTimeout(done, 500));
    if (child.exitCode !== null) throw new Error(`The deck service stopped: ${log.trim()}`);
    try {
      const connection = JSON.parse(await readFile(join(DATA_DIR, "connection.json"), "utf8"));
      if (!connection.url.endsWith(`:${PORT}`)) continue;
      const health = await fetch(`${connection.url}/health`, { headers: { Authorization: `Bearer ${connection.token}` } });
      if (health.ok) return { child, connection };
    } catch { /* not up yet */ }
  }
  child.kill("SIGTERM");
  throw new Error(`The deck service did not start on port ${PORT}: ${log.trim()}`);
}

async function tool(connection, name, args = {}) {
  const response = await fetch(`${connection.url}/tools/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${connection.token}` },
    body: JSON.stringify(args),
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(`${name}: ${result.error?.message ?? response.status}`);
  return result;
}

// ---------------------------------------------------------------------------
// One agent conversation
// ---------------------------------------------------------------------------

async function workspace(path) {
  const dir = await mkdtemp(join(tmpdir(), `deck-compare-${path}-`));
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.ELECTRON_RUN_AS_NODE;
  env.DECK_DATA_DIR = DATA_DIR;
  if (path === "B") {
    await cp(resolve(ROOT, "skills/wknd-deck"), join(dir, ".claude/skills/wknd-deck"), { recursive: true });
    await mkdir(join(dir, "specs"));
    const bin = join(dir, "bin");
    await mkdir(bin);
    const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
    await writeFile(join(bin, "wknd-deck"), [
      "#!/bin/sh",
      `export DECK_DATA_DIR=${quote(DATA_DIR)}`,
      `export TSX_TSCONFIG_PATH=${quote(resolve(ROOT, "tsconfig.json"))}`,
      `exec ${quote(process.execPath)} --import ${quote(TSX_LOADER)} ${quote(resolve(ROOT, "scripts/wknd-deck.ts"))} "$@"`,
      "",
    ].join("\n"));
    await chmod(join(bin, "wknd-deck"), 0o755);
    env.PATH = `${bin}:${env.PATH}`;
  }
  return { dir, env };
}

function claudeArgs(path, { sessionId, model }) {
  const common = ["-p", "--output-format", "stream-json", "--verbose", "--setting-sources", "project", "--permission-mode", "dontAsk", "--strict-mcp-config"];
  const specific = path === "A"
    ? ["--tools", "", "--mcp-config", JSON.stringify({ mcpServers: { deck_builder: deckMcpServer(ROOT, DATA_DIR) } }), "--allowedTools", "mcp__deck_builder"]
    // Shell: only wknd-deck. Files: only the agent's own specs folder.
    : ["--tools", "Bash,Skill,Write,Edit,Read", "--allowedTools", "Skill", "Bash(wknd-deck *)", "Write(./specs/**)", "Edit(./specs/**)", "Read(./specs/**)"];
  return [
    ...common, ...specific,
    "--append-system-prompt", PROMPTS[path],
    ...(model ? ["--model", model] : []),
    ...(sessionId ? ["--resume", sessionId] : []),
  ];
}

const shortName = (name) => String(name).replace(/^mcp__deck_builder__/, "");
const textOf = (content) => typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part?.text ?? "").join("") : "";
const DECK_ID = /deck-[0-9a-f]{32}/;

function runTurn(path, message, state, options) {
  return new Promise((done) => {
    const child = spawn("claude", claudeArgs(path, { sessionId: state.sessionId, model: options.model }), { cwd: state.dir, env: state.env, stdio: ["pipe", "pipe", "pipe"] });
    const turn = { message, texts: [], calls: [], result: null, stderr: "", timedOut: false };
    const calls = new Map();
    const timer = setTimeout(() => { turn.timedOut = true; child.kill("SIGTERM"); }, TURN_TIMEOUT_MS);
    createInterface({ input: child.stdout }).on("line", (line) => {
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event.type === "system" && event.subtype === "init") {
        state.sessionId = event.session_id;
        state.model ??= event.model;
      } else if (event.type === "assistant") {
        for (const part of event.message?.content ?? []) {
          if (part.type === "text" && part.text?.trim()) turn.texts.push(part.text);
          if (part.type === "tool_use") {
            const call = { id: part.id, name: shortName(part.name), input: part.input, ok: null, output: "" };
            if (call.name === "Bash") call.label = String(part.input?.command ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
            else if (call.name === "Skill") call.label = `Skill(${part.input?.skill ?? part.input?.command ?? ""})`;
            else call.label = call.name;
            calls.set(part.id, call);
            turn.calls.push(call);
          }
        }
      } else if (event.type === "user") {
        for (const part of event.message?.content ?? []) {
          if (part.type !== "tool_result" || !calls.has(part.tool_use_id)) continue;
          const call = calls.get(part.tool_use_id);
          call.output = textOf(part.content);
          call.ok = !part.is_error && !/"ok":\s*false|^Error \(/m.test(call.output);
          const creates = call.name === "create_deck" || (call.name === "Bash" && /wknd-deck\s+deck\s+create/.test(String(call.input?.command)));
          if (creates && DECK_ID.test(call.output)) state.deckIds.add(call.output.match(DECK_ID)[0]);
        }
      } else if (event.type === "result") {
        turn.result = event;
        if (event.session_id) state.sessionId = event.session_id;
      }
    });
    child.stderr.on("data", (chunk) => { turn.stderr += chunk; });
    child.on("close", () => { clearTimeout(timer); done(turn); });
    child.on("error", (error) => { clearTimeout(timer); turn.stderr += error.message; done(turn); });
    child.stdin.end(message);
  });
}

async function deckStats(connection, deckId) {
  const deck = await tool(connection, "get_deck", { deckId });
  const layouts = deck.slides.map((slide) => slide.source?.spec.layout ?? "manual");
  const counts = layouts.reduce((map, layout) => map.set(layout, (map.get(layout) ?? 0) + 1), new Map());
  const texts = deck.slides.flatMap((slide) => slide.texts.map((item) => item.text));
  return {
    deckId,
    title: deck.title,
    status: deck.agentWork?.status ?? "none",
    slides: layouts.length,
    layouts,
    distinctLayouts: counts.size,
    maxReuse: Math.max(...counts.values()),
    adjacentRepeats: layouts.filter((layout, index) => index > 0 && layout === layouts[index - 1]).length,
    placeholders: [...new Set(texts.flatMap((text) => text.match(/\[[^\]\n]{1,40}\]/g) ?? []))],
  };
}

async function runConversation(connection, path, briefId, runIndex, options) {
  const { dir, env } = await workspace(path);
  const state = { dir, env, sessionId: null, model: null, deckIds: new Set() };
  const turns = [];
  const started = Date.now();
  const messages = [BRIEFS[briefId], ...FOLLOW_UPS];
  for (const message of messages) {
    const turn = await runTurn(path, message, state, options);
    turns.push(turn);
    const finished = await Promise.all([...state.deckIds].map((id) => tool(connection, "get_deck", { deckId: id }).catch(() => null)));
    if (finished.some((deck) => deck && deck.agentWork?.status !== "working")) break;
    if (turn.timedOut || (turn.result?.is_error && !turn.texts.length)) break;
  }
  await rm(dir, { recursive: true, force: true });
  const deckId = [...state.deckIds].at(-1);
  const calls = turns.flatMap((turn) => turn.calls);
  const sum = (pick) => turns.reduce((total, turn) => total + (Number(pick(turn.result ?? {})) || 0), 0);
  return {
    path, brief: briefId, run: runIndex, model: state.model,
    wallMs: Date.now() - started,
    userTurns: turns.length,
    agentSteps: sum((result) => result.num_turns),
    apiMs: sum((result) => result.duration_api_ms),
    costUsd: sum((result) => result.total_cost_usd),
    inputTokens: sum((result) => result.usage?.input_tokens),
    cacheReadTokens: sum((result) => result.usage?.cache_read_input_tokens),
    cacheWriteTokens: sum((result) => result.usage?.cache_creation_input_tokens),
    outputTokens: sum((result) => result.usage?.output_tokens),
    toolCalls: calls.length,
    toolErrors: calls.filter((call) => call.ok === false).length,
    permissionDenials: turns.flatMap((turn) => turn.result?.permission_denials ?? []).length,
    callsByName: calls.reduce((map, call) => ({ ...map, [call.label]: (map[call.label] ?? 0) + 1 }), {}),
    timedOut: turns.some((turn) => turn.timedOut),
    deck: deckId ? await deckStats(connection, deckId) : null,
    turns: turns.map((turn) => ({
      message: turn.message,
      texts: turn.texts,
      calls: turn.calls.map(({ label, input, ok, output }) => ({ label, input, ok, output: output.slice(0, 1200) })),
      error: turn.result?.is_error ? String(turn.result.result ?? "") : (turn.result ? null : turn.stderr.slice(0, 600)),
    })),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const minutes = (ms) => (ms / 60_000).toFixed(1);
const thousands = (count) => `${(count / 1000).toFixed(1)}k`;
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function report(runs, startedAt) {
  const row = (run) => `| ${run.path} | ${run.brief} #${run.run} | ${run.deck ? `${run.deck.slides} (${run.deck.status})` : "no deck"} | ${run.deck?.distinctLayouts ?? "–"} | ${run.deck?.maxReuse ?? "–"} | ${run.userTurns} | ${run.agentSteps} | ${run.toolCalls} | ${run.toolErrors} | ${run.permissionDenials} | ${minutes(run.wallMs)} | $${run.costUsd.toFixed(2)} | ${thousands(run.inputTokens + run.cacheReadTokens + run.cacheWriteTokens)} | ${thousands(run.outputTokens)} |`;
  const averages = ["A", "B"].filter((path) => runs.some((run) => run.path === path)).map((path) => {
    const own = runs.filter((run) => run.path === path);
    return `| ${path} | ${own.length} | ${own.filter((run) => run.deck?.status === "completed").length} | ${mean(own.map((run) => run.toolCalls)).toFixed(1)} | ${mean(own.map((run) => run.toolErrors)).toFixed(1)} | ${mean(own.map((run) => run.agentSteps)).toFixed(1)} | ${minutes(mean(own.map((run) => run.wallMs)))} | $${mean(own.map((run) => run.costUsd)).toFixed(2)} | ${thousands(mean(own.map((run) => run.inputTokens + run.cacheReadTokens + run.cacheWriteTokens)))} | ${thousands(mean(own.map((run) => run.outputTokens)))} | ${mean(own.map((run) => run.deck?.distinctLayouts ?? 0)).toFixed(1)} |`;
  });
  const details = runs.map((run) => [
    `### ${run.path} · ${run.brief} #${run.run}`,
    "",
    run.deck ? `Deck \`${run.deck.deckId}\` "${run.deck.title}", ${run.deck.slides} slides, ${run.deck.status}.` : "No deck was created.",
    run.deck ? `Layouts: ${run.deck.layouts.join(" → ")}` : "",
    run.deck?.placeholders.length ? `Placeholders: ${run.deck.placeholders.join(", ")}` : "",
    `Tool calls: ${Object.entries(run.callsByName).map(([name, count]) => `${name} ×${count}`).join(", ") || "none"}`,
    run.timedOut ? "**Timed out.**" : "",
    "",
    ...run.turns.map((turn, index) => `**User ${index + 1}:** ${turn.message.split("\n")[0]}${turn.message.includes("\n") ? " …" : ""}\n\n**Agent:** ${(turn.texts.at(-1) ?? "(no reply)").trim().replace(/\n/g, "\n> ").replace(/^/, "> ")}${turn.error ? `\n\n_Error: ${turn.error}_` : ""}`),
  ].filter((line) => line !== "").join("\n\n"));
  return [
    "# Agent comparison: MCP (A) vs CLI + skill (B)",
    "",
    `Started ${startedAt}. Model: ${[...new Set(runs.map((run) => run.model))].join(", ")}. A = MCP tools + playbook, B = wknd-deck CLI + skill.`,
    "",
    "## Averages",
    "",
    "| Path | Runs | Completed decks | Tool calls | Tool errors | Agent steps | Minutes | Cost | Input tokens | Output tokens | Distinct layouts |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...averages,
    "",
    "Input tokens include cache reads and writes. Cost is what Claude Code reports for the session.",
    "",
    "## Every run",
    "",
    "| Path | Brief | Slides | Distinct layouts | Max reuse | User turns | Agent steps | Tool calls | Tool errors | Denied | Minutes | Cost | Input tokens | Output tokens |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...runs.map(row),
    "",
    "## Details",
    "",
    ...details,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function view() {
  const appUrl = process.env.DECK_APP_URL ?? "http://localhost:3000";
  const { child, connection } = await startService({ appUrl });
  const url = new URL(appUrl);
  url.hash = new URLSearchParams({ service: connection.url, token: connection.token }).toString();
  console.log(`Serving .deck-compare on ${connection.url}. With \`npm run dev\` running, open:\n${url.href}\nPress Ctrl+C to stop.`);
  process.once("SIGINT", () => { child.kill("SIGTERM"); process.exit(0); });
}

async function main() {
  const { values } = parseArgs({ options: {
    briefs: { type: "string", default: Object.keys(BRIEFS).join(",") },
    runs: { type: "string", default: "3" },
    paths: { type: "string", default: "A,B" },
    model: { type: "string" },
    view: { type: "boolean" },
  } });
  if (values.view) return view();
  const briefs = values.briefs.split(",").filter((id) => BRIEFS[id]);
  const paths = values.paths.split(",").filter((path) => path === "A" || path === "B");
  const runs = Number(values.runs);
  if (!briefs.length || !paths.length || !Number.isInteger(runs) || runs < 1) throw new Error("Check --briefs, --paths and --runs.");

  const startedAt = new Date().toISOString();
  const outDir = join(DATA_DIR, "reports", startedAt.replace(/[:.]/g, "-"));
  await mkdir(outDir, { recursive: true });
  const { child, connection } = await startService();
  const results = [];
  try {
    for (const brief of briefs) {
      for (let run = 1; run <= runs; run++) {
        // A and B of the same brief and run go side by side, under the same conditions.
        console.log(`→ ${brief} #${run}: ${paths.join(" + ")}`);
        const pair = await Promise.all(paths.map((path) => runConversation(connection, path, brief, run, { model: values.model })));
        for (const result of pair) {
          results.push(result);
          console.log(`  ${result.path}: ${result.deck ? `${result.deck.slides} slides (${result.deck.status})` : "no deck"}, ${result.toolCalls} tool calls, ${result.toolErrors} errors, ${minutes(result.wallMs)} min, $${result.costUsd.toFixed(2)}`);
        }
        await writeFile(join(outDir, "runs.json"), JSON.stringify(results, null, 2));
        await writeFile(join(outDir, "report.md"), report(results, startedAt));
      }
    }
  } finally {
    child.kill("SIGTERM");
  }
  console.log(`Report: ${join(outDir, "report.md")}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
