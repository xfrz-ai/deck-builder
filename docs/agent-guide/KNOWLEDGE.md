# WKND Deck Builder: knowledge base for AI agents

Everything an AI agent needs to operate the WKND Deck Builder well: what it is, how to connect, how to run a deck conversation with the user, the storytelling and copy rules, every layout and tool, and how to recover from errors. Read it top to bottom once; later, jump to the section you need.

**Sources of truth.** This file is a summary. When it disagrees with a live source, the live source wins:

| Topic | Live source |
|---|---|
| Workflow, storytelling, copy voice | `get_deck_playbook` tool (file `docs/agent-guide/playbook.md`) |
| Layout ids, fields, item counts, character limits | `list_layouts` tool (also `/deck-spec/catalog.json`) |
| Themes, palette, typography | `get_brand_styles` tool |

---

## 1. Mental model

- The Deck Builder makes **Weekend (WKND) branded presentations**: 16:9, 1920×1080, on a 24×12 grid.
- **You don't design slides.** Every slide is one of **31 fixed layouts**. You pick a layout and fill its content fields; the layout owns every position, color, font, photo and 3D asset. That is how brand consistency is guaranteed.
- **The builder is deterministic.** It has no AI of its own. It validates your content (required fields, item counts, text fit) and either builds the slide or returns errors for you to fix.
- A deck is described as a **DeckSpec** (JSON): `{ title, theme?, footer?, slides: [{ layout, content }] }`.
- Text fit is **estimated** (`validation: "estimated"`). Aim for about 85% of every limit so the real font still fits.
- Decks built through the tools are saved by a **local deck service** and appear live in the **Library** (`http://localhost:3000`), where a person can watch, edit and export to PowerPoint.

---

## 2. Ways to operate the Deck Builder

Pick the first one your environment supports.

| Route | How | Best for |
|---|---|---|
| **A. MCP tools (preferred)** | Connect to the `deck_builder` MCP server and call its tools. Builds live in the Library. | Any agent that supports MCP: Claude Code, Claude Desktop, Codex, others |
| **B. "Create with AI" chat** | Built into the Library home page; runs Claude Code headless with the same tools and playbook. | People working in the browser (not for other agents) |
| **C. DeckSpec JSON file** | Write a `.json` deck spec; a person imports it via **Import** in the editor or home. No AI in between. | Agents without MCP that can still produce a file |
| **D. Markdown or PPTX concept** | Write a `.md` concept (or give a `.pptx`); the importer (Claude) maps it to layouts, a person reviews and imports. | Human-readable drafts, re-branding an old deck |

If you can only produce text, prefer **C** (exact control) over **D**. For C and D, follow sections 4–8 the same way; only the delivery differs. Details on writing `.md` and `.pptx` sources: `docs/agent-guide/README.md`.

---

## 3. Setup (route A)

The person runs these from the project folder, each in its own terminal:

```sh
npm run deck-service   # local deck service on 127.0.0.1:8790 (required for tools)
npm run dev            # editor and Library on http://localhost:3000
```

Then connect the agent:

| Client | How |
|---|---|
| Claude Code CLI | `npm run deck-agent:claude`, then `/deck <brief>` (add `-- --remote-control "WKND Deck"` to drive it from the Claude mobile app) |
| Codex CLI | `npm run deck-agent` |
| Claude Desktop | once: `npm run deck-agent:desktop-config -- --write`, then restart Desktop |
| Browser chat | `npm run ai-bridge`, then **Create with AI** on the home page |
| Any other MCP client | stdio server; see below |

Generic MCP stdio config (absolute paths):

```json
{
  "mcpServers": {
    "deck_builder": {
      "command": "node",
      "args": ["--import", "<project>/node_modules/tsx/dist/loader.mjs", "<project>/scripts/deck-mcp.ts"],
      "env": { "DECK_DATA_DIR": "<project>/.deck-builder", "TSX_TSCONFIG_PATH": "<project>/tsconfig.json" }
    }
  }
}
```

The MCP server also exposes a prompt, `plan_deck` (argument `brief`), that starts a deck conversation with the playbook loaded.

