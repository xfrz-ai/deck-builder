// App bundles: everything of the desktop app that changes often (the web app,
// slide layouts, templates, the playbook and the main-process engine) lives in
// a bundle folder next to a small, rarely changing shell (shell.ts).
//
//   bundle/
//     manifest.json   build number, version, shell API and the SHA-256 of every file
//     manifest.sig    Ed25519 signature of manifest.json (base64)
//     engine.cjs      main-process engine (electron/engine.ts)
//     web/…           the Next.js static export
//     …
//
// The bundle inside the app is trusted as is. Downloaded bundles live in
// <userData>/bundles/<build>/ and are used only while their signature and
// every file hash check out against the public key built into the shell.

import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import JSZip from "jszip";

// Version of the contract between shell and engine (electron/engine-api.ts).
// A bundle needing a newer shell is skipped, and the user is asked to download
// the new app.
export const SHELL_API = 1;
const FORMAT = 1;

const MAX_FILES = 5000;
const MAX_UNPACKED_BYTES = 300 * 1024 * 1024;

export interface BundleManifest {
  format: number;
  build: number;
  version: string;
  shellApi: number;
  createdAt: string;
  files: Record<string, string>;
}

export interface SelectedBundle {
  dir: string;
  manifest: BundleManifest;
  source: "builtin" | "downloaded";
}

interface BundleState {
  current?: number;
  bad: number[];
}

export function sha256(data: Uint8Array) {
  return createHash("sha256").update(data).digest("hex");
}

// Relative, forward-slash paths without "..": no file may land outside the bundle.
export function assertSafePath(path: string) {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    throw new Error(`Unsafe path in bundle: ${JSON.stringify(path)}`);
  }
  for (const part of path.split("/")) {
    if (part === "" || part === "." || part === "..") throw new Error(`Unsafe path in bundle: ${JSON.stringify(path)}`);
  }
}

export function parseManifest(bytes: Uint8Array): BundleManifest {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as Partial<BundleManifest>;
  if (
    value.format !== FORMAT ||
    !Number.isSafeInteger(value.build) || (value.build ?? 0) <= 0 ||
    typeof value.version !== "string" ||
    !Number.isSafeInteger(value.shellApi) ||
    typeof value.files !== "object" || value.files === null
  ) {
    throw new Error("Invalid bundle manifest.");
  }
  for (const [path, hash] of Object.entries(value.files)) {
    assertSafePath(path);
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid hash for ${path}.`);
  }
  return value as BundleManifest;
}

export async function readManifest(dir: string) {
  return parseManifest(await readFile(join(dir, "manifest.json")));
}

// Checks the signature of manifest.json and the hash of every listed file.
export async function verifyBundleDir(dir: string, publicKeyPem: string) {
  const manifestBytes = await readFile(join(dir, "manifest.json"));
  const signature = Buffer.from((await readFile(join(dir, "manifest.sig"), "utf8")).trim(), "base64");
  if (!verify(null, manifestBytes, createPublicKey(publicKeyPem), signature)) {
    throw new Error("The bundle signature is not valid.");
  }
  const manifest = parseManifest(manifestBytes);
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (sha256(await readFile(join(dir, path))) !== hash) throw new Error(`Bundle file changed: ${path}`);
  }
  return manifest;
}

// ---------------------------------------------------------------------------
// Downloaded bundles
// ---------------------------------------------------------------------------

async function readState(bundlesDir: string): Promise<BundleState> {
  try {
    const value = JSON.parse(await readFile(join(bundlesDir, "state.json"), "utf8")) as Partial<BundleState>;
    return {
      current: Number.isSafeInteger(value.current) ? value.current : undefined,
      bad: Array.isArray(value.bad) ? value.bad.filter(Number.isSafeInteger) : [],
    };
  } catch {
    return { bad: [] };
  }
}

async function writeState(bundlesDir: string, state: BundleState) {
  await mkdir(bundlesDir, { recursive: true });
  const temporary = join(bundlesDir, `state.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(state));
  await rename(temporary, join(bundlesDir, "state.json"));
}

// The newest usable bundle: a verified download newer than the built-in one,
// or the built-in bundle.
export async function selectBundle(options: { builtinDir: string; bundlesDir: string; publicKey: string; log: (message: string) => void }): Promise<SelectedBundle> {
  const builtin: SelectedBundle = { dir: options.builtinDir, manifest: await readManifest(options.builtinDir), source: "builtin" };
  const state = await readState(options.bundlesDir);
  const build = state.current;
  if (!build || build <= builtin.manifest.build || state.bad.includes(build)) return builtin;

  const dir = join(options.bundlesDir, String(build));
  try {
    const manifest = await verifyBundleDir(dir, options.publicKey);
    if (manifest.build !== build) throw new Error("Bundle folder and manifest disagree.");
    if (manifest.shellApi > SHELL_API) throw new Error("Bundle needs a newer app.");
    return { dir, manifest, source: "downloaded" };
  } catch (error) {
    options.log(`Ignoring downloaded bundle ${build}: ${error instanceof Error ? error.message : String(error)}`);
    await markBad(options.bundlesDir, build);
    return builtin;
  }
}

// A bundle that failed to verify or start is never used again.
export async function markBad(bundlesDir: string, build: number) {
  const state = await readState(bundlesDir);
  if (!state.bad.includes(build)) state.bad.push(build);
  if (state.current === build) state.current = undefined;
  await writeState(bundlesDir, state);
  await rm(join(bundlesDir, String(build)), { recursive: true, force: true });
}

async function extractZip(zipBytes: Uint8Array, target: string) {
  const zip = await JSZip.loadAsync(zipBytes);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_FILES) throw new Error("The bundle has too many files.");
  let total = 0;
  for (const entry of entries) {
    // JSZip quietly rewrites names like "../x"; a bundle containing one is refused.
    assertSafePath((entry as { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name);
    assertSafePath(entry.name);
    const data = await entry.async("uint8array");
    total += data.byteLength;
    if (total > MAX_UNPACKED_BYTES) throw new Error("The bundle is too large.");
    const path = join(target, entry.name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }
}

// Unpacks a downloaded bundle, verifies it and makes it the one used from the
// next start. Keeps the previous download as a fallback.
export async function installBundle(zipBytes: Uint8Array, options: { bundlesDir: string; publicKey: string; newerThan: number }) {
  await mkdir(options.bundlesDir, { recursive: true });
  const incoming = join(options.bundlesDir, `.incoming-${randomUUID()}`);
  try {
    await extractZip(zipBytes, incoming);
    const manifest = await verifyBundleDir(incoming, options.publicKey);
    if (manifest.build <= options.newerThan) throw new Error("The bundle is not newer than the one in use.");
    if (manifest.shellApi > SHELL_API) throw new Error("The bundle needs a newer app.");

    const state = await readState(options.bundlesDir);
    if (state.bad.includes(manifest.build)) throw new Error("This bundle failed before.");
    const final = join(options.bundlesDir, String(manifest.build));
    await rm(final, { recursive: true, force: true });
    await rename(incoming, final);

    const previous = state.current;
    await writeState(options.bundlesDir, { current: manifest.build, bad: state.bad });
    // Keep the new and the previous bundle, drop older ones.
    for (const name of await readdir(options.bundlesDir)) {
      if (/^\d+$/.test(name) && Number(name) !== manifest.build && Number(name) !== previous) {
        await rm(join(options.bundlesDir, name), { recursive: true, force: true });
      }
    }
    return manifest;
  } finally {
    await rm(incoming, { recursive: true, force: true });
  }
}
