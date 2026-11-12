#!/usr/bin/env node
// Local-only bridge between the deck editor's AI chat and Claude Code.
// It runs `claude -p` (headless) with your own Claude Code login, so no API
// key is needed. Listens on 127.0.0.1 only; never deploy this.
// The Library's "Create with AI" chat lives in ./deck-agent-chat.mjs.
//
//   npm run ai-bridge
//
// Optional env: AI_BRIDGE_PORT (default 8787), AI_BRIDGE_MODEL (e.g. "opus").

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claudeEnv, handleDeckAgentRequest } from "./deck-agent-chat.mjs";

const PORT = Number(process.env.AI_BRIDGE_PORT ?? 8787);
const MODEL = process.env.AI_BRIDGE_MODEL;
const TIMEOUT_MS = 180_000;
// A whole deck is a much longer answer than one slide.
const DECK_TIMEOUT_MS = 600_000;
const MAX_BODY_BYTES = 2_000_000;
const ALLOWED_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Claude runs in an empty folder so it never sees or touches this project.
const WORK_DIR = mkdtempSync(join(tmpdir(), "deck-ai-"));

const SHARED_RULES = `The layout is drawn by the editor from this data, so you only change text, structure and the listed fields.

General rules:
- Keep the id of every item that still exists. Give new items "id": null.
- Respect the limits in the data. If the instruction would break a limit, return "data": null, explain the limit in reply and suggest an alternative.
- Only change what the instruction asks for. Keep everything else exactly as it is.
- If the instruction is a question or unclear, answer or ask in reply and return "data": null.
- Write reply in the same language as the user, in one or two short sentences.
- When errors from a previous attempt are given, fix exactly those problems.
- Respond with only one JSON object, no markdown fences: {"reply": string, "data": null | <content>}`;

const PROMPTS = {
  team: `You edit the content of one "Our Team" slide in a presentation editor.

Team rules:
- At most limits.groups groups and limits.membersPerGroup members per group, at least one of each.
- Text must fit small cards: group names 1-3 words, descriptions under ~40 characters, roles under ~28 characters.
- When the user does not give names, use "Full Name" as the member name and a sensible role.
- Only org and tree variants have a leader; otherwise leader is null.

<content> shape:
{"leader": {"name": string, "role": string, "badge": string} | null, "groups": [{"id": string | null, "name": string, "description": string, "members": [{"id": string | null, "name": string, "role": string}]}]}

${SHARED_RULES}`,

  agenda: `You edit the content of one Agenda slide in a presentation editor.

Agenda rules:
- 1 to maxItems items.
- Which fields show depends on variant:
  - schedule: title (may use "\\n" for a second line), durationMinutes (whole minutes), kind ("session" or "break"); plus date (YYYY-MM-DD), location and startTime (HH:MM, 24h). All sessions must end before midnight. Short sessions only fit short titles.
  - chapters: title (one line) and page (page number as text, or "").
  - cards: title and description (one line each, description under ~40 characters).
  - spotlight: title and description; exactly one item has highlighted true.
- Keep fields the variant does not show as they are; for new items use description "", page "", durationMinutes 30, kind "session", highlighted false unless asked.

<content> shape:
{"date": string, "location": string, "startTime": string, "items": [{"id": string | null, "title": string, "description": string, "page": string, "durationMinutes": number, "kind": "session" | "break", "highlighted": boolean}]}

${SHARED_RULES}`,

  timeline: `You edit the content of one Timeline in a presentation editor.

Timeline rules:
- 1 to maxPhases phases, in chronological order.
- start and end are dates as YYYY-MM-DD, end on or after start.
- Which fields show depends on variant: bars shows only title and the dates; road, steps and roadmap show title (short, 1-3 words), a period label and description (fits two short lines, under ~60 characters).
- periodFormat ("weeks", "dates" or "months") controls the period label; only change it when asked.
- When moving or adding phases, keep the dates consistent with neighbouring phases.

<content> shape:
{"periodFormat": "weeks" | "dates" | "months", "phases": [{"id": string | null, "title": string, "description": string, "start": string, "end": string}]}

${SHARED_RULES}`,
};

