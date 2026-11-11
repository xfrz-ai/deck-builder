# Deck Builder

A browser-based editor for building WKND-branded presentation decks. Pick a slide layout, edit content on a 1920×1080 canvas, present full-screen, and export to PowerPoint.

Built with Next.js 16 (static export), React 19, Konva, Zustand and Tailwind CSS 4. Deployed to Cloudflare Workers as static assets.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `/` redirects to `/editor`.

The editor needs a screen at least **1280px wide**. Narrower windows show a notice instead of the editor.

## Features

- **Slide layouts:** about 40 ready-made WKND layouts in these groups:
  - Cover, Agenda, Team, Timeline
  - Scope of work, Tables
  - Image, Bento, Full text, Device mockups
  - Thank you / Questions
- **Structured components:** Agenda, Team, Timeline and Table slides are generated from data and edited through a form. The layout reflows when content changes, and the form warns when text doesn't fit the design.
- **Free editing:** text, shapes, images, cards, image grids, device mockups, snapping, zoom, and an optional 24×12 layout grid overlay.
- **Themes:** Blue, Cream, Black, Yellow and Orange, per slide or for the whole deck. Themes recolor elements reversibly.
- **Presentation mode:** use the **Present** button in the right panel.
- **PowerPoint export:** export the whole deck as a `.pptx` from the top bar.
- **Import from documents (local only):** turn a Markdown or PowerPoint file into WKND slides with Claude, then review and import. Use **Import** in the top bar. See [Import from MD or PPTX](#import-from-md-or-pptx-local-only).
- **Deck spec import:** build a whole deck from a JSON spec, for example one written by an AI agent. See [docs/deck-spec](docs/deck-spec/README.md).
- **Guide for AI agents:** how to write a `.md` concept, `.pptx` or deck spec that imports cleanly, with every layout and its text limits. See [docs/agent-guide](docs/agent-guide/README.md).
- **AI assistant (local only):** edit Team, Agenda and Timeline content by chatting. See [AI assistant](#ai-assistant-local-only).
- **Autosave:** the deck is saved to the browser's `localStorage`, with undo/redo.

### Keyboard shortcuts

| Action | Keys |
|---|---|
| Undo / Redo | `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` (or `Ctrl+Y`) |
| Select all | `Cmd/Ctrl+A` |
| Insert text box | `T` |
| Bold / Italic | `Cmd/Ctrl+B` / `Cmd/Ctrl+I` |
| Move selection | Arrow keys (`Shift` = 10px) |
| Duplicate element | `Cmd/Ctrl+D` |
| Duplicate slide | `Cmd/Ctrl+Shift+D` |
| Delete | `Delete` / `Backspace` |
| Previous / next slide | `↑` / `↓` or `PageUp` / `PageDown` (nothing selected) |
| Deselect | `Esc` |

In presentation mode, use `→`, `Space`, `Enter` or `N` to go forward, `←`, `Backspace` or `P` to go back, and `Esc` to exit.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Build the static export into `./out` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Build, then serve `./out` locally with `wrangler dev` |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run ai-bridge` | Start the local AI assistant bridge (dev only) |

## AI assistant (local only)

The **Ask AI** button in the bottom-left of the canvas opens a chat. It edits the selected slide's Team, Agenda or Timeline content, for example "Add a Data squad with 3 people" or "Move every phase one week later".

It runs on **Claude Code on your own machine**, so no API key is needed. You need [Claude Code](https://claude.com/claude-code) installed and logged in.

```bash
# Terminal 1
npm run ai-bridge

# Terminal 2
npm run dev
```

How it works:

1. The browser sends the slide's content (text and structure only, never photos) to the bridge at `http://127.0.0.1:8787`.
2. The bridge ([scripts/ai-bridge.mjs](scripts/ai-bridge.mjs)) runs `claude -p` in an empty temp folder with tools disabled, so Claude can't read or change project files.
3. The editor checks the proposal with the same rules as the forms, such as item limits and whether text fits. If a check fails, the errors go back to Claude for up to two retries.
4. Valid changes are applied as a single undo step, so `Cmd/Ctrl+Z` reverts them.

Notes:

- The chat only appears in `npm run dev`, or when `NEXT_PUBLIC_AI_BRIDGE_URL` is set. It is not part of the deployed site.
- It uses your Claude Code default model. Override it with `AI_BRIDGE_MODEL=sonnet npm run ai-bridge`. The port can be changed with `AI_BRIDGE_PORT`.
- **Restart the bridge after editing `scripts/ai-bridge.mjs`.** An old bridge answers `Not found.`
- Limits come from the layouts: Team "Squads" holds 4 groups, "Org" holds 5; Agenda holds 6 items; Timeline holds 5–10 phases depending on the variant.

## Import from MD or PPTX (local only)

**Import → Document** turns a `.md` or `.pptx` file into WKND slides. It uses the same local bridge as the AI assistant, so start `npm run ai-bridge` next to `npm run dev`.

1. The browser reads the file. PowerPoint slides are read as text with font sizes, tables and speaker notes. Text that repeats on most slides, such as the deck name and page numbers, is dropped. Pictures and charts are not imported.
2. Claude picks a WKND layout for each slide and fills its fields, following [the layout catalog](docs/deck-spec/README.md#the-catalog).
3. The deck builder checks the result. Claude fixes what does not fit, for up to two rounds.
4. You review the preview, Claude's notes and any remaining issues, then choose **Replace deck** or **Add to deck**.

There are two modes:

- **Keep content** keeps the slides, order and wording, and shortens only text that doesn't fit. WKND titles are short, so long source titles are often shortened.
- **Rewrite & condense** lets Claude restructure the story into about 12–20 slides.

Placeholders such as `[Nama Klien]` are kept as written. A long document can take a few minutes. Speaker notes are read for context but are not added to the slides.

## Project structure

```
app/                  Next.js routes (/ → /editor, /deck-spec/catalog.json)
components/editor/    Editor UI: canvas, sidebars, toolbars, dialogs, AI chat
components/ui/        Shared primitives (button, tooltip, menus, switch)
store/editor-store.tsx  Zustand store: deck state, actions, undo/redo, persistence
types/                Presentation, slide and component data types
lib/
  layouts/            Slide layout definitions + registry + 24×12 grid helpers
  agenda/ team/ timeline/ table/   Data models, validation and element generation
  themes/             Deck themes and theme application
  text/               Text measurement and text blocks
  elements/ image/ mockup/          Element factories, image fit, device mockups
  export/             PowerPoint export (pptxgenjs)
  presentation/       Persistence, validation, default deck
  ai/                 AI chat adapters and bridge client
  deck-spec/          Deck spec → presentation builder and layout catalog
scripts/ai-bridge.mjs Local bridge between the AI chat and Claude Code
public/assets/        Brand images, 3D illustrations, placeholder photos
```

### How slides are modelled

A deck is a `Presentation` with `slides`, and each slide is a list of positioned `elements` (`text`, `shape`, `image`). See [types/presentation.ts](types/presentation.ts).

Component slides (Agenda, Team, Timeline, Table) also store their **data** on the slide, for example `slide.team`. Their graphic elements are regenerated from that data, so edit the data through the store action rather than the elements. For example, `saveTeam` handles the form and `applyTeamData` handles the AI.

### Adding a slide layout

1. Create `lib/layouts/wknd-<name>-layout.ts` exporting a `SlideLayoutDefinition`.
2. Position content on the **24×12 layout grid** using the helpers in [lib/layouts/layout-grid.ts](lib/layouts/layout-grid.ts). The grid has 60px side margins, so avoid hard-coded pixel offsets.
3. Register it in `SLIDE_LAYOUTS` in [lib/layouts/layout-registry.ts](lib/layouts/layout-registry.ts).

### Things to know

- **Next.js 16 differs from older versions.** Read the bundled docs in `node_modules/next/dist/docs/` before using Next APIs (see [AGENTS.md](AGENTS.md)).
- **The app is a static export** (`output: "export"`). There is no server, so API routes that read the request (e.g. `POST` handlers) don't work, even in `next dev`.
- **Storage is per browser.** The deck lives in `localStorage` under `presentation-editor-storage`, and images are stored inline. Large images can fill the quota, and the editor warns when storage is full.

## Build

```bash
npm run build   # outputs to ./out
```

## Deploy to Cloudflare Workers

The static export is served by a Worker using [Static Assets](https://developers.cloudflare.com/workers/static-assets/), configured in [wrangler.jsonc](wrangler.jsonc).

```bash
npx wrangler login   # first time only
npm run preview      # build + run locally with wrangler dev
npm run deploy       # build + deploy to Cloudflare
```

### Deploy from GitHub (Workers Builds)

In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**, select this repo and set:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
