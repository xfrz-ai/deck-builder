// Serves the Next.js static export (out/) on a fixed loopback port. The app
// keeps one origin across launches, because the Library (IndexedDB) and the
// deck service connection are stored per origin, and the local deck features
// only run on http://127.0.0.1 or localhost.

import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".glb": "model/gltf-binary",
  ".map": "application/json; charset=utf-8",
};

async function isFile(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

// /editor → editor.html, /docs/ → docs/index.html, like the Cloudflare
// Worker's "auto-trailing-slash" handling.
async function resolveFile(root: string, pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const base = join(root, relative);
  if (base !== root && !base.startsWith(root + sep)) return null;

  const candidates = decoded.endsWith("/")
    ? [join(base, "index.html")]
    : [base, `${base}.html`, join(base, "index.html")];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

export function startStaticServer(root: string, port: number) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const server: Server = createServer(async (request, response) => {
    // Refuse other host names pointing at this port (DNS rebinding).
    if (!allowedHosts.has(request.headers.host ?? "")) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }

    const { pathname } = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const file = await resolveFile(root, pathname);
    const target = file ?? join(root, "404.html");
    try {
      const body = await readFile(target);
      response.writeHead(file ? 200 : 404, {
        "Content-Type": TYPES[extname(target).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });

  return new Promise<Server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