**Check the connection:** call `get_deck_playbook`. If a tool returns `SERVICE_UNAVAILABLE`, ask the person to start `npm run deck-service`.

---

## 4. Workflow with the user

The user approves **once**, at the storyline. After that you write and build without asking again.

### Step 1: Brief

Call `get_deck_playbook` first. Ask only about what you don't know yet: **at most five short questions, in one message**.

1. **Goal:** what should the audience decide or do afterwards?
2. **Audience:** who are they, what do they know or worry about?
3. **Context:** client, project, the problem, history.
4. **Facts available:** numbers, prices, dates, team, references. Everything else becomes a placeholder.
5. **Format:** number of slides, language, presented live or sent as a document.

If the user pasted a document, read it and only ask about real gaps. If they say "just go", state your assumptions in one line and continue.

### Step 2: Storyline (the approval point)

Propose one line per slide, as the slide's **message** plus its layout:

```
1. Kopi Senja — wknd-cover-brand
2. Tiga hal yang kita bahas hari ini — wknd-agenda-chapters
3. Pelanggan setia, tapi tidak bertambah — wknd-full-text-statement
...
```

Add one line on the story arc and on any assumptions or placeholders. Then ask: *"Storyline ini oke? Kalau oke, aku langsung tulis copy dan build."* **Wait for the answer.** Small changes can go straight to the build; show the list again only after big changes.

### Step 3: Copy and build (no more questions)

1. `list_layouts` with `layoutId` for each layout you use, to get exact fields and limits.
2. Write the copy for every slide (section 6), at about 85% of each limit.
3. Build **live** (section 9): `create_deck` with the cover only, then `add_slide` one at a time in storyline order.
4. If a slide fails validation, shorten or reshape **that slide** and retry. Don't change the storyline to dodge errors.
5. `finish_deck`. Reply with the deck title, a list of every placeholder the user still has to fill, and any slide you had to adapt.

### Step 4: Revisions

The user asks for changes per slide ("slide 4 judulnya kurang tajam"). `get_deck` for the current revision and slide ids, then `update_slide`. For changes across several slides, call `start_deck_run` first. Keep the user's manual edits unless they ask you to replace them.

---

## 5. Storytelling

### Default arc for a pitch or proposal

**Problem → impact → solution → proof → plan → next step.**

| Part | Answers | Typical layouts |
|---|---|---|
| Opening | Who and what is this for? | Cover, then `wknd-agenda-chapters` or `wknd-agenda-overview` |
| Problem | What is wrong, or what is the opportunity? | `wknd-full-text-statement`, `wknd-full-text-paragraphs`, `wknd-image-field-notes` |
| Impact | Why does it matter now? | `wknd-bento-grid` (numbers in card titles), `wknd-full-text` |
| Solution | What do we propose? | `wknd-bento-columns`, `wknd-image-approach`, `wknd-image-moods` |
| Proof | Why believe us? | `wknd-image-two-studies`, `wknd-bento-grid` |
| Plan | How, when, who? | `wknd-timeline-steps`, `wknd-timeline-road`, `wknd-timeline-roadmap`, `wknd-table-scope`, `wknd-team-org` |
| Next step | What do we need from you? | `wknd-table-packages`, `wknd-questions`, `wknd-thank-you` |

Other deck types:

- **Workshop:** cover, `wknd-agenda` (schedule), content per session, `wknd-questions`.
- **Project update:** cover, `wknd-agenda-overview`, `wknd-timeline-roadmap`, `wknd-bento-grid`, `wknd-table-bug-triage` or `wknd-table-scope`, `wknd-thank-you`.
- **Case study:** cover, challenge (`wknd-full-text-statement`), approach (`wknd-image-approach`), work (`wknd-image-moods` / `wknd-image-materials`), results (`wknd-bento-grid`), `wknd-thank-you`.

### Rules

