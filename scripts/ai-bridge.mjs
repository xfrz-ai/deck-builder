#!/usr/bin/env node
// Local-only bridge between the deck editor's AI chat and Claude Code.
// It runs `claude -p` (headless) with your own Claude Code login, so no API
// key is needed. Listens on 127.0.0.1 only; never deploy this.
//
//   npm run ai-bridge
//
// Optional env: AI_BRIDGE_PORT (default 8787), AI_BRIDGE_MODEL (e.g. "opus").

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.AI_BRIDGE_PORT ?? 8787);
const MODEL = process.env.AI_BRIDGE_MODEL;
const TIMEOUT_MS = 180_000;
const MAX_BODY_BYTES = 1_000_000;
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

function runClaude(systemPrompt, prompt) {
  const args = [
    "-p",
    "--output-format", "json",
    "--tools", "",
    "--strict-mcp-config",
    "--system-prompt", systemPrompt,
  ];
  if (MODEL) args.push("--model", MODEL);

  // Allow starting the bridge from a terminal inside Claude Code.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: WORK_DIR, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude took too long to answer."));
    }, TIMEOUT_MS);

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
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
