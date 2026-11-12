// Acceptance test only. Uses an isolated Chrome profile, never the user's live browser.
// Does not add automatic browser validation or screenshot features to the product.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { DeckSnapshot } from "../lib/deck-service/deck-document";

const root = resolve(".");
const realCodex = process.argv.includes("--codex");
const libraryMode = process.argv.includes("--library");
const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(read: () => Promise<T>, accept: (value: T) => boolean = Boolean, timeout = 20_000): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await delay(100);
  }
  throw new Error("Timed out waiting for acceptance condition.");
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise<void>(resolve => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await Promise.race([ended, delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await ended; }
}

class Browser {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  session?: string;
  constructor(readonly socket: WebSocket) {
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Page.javascriptDialogOpening") {
        void this.call("Page.handleJavaScriptDialog", { accept: true });
      }
      if (!message.id) return;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error.message)); else waiting.resolve(message.result ?? {});
    });
    socket.addEventListener("close", () => {
      for (const value of this.pending.values()) value.reject(new Error("Chrome connection closed."));
      this.pending.clear();
    });
  }
  call(method: string, params: Record<string, unknown> = {}, browser = false): Promise<Record<string, unknown>> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(this.session && !browser ? { sessionId: this.session } : {}) }));
    });
  }
  async evaluate(expression: string) {
    const result = await this.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed: " + JSON.stringify(result.exceptionDetails));
    return (result.result as { value: unknown }).value;
  }
  async navigate(url: string) {
    await this.call("Page.navigate", { url });
    await until(() => this.evaluate("document.readyState === 'complete'"));
  }
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), "deck-agent-e2e-"));
  const data = join(temporary, "data");
  const mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };
  const web = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    let file = resolve(root, "out", `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(resolve(root, "out") + "/")) { response.writeHead(403).end(); return; }
    if (!extname(file)) file += ".html";
    try { response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream"); response.end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  let serviceProcess: ChildProcess | undefined;
  let chrome: ChildProcess | undefined;
  let client: Client | undefined;
  let browser: Browser | undefined;
  let codexProcess: ChildProcess | undefined;
  try {
    await new Promise<void>(resolve => web.listen(0, "127.0.0.1", resolve));
    const appUrl = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
    const reserve = createServer();
    await new Promise<void>(resolve => reserve.listen(0, "127.0.0.1", resolve));
    const port = (reserve.address() as AddressInfo).port;
    await new Promise<void>(resolve => reserve.close(() => resolve()));
    serviceProcess = spawn(process.execPath, ["--import", "tsx", "scripts/deck-service.ts"], { cwd: root, env: { ...process.env, DECK_DATA_DIR: data, DECK_SERVICE_PORT: String(port), DECK_APP_URL: appUrl }, stdio: ["ignore", "ignore", "pipe"] });
    let serviceLog = "";
    serviceProcess.stderr?.on("data", chunk => { serviceLog += String(chunk); });
    const connection = await until(async () => {
      try { return JSON.parse(await readFile(join(data, "connection.json"), "utf8")); }
      catch { if (serviceProcess?.exitCode !== null) throw new Error(serviceLog); return null; }
    });
    const transport = new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "scripts/deck-mcp.ts"], cwd: root, env: { ...process.env as Record<string, string>, DECK_DATA_DIR: data }, stderr: "pipe" });
    client = new Client({ name: "deck-agent-e2e", version: "1" });
    await client.connect(transport);
    async function tool(name: string, args: Record<string, unknown>) {
      const result = await client!.callTool({ name, arguments: args });
      assert.equal(result.isError, false, "MCP operation failed: " + name);
      return result.structuredContent as Record<string, unknown>;
    }
    async function document(deckId: string): Promise<DeckSnapshot> {
      const response = await fetch(`${connection.url}/decks/${deckId}`, { headers: { Authorization: `Bearer ${connection.token}` } });
      assert.equal(response.status, 200);
      return (await response.json()).document;
    }
    async function codex(prompt: string) {
      const workspace = join(temporary, "workspace");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(workspace, { recursive: true });
      const args = ["exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", "--json", "-C", workspace,
        "-c", `mcp_servers.deck_builder.command=${JSON.stringify(process.execPath)}`,
        "-c", `mcp_servers.deck_builder.args=${JSON.stringify(["--import", resolve(root, "node_modules/tsx/dist/loader.mjs"), resolve(root, "scripts/deck-mcp.ts")])}`,
        "-c", `mcp_servers.deck_builder.cwd=${JSON.stringify(root)}`,
        "-c", `mcp_servers.deck_builder.env.DECK_DATA_DIR=${JSON.stringify(data)}`,
        "-c", 'mcp_servers.deck_builder.default_tools_approval_mode="approve"',
        "-c", "mcp_servers.deck_builder.required=true", prompt];
      const child = spawn("codex", args, { stdio: ["ignore", "pipe", "pipe"] });
      codexProcess = child;
      let output = "";
      let error = "";
      child.stdout.on("data", chunk => { output += String(chunk); });
      child.stderr.on("data", chunk => { error += String(chunk); });
      const timer = setTimeout(() => child.kill("SIGTERM"), 180_000);
      const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
      clearTimeout(timer);
      // Tool URLs contain local capabilities, so raw model events are not printed.
      if (code !== 0) throw new Error(`Codex CLI failed (exit ${code}). ${error.replace(/#[^\s"]+/g, "#[redacted]").slice(-1200)}`);
      if (!output.includes("create_deck") && !output.includes("update_slide")) {
        const messages = output.split("\n").flatMap(line => {
          try { const event = JSON.parse(line); return event.item?.type === "agent_message" ? [event.item.text] : event.type === "error" ? [event.message] : []; }
          catch { return []; }
        });
        throw new Error("Codex did not call deck tools: " + String(messages.join("\n")).replace(/#[^\s"]+/g, "#[redacted]").slice(-1800));
      }
    }
    async function launchBrowser(rawLegacy: string) {
      let chromeLog = "";
      chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "chrome")}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--window-size=1600,1000", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
      chrome.stderr?.on("data", chunk => { chromeLog += String(chunk); });
      const wsUrl = await until(async () => chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]);
      const socket = new WebSocket(wsUrl!);
      await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve(), { once: true }); socket.addEventListener("error", () => reject(new Error("Chrome connection failed.")), { once: true }); });
      browser = new Browser(socket);
      const target = await browser.call("Target.createTarget", { url: "about:blank" }, true);
      const attached = await browser.call("Target.attachToTarget", { targetId: target.targetId, flatten: true }, true);
      browser.session = String(attached.sessionId);
      await browser.call("Page.enable"); await browser.call("Runtime.enable");
      await browser.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.call("Page.addScriptToEvaluateOnNewDocument", { source: `if (location.origin === ${JSON.stringify(appUrl)} && !localStorage.getItem('presentation-editor-storage')) localStorage.setItem('presentation-editor-storage', ${JSON.stringify(rawLegacy)});` });
    }
    const source = JSON.parse(await readFile(join(root, "docs/deck-spec/example-proposal.json"), "utf8"));
    if (libraryMode) {
      const { createDefaultPresentation } = await import("../lib/presentation/default-presentation");
      const legacy = createDefaultPresentation(); legacy.title = "Browser deck kept";
      const rawLegacy = JSON.stringify({ state: { presentation: legacy, activeSlideId: legacy.slides[0].id }, version: 4 });
      await launchBrowser(rawLegacy);
      const page = browser!;
      const libraryUrl = `${appUrl}/#${new URLSearchParams({ service: connection.url, token: connection.token })}`;
      // The user's Library may already be open before the CLI opens its paired tab.
      await page.navigate(appUrl);
      await until(() => page.evaluate("document.querySelector('[data-testid=agent-library-status]')?.textContent.includes('Start npm run deck-agent')"));
      const existingSession = page.session;
      const pairingTarget = await page.call("Target.createTarget", { url: "about:blank" }, true);
      const pairingSession = await page.call("Target.attachToTarget", { targetId: pairingTarget.targetId, flatten: true }, true);
      page.session = String(pairingSession.sessionId);
      await page.call("Page.enable"); await page.call("Runtime.enable");
      await page.navigate(libraryUrl);
      await until(() => page.evaluate("document.querySelector('[data-testid=agent-library-status]')?.textContent.includes('CLI agent connected')"));
      assert.equal(await page.evaluate("location.hash"), "");
      page.session = existingSession;
      await until(() => page.evaluate("document.querySelector('[data-testid=agent-library-status]')?.textContent.includes('CLI agent connected')"));
      await page.call("Target.closeTarget", { targetId: pairingTarget.targetId }, true);
      await until(() => page.evaluate("Boolean([...document.querySelectorAll('article h2')].find(e => e.textContent === 'Browser deck kept'))"));
      const browserFingerprint = async () => page.evaluate(`new Promise((resolve, reject) => { const r = indexedDB.open('deck-library', 1); r.onsuccess = () => { const db=r.result; const q=db.transaction('decks').objectStore('decks').getAll(); q.onsuccess=async()=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(q.result)));db.close();resolve(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));}; q.onerror=()=>reject(q.error); }; r.onerror=()=>reject(r.error); })`);
      const fingerprint = await browserFingerprint();
      let opened!: () => void;
      const viewer = new Promise<void>(resolve => { opened = resolve; });
      let finished = false;
      let jobError: unknown;
      const job = (realCodex ? codex(`Use only deck_builder MCP tools, no shell or file changes. Create this NEW presentation LIVE so it appears in the connected Library while working. Use create_deck with live:true, plannedSlides:10, requestId library-create, and ONLY the first cover slide; then add_slide for each of the other nine slides one at a time, carrying agentWork.id as runId, ownerToken, and latest expectedRevision. Finally finish_deck status completed, requestId library-finish. Do not wait for the viewer or insert delays. Do not print tokens or URLs. Exact source spec for the final deck: ${JSON.stringify(source)}. Return the deck ID only.`) : (async () => {
        let state = await tool("create_deck", { requestId: "library-create", live: true, plannedSlides: 10, spec: { ...source, slides: source.slides.slice(0, 1) } });
        const ownerToken = state.ownerToken;
        const runId = (state.agentWork as { id: string }).id;
        await viewer;
        for (let i = 1; i < source.slides.length; i++) {
          state = await tool("add_slide", { deckId: state.deckId, expectedRevision: state.revision, requestId: `library-add-${i}`, slideSpec: source.slides[i], runId, ownerToken });
          const expected = Number(state.revision);
          await until(() => page.evaluate(`document.querySelector('[data-testid=local-deck-status]')?.textContent.startsWith('Local deck · r${expected}')`));
        }
        await tool("finish_deck", { deckId: state.deckId, expectedRevision: state.revision, requestId: "library-finish", status: "completed", runId, ownerToken });
      })()).then(() => { finished = true; }, error => { jobError = error; finished = true; });
      await until(async () => {
        if (jobError) throw jobError;
        return page.evaluate("Boolean(document.querySelector('article[data-agent-status=working]'))");
      }, Boolean, 90_000);
      assert.equal(finished, false, "The card should be visible while the agent is still working.");
      const deckId = String(await page.evaluate("document.querySelector('article[data-agent-status=working]').getAttribute('data-deck-id')"));
      await page.evaluate("document.querySelector('article[data-agent-status=working] h2 a').click()");
      await until(() => page.evaluate("Boolean(document.querySelector('[data-testid=local-deck-status]')) && document.querySelectorAll('canvas').length > 0"));
      assert.equal(await page.evaluate("document.querySelector('[aria-label=\"Follow AI\"]').checked"), true);
      await page.evaluate("const toggle=document.querySelector('[aria-label=\"Follow AI\"]'); toggle.click(); toggle.click(); toggle.focus();");
      await page.evaluate("window.agentRevisions=[];window.agentHighlightSeen=false;window.agentObserver=new MutationObserver(()=>{const t=document.querySelector('[data-testid=local-deck-status]')?.textContent??'';const m=t.match(/^Local deck · r(\\d+)/);if(m&&!window.agentRevisions.includes(m[1]))window.agentRevisions.push(m[1]);if(document.querySelector('[data-testid=agent-canvas-highlight]'))window.agentHighlightSeen=true;});window.agentObserver.observe(document.body,{childList:true,subtree:true});");
      opened(); await job; if (jobError) throw jobError;
      await until(() => page.evaluate("document.querySelector('[data-testid=agent-work-status]')?.textContent.startsWith('Selesai · 10/10')"));
      const final = await document(deckId);
      assert.equal(final.agentWork?.status, "completed");
      assert.equal(final.presentation.slides.length, 10);
      assert.equal(await page.evaluate("document.querySelector('[data-slide-select][aria-current=page]')?.getAttribute('aria-label')"), "Select slide 10");
      assert.equal(await page.evaluate("window.agentHighlightSeen"), true);
      assert.ok(Number(await page.evaluate("window.agentRevisions.length")) >= 2);
      await page.navigate(appUrl);
      await until(() => page.evaluate(`document.querySelector('article[data-deck-id="${deckId}"]')?.textContent.includes('Selesai')`));
      async function openDeleteDialog() {
        await page.evaluate(`document.querySelector('article[data-deck-id="${deckId}"] button[aria-label^="More actions"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))`);
        await until(() => page.evaluate("[...document.querySelectorAll('[role=menuitem]')].some(item => item.textContent.trim() === 'Delete')"));
        await page.evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Delete').click()");
        await until(() => page.evaluate("Boolean(document.querySelector('[role=alertdialog]'))"));
      }
      await openDeleteDialog();
      await page.evaluate("[...document.querySelectorAll('[role=alertdialog] button')].find(button => button.textContent.trim() === 'Cancel').click()");
      await until(() => page.evaluate("!document.querySelector('[role=alertdialog]')"));
      assert.equal((await document(deckId)).revision, final.revision, "Cancel must leave the service deck unchanged.");
      await openDeleteDialog();
      await page.evaluate("[...document.querySelectorAll('[role=alertdialog] button')].find(button => button.textContent.trim() === 'Delete').click()");
      await until(() => page.evaluate(`!document.querySelector('article[data-deck-id="${deckId}"]')`));
      assert.equal((await fetch(`${connection.url}/decks/${deckId}`, { headers: { Authorization: `Bearer ${connection.token}` } })).status, 410);
      await page.navigate(appUrl);
      await until(() => page.evaluate("document.querySelector('[data-testid=agent-library-status]')?.textContent.includes('CLI agent connected')"));
      assert.equal(await page.evaluate(`Boolean(document.querySelector('article[data-deck-id="${deckId}"]'))`), false);
      assert.equal(await browserFingerprint(), fingerprint);
      assert.equal(await page.evaluate(`localStorage.getItem('presentation-editor-storage') === ${JSON.stringify(rawLegacy)}`), true);
      console.log(JSON.stringify({ ok: true, driver: realCodex ? "Codex CLI + Library + Chrome" : "MCP client + Library + Chrome", slides: 10, checks: ["existing Library tab pairing", "card appears during work", "click from Library", "incremental live slides", "Follow AI", "canvas highlight", "explicit completion", "Library completion status", "cancel deletion", "delete CLI deck from card menu", "deleted after reload", "IndexedDB unchanged", "legacy localStorage unchanged"] }, null, 2));
      return;
    }
    if (realCodex) {
      await codex(`Use only the deck_builder MCP tools. Do not use shell or read/edit any files. This is an authorized local acceptance test. Call list_layouts for layoutId wknd-cover-brand and get_brand_styles, then BULK create_deck with live:false, requestId e2e-codex-create and exactly this spec: ${JSON.stringify(source)}. Finish with the deck ID only; do not print URLs or tokens.`);
    } else {
      await tool("create_deck", { requestId: "e2e-create", spec: source });
    }
    const files = await readdir(join(data, "decks"));
    assert.equal(files.length, 1);
    const deckId = files[0].replace(/\.json$/, "");
    const initial = await document(deckId);
    assert.equal(initial.presentation.slides.length, 10);
    const info = await tool("get_deck", { deckId });
    const legacy = structuredClone(initial.presentation);
    legacy.id = "legacy-browser-deck"; legacy.title = "Legacy browser deck";
    const rawLegacy = JSON.stringify({ state: { presentation: legacy, activeSlideId: legacy.slides[0].id }, version: 4 });

    await launchBrowser(rawLegacy);
    browser = browser!;
    await browser.navigate(String(info.editorUrl));
    await until(() => browser!.evaluate("Boolean(document.querySelector('[aria-label=\"Save local deck\"]'))"));
    await until(() => browser!.evaluate("document.querySelectorAll('canvas').length > 0"));
    assert.equal(await browser.evaluate("document.querySelector('[aria-label=\"Save local deck\"]').getBoundingClientRect().right <= innerWidth"), true);
    assert.equal(await browser.evaluate("location.hash"), "");
    assert.equal(await browser.evaluate(`localStorage.getItem('presentation-editor-storage') === ${JSON.stringify(rawLegacy)}`), true);

    // Edit a slide through the actual editor's existing insert-text shortcut.
    await browser.evaluate("document.activeElement?.blur()");
    await browser.call("Input.dispatchKeyEvent", { type: "keyDown", key: "t", code: "KeyT", windowsVirtualKeyCode: 84 });
    await browser.call("Input.dispatchKeyEvent", { type: "keyUp", key: "t", code: "KeyT", windowsVirtualKeyCode: 84 });
    await until(() => browser!.evaluate("Boolean(document.querySelector('textarea'))"));
    await browser.evaluate("document.querySelector('textarea').focus(); document.querySelector('textarea').select()");
    await browser.call("Input.insertText", { text: "Edited in local editor" });
    await browser.evaluate("document.querySelector('textarea').blur()");
    await until(() => browser!.evaluate("!document.querySelector('[aria-label=\"Save local deck\"]').disabled"));
    await browser.evaluate("document.querySelector('[aria-label=\"Save local deck\"]').click()");
    await until(() => browser!.evaluate("document.querySelector('[role=status]')?.textContent.includes('r2')"));
    const saved = await document(deckId);
    assert.equal(saved.revision, 2);
    assert.ok(saved.presentation.slides[0].elements.some(element => element.type === "text" && element.text === "Edited in local editor"));
    assert.equal(saved.sources[saved.presentation.slides[0].id].stale, true);

    const targetId = initial.presentation.slides[1].id;
    if (realCodex) {
      await codex(`Use only deck_builder MCP tools; no shell or file operations. This local acceptance test authorizes revising a slide. First get_deck deckId ${deckId} slideId ${targetId}; then update_slide that slide with the current revision, requestId e2e-codex-update and contentPatch {"title":"Revisi Codex"}. Call get_deck for that slide again to verify. Finish with deck ID and revision only, no URLs or tokens.`);
    } else {
      await tool("update_slide", { deckId, slideId: targetId, expectedRevision: 2, requestId: "e2e-update", contentPatch: { title: "Revisi Codex" } });
    }
    const revised = await document(deckId);
    assert.equal(revised.revision, 3);
    assert.deepEqual(revised.presentation.slides[0], saved.presentation.slides[0]);
    assert.equal(revised.presentation.slides[1].id, targetId);
    assert.ok(revised.presentation.slides[1].elements.some(element => element.type === "text" && element.text === "Revisi Codex"));

    // Clean editors follow the committed revision without a page reload.
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.startsWith('Local deck · r3')"));
    // A subsequent remote update must not replace an in-progress browser draft.
    await browser.evaluate("document.querySelector('[aria-label=\"Presentation title\"]').focus(); document.querySelector('[aria-label=\"Presentation title\"]').select()");
    await browser.call("Input.insertText", { text: "Conflicting browser draft" });
    await browser.evaluate("document.querySelector('[aria-label=\"Presentation title\"]').blur()");
    await until(() => browser!.evaluate("!document.querySelector('[aria-label=\"Save local deck\"]').disabled"));
    await tool("update_slide", { deckId, slideId: targetId, expectedRevision: 3, requestId: "e2e-conflict", contentPatch: { title: "New remote" } });
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.includes('Server r4 available')"));
    await browser.evaluate("document.querySelector('[aria-label=\"Save local deck\"]').click()");
    await until(() => browser!.evaluate("document.querySelector('[role=alert]')?.textContent.includes('deck changed')"));
    assert.equal(await browser.evaluate("document.querySelector('[aria-label=\"Presentation title\"]').value"), "Conflicting browser draft");
    assert.equal((await document(deckId)).revision, 4);
    assert.equal((await document(deckId)).presentation.title, initial.presentation.title);
    await until(() => browser!.evaluate("Boolean(document.querySelector('[aria-label=\"Load server version\"]'))"));
    await browser.evaluate("document.querySelector('[aria-label=\"Load server version\"]').click()");
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.includes('r4') && !document.querySelector('[data-testid=local-deck-status]')?.textContent.includes('Server r4 available')"));
    assert.equal(await browser.evaluate("document.querySelector('[aria-label=\"Presentation title\"]').value"), initial.presentation.title);
    // Restart the real service and verify automatic recovery with the same token.
    await stop(serviceProcess);
    serviceProcess = spawn(process.execPath, ["--import", "tsx", "scripts/deck-service.ts"], { cwd: root, env: { ...process.env, DECK_DATA_DIR: data, DECK_SERVICE_PORT: String(port), DECK_APP_URL: appUrl }, stdio: ["ignore", "ignore", "pipe"] });
    await until(async () => {
      try { return (await fetch(`${connection.url}/health`, { headers: { Authorization: `Bearer ${connection.token}` } })).ok; }
      catch { return false; }
    });
    await tool("update_slide", { deckId, slideId: targetId, expectedRevision: 4, requestId: "e2e-restart", contentPatch: { title: "Recovered" } });
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.startsWith('Local deck · r5') && document.querySelector('[data-testid=local-deck-status]')?.textContent.includes('Live connected')"));
    await browser.evaluate("document.querySelector('[aria-label=\"Import deck spec\"]').click()");
    await until(() => browser!.evaluate("Boolean(document.querySelector('[role=dialog]'))"));
    await browser.evaluate("document.activeElement?.blur()");
    await tool("update_slide", { deckId, slideId: targetId, expectedRevision: 5, requestId: "e2e-dialog", contentPatch: { title: "After dialog" } });
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.includes('Server r6 available')"));
    assert.equal(await browser.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.startsWith('Local deck · r5')"), true);
    await browser.evaluate("document.querySelector('[aria-label=\"Close import\"]').click()");
    await until(() => browser!.evaluate("document.querySelector('[data-testid=local-deck-status]')?.textContent.startsWith('Local deck · r6')"));
    const preview = await tool("preview_deck", { deckId, revision: 6 });
    await browser.navigate(String(preview.previewUrl));
    await until(() => browser!.evaluate("Boolean(document.querySelector('[data-testid=local-preview] canvas'))"));
    assert.equal(await browser.evaluate(`localStorage.getItem('presentation-editor-storage') === ${JSON.stringify(rawLegacy)}`), true);
    const backups = await readdir(join(data, "backups"));
    assert.equal(backups.length, 1);
    assert.equal(JSON.parse(await readFile(join(data, "backups", backups[0]), "utf8")).raw, rawLegacy);
    console.log(JSON.stringify({ ok: true, driver: realCodex ? "Codex CLI + MCP + Chrome" : "MCP client + Chrome", slides: 10, revisions: [1, 2, 3, 4, 5, 6], checks: ["create", "canvas render", "browser slide edit/save", "live revision without reload", "stale save rejected and draft preserved", "explicit server load", "service restart recovery", "active dialog protected", "existing renderer preview", "legacy localStorage unchanged", "exact backup"] }, null, 2));
  } finally {
    if (codexProcess) await stop(codexProcess);
    browser?.socket.close();
    if (chrome) await stop(chrome);
    await client?.close();
    if (serviceProcess) await stop(serviceProcess);
    await new Promise<void>(resolve => { web.close(() => resolve()); web.closeAllConnections(); });
    // Chrome helpers may finish profile writes just after the main process exits.
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "E2E failed."); process.exitCode = 1; });