- **One message per slide.** Two messages means two slides.
- **The titles alone tell the story** when read in order.
- **Open with a cover; close with `wknd-thank-you` or `wknd-questions`.**
- **Section dividers** (`wknd-agenda-spotlight`, `wknd-image-chapter`) only in decks over about 10 slides.
- **Vary layouts:** never the same layout twice in a row; any layout at most three times.
- **Fixed item counts:** merge, split over two slides or pick another layout. Never pad with filler items.
- **No layout exists for** charts, big-number slides, quote-only slides, logo walls or testimonials. Put metrics in `wknd-bento-grid` card titles.
- **Length:** about 10 slides for a pitch, 12–20 for a full proposal, unless told otherwise. Hard maximum: 60.

---

## 6. Copywriting (provisional WKND voice)

### Voice

- **Clear and professional, never stiff**, like a senior consultant talking to a client they respect.
- **Client first:** "Anda mendapat…" over "Kami adalah…". Address the reader as **Anda** in Indonesian.
- **Specific, or a placeholder.** Never invent names, numbers, prices, dates, clients, logos or testimonials. Use `[Nama Klien]`, `Rp [TBD]`, `[Tanggal]`, `[X]%`, and keep any placeholders the user wrote exactly as written.
- **Confident without hype:** prove with specifics, not adjectives.

### Language

- Write in the user's language, **Indonesian by default**. Mixed Indonesian and English stays mixed.
- Keep industry terms in English: UX, roadmap, MVP, design system, sprint, stakeholder.
- Delete empty words: *solusi inovatif, sinergi, end-to-end, holistik, revolusioner, terdepan, one-stop solution, memaksimalkan potensi*.
- Indonesian runs 20–30% longer than English. Check the limits.
- Agenda, team and timeline layouts write an **English intro** when `intro` is left out, so always set `intro` in non-English decks.

### Titles

- **A claim, not a label:** "Pengguna berhenti di langkah pembayaran", not "Temuan riset".
- Most content titles fit one line of about 20–36 characters. Move detail to the subtitle or intro. Use `"\n"` to break a title on purpose.
- Cover title: the client or project name, as short as possible.
- No full stop after a one-line title, unless the layout's example uses one for style.

### Body text and bullets

- Active voice, short sentences, one idea per sentence.
- Start bullets with a verb or an outcome, keep them parallel, and never repeat the title in a paragraph.

| Instead of | Write |
|---|---|
| Solusi Digital Inovatif untuk Bisnis Anda | Checkout 2 langkah untuk [Nama Klien] |
| Kami adalah agensi digital terdepan… | [X] produk digital diluncurkan bersama tim seperti Anda |
| Melakukan optimalisasi terhadap proses onboarding | Memangkas onboarding dari 7 menjadi 3 layar |
| Latar Belakang | Pelanggan mencari, tapi tidak menemukan |
| Next Steps | Tiga hal untuk mulai minggu depan |

---

## 7. DeckSpec format

```json
{
  "version": 1,
  "title": "Kopi Senja — Pitch",
  "theme": "blue",
  "footer": { "left": "Kopi Senja × Weekend", "note": "Confidential" },
  "slides": [
    { "layout": "wknd-cover-brand", "content": { "eyebrow": "Pitch — 2026", "title": "Kopi Senja", "subtitle": "Dari pelanggan setia ke pelanggan baru" } },
    { "layout": "wknd-thank-you", "content": { "subtitle": "Mari mulai minggu depan." } }
  ]
}
```

- `slides`: 1–60 items of `{ layout, theme?, content }`. Unknown keys at the deck or slide level are rejected; unknown **content** fields are ignored.
- `theme` (deck or per slide): `blue`, `cream`, `black`, `yellow`, `orange`. **Leave it out** to keep each layout's own colors, which is the usual WKND look.
- `footer`: optional `left` and `note` text shown on slides.
- Optional content fields you leave out are removed from the slide. Required fields are marked `*` below.
- **Images:** leave image fields out to keep the placeholder photos; the person swaps them in the editor. Through the deck service, only `/assets/...` paths or raster `data:` URLs are accepted (external URLs fail with `EXTERNAL_ASSET`).
- **Dates** (timelines, agenda): `YYYY-MM-DD`. If the source only has weeks or durations, start on the Monday after today and use `periodFormat: "weeks"`.

