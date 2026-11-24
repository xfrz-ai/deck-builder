// The engine of the desktop app, loaded by the shell from a bundle: it starts
// the local services and opens the window. Because it ships in the bundle,
// changes here reach users through bundle updates.
//
// Services (fixed loopback ports, because the Library and the deck service
// connection are stored per origin):
//   4790  the web app (bundle/web)
//   8790  the deck service (in this process)
//   8787  the AI bridge (child process running the user's Claude Code)

import { join } from "node:path";
import { BrowserWindow, shell } from "electron";

import { PortInUseError, type EngineContext, type EngineHandle } from "./engine-api";
import { startAiBridge, startDeckService, type RunningService } from "./services";
import { fixPath } from "./shell-path";
import { startStaticServer } from "./static-server";

const APP_PORT = 4790;
const DECK_SERVICE_PORT = 8790;
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;

function isAppUrl(url: string) {
  return url === APP_ORIGIN || url.startsWith(`${APP_ORIGIN}/`);
}

function createWindow(url: string) {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    // The editor needs at least 1280px.
    minWidth: 1280,
    minHeight: 720,
    title: "WKND Deck",
    backgroundColor: "#F5F5F5",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Links to other sites open in the default browser.
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isAppUrl(target)) return { action: "allow" };
    if (/^https?:\/\//.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    if (isAppUrl(target)) return;
    event.preventDefault();
    if (/^https?:\/\//.test(target)) void shell.openExternal(target);
  });

  void window.loadURL(url);
  return window;
}

export async function start(context: EngineContext): Promise<EngineHandle> {
  await fixPath();
  const services: RunningService[] = [];
  const stopAll = () => Promise.allSettled([...services].reverse().map((service) => service.stop()));

  let pairingUrl: string;
  try {
    const site = await startStaticServer(join(context.bundleDir, "web"), APP_PORT);
    services.push({ stop: () => new Promise<void>((resolve) => site.close(() => resolve())) });

    const deckService = await startDeckService({ dataDir: context.dataDir, port: DECK_SERVICE_PORT, appUrl: APP_ORIGIN });
    services.push(deckService);

    services.push(startAiBridge({
      script: join(context.bundleDir, "ai-bridge.mjs"),
      dataDir: context.dataDir,
      mcpBundle: join(context.bundleDir, "deck-mcp.mjs"),
      cliBundle: join(context.bundleDir, "wknd-deck.mjs"),
      skillDir: join(context.bundleDir, "skills", "wknd-deck"),
      playbook: join(context.bundleDir, "playbook.md"),
    }));

    // The Library pairs with the deck service through the URL fragment once;
    // the page moves it into session storage.
    const pairing = new URLSearchParams({ service: deckService.connection.url, token: deckService.connection.token });
    pairingUrl = `${APP_ORIGIN}/#${pairing}`;
  } catch (error) {
    await stopAll();
    if ((error as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
      throw new PortInUseError(
        `A port WKND Deck needs (${APP_PORT}, ${DECK_SERVICE_PORT} or 8787) is already in use. Close other copies of the deck builder (for example npm run deck-service or npm run ai-bridge) and open the app again.`,
      );
    }
    throw error;
  }

  let window: BrowserWindow | null = createWindow(pairingUrl);
  window.on("closed", () => { window = null; });

  return {
    focus() {
      if (!window) {
        window = createWindow(pairingUrl);
        window.on("closed", () => { window = null; });
        return;
      }
      if (window.isMinimized()) window.restore();
      window.focus();
    },
    async stop() {
      await stopAll();
    },
  };
}