const DECK_PROMPT = `You turn a source document into a Weekend (WKND) branded presentation, written as a deck spec for a deck builder.

The source is either Markdown or the text extracted from a PowerPoint file. PowerPoint text is listed per slide in reading order with its font size, e.g. "[31pt] Title". The largest text is usually the slide title and small uppercase text above it is usually an eyebrow label. "Notes:" are the speaker notes.

The catalog lists every layout you may use: its purpose, its content fields with item counts and estimated maxChars / maxLines, and an example. Layouts own all positions, colors and fonts; you only choose a layout per slide and fill its fields.

Rules:
- Use only layout ids and fields from the catalog. Match every list's item count exactly (minItems–maxItems).
- Text must fit. Treat maxChars as a hard ceiling and aim for about 85% of it. WKND titles are short and punchy: when a source title is too long, shorten it and move the rest into the subtitle or intro. Use "\\n" in titles to break lines on purpose.
- Keep the language of the source text. Mixed English and Indonesian stays mixed.
- Keep placeholders such as [Nama Klien], [TBD] or Rp [TBD] exactly as written. Never invent names, numbers, prices, dates, clients or testimonials.
- Leave image fields out; placeholder photos are used.
- Production notes in the source (e.g. "Fungsi", "Arahan visual", "Catatan", "Presenter cue", checklists, durations) are instructions, never slide content. Use "Arahan visual" and similar hints to choose layouts.
- Timeline layouts need dates. When the source only gives weeks or durations, start on the Monday after <today> and use periodFormat "weeks", so only relative weeks are shown.
- Vary the layouts: never use the same layout on two consecutive slides, and use any layout at most three times.
- Speaker notes are not supported; use them only to understand a slide.

Modes:
- "restyle": keep the source's slides, order and wording. Shorten only what does not fit. A source slide whose content has no fitting layout is mapped to the closest layout, split, or left out; say which in notes.
- "rewrite": you may restructure and condense into the strongest story, usually 12–20 slides, opening with a cover and closing with wknd-questions or wknd-thank-you. Keep the facts and placeholders of the source.

Respond with only one JSON object, no markdown fences:
{"notes": string[], "spec": {"version": 1, "title": string, "footer"?: {"left"?: string, "note"?: string}, "slides": [{"layout": string, "content": object}]}}

notes: 3–10 short lines for the person importing the deck, in the main language of the source: which source slides were merged, split or left out, which titles were shortened, and what they should fill in.

When <errors> are given, you receive your previous spec and the problems the deck builder found. Fix exactly those problems and respond with only the slides you changed, keyed by their index in slides:
{"notes": string[], "slides": {"<index>": {"layout": string, "content": object}}}`;

function buildDeckPrompt({ source, mode, catalog, today, spec, errors }) {
  const parts = [
    `<today>\n${today}\n</today>`,
    `<catalog>\n${JSON.stringify(catalog)}\n</catalog>`,
  ];
  if (spec && Array.isArray(errors) && errors.length > 0) {
    parts.push(
      `<previous_spec>\n${JSON.stringify(spec, null, 2)}\n</previous_spec>`,
      `<errors>\nThe deck builder found these problems:\n${errors.map((error) => `- ${error}`).join("\n")}\n</errors>`,
    );
  } else {
    parts.push(
      `<mode>\n${mode === "rewrite" ? "rewrite" : "restyle"}\n</mode>`,
      `<source name="${String(source.name).replace(/"/g, "")}" kind="${source.kind}">\n${source.text}\n</source>`,
    );
  }
  return parts.join("\n\n");
}

