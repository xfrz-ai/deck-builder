// Checks a feed (latest.json) for a newer bundle, downloads and installs it.
// The feed only says where the zip is; trust comes from the signature inside
// the bundle (bundles.ts), so a wrong feed can at worst offer an old or
// broken bundle, which is refused.
//
// latest.json: { "build": 1763900000, "version": "0.1.0", "shellApi": 1,
//                "url": "wknd-deck-bundle-1763900000.zip", "sha256": "…", "size": 1234567 }
// "url" may be relative to the feed.

import { installBundle, SHELL_API, sha256, type BundleManifest } from "./bundles";

const MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024;

export interface UpdateFeed {
  build: number;
  version: string;
  shellApi: number;
  url: string;
  sha256: string;
  size: number;
}

export type UpdateResult =
  | { status: "current" }
  | { status: "installed"; manifest: BundleManifest }
  | { status: "needs-new-app"; feed: UpdateFeed };

function parseFeed(value: unknown): UpdateFeed {
  const feed = value as Partial<UpdateFeed>;
  if (
    !Number.isSafeInteger(feed.build) ||
    typeof feed.version !== "string" ||
    !Number.isSafeInteger(feed.shellApi) ||
    typeof feed.url !== "string" ||
    typeof feed.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(feed.sha256) ||
    !Number.isSafeInteger(feed.size) || (feed.size ?? 0) <= 0
  ) {
    throw new Error("Invalid update feed.");
  }
  return feed as UpdateFeed;
}

export async function checkForUpdate(options: { feedUrl: string; activeBuild: number; bundlesDir: string; publicKey: string }): Promise<UpdateResult> {
  const response = await fetch(options.feedUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  // No release published yet.
  if (response.status === 404) return { status: "current" };
  if (!response.ok) throw new Error(`Update feed returned ${response.status}.`);
  const feed = parseFeed(await response.json());

  if (feed.build <= options.activeBuild) return { status: "current" };
  if (feed.shellApi > SHELL_API) return { status: "needs-new-app", feed };
  if (feed.size > MAX_DOWNLOAD_BYTES) throw new Error("The update is too large.");

  // Relative to the feed URL as configured, not the redirect target: GitHub's
  // "releases/latest/download/" redirects to a signed storage URL.
  const download = await fetch(new URL(feed.url, options.feedUrl), { signal: AbortSignal.timeout(10 * 60_000) });
  if (!download.ok) throw new Error(`Update download returned ${download.status}.`);
  const bytes = new Uint8Array(await download.arrayBuffer());
  if (bytes.byteLength !== feed.size || sha256(bytes) !== feed.sha256) throw new Error("The update download is incomplete or changed.");

  const manifest = await installBundle(bytes, {
    bundlesDir: options.bundlesDir,
    publicKey: options.publicKey,
    newerThan: options.activeBuild,
  });
  return { status: "installed", manifest };
}
