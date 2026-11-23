// Desktop app bundle updates (electron/bundles.ts, electron/updater.ts):
// only bundles signed with the shell's key, unchanged on disk and newer than
// the one in use are installed and selected.

import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import JSZip from "jszip";

import { installBundle, SHELL_API, selectBundle, sha256, type BundleManifest } from "../electron/bundles";
import { checkForUpdate } from "../electron/updater";

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(), privateKey };
}

async function tempDir(t: { after: (fn: () => unknown) => void }) {
  const dir = await mkdtemp(join(tmpdir(), "desktop-bundles-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

// A bundle zip with the given files, signed with `privateKey`.
async function bundleZip(build: number, privateKey: ReturnType<typeof keyPair>["privateKey"], files: Record<string, string> = { "engine.cjs": `module.exports = ${build};` }, options: { shellApi?: number; extra?: Record<string, string> } = {}) {
  const manifest: BundleManifest = {
    format: 1,
    build,
    version: "0.1.0",
    shellApi: options.shellApi ?? SHELL_API,
    createdAt: new Date().toISOString(),
    files: Object.fromEntries(Object.entries(files).map(([path, text]) => [path, sha256(Buffer.from(text))])),
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const zip = new JSZip();
  zip.file("manifest.json", manifestBytes);
  zip.file("manifest.sig", sign(null, manifestBytes, privateKey).toString("base64"));
  for (const [path, text] of Object.entries({ ...files, ...options.extra })) zip.file(path, text);
  return zip.generateAsync({ type: "uint8array" });
}

async function builtinBundle(dir: string, build: number) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ format: 1, build, version: "0.1.0", shellApi: SHELL_API, createdAt: "", files: {} }));
}

const noLog = () => undefined;

test("a signed, newer bundle is installed and selected over the built-in one", async (t) => {
  const dir = await tempDir(t);
  const keys = keyPair();
  const builtinDir = join(dir, "builtin");
  const bundlesDir = join(dir, "bundles");
  await builtinBundle(builtinDir, 100);

  const manifest = await installBundle(await bundleZip(200, keys.privateKey), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 });
  assert.equal(manifest.build, 200);

  const selected = await selectBundle({ builtinDir, bundlesDir, publicKey: keys.publicKey, log: noLog });
  assert.equal(selected.source, "downloaded");
  assert.equal(selected.manifest.build, 200);
  assert.equal(await readFile(join(selected.dir, "engine.cjs"), "utf8"), "module.exports = 200;");
});

test("bundles signed with another key, older ones and ones for a newer shell are refused", async (t) => {
  const dir = await tempDir(t);
  const keys = keyPair();
  const other = keyPair();
  const bundlesDir = join(dir, "bundles");

  await assert.rejects(installBundle(await bundleZip(200, other.privateKey), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 }), /signature/);
  await assert.rejects(installBundle(await bundleZip(90, keys.privateKey), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 }), /not newer/);
  await assert.rejects(installBundle(await bundleZip(300, keys.privateKey, undefined, { shellApi: SHELL_API + 1 }), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 }), /newer app/);
});

test("a zip entry pointing outside the bundle is rejected before anything is written there", async (t) => {
  const dir = await tempDir(t);
  const keys = keyPair();
  const bundlesDir = join(dir, "bundles");
  const zip = await bundleZip(200, keys.privateKey, undefined, { extra: { "../escaped.txt": "x" } });

  await assert.rejects(installBundle(zip, { bundlesDir, publicKey: keys.publicKey, newerThan: 100 }), /Unsafe path/);
  await assert.rejects(readFile(join(dir, "escaped.txt")), { code: "ENOENT" });
});

test("a changed file in an installed bundle makes the app fall back and never use it again", async (t) => {
  const dir = await tempDir(t);
  const keys = keyPair();
  const builtinDir = join(dir, "builtin");
  const bundlesDir = join(dir, "bundles");
  await builtinBundle(builtinDir, 100);
  await installBundle(await bundleZip(200, keys.privateKey), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 });

  await writeFile(join(bundlesDir, "200", "engine.cjs"), "module.exports = 'tampered';");
  const messages: string[] = [];
  const selected = await selectBundle({ builtinDir, bundlesDir, publicKey: keys.publicKey, log: (message) => messages.push(message) });
  assert.equal(selected.source, "builtin");
  assert.match(messages.join("\n"), /changed: engine\.cjs/);

  // Even a correct reinstall of that build is refused now.
  await assert.rejects(installBundle(await bundleZip(200, keys.privateKey), { bundlesDir, publicKey: keys.publicKey, newerThan: 100 }), /failed before/);
});

test("the updater downloads from the feed, checks the zip hash and installs", async (t) => {
  const dir = await tempDir(t);
  const keys = keyPair();
  const bundlesDir = join(dir, "bundles");
  const zip = await bundleZip(300, keys.privateKey);
  let served = zip;

  const server = createServer((request, response) => {
    if (request.url === "/releases/latest.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ build: 300, version: "0.1.0", shellApi: SHELL_API, url: "bundle-300.zip", sha256: sha256(zip), size: zip.byteLength }));
    } else if (request.url === "/releases/bundle-300.zip") {
      response.end(Buffer.from(served));
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const feedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/releases/latest.json`;

  // A download that doesn't match the feed's hash is refused.
  served = new Uint8Array(zip.byteLength);
  await assert.rejects(checkForUpdate({ feedUrl, activeBuild: 100, bundlesDir, publicKey: keys.publicKey }), /incomplete or changed/);

  served = zip;
  const result = await checkForUpdate({ feedUrl, activeBuild: 100, bundlesDir, publicKey: keys.publicKey });
  assert.equal(result.status, "installed");
  assert.deepEqual(await checkForUpdate({ feedUrl, activeBuild: 300, bundlesDir, publicKey: keys.publicKey }), { status: "current" });
});
