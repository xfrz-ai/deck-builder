// Argument parsing, help and output for the wknd-deck CLI. Commands return
// data plus a compact text rendering; --json prints the data instead.

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { CliError, DeckApi, RunStore } from "./api";
import { COMMANDS, type CommandDefinition, type CommandGroup } from "./commands";
import type { GuidePaths } from "./guide";

export interface CliIO {
  dataDir: string;
  guide: GuidePaths;
  stdout(text: string): void;
  stderr(text: string): void;
  readStdin(): Promise<string>;
  openUrl(url: string): Promise<void>;
}

const GROUPS: CommandGroup[] = ["Read", "Check", "Build and change"];
// Never printed: tokens and links that carry the local service token.
const SECRET_KEYS = new Set(["ownerToken", "token", "editorUrl", "previewUrl", "libraryUrl"]);

function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_KEYS.has(key)).map(([key, item]) => [key, withoutSecrets(item)]));
}

export function generalHelp() {
  // Long usages put their summary on the next line instead of widening every row.
  const width = 46;
  const row = (command: CommandDefinition) => command.usage.length < width - 2
    ? `  ${command.usage.padEnd(width)}${command.summary}`
    : `  ${command.usage}\n  ${"".padEnd(width)}${command.summary}`;
  return [
    "wknd-deck: build and revise WKND presentations in the Deck Builder.",
    "",
    "Usage: wknd-deck <command> [arguments] [--json]",
    "",
    ...GROUPS.flatMap(group => [
      `${group}:`,
      ...COMMANDS.filter(command => command.group === group).map(row),
      "",
    ]),
    "<deck> is a deck id. <slide> is a slide id or its number in the deck (1 = first).",
    "<spec> is inline JSON in single quotes, a file path, or - to read JSON from stdin.",
    "Add --json to any command for machine-readable output. Run `wknd-deck <command> --help` for details,",
    "and `wknd-deck guide` for how to work with the app.",
  ].join("\n");
}

export function commandHelp(command: CommandDefinition) {
  const options = Object.entries(command.options ?? {});
  return [
    `Usage: wknd-deck ${command.usage}`,
    "",
    command.summary + ".",
    ...(command.help ? ["", command.help] : []),
    ...(options.length ? ["", "Options:", ...options.map(([name, option]) => `  --${name}${option.type === "string" ? " <value>" : ""}`.padEnd(28) + option.description)] : []),
    "  --json".padEnd(28) + "Print machine-readable JSON",
  ].join("\n");
}

// The longest command name that the leading words spell, such as "slide add".
function findCommand(argv: string[]) {
  const words = argv.slice(0, 2).filter(word => !word.startsWith("-"));
  for (let count = words.length; count > 0; count--) {
    const name = words.slice(0, count).join(" ");
    const command = COMMANDS.find(item => item.name === name);
    if (command) return { command, rest: argv.slice(count) };
  }
  return undefined;
}

export async function runCli(argv: string[], io: CliIO): Promise<number> {
  const json = argv.includes("--json");
  try {
    const found = findCommand(argv);
    if (!found) {
      if (!argv.length || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") { io.stdout(generalHelp()); return 0; }
      const first = argv.filter(word => !word.startsWith("-")).slice(0, 2).join(" ");
      const near = COMMANDS.filter(command => command.name.startsWith(first.split(" ")[0])).map(command => command.name);
      throw new CliError("UNKNOWN_COMMAND", `Unknown command "${first}".${near.length ? ` Did you mean: ${near.join(", ")}?` : ""} Run \`wknd-deck --help\` for the list.`, [], 2);
    }
    const { command, rest } = found;
    let parsed: ReturnType<typeof parseArgs>;
    try {
      parsed = parseArgs({
        args: rest,
        allowPositionals: true,
        strict: true,
        options: {
          ...Object.fromEntries(Object.entries(command.options ?? {}).map(([name, option]) => [name, { type: option.type }])),
          json: { type: "boolean" },
          help: { type: "boolean", short: "h" },
        },
      });
    } catch (error) {
      throw new CliError("INVALID_ARGUMENTS", `${(error as Error).message.split("\n")[0]} Run \`wknd-deck ${command.name} --help\`.`, [], 2);
    }
    if (parsed.values.help) { io.stdout(commandHelp(command)); return 0; }
    const required = command.args.filter(arg => !arg.optional).length;
    const unlimited = command.args.at(-1)?.variadic;
    if (parsed.positionals.length < required || (!unlimited && parsed.positionals.length > command.args.length)) {
      throw new CliError("INVALID_ARGUMENTS", `Usage: wknd-deck ${command.usage}`, [], 2);
    }

    const result = await command.run({
      api: new DeckApi(io.dataDir),
      runs: new RunStore(io.dataDir),
      guide: io.guide,
      async readInput(source) {
        if (source === "-") return io.readStdin();
        try { return await readFile(source, "utf8"); }
        catch { throw new CliError("FILE_NOT_FOUND", `Could not read ${source}. Pass inline JSON in single quotes, a file path, or - to read JSON from stdin.`, [], 2); }
      },
      openUrl: io.openUrl,
      progress(line) { if (!json) io.stdout(line); },
    }, parsed.positionals, parsed.values as Record<string, string | boolean | undefined>);
    io.stdout(json ? JSON.stringify({ ok: result.exitCode ? false : true, ...withoutSecrets(result.data) as object }) : result.text);
    return result.exitCode ?? 0;
  } catch (caught) {
    const error = caught instanceof CliError ? caught : new CliError("INTERNAL_ERROR", caught instanceof Error ? caught.message : "Unexpected failure.");
    if (json) {
      io.stdout(JSON.stringify({ ok: false, error: { code: error.code, message: error.message, issues: error.issues } }));
    } else {
      const issues = error.issues.length && !error.message.includes("\n") ? ["", ...error.issues.map(issue => `  ${issue.path ? `${issue.path}: ` : ""}${issue.message}`)] : [];
      io.stderr([`Error (${error.code}): ${error.message}`, ...issues].join("\n"));
    }
    return error.exitCode;
  }
}
