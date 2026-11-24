// Packages dist-desktop/ (from build-desktop.ts) into the macOS app:
// dist-desktop/app/WKND Deck-<version>-arm64.dmg and .zip, plus the .app in
// dist-desktop/app/mac-arm64/. WKND_DECK_APP_OUT writes them elsewhere, e.g.
// while a release upload is still reading dist-desktop/app/.
//
// The app holds only the shell and the bundle (no node_modules: everything is
// bundled). It is ad-hoc signed, which Apple Silicon requires to run at all;
// with a Developer ID certificate it can later be signed and notarized.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Arch, build, Platform } from "electron-builder";

const root = resolve(__dirname, "..");
const outDir = join(root, "dist-desktop");
const stage = join(outDir, "stage");
const appDir = process.env.WKND_DECK_APP_OUT ? resolve(process.env.WKND_DECK_APP_OUT) : join(outDir, "app");

async function main() {
  const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    version: string;
    devDependencies: Record<string, string>;
  };

  // A minimal app folder, so electron-builder doesn't pack the web project's dependencies.
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await cp(join(outDir, "shell.cjs"), join(stage, "shell.cjs"));
  await writeFile(join(stage, "package.json"), JSON.stringify({
    name: "wknd-deck",
    productName: "WKND Deck",
    version: rootPackage.version,
    description: "WKND presentation builder with your own Claude Code or Codex.",
    author: "WKND",
    main: "shell.cjs",
  }, null, 2));

  await build({
    targets: Platform.MAC.createTarget(["dmg", "zip"], Arch.arm64),
    projectDir: stage,
    config: {
      appId: "com.weekendinc.wknd-deck",
      productName: "WKND Deck",
      electronVersion: rootPackage.devDependencies.electron,
      // Reuse the installed Electron instead of downloading it again.
      electronDist: join(root, "node_modules/electron/dist"),
      directories: { output: appDir },
      files: ["shell.cjs", "package.json"],
      extraResources: [{ from: join(outDir, "bundle"), to: "bundle" }],
      asar: true,
      mac: {
        category: "public.app-category.productivity",
        // 1024px PNG with the artwork already in the macOS rounded shape
        // (824px, centred); electron-builder makes the .icns from it.
        icon: join(root, "electron/icon.png"),
        // Ad-hoc signature: free, enough to run on Apple Silicon. Gatekeeper
        // still asks once ("Open Anyway") for downloaded copies.
        identity: "-",
        hardenedRuntime: false,
        notarize: false,
      },
      dmg: { title: "WKND Deck" },
      publish: null,
    },
  });
  console.log(`Packaged ${appDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
