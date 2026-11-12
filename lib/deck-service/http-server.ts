import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DeckService, hash } from "./deck-service";
import { DeckError, errorResult, type DeckSnapshot } from "./deck-document";
import { idSchema, revisionSchema, saveSchema, createSchema, startWorkSchema, deleteSchema } from "./schemas";
import { localUrl, type LocalConnection } from "./connection";

const MAX_BODY = 32 * 1024 * 1024;
async function body(request: IncomingMessage) {
  if (!request.headers["content-type"]?.startsWith("application/json")) throw new DeckError("CONTENT_TYPE", "Use application/json.", 415);
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new DeckError("BODY_TOO_LARGE", "The local deck request exceeds 32 MiB.", 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new DeckError("INVALID_JSON", "Request body must be JSON."); }
}

export function deckLinks(connection: LocalConnection, deckId: string) {
  const fragment = new URLSearchParams({ service: connection.url, token: connection.token });
  return {
    editorUrl: `${connection.appUrl}/editor?deckId=${encodeURIComponent(deckId)}&follow=1#${fragment}`,
    previewUrl: `${connection.appUrl}/preview?deckId=${encodeURIComponent(deckId)}#${fragment}`,
    libraryUrl: `${connection.appUrl}/#${fragment}`,
  };
}
function toolSummary(document: DeckSnapshot, connection: LocalConnection) {
  return {
    ok: true, deckId: document.presentation.id, revision: document.revision, title: document.presentation.title,
    slides: document.presentation.slides.map(slide => {
      const source = Object.hasOwn(document.sources, slide.id) ? document.sources[slide.id] : undefined;
      return { id: slide.id, layout: source?.spec.layout ?? null, manuallyEdited: !source || source.stale };
    }),
    validation: document.validation, warnings: document.warnings, agentWork: document.agentWork, ...deckLinks(connection, document.presentation.id),
  };
}

