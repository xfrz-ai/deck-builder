// The shell of WKND Deck: the small part that ships inside the .app and
// rarely changes. It picks the newest usable bundle (built-in or a verified
// download), runs its engine, and looks for bundle updates, so new layouts
// and templates reach people without downloading the app again.

import { appendFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { app, BrowserWindow, dialog, shell as electronShell } from "electron";

import publicKey from "./bundle-public-key.pem";
import { markBad, selectBundle, type SelectedBundle } from "./bundles";
import type { EngineHandle, EngineModule } from "./engine-api";
import { checkForUpdate } from "./updater";

const RELEASES_PAGE = "https://github.com/xfrz-ai/deck-builder/releases/latest";
const DEFAULT_FEED = "https://github.com/xfrz-ai/deck-builder/releases/latest/download/latest.json";
// Packaged apps check GitHub; development builds only when a feed is given.
const FEED_URL = process.env.WKND_DECK_UPDATE_URL || (app.isPackaged ? DEFAULT_FEED : "");
const FIRST_CHECK_MS = 10_000;
const CHECK_EVERY_MS = 6 * 60 * 60_000;

app.setName("WKND Deck");

// Also written to ~/Library/Logs/WKND Deck/main.log, since an app opened from
// Finder has no terminal to show its output.
function log(message: string) {
  console.log(`[shell] ${message}`);
  try {
    const dir = app.getPath("logs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "main.log"), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Logging must never stop the app.
  }
}
const loadModule = createRequire(__filename);

let engine: EngineHandle | null = null;
let active: SelectedBundle | null = null;
let offeredBuild = 0;

function paths() {
  return {
    builtinDir: app.isPackaged ? join(process.resourcesPath, "bundle") : join(app.getAppPath(), "dist-desktop", "bundle"),
    bundlesDir: join(app.getPath("userData"), "bundles"),
    dataDir: join(app.getPath("userData"), "deck-service"),
  };
}

async function runEngine(bundle: SelectedBundle) {
  const engineModule = loadModule(join(bundle.dir, "engine.cjs")) as EngineModule;
  return engineModule.start({
    bundleDir: bundle.dir,
    dataDir: paths().dataDir,
    bundle: { build: bundle.manifest.build, version: bundle.manifest.version, source: bundle.source },
    shellVersion: app.getVersion(),
  });
}

async function boot() {
  const { builtinDir, bundlesDir } = paths();
  active = await selectBundle({ builtinDir, bundlesDir, publicKey, log });
  log(`Using ${active.source} bundle ${active.manifest.version} (build ${active.manifest.build})`);

  try {
    engine = await runEngine(active);
  } catch (error) {
    if ((error as { code?: string })?.code === "PORT_IN_USE" || active.source === "builtin") throw error;
    // A downloaded bundle that can't start is dropped; the built-in one takes over.
    log(`Bundle ${active.manifest.build} failed to start: ${error instanceof Error ? error.message : String(error)}`);
    await markBad(bundlesDir, active.manifest.build);
    active = await selectBundle({ builtinDir, bundlesDir, publicKey, log });
    engine = await runEngine(active);
  }
}

async function offerRestart(version: string, build: number) {
  if (offeredBuild === build) return;
  offeredBuild = build;
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    type: "info" as const,
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    message: "A WKND Deck update is ready",
    detail: `Version ${version} (build ${build}) has been downloaded. Restart to use it; your work is saved. Otherwise it's used the next time you open the app.`,
  };
  const { response } = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  if (response === 0) {
    app.relaunch();
    app.quit();
  }
}

async function offerNewApp(version: string, build: number) {
  if (offeredBuild === build) return;
  offeredBuild = build;
  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: ["Open download page", "Later"],
    defaultId: 0,
    cancelId: 1,
    message: "A new version of the WKND Deck app is available",
    detail: `Version ${version} needs a newer app than the one installed. Download it once from GitHub; after that, updates install themselves again.`,
  });
  if (response === 0) void electronShell.openExternal(RELEASES_PAGE);
}

async function checkUpdates() {
  if (!FEED_URL || !active) return;
  try {
    const result = await checkForUpdate({
      feedUrl: FEED_URL,
      activeBuild: Math.max(active.manifest.build, offeredBuild),
      bundlesDir: paths().bundlesDir,
      publicKey,
    });
    if (result.status === "installed") {
      log(`Installed bundle ${result.manifest.version} (build ${result.manifest.build})`);
      await offerRestart(result.manifest.version, result.manifest.build);
    } else if (result.status === "needs-new-app") {
      await offerNewApp(result.feed.version, result.feed.build);
    }
  } catch (error) {
    // Offline or GitHub unreachable: try again later.
    log(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

log(`Starting WKND Deck ${app.getVersion()} (pid ${process.pid}, packaged ${app.isPackaged})`);
if (!app.requestSingleInstanceLock()) {
  log("Another instance is running; handing over to it.");
  app.quit();
} else {
  app.on("second-instance", () => engine?.focus());
  // macOS: clicking the Dock icon with no window open shows the Library again.
  app.on("activate", () => engine?.focus());
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.whenReady().then(async () => {
    try {
      await boot();
    } catch (error) {
      log(`Start failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      dialog.showErrorBox("WKND Deck couldn't start", error instanceof Error ? error.message : String(error));
      app.exit(1);
      return;
    }
    setTimeout(() => void checkUpdates(), FIRST_CHECK_MS);
    setInterval(() => void checkUpdates(), CHECK_EVERY_MS);
  });

  // Ctrl+C in the terminal (npm run desktop) quits cleanly too, so the AI
  // bridge doesn't outlive the app.
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => app.quit());

  let stopping = false;
  app.on("before-quit", (event) => {
    if (stopping || !engine) return;
    stopping = true;
    event.preventDefault();
    void engine.stop().finally(() => app.exit(0));
  });
}
