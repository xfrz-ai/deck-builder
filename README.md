# Deck Builder

A browser-based editor for Weekend (WKND) presentations. Pick a slide layout, edit content on a 1920×1080 canvas, present full-screen and export to PowerPoint.

**Open the app:** <https://deck-builder.xfrz-ai.workers.dev>

- [Make a deck with your AI agent](#make-a-deck-with-your-ai-agent): no install needed
- [Using the editor](#using-the-editor)
- [Run it locally](#run-it-locally)
- [Local AI features](#local-ai-features): the live Deck Agent, Ask AI and document import
- [Development](#development) and [Deploy](#deploy)

## Make a deck with your AI agent

Any AI agent or chat that can read a file or a link can write a WKND deck: Claude, ChatGPT, Codex, Gemini and so on. You don't need to install anything.

**1. Give your agent the guide.** Paste this into a new chat and fill in the brackets:

```text
Baca dan ikuti panduan ini: https://deck-builder.xfrz-ai.workers.dev/deck-guide.md
Bantu saya bikin deck tentang [topik] untuk [audiens].
```

If your agent can't open links, download [DECK-GUIDE.md](DECK-GUIDE.md) and attach it instead.

**2. Talk it through.** The agent asks a few questions about the brief and proposes a storyline, one line per slide. Once you approve it, the agent writes the whole deck as a JSON *deck spec*.

**3. Import the JSON.** Open the [app](https://deck-builder.xfrz-ai.workers.dev), click **Import**, choose the **Deck spec (JSON)** tab and paste the JSON (or **Upload .json**). Check the preview, then click **Create presentation**.

**4. Finish in the editor.** Swap the placeholder photos, fill in placeholders such as `[Nama Klien]`, then click **Present** or **Export** (PowerPoint).

Good to know:

- **Fixing issues:** the import lists issues per slide. Red errors mean text that doesn't fit or a wrong number of items. Paste the list back to your agent and it sends a corrected JSON.
- **Revisions:** ask your agent for changes. To apply them, open the presentation, click **Import** in the top bar, paste the new JSON and choose **Replace deck**. Replacing discards changes you made by hand, so make small text edits in the editor instead.
- **Storage:** decks are saved in your browser only, with no account. Use a laptop or desktop, because the editor needs a screen at least 1280px wide.

## Using the editor

- **Slide layouts:** 40 ready-made WKND layouts: covers, agenda, team, timeline, scope of work, tables, image, bento, full text, device mockups, and thank you / questions.
- **Structured components:** Agenda, Team, Timeline and Table slides are edited through a form. The layout reflows when the content changes, and the form warns when text doesn't fit.
- **Free editing:** text, shapes, images, cards, image grids, device mockups, snapping, zoom and an optional 24×12 layout grid.
- **Themes:** Blue, Cream, Black, Yellow and Orange, per slide or for the whole deck. Themes recolor elements reversibly.
- **Present:** the **Present** button in the right panel starts presentation mode.
- **Export:** **Export** in the top bar downloads the whole deck as a `.pptx`.
- **Autosave:** decks are saved in the browser (IndexedDB), with undo and redo.

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

## Run it locally

You need [Node.js](https://nodejs.org) 20 or later and Git.

```bash
git clone https://github.com/xfrz-ai/deck-builder.git
cd deck-builder
npm install
npm run dev
```

Open <http://localhost:3000> to see the presentation Library.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Build the static export into `./out` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Build, then serve `./out` locally with `wrangler dev` |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run ai-bridge` | Start the local AI bridge for Ask AI, document import and Create with AI |
| `npm run deck-service` | Start the local deck service that the Deck Agent writes to |
| `npm run deck-agent` | Open the Library and start Codex with the deck tools |
| `npm run deck-agent:claude` | Same, with Claude Code |
| `npm run deck-agent:desktop-config -- --write` | Add the deck tools to Claude Desktop (backs up its config first) |
| `npm run test:deck-agent` | Test the deck service, MCP server, live updates and agent jobs |
| `npm run test:deck-agent:e2e -- --library` | Test Library discovery and live building in an isolated Chrome |

## Local AI features

These features only work with `npm run dev` on your own machine. They use [Claude Code](https://claude.com/claude-code) (or Codex for the Deck Agent), installed and logged in, so no API key is needed.

### Deck Agent: live build

Discuss the brief and storyline with Codex, Claude Code or Claude Desktop, and watch the agent build the deck slide by slide in the Library. It uses the deck tools over MCP, which check every slide as it is added.

```bash
npm run deck-service       # Terminal 1
npm run dev                # Terminal 2
npm run deck-agent:claude  # Terminal 3 (or npm run deck-agent for Codex)
```

In Claude Code, type `/deck` followed by your brief. Setup, Claude Desktop, live updates and data storage are described in [docs/local-deck-agent.md](docs/local-deck-agent.md) (Indonesian).

### Ask AI

The **Ask AI** button at the bottom left of the canvas edits the selected slide's Team, Agenda or Timeline content by chat, for example "Add a Data squad with 3 people" or "Move every phase one week later".

```bash
npm run ai-bridge   # Terminal 1
npm run dev         # Terminal 2
```

1. The browser sends the slide's content (text and structure, never photos) to the bridge at `http://127.0.0.1:8787`.
2. The bridge ([scripts/ai-bridge.mjs](scripts/ai-bridge.mjs)) runs `claude -p` in an empty temp folder with tools disabled, so Claude can't read or change project files.
3. The editor checks the proposal with the same rules as the forms. If a check fails, the errors go back to Claude for up to two retries.
4. Valid changes are applied as one undo step.

Notes:

- The chat only appears in `npm run dev`, or when `NEXT_PUBLIC_AI_BRIDGE_URL` is set.
- Choose the model with `AI_BRIDGE_MODEL=sonnet npm run ai-bridge` and the port with `AI_BRIDGE_PORT`.
- **Restart the bridge after editing `scripts/ai-bridge.mjs`.** An old bridge answers `Not found.`

### Import from Markdown or PowerPoint

**Import → Document (MD, PPTX)** turns a `.md` or `.pptx` file into WKND slides. It uses the same bridge, so run `npm run ai-bridge` next to `npm run dev`.

1. The browser reads the file. PowerPoint slides are read as text with font sizes, tables and speaker notes. Pictures and charts are not imported.
2. Claude picks a WKND layout for each slide and fills its fields.
3. The builder checks the result, and Claude fixes what doesn't fit, for up to two rounds.
4. You review the preview and Claude's notes, then import.

Choose **Keep content** to keep the slides, order and wording (only text that doesn't fit is shortened), or **Rewrite & condense** to let Claude restructure the story into about 12–20 slides.

## Development

Built with Next.js 16 (static export), React 19, Konva, Zustand and Tailwind CSS 4.

```
app/                  Routes: Library, /editor, /preview, /deck-spec/catalog.json, /deck-guide.md
components/home/      Presentation Library and live agent cards
components/editor/    Editor UI: canvas, sidebars, toolbars, dialogs, AI chat
components/ui/        Shared primitives (button, tooltip, menus, switch)
store/editor-store.tsx  Zustand store: deck state, actions, undo/redo, persistence
types/                Presentation, slide and component data types
lib/
  layouts/            Slide layout definitions, registry and 24×12 grid helpers
  agenda/ team/ timeline/ table/   Data models, validation and element generation
  themes/             Deck themes and theme application
  text/               Text measurement and text blocks
  elements/ image/ mockup/          Element factories, image fit, device mockups
  export/             PowerPoint export (pptxgenjs)
  presentation/       Persistence, validation, default deck
  ai/                 AI chat adapters, bridge client and document-to-deck generation
  deck-spec/          Deck spec builder and layout catalog
  deck-service/       Local deck service and atomic JSON repository
  local-deck/         Browser client for the deck service and live sessions
scripts/              AI bridge, deck service, MCP server and agent launchers
public/assets/        Brand images, 3D illustrations, placeholder photos
```

### Docs

| File | For |
|---|---|
| [DECK-GUIDE.md](DECK-GUIDE.md) | AI agents writing a deck spec. Also served by the app at `/deck-guide.md`. |
| [docs/agent-guide/playbook.md](docs/agent-guide/playbook.md) | Workflow and copy voice for MCP agents, read by the `get_deck_playbook` tool on every call |
| [docs/local-deck-agent.md](docs/local-deck-agent.md) | Setting up and using the live Deck Agent (Indonesian) |
| [docs/deck-spec/example-proposal.json](docs/deck-spec/example-proposal.json) | A full example spec, used by the end-to-end test |

The storytelling and copywriting sections of the playbook and `DECK-GUIDE.md` are the same text. **When you change one, change the other.**

### How slides are modelled

A deck is a `Presentation` with `slides`, and each slide is a list of positioned `elements` (`text`, `shape`, `image`). See [types/presentation.ts](types/presentation.ts).

Component slides (Agenda, Team, Timeline, Table) also store their **data** on the slide, for example `slide.team`. Their graphic elements are regenerated from that data, so edit the data through the store action rather than the elements. For example, `saveTeam` handles the form and `applyTeamData` handles the AI.

### Deck specs

A deck spec is JSON that picks a layout for each slide and fills its content fields. The format is in [DECK-GUIDE.md](DECK-GUIDE.md#4-deck-spec-format).

| File | Contents |
|---|---|
| [lib/deck-spec/deck-spec.ts](lib/deck-spec/deck-spec.ts) | Spec and result types |
| [lib/deck-spec/static-layouts.ts](lib/deck-spec/static-layouts.ts) | Fields of the fixed layouts, mapped to template element ids |
| [lib/deck-spec/component-layouts.ts](lib/deck-spec/component-layouts.ts) | Agenda, Team, Timeline and Table content, built with the same models and checks as the forms |
| [lib/deck-spec/build-deck.ts](lib/deck-spec/build-deck.ts) | `buildDeckFromSpec(spec, measure?)` |
| [lib/deck-spec/layout-catalog.ts](lib/deck-spec/layout-catalog.ts) | `getDeckSpecCatalog()`, served at `/deck-spec/catalog.json` |
| [lib/deck-spec/source-document.ts](lib/deck-spec/source-document.ts) | Reads `.md` and `.pptx` files into text for Claude |
| [lib/ai/deck-generation.ts](lib/ai/deck-generation.ts) | Drafts a spec with Claude, checks it and lets Claude fix problems |

31 of the 40 layouts can be used in a spec. Image Split, SOW Modules and the seven device mockups can't, because their content is positioned by hand. To support another fixed layout, add an entry to `STATIC_LAYOUT_CONTENT` whose `element` values match the layout's element ids (without the `<layoutId>-` prefix).

**When you add or change a layout, update [DECK-GUIDE.md](DECK-GUIDE.md) sections 5 and 6.** The catalog updates itself, but the guide doesn't.

### Adding a slide layout

1. Create `lib/layouts/wknd-<name>-layout.ts` exporting a `SlideLayoutDefinition`.
2. Position content on the **24×12 layout grid** using the helpers in [lib/layouts/layout-grid.ts](lib/layouts/layout-grid.ts). The grid has 60px side margins, so avoid hard-coded pixel offsets.
3. Register it in `SLIDE_LAYOUTS` in [lib/layouts/layout-registry.ts](lib/layouts/layout-registry.ts).

### Things to know

- **Next.js 16 differs from older versions.** Read the bundled docs in `node_modules/next/dist/docs/` before using Next APIs (see [AGENTS.md](AGENTS.md)).
- **The app is a static export** (`output: "export"`). There is no server, so route handlers that read the request (such as `POST` handlers) don't work, even in `next dev`. `GET` handlers marked `force-static` are prerendered into files.
- **Browser storage is per browser.** Library decks live in IndexedDB (`deck-library`), and images are stored inline. The legacy `presentation-editor-storage` localStorage key is kept for migration. Decks made by the Deck Agent live in `.deck-builder/decks` and appear in the Library while it is connected to the local deck service.

## Deploy

The static export is served by a Cloudflare Worker using [Static Assets](https://developers.cloudflare.com/workers/static-assets/), configured in [wrangler.jsonc](wrangler.jsonc).

```bash
npx wrangler login   # first time only
npm run preview      # build, then run locally with wrangler dev
npm run deploy       # build, then deploy to Cloudflare
```

To deploy on every push instead, go to **Workers & Pages → Create → Import a repository** in the Cloudflare dashboard, select this repo and set:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