export function createDeckHttpServer(service: DeckService, connection: LocalConnection) {
  const allowedOrigins = new Set([localUrl(connection.appUrl), localUrl(connection.url)]);
  const streams = new Set<ServerResponse>();
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Type", "application/json");
    const send = (status: number, result: unknown) => { response.writeHead(status); response.end(JSON.stringify(result)); };
    try {
      const expectedPort = (response.socket?.address() as { port?: number })?.port;
      if (![ `127.0.0.1:${expectedPort}`, `localhost:${expectedPort}` ].includes(request.headers.host ?? "")) throw new DeckError("HOST_DENIED", "Local Host header required.", 403);
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) throw new DeckError("ORIGIN_DENIED", "Origin is not allowed.", 403);
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Last-Event-ID");
        send(204, undefined); return;
      }
      const supplied = Buffer.from(request.headers.authorization ?? "");
      const expected = Buffer.from(`Bearer ${connection.token}`);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new DeckError("UNAUTHORIZED", "A local service token is required.", 401);
      const url = new URL(request.url ?? "/", connection.url);
      const parts = url.pathname.split("/").filter(Boolean);
      if (request.method === "GET" && (url.pathname === "/events" || (parts[0] === "decks" && parts.length === 3 && parts[2] === "events"))) {
        const library = url.pathname === "/events";
        const deckId = library ? "*" : idSchema.parse(parts[1]);
        const revision = library ? 1 : (await service.get(deckId)).revision;
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("X-Accel-Buffering", "no");
        response.flushHeaders();
        const write = (event: import("./event-types").DeckEvent) => {
          if (response.destroyed || response.writableEnded) return;
          if (response.writableLength > 256 * 1024) { response.destroy(); return; }
          response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        };
        const cursor = typeof request.headers["last-event-id"] === "string" ? request.headers["last-event-id"] : undefined;
        const subscription = service.events.subscribe(deckId, cursor, write);
        // Every connection requests an authoritative fetch. Commits racing the
        // initial read are recovered by that fetch and the now-active subscription.
        write(service.events.sync(library ? "library" : deckId, revision, subscription.reset));
        subscription.replay.forEach(write);
        streams.add(response);
        const heartbeat = setInterval(() => {
          if (response.writableLength > 256 * 1024) response.destroy();
          else response.write(": heartbeat\n\n");
        }, 15_000);
        heartbeat.unref();
        const cleanup = () => { clearInterval(heartbeat); subscription.close(); streams.delete(response); };
        response.once("close", cleanup);
        response.once("error", cleanup);
        return;
      }
      if (request.method === "GET" && url.pathname === "/health") { send(200, { ok: true, validation: "estimated" }); return; }
      if (request.method === "GET" && url.pathname === "/decks") { send(200, { ok: true, ...await service.list() }); return; }
      if (request.method === "GET" && parts[0] === "decks" && parts.length === 3 && parts[2] === "cover") {
        send(200, { ok: true, slide: (await service.get(idSchema.parse(parts[1]))).presentation.slides[0] }); return;
      }
      if (request.method === "POST" && url.pathname === "/backups") {
        const payload = z.object({ raw: z.string().max(MAX_BODY) }).strict().parse(await body(request));
        send(200, { ok: true, ...await service.repository.backup(payload.raw) }); return;
      }
      if (parts[0] === "decks" && parts.length === 2) {
        const deckId = idSchema.parse(parts[1]);
        if (request.method === "GET") { send(200, { ok: true, document: await service.get(deckId) }); return; }
        if (request.method === "PUT") {
          const payload = saveSchema.parse(await body(request));
          if (payload.deckId !== deckId) throw new DeckError("DECK_ID_MISMATCH", "Deck ID must match the URL.");
          send(200, { ok: true, document: await service.save(payload) }); return;
        }
        if (request.method === "DELETE") {
          const payload = deleteSchema.parse(await body(request));
          if (payload.deckId !== deckId) throw new DeckError("DECK_ID_MISMATCH", "Deck ID must match the URL.");
          send(200, { ok: true, ...await service.remove(payload) }); return;
        }
      }
      if (request.method === "POST" && parts[0] === "tools" && parts.length === 2) {
        const args = await body(request);
        let result: unknown;
        switch (parts[1]) {
          case "list_layouts": {
            const parsed = z.object({ category: z.string().optional(), layoutId: z.string().optional() }).strict().parse(args);
            result = { ok: true, ...service.layouts(parsed.category, parsed.layoutId) }; break;
          }
          case "get_brand_styles":
            z.object({}).strict().parse(args);
            result = { ok: true, ...service.brand() }; break;
          case "create_deck": {
            const parsed = createSchema.parse(args);
            const ownerToken = createHmac("sha256", connection.token).update(`create:${parsed.requestId}`).digest("hex");
            const document = await service.create(parsed, ownerToken);
            result = { ...toolSummary(document, connection), ...(parsed.live && document.agentWork?.id === `run-${hash(parsed.requestId).slice(0, 32)}` ? { ownerToken } : {}) }; break;
          }
          case "start_deck_run": {
            const parsed = startWorkSchema.parse(args);
            const ownerToken = createHmac("sha256", connection.token).update(`start:${parsed.requestId}`).digest("hex");
            const document = await service.startWork(parsed, ownerToken);
            result = { ...toolSummary(document, connection), ...(document.agentWork?.id === `run-${hash(parsed.requestId).slice(0, 32)}` ? { ownerToken } : {}) }; break;
          }
          case "finish_deck": result = toolSummary(await service.finishWork(args), connection); break;
          case "add_slide": result = toolSummary(await service.add(args), connection); break;
          case "update_slide": result = toolSummary(await service.update(args), connection); break;
          case "get_deck": {
            const parsed = z.object({ deckId: idSchema, slideId: idSchema.optional(), includeElements: z.boolean().optional() }).strict().parse(args);
            const document = await service.get(parsed.deckId);
            const slides = document.presentation.slides.filter(s => !parsed.slideId || s.id === parsed.slideId);
            if (!slides.length) throw new DeckError("SLIDE_NOT_FOUND", "Slide not found.", 404);
            result = {
              ...toolSummary(document, connection), defaults: document.defaults,
              slides: slides.map(slide => ({
                id: slide.id, background: slide.background, themeId: slide.themeId,
                source: Object.hasOwn(document.sources, slide.id) ? document.sources[slide.id] : null,
                texts: slide.elements.filter(e => e.type === "text").map(e => ({ id: e.id, text: e.text })),
                ...(parsed.includeElements ? { elements: slide.elements } : {}),
              })),
            }; break;
          }
          case "preview_deck": {
            const parsed = z.object({ deckId: idSchema, revision: revisionSchema.optional() }).strict().parse(args);
            const document = await service.get(parsed.deckId);
            if (parsed.revision && document.revision !== parsed.revision) throw new DeckError("REVISION_CONFLICT", "This preview revision is no longer current. Get the latest deck.", 409, [], document.revision);
            result = { ...toolSummary(document, connection), screenshot: null, note: "Manual browser preview; text validation is estimated. Reload to see later revisions." }; break;
          }
          default: throw new DeckError("TOOL_NOT_FOUND", "Unknown deck tool.", 404);
        }
        send(200, result); return;
      }
      throw new DeckError("NOT_FOUND", "Endpoint not found.", 404);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      if (error instanceof z.ZodError) {
        send(400, errorResult(new DeckError("INVALID_INPUT", "Invalid request fields.", 400, error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })))));
      } else {
        if (!(error instanceof DeckError)) console.error("Local deck operation failed:", error instanceof Error ? error.message : "unknown error");
        send(error instanceof DeckError ? error.status : 500, errorResult(error));
      }
    }
  });
  return Object.assign(server, { closeEventStreams: () => { for (const response of streams) response.end(); } });
}