---

## 8. Layout reference (31 layouts)

Notation: `field*` required, `≤N` max characters, `list[min–max]{item fields}`. For component layouts (agenda, team, timeline, table) the exact nested shape and limits come from `list_layouts` with `layoutId`, which also returns an example for every layout. Call it before writing those slides.

| Layout | Category | Purpose | Fields |
|---|---|---|---|
| `wknd-cover-brand` | cover | Opening slide on blue with a huge one-line title, such as the client or project name. | eyebrow; title*≤17; subtitle≤92 |
| `wknd-cover-star` | cover | Opening slide on black with a 3D star and a huge one-line title. | title*≤15; subtitle≤59 |
| `wknd-cover-arches` | cover | Opening slide on yellow with 3D letters standing on arches. | title*≤14; subtitle≤58 |
| `wknd-cover-d` | cover | Opening slide on orange with a large 3D D and a two-line title. | eyebrow; title*≤24; subtitle≤74 |
| `wknd-agenda` | agenda | Workshop or meeting schedule: sessions with durations, a date, a location and a start time. | eyebrow; title; intro; items[1–6]{title, durationMinutes, kind}; date; location; startTime |
| `wknd-agenda-chapters` | agenda | Table of contents: numbered chapters with optional page numbers. | eyebrow; title; intro; items[1–6]{title, page} |
| `wknd-agenda-overview` | agenda | Agenda as cards: topics with a one-line description each. | eyebrow; title; intro; items[1–6]{title, description} |
| `wknd-agenda-spotlight` | agenda | Section divider that lists all topics and highlights the current one. Reuse it before each section. | eyebrow; items[1–6]{title, description, highlighted} |
| `wknd-team-structure` | team | Team structure: connected team cards with members. | eyebrow; title; intro; groups[1–4]{name, description, members} |
| `wknd-team-squads` | team | Squads: team cards with member photos, names and roles. | eyebrow; title; intro; groups[1–4]{name, description, members} |
| `wknd-team-org` | team | Org chart: one leader above team cards. | eyebrow; title; intro; leader; groups[1–5]{name, description, members} |
| `wknd-team-tree` | team | Org tree: one leader above team leads. | eyebrow; title; intro; leader; groups[1–5]{name, description, members} |
| `wknd-timeline-road` | timeline | Project timeline as milestones on a winding road. | eyebrow; title; intro; periodFormat; phases[1–5]{title, description, start, end} |
| `wknd-timeline-steps` | timeline | Project phases as steps that build up. | eyebrow; title; intro; periodFormat; phases[1–5]{title, description, start, end} |
| `wknd-timeline-roadmap` | timeline | Roadmap across months or quarters. | title; intro; periodFormat; phases[1–6]{title, description, start, end} |
| `wknd-table-packages` | table | Pricing or package comparison: features in rows, packages in columns, one highlighted. | eyebrow; title*≤23; subtitle≤70; table |
| `wknd-table-scope` | table | Scope of work: services in rows, phases in columns, each cell Lead, Support or —. | eyebrow; title*≤16; subtitle≤59; table |
| `wknd-table-bug-triage` | table | Bug or issue list grouped by severity, with steps, expected vs. actual and status. | eyebrow; title*≤27; subtitle≤65; table |
| `wknd-image-moods` | image | Four photos in a row, each with a short title and one sentence. | eyebrow; title*≤24; intro≤186; items[4–4]{image, title≤31, body≤98} |
| `wknd-image-materials` | image | Title and paragraphs on the left, a 2×2 grid of photos with captions on the right. | eyebrow; title*≤32; subtitle≤49; paragraphs[1–2]{text≤201}; items[4–4]{image, title≤51, body≤66} |
| `wknd-image-chapter` | image | Chapter divider over a full-bleed photo, with a text card. | background; eyebrow; title*≤48; subtitle≤72; body≤255; caption≤51 |
| `wknd-image-field-notes` | image | A wide photo banner under the title, with a heading and two notes. | eyebrow; title*≤26; banner; heading≤66; notes[1–2]{text≤171}; caption≤71 |
| `wknd-image-two-studies` | image | Two large photos side by side, each with a title and description. | eyebrow; title*≤24; intro≤183; studies[2–2]{image, title≤60, body≤273} |
| `wknd-image-approach` | image | Approach or key-points slide over a full-bleed photo with three statement cards. | background; title*≤19; subtitle≤53; points[3–3]{text≤78} |
| `wknd-bento-columns` | bento | Three tall cards, each with a title, subtitle, two paragraphs and three bullet points. | title*≤48; intro≤196; cards[3–3]{title≤26, subtitle≤50, body≤122, detail≤244, bullets≤177} |
| `wknd-bento-grid` | bento | Title, text and a button on the left with a 2×2 grid of numbered cards. | eyebrow; title*≤51; body≤220; button≤40; cards[4–4]{title≤27, subtitle≤47, body≤165, detail≤110} |
| `wknd-full-text` | text | Text-heavy slide on blue: title, intro, an optional pull quote and three numbered text columns. | eyebrow; title*≤36; subtitle≤164; quote≤126; columns[3–3]{body≤360} |
| `wknd-full-text-paragraphs` | text | Text-heavy slide on cream: title, intro, up to three stacked paragraphs and a small note. | eyebrow; title*≤36; subtitle≤164; paragraphs[1–3]{text≤416}; note≤132 |
| `wknd-full-text-statement` | text | Statement slide on yellow: a huge title on the left with three numbered text columns. | eyebrow; title*≤20; subtitle≤116; columns[3–3]{body≤370} |
| `wknd-thank-you` | thankyou | Closing slide with a huge "Thank you." and contact details. | subtitle≤49; website≤17; email≤24; phone≤22 |
| `wknd-questions` | thankyou | Closing "Any questions?" slide with three next steps. | eyebrow≤37; steps[3–3]{title≤25, body≤100} |

