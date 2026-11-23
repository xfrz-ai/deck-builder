// Builds the desktop app into dist-desktop/:
//
//   dist-desktop/shell.cjs   the shell (electron/shell.ts), packaged inside the .app
//   dist-desktop/bundle/     the updatable bundle: engine, MCP server, AI bridge,
//                            playbook and the web app, with a signed manifest
//
//   npx tsx scripts/build-desktop.ts                  everything
//   npx tsx scripts/build-desktop.ts --skip-renderer  reuse the current out/
//
// Signing key: WKND_DECK_SIGNING_KEY (PEM text, for CI) or
// ~/.wknd-deck/bundle-signing-key.pem. Without one the bundle is unsigned; it
// still runs as the built-in bundle, but can't be published as an update.
// Build number: WKND_DECK_BUILD, or the current time in seconds.

import { spawnSync } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { build, type BuildOptions } from "esbuild";

import { SHELL_API, sha256, type BundleManifest } from "../electron/bundles";

const root = resolve(__dirname, "..");
const outDir = resolve(root, "dist-desktop");
const bundleDir = join(outDir, "bundle");

const common: BuildOptions = {
  bundle: true,
  platform: "node",
  target: "node22",
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "warning",
  legalComments: "none",
};
// Bundled CommonJS dependencies still call require() in ES modules.
const esmBanner = { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" };

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

async function signingKey() {
  if (process.env.WKND_DECK_SIGNING_KEY) return process.env.WKND_DECK_SIGNING_KEY;
  const file = join(homedir(), ".wknd-deck", "bundle-signing-key.pem");
  return existsSync(file) ? readFile(file, "utf8") : null;
}

async function main() {
  if (!process.argv.includes("--skip-renderer")) {
    // The desktop app always runs its own AI bridge on this port.
    const result = spawnSync("npx", ["next", "build", "--webpack"], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, NEXT_PUBLIC_AI_BRIDGE_URL: "http://127.0.0.1:8787" },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  if (!existsSync(join(root, "out", "index.html"))) throw new Error("out/ is missing. Run without --skip-renderer first.");

  await rm(bundleDir, { recursive: true, force: true });
  await mkdir(bundleDir, { recursive: true });

  await build({
    ...common,
    entryPoints: [join(root, "electron/shell.ts")],
    format: "cjs",
    outfile: join(outDir, "shell.cjs"),
    external: ["electron"],
    loader: { ".pem": "text" },
  });
  await build({
    ...common,
    entryPoints: [join(root, "electron/engine.ts")],
    format: "cjs",
    outfile: join(bundleDir, "engine.cjs"),
    external: ["electron"],
  });
  await build({
    ...common,
    entryPoints: [join(root, "scripts/deck-mcp.ts")],
    format: "esm",
    outfile: join(bundleDir, "deck-mcp.mjs"),
    banner: esmBanner,
  });
  await build({
    ...common,
    entryPoints: [join(root, "scripts/ai-bridge.mjs")],
    format: "esm",
    outfile: join(bundleDir, "ai-bridge.mjs"),
    banner: esmBanner,
  });
  await cp(join(root, "docs/agent-guide/playbook.md"), join(bundleDir, "playbook.md"));
  await cp(join(root, "out"), join(bundleDir, "web"), {
    recursive: true,
    // Sample files for tests aren't needed in the app.
    filter: (source) => !relative(join(root, "out"), source).startsWith("test-data"),
  });

  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version: string };
  const buildNumber = Number(process.env.WKND_DECK_BUILD ?? Math.floor(Date.now() / 1000));
  if (!Number.isSafeInteger(buildNumber) || buildNumber <= 0) throw new Error("WKND_DECK_BUILD must be a positive integer.");
  // Lets the web app (and tests) see which bundle is running.
  await writeFile(join(bundleDir, "web", "bundle.json"), JSON.stringify({ build: buildNumber, version: packageJson.version }));

  const files: Record<string, string> = {};
  for (const file of (await listFiles(bundleDir)).sort()) {
    files[relative(bundleDir, file).split("\\").join("/")] = sha256(await readFile(file));
  }
  const manifest: BundleManifest = {
    format: 1,
    build: buildNumber,
    version: packageJson.version,
    shellApi: SHELL_API,
    createdAt: new Date().toISOString(),
    files,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  await writeFile(join(bundleDir, "manifest.json"), manifestBytes);

  const key = await signingKey();
  if (key) {
    await writeFile(join(bundleDir, "manifest.sig"), sign(null, manifestBytes, createPrivateKey(key)).toString("base64"));
  } else {
    console.warn("No signing key: the bundle is unsigned and can't be published as an update.");
  }
  console.log(`Built dist-desktop/ (bundle ${manifest.version}, build ${manifest.build}, ${Object.keys(files).length} files${key ? ", signed" : ""})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
