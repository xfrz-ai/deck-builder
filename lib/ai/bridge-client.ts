// The local bridge (scripts/ai-bridge.mjs) that runs Claude Code headless.
export const AI_BRIDGE_URL =
  process.env.NEXT_PUBLIC_AI_BRIDGE_URL ?? "http://127.0.0.1:8787";

// The bridge only exists on your machine, so AI features are dev-only unless
// a bridge URL is configured explicitly.
export const AI_BRIDGE_ENABLED =
  process.env.NODE_ENV === "development" || Boolean(process.env.NEXT_PUBLIC_AI_BRIDGE_URL);

export type SlideChatKind = "team" | "agenda" | "timeline";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface SlideChatRequest {
  kind: SlideChatKind;
  instruction: string;
  history: ChatTurn[];
  // The slide content the AI may change, in the shape its prompt describes.
  data: unknown;
  // Set on a retry: what the AI proposed last time and why it didn't fit.
  previousAttempt?: unknown;
  errors?: string[];
}

export interface SlideChatResponse {
  reply: string;
  // The proposed content, or null when the AI answered without changes.
  data: unknown | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// Turns validation errors keyed by "<id>.<field>" into lines the AI can act
// on, naming the item each problem belongs to.
export function describeErrors(labels: ReadonlyMap<string, string>, errors: Record<string, string>) {
  return Object.entries(errors).map(([key, message]) => {
    const dot = key.lastIndexOf(".");
    const owner = dot === -1 ? key : key.slice(0, dot);
    const field = dot === -1 ? "" : ` ${key.slice(dot + 1)}`;
    return `${labels.get(owner) ?? owner}${field}: ${message}`;
  });
}

async function postToBridge(path: string, body: unknown, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${AI_BRIDGE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The AI bridge isn't running. Start it with `npm run ai-bridge` in a separate terminal.");
  }
  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.status === 404) {
    throw new Error("The AI bridge is out of date. Restart it with `npm run ai-bridge`.");
  }
  if (!response.ok || !result) {
    throw new Error(typeof result?.error === "string" ? result.error : `AI bridge error (${response.status}).`);
  }
  return result;
}

export interface DeckGenerationRequest {
  source?: { kind: "markdown" | "pptx"; name: string; text: string };
  mode?: "restyle" | "rewrite";
  catalog: unknown;
  today: string;
  // Set on a fix: the previous spec and the problems the builder found.
  spec?: unknown;
  errors?: string[];
}

export interface DeckGenerationResponse {
  notes: string[];
  // A whole spec on the first request; changed slides by index on a fix.
  spec: unknown | null;
  slides: Record<string, unknown> | null;
}

export async function requestDeckGeneration(request: DeckGenerationRequest, signal?: AbortSignal): Promise<DeckGenerationResponse> {
  const body = await postToBridge("/api/deck", request, signal);
  return {
    notes: Array.isArray(body.notes) ? body.notes.filter((note): note is string => typeof note === "string") : [],
    spec: body.spec ?? null,
    slides: isRecord(body.slides) ? body.slides : null,
  };
}

export async function requestSlideEdit(
  request: SlideChatRequest,
  signal?: AbortSignal,
): Promise<SlideChatResponse> {
  const body = await postToBridge("/api/slide-chat", request, signal);
  return {
    reply: typeof body.reply === "string" ? body.reply : "",
    data: body.data ?? null,
  };
}
