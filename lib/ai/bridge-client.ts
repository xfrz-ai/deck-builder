// The local bridge (scripts/ai-bridge.mjs) that runs Claude Code headless.
export const AI_BRIDGE_URL =
  process.env.NEXT_PUBLIC_AI_BRIDGE_URL ?? "http://127.0.0.1:8787";

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

export async function requestSlideEdit(
  request: SlideChatRequest,
  signal?: AbortSignal,
): Promise<SlideChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${AI_BRIDGE_URL}/api/slide-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("The AI bridge isn't running. Start it with `npm run ai-bridge` in a separate terminal.");
  }

  const body = (await response.json().catch(() => null)) as
    | { reply?: unknown; data?: unknown; error?: unknown }
    | null;
  if (!response.ok || !body) {
    throw new Error(typeof body?.error === "string" ? body.error : `AI bridge error (${response.status}).`);
  }
  return {
    reply: typeof body.reply === "string" ? body.reply : "",
    data: body.data ?? null,
  };
}