### Shapes of the component layouts

- **Agenda** `items`: `title` (may use `"\n"`), plus per variant: `durationMinutes` and `kind` (`"session"` / `"break"`) for `wknd-agenda` (also deck-level `date`, `location`, `startTime` `HH:MM`, all sessions end before midnight); `page` for chapters; `description` (under ~40 characters) for overview and spotlight; exactly one `highlighted: true` in spotlight.
- **Team** `groups`: `{ name (1–3 words), description (under ~40 characters), members: [{ name, role (under ~28 characters) }] }`, 1–4 members, the first shown as lead. Leave `name` out to show "Full Name". Org and tree add `leader: { name, role, badge }`.
- **Timeline** `phases`: `{ title (1–2 words), description (two short lines), start, end }` in chronological order; `periodFormat`: `weeks`, `dates` or `months`.
- **Table** `table`: `{ columns: [{ title, subtitle }], rows: [[cell per column]], highlightColumn?, badge? }`. Packages: 2–6 columns (the first labels the rows), 1–8 rows, `"✓"` and `"—"` render as a check and a dash. Scope cells are `Lead`, `Support` or `—`.

---

## 9. MCP tools and the live build protocol

### Tools

| Tool | Input | Use |
|---|---|---|
| `get_deck_playbook` | `{}` | Workflow, storytelling, copy voice. Call before planning. |
| `list_layouts` | `category?`, `layoutId?` | Layout fields, limits, examples. Filter to keep it small. |
| `get_brand_styles` | `{}` | Themes, palette, typography, grid, assets. |
| `create_deck` | `spec`, `requestId`, `live?`, `plannedSlides?` | New deck. Live mode starts with exactly one slide. |
| `add_slide` | `deckId`, `expectedRevision`, `requestId`, `slideSpec`, `afterSlideId?`, `runId`, `ownerToken` | Append (or insert after a slide). |
| `update_slide` | `deckId`, `slideId`, `expectedRevision`, `requestId`, exactly one of `contentPatch` / `slideSpec`, `replaceManual?`, `runId?`, `ownerToken?` | Rebuild one slide. |
| `get_deck` | `deckId`, `slideId?`, `includeElements?` | Current revision, slide ids, source specs, text. |
| `start_deck_run` | `deckId`, `expectedRevision`, `requestId`, `plannedSlides?` | Start or resume a multi-step job on an existing deck. |
| `finish_deck` | `deckId`, `expectedRevision`, `requestId`, `runId`, `ownerToken`, `status`, `summary?` (≤240) | Close a job: `completed`, `partial` or `failed`. |
| `preview_deck` | `deckId`, `revision?` | Manual preview URL (no screenshot). |

