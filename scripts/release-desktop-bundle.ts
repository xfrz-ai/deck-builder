// Turns the signed dist-desktop/bundle into an update the app can download:
//
//   dist-desktop/release/wknd-deck-bundle-<build>.zip
//   dist-desktop/release/latest.json
//
// Attach both to a GitHub release: apps read
// https://github.com/xfrz-ai/deck-builder/releases/latest/download/latest.json

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import JSZip from "jszip";

import { readManifest, sha256 } from "../electron/bundles";

const root = resolve(__dirname, "..");
const bundleDir = join(root, "dist-desktop", "bundle");
const releaseDir = join(root, "dist-desktop", "release");

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

async function main() {
  const manifest = await readManifest(bundleDir);
  try {
    await readFile(join(bundleDir, "manifest.sig"));
  } catch {
    throw new Error("The bundle is unsigned. Build it with the signing key first.");
  }

  const zip = new JSZip();
  for (const file of (await listFiles(bundleDir)).sort()) {
    zip.file(relative(bundleDir, file).split("\\").join("/"), await readFile(file));
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });

  await rm(releaseDir, { recursive: true, force: true });
  await mkdir(releaseDir, { recursive: true });
  const name = `wknd-deck-bundle-${manifest.build}.zip`;
  await writeFile(join(releaseDir, name), bytes);
  await writeFile(join(releaseDir, "latest.json"), JSON.stringify({
    build: manifest.build,
    version: manifest.version,
    shellApi: manifest.shellApi,
    url: name,
    sha256: sha256(bytes),
    size: bytes.byteLength,
  }, null, 2));
  console.log(`Wrote dist-desktop/release/${name} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB) and latest.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