function buildPrompt({ instruction, history, data, previousAttempt, errors }) {
  const parts = [`<current_content>\n${JSON.stringify(data, null, 2)}\n</current_content>`];
  if (Array.isArray(history) && history.length > 0) {
    const lines = history.slice(-6).map((turn) => `${turn.role}: ${turn.text}`);
    parts.push(`<conversation>\n${lines.join("\n")}\n</conversation>`);
  }
  parts.push(`<instruction>\n${instruction}\n</instruction>`);
  if (previousAttempt && Array.isArray(errors) && errors.length > 0) {
    parts.push(
      `<previous_attempt>\n${JSON.stringify(previousAttempt, null, 2)}\n</previous_attempt>`,
      `<errors>\nThe editor rejected your previous attempt:\n${errors.map((error) => `- ${error}`).join("\n")}\n</errors>`,
    );
  }
  return parts.join("\n\n");
}

// The model is asked for bare JSON, but tolerate fences or stray text.
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Claude did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

function runClaude(systemPrompt, prompt, timeoutMs = TIMEOUT_MS) {
  const args = [
    "-p",
    "--output-format", "json",
    "--tools", "",
    "--strict-mcp-config",
    "--system-prompt", systemPrompt,
  ];
  if (MODEL) args.push("--model", MODEL);

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: WORK_DIR, env: claudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude took too long to answer."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error.code === "ENOENT"
        ? new Error("`claude` command not found. Install Claude Code and log in first.")
        : error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${(stderr || stdout).trim().slice(0, 500)}`));
        return;
      }
      try {
        const envelope = JSON.parse(stdout);
        if (envelope.is_error) throw new Error(envelope.result || "Claude returned an error.");
        if (typeof envelope.total_cost_usd === "number") {
          console.log(`  done in ${Math.round((envelope.duration_ms ?? 0) / 100) / 10}s`);
        }
        resolve(String(envelope.result ?? ""));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(prompt);
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  } else if (origin) {
    send(response, 403, { error: "Origin not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.url?.startsWith("/api/deck-agent/")) {
    // The deck agent can build decks, so refuse pages that reach this port
    // under another host name (DNS rebinding).
    if (![`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(request.headers.host ?? "")) {
      send(response, 403, { error: "Local Host header required." });
      return;
    }
    try {
      if (await handleDeckAgentRequest(request, response, readBody)) return;
    } catch (error) {
      console.error(`  ✗ ${error.message}`);
      if (!response.headersSent) send(response, 500, { error: error.message });
      return;
    }
  }
  if (request.method === "POST" && request.url === "/api/deck") {
    try {
      const payload = JSON.parse(await readBody(request));
      const isFix = Array.isArray(payload.errors) && payload.errors.length > 0;
      if (typeof payload.catalog !== "object" || (!isFix && (typeof payload.source?.text !== "string" || !payload.source.text.trim()))) {
        send(response, 400, { error: "catalog and source are required." });
        return;
      }
      console.log(isFix
        ? `→ [deck] fixing ${payload.errors.length} problem(s)`
        : `→ [deck] ${payload.mode ?? "restyle"} ${payload.source.name} (${payload.source.text.length} chars)`);
      const result = extractJson(await runClaude(DECK_PROMPT, buildDeckPrompt(payload), DECK_TIMEOUT_MS));
      send(response, 200, {
        notes: Array.isArray(result.notes) ? result.notes.filter((note) => typeof note === "string") : [],
        spec: result.spec ?? null,
        slides: result.slides ?? null,
      });
    } catch (error) {
      console.error(`  ✗ ${error.message}`);
      send(response, 500, { error: error.message });
    }
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/slide-chat") {
    send(response, 404, { error: "Not found." });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request));
    const systemPrompt = PROMPTS[payload.kind];
    if (!systemPrompt || typeof payload.instruction !== "string" || !payload.instruction.trim() || typeof payload.data !== "object") {
      send(response, 400, { error: "kind, instruction and data are required." });
      return;
    }
    console.log(`→ [${payload.kind}] ${payload.instruction.slice(0, 80)}${payload.errors ? " (retry)" : ""}`);
    const result = extractJson(await runClaude(systemPrompt, buildPrompt(payload)));
    send(response, 200, {
      reply: typeof result.reply === "string" ? result.reply : "",
      data: result.data ?? null,
    });
  } catch (error) {
    console.error(`  ✗ ${error.message}`);
    send(response, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI bridge ready on http://127.0.0.1:${PORT} (Claude Code headless)`);
});