Every tool result includes `ok`, `deckId`, `revision`, `title`, `slides: [{ id, layout, manuallyEdited }]`, `warnings`, `agentWork` and links. **Never print the links' `#service=…&token=…` fragment or any token**; it grants access to the local service.

### Live build, step by step

1. **Create with the cover only:**

```json
{
  "spec": { "version": 1, "title": "Kopi Senja — Pitch", "slides": [
    { "layout": "wknd-cover-brand", "content": { "eyebrow": "Pitch — 2026", "title": "Kopi Senja", "subtitle": "Dari pelanggan setia ke pelanggan baru" } }
  ] },
  "requestId": "kopi-senja-create",
  "live": true,
  "plannedSlides": 10
}
```

   Keep `deckId`, `revision`, `agentWork.id` (this is the `runId`) and `ownerToken` from the result. The deck now shows in the Library as "AI sedang mengerjakan".

2. **Add the remaining slides one by one**, each with the latest revision:

```json
{
  "deckId": "<deckId>", "expectedRevision": 1, "requestId": "kopi-senja-slide-2",
  "runId": "<agentWork.id>", "ownerToken": "<ownerToken>",
  "slideSpec": { "layout": "wknd-agenda-chapters", "content": {
    "title": "Yang kita bahas", "intro": "Tiga bagian, sekitar 20 menit.",
    "items": [ { "title": "Situasi hari ini" }, { "title": "Usulan kami" }, { "title": "Rencana dan biaya" } ]
  } }
}
```

   Use the `revision` from each result as the next `expectedRevision`. Don't add delays or wait for the user to click.

3. **Finish:**

```json
{ "deckId": "<deckId>", "expectedRevision": 10, "requestId": "kopi-senja-finish",
  "runId": "<agentWork.id>", "ownerToken": "<ownerToken>", "status": "completed", "summary": "10 slide, 6 placeholder" }
```

   `completed` only when every planned slide exists (otherwise `INCOMPLETE_DECK`); use `partial` or `failed` when the plan wasn't met. Always call `finish_deck` before ending your turn.

Bulk creation (all slides in one `create_deck`, without `live`) is allowed only when the user asks for it.

### Request ids and revisions

- **A new `requestId` for every operation.** To retry the identical request, reuse the same `requestId` **and** payload; the service won't commit twice. Same id with a different payload: `REQUEST_ID_REUSED`.
- Every mutation needs the current `expectedRevision`. A stale revision returns `REVISION_CONFLICT`: call `get_deck`, then redo the change on the latest state. Never just bump the number and overwrite.

### Revising an existing deck

- `get_deck` first, for the current revision and slide ids.
- `contentPatch` keeps fields you don't send; any array you send replaces the whole array. `slideSpec` replaces the slide's spec.
- If the person edited a slide by hand, its source is stale (`manuallyEdited: true`) and patches fail with `SLIDE_SOURCE_STALE`. Only when the user asks to rebuild it, send a full `slideSpec` with `replaceManual: true`.
- For several changes, call `start_deck_run` (keep its `agentWork.id` and `ownerToken`), make the changes, then `finish_deck`.
- A job is **interrupted** after a service restart or 10 minutes without a commit (`WORK_INTERRUPTED`). Read the deck again and `start_deck_run` to resume.

---

## 10. Error codes

