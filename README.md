# Deck Builder

A browser-based presentation editor built with Next.js, Konva and Zustand. Exports to PPTX via `pptxgenjs`.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — `/` redirects to `/editor`.

## Build

The app is fully client-side, so it is built as a Next.js **static export** (`output: "export"` in `next.config.ts`):

```bash
npm run build   # outputs to ./out
```

## Deploy to Cloudflare Workers

The static export is served by a Worker using [Static Assets](https://developers.cloudflare.com/workers/static-assets/), configured in `wrangler.jsonc`.

```bash
npx wrangler login   # first time only
npm run preview      # build + run locally with wrangler dev
npm run deploy       # build + deploy to Cloudflare
```

### Deploy from GitHub (Workers Builds)

In the Cloudflare dashboard → Workers & Pages → Create → Import a repository, select this repo and set:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