| Code | Meaning | Do |
|---|---|---|
| `SERVICE_UNAVAILABLE` | Deck service not running | Ask the person to run `npm run deck-service`, then retry |
| `BUILD_FAILED` / `INVALID_INPUT` | Content broke a rule: missing field, wrong item count, text too long | Read the error paths, shorten or reshape that slide, retry with a new `requestId` |
| `UNSUPPORTED_LAYOUT` | Layout id not in the 31 | Pick a layout from `list_layouts` |
| `SLIDE_LIMIT` | Over 60 slides | Merge or cut slides |
| `LIVE_START_ONE_SLIDE` | Live `create_deck` with more than one slide | Create with the cover only, then `add_slide` |
| `REVISION_CONFLICT` | Your revision is stale | `get_deck`, redo on the latest revision |
| `REQUEST_ALREADY_APPLIED` | Retry of a request that already succeeded, and the deck moved on | `get_deck` and reconcile; don't resend old content |
| `REQUEST_ID_REUSED` | Same `requestId`, different payload | Use a new `requestId` |
| `WORK_OWNER_REQUIRED` | Deck has an active job; `runId`/`ownerToken` missing or wrong | Send both from your own job, or wait until it is interrupted |
| `WORK_BUSY` | Another agent's job is still active | Wait, or tell the user |
| `WORK_INTERRUPTED` | Job idle or service restarted | `get_deck`, then `start_deck_run` |
| `WORK_NOT_ACTIVE` | No running job to finish or use | Start one with `start_deck_run` if needed |
| `INCOMPLETE_DECK` | `completed` with fewer slides than planned | Add the missing slides or finish as `partial` |
| `SLIDE_SOURCE_STALE` | Slide was edited by hand | Ask the user; rebuild only with `slideSpec` + `replaceManual: true` |
| `EXTERNAL_ASSET` | External image URL | Leave the image out or use `/assets/...` |
| `DECK_NOT_FOUND` / `SLIDE_NOT_FOUND` / `DECK_DELETED` | Wrong or deleted id | Re-read the deck list or ids; don't recreate a deleted deck unless asked |

---

## 11. Do and don't

**Do**

- Call `get_deck_playbook` and the relevant `list_layouts` before planning and writing.
- Get exactly one approval, on the storyline, then build without asking again.
- Build live, one slide at a time, and always close with `finish_deck`.
- Use placeholders for every unknown fact and list them in your final reply.
- Set `intro` on agenda, team and timeline slides in Indonesian decks.

**Don't**

- Edit the application's source code to make a deck. Use the tools or a DeckSpec.
- Invent facts, clients, numbers, prices, testimonials or logos.
- Repeat a layout on consecutive slides, use one more than three times, or pad lists with filler items.
- Print tokens or the `#service=…&token=…` part of links.
- Overwrite the user's manual edits without being asked.

## 12. Final checklist

- [ ] Cover first, `wknd-thank-you` or `wknd-questions` last.
- [ ] Every title is a claim; read in order, the titles tell the story.
- [ ] No layout twice in a row, none more than three times.
- [ ] All text within limits (about 85%), in the user's language, `intro` set where needed.
- [ ] No invented facts; all placeholders listed for the user.
- [ ] `finish_deck` called with the right status.
- [ ] Final reply: deck title, where to find it (the Library), placeholders to fill, slides you adapted.

---

## 13. File map (for agents with repo access)

| Path | What |
|---|---|
| `docs/agent-guide/playbook.md` | Workflow, storytelling and copy voice (served by `get_deck_playbook`) |
| `docs/agent-guide/README.md` | Writing `.md`, `.pptx` and `.json` sources for import |
| `docs/deck-spec/README.md`, `docs/deck-spec/example-proposal.json` | DeckSpec format and a full example |
| `lib/deck-spec/layout-catalog.ts` | Generates the layout catalog (`/deck-spec/catalog.json`) |
| `scripts/deck-mcp.ts` | The MCP server and its tool descriptions |
| `lib/deck-service/` | Local deck service: storage, revisions, agent jobs, validation |
| `docs/local-deck-agent.md` | Running the agents, security, data, limits (Indonesian) |
| `.deck-builder/` | Local data: decks, backups, `connection.json` (secret token; never share) |

The layout table in section 8 was generated from the catalog. If layouts change, trust `list_layouts` and regenerate the table.
