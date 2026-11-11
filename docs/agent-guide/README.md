# WKND Deck Builder: guide for AI agents

Read this before you write a deck concept (`.md`), a PowerPoint (`.pptx`) or a deck spec (`.json`) for the WKND Deck Builder. It explains how the builder turns your file into Weekend (WKND) branded slides, which layouts exist, how much text each one holds, and how to write a file that imports cleanly.

**Short version:** every slide is one of 31 fixed layouts. You don't design slides. You pick a layout for each slide and write text that fits its fields. The layout decides every position, color, font, photo and 3D asset.

---

## 1. How a file becomes a deck

The deck is 16:9 (1920×1080). There are three ways in:

| You write | What happens | Use it for |
|---|---|---|
| **`.md` concept** | An importer (Claude) reads the file, picks a layout for each slide, fills the fields, and the builder checks that everything fits. Claude fixes problems for up to two rounds, then a person reviews and imports. | Human-readable concepts and drafts |
| **`.pptx`** | Same as `.md`, but working from the text on each slide. | Re-branding an existing deck |
| **`.json` deck spec** | Built directly, with no AI in between. | Agents that want exact control |

The importer has two modes, and the person importing chooses one:

- **Keep content:** keeps your slides, their order and your wording. Only text that doesn't fit gets shortened. One slide in your file becomes one WKND slide, so write it the way you want it to end up.
- **Rewrite & condense:** Claude may restructure the story into about 12–20 slides, keeping your facts and placeholders.

Things that are lost on import:

- Colors, fonts and positions from your file. The layouts own the look.
- Pictures and charts. Photo layouts get placeholder photos, and the person swaps them in the editor.
- Speaker notes and visual directions. They are read to understand the slide and choose a layout, but they are not stored.

---

## 2. Rules

1. **One idea per slide, one layout per slide.**
2. **Match item counts exactly.** Many layouts have a fixed number of items, for example exactly 3 columns, exactly 4 cards or exactly 3 next steps. When your content has a different count, merge items, split them over two slides, or pick another layout. See [section 3](#3-choose-a-layout).
3. **Keep titles short.** Cover titles hold 14–24 characters and most content titles hold one line of about 20–36 characters. Put the rest in the subtitle or intro.
4. **Stay under the character limits** in [section 4](#4-layout-reference) and aim for about 85% of each limit. The limits are measured with the real font, so a text over the limit really does overflow. Indonesian text is often longer than the English equivalent.
5. **Never invent facts:** names, numbers, prices, dates, clients, logos or testimonials. Use placeholders in square brackets, such as `[Nama Klien]`, `Rp [TBD]` or `[Tanggal]`. The importer keeps them exactly as written, and the person fills them in later.
6. **Label production notes** so they never end up on a slide. Use `Presenter notes:` and `Visual direction:`. The Indonesian labels `Fungsi:`, `Arahan visual:`, `Catatan:` and `Presenter cue:` are recognised too.
7. **Write in the deck's language.** Mixed English and Indonesian stays mixed.
8. **Follow the standard arc:** cover, then agenda, then for each section a divider followed by content slides, then a closing slide.
9. **Vary layouts.** Never use the same layout on two slides in a row, and use any layout at most three times. With more than three sections, alternate the dividers between `wknd-agenda-spotlight` and `wknd-image-chapter`.
10. **Give real dates for timelines** (`YYYY-MM-DD`). If you only know durations such as "Week 1–2", write those, and the importer starts the timeline on the next Monday and shows relative weeks.

---

## 3. Choose a layout

| Your slide has… | Layout |
|---|---|
| Opening with the client or project name | `wknd-cover-brand` (blue), `wknd-cover-star` (black), `wknd-cover-arches` (yellow), `wknd-cover-d` (orange, two-line title) |
| A table of contents (up to 6 chapters) | `wknd-agenda-chapters` |
| Topics with a one-line description each (up to 6) | `wknd-agenda-overview` |
| A workshop or meeting schedule with times | `wknd-agenda` |
| A section divider that shows where we are in the agenda | `wknd-agenda-spotlight` |
| A section divider with a photo and a short text | `wknd-image-chapter` |
| A bold statement with 3 supporting paragraphs | `wknd-full-text-statement` |
| A title, intro, optional quote and 3 paragraphs | `wknd-full-text` |
| 1–3 paragraphs of narrative, such as context or background | `wknd-full-text-paragraphs` |
| 3 pillars, options or services, each with detail and 3 bullets | `wknd-bento-columns` |
| 4 features, benefits or capabilities as cards, plus a call to action | `wknd-bento-grid` |
| 3 short key points or principles over a photo | `wknd-image-approach` |
| 4 moods, principles or directions, each with a photo | `wknd-image-moods` |
| 2 case studies or options side by side, with photos | `wknd-image-two-studies` |
| Materials or references: text plus a 2×2 photo grid | `wknd-image-materials` |
| A research insight or observation with a wide photo | `wknd-image-field-notes` |
| Project phases (up to 5) as a journey | `wknd-timeline-road` |
| Project phases (up to 5) as building steps | `wknd-timeline-steps` |
| A roadmap over months or quarters (up to 6) | `wknd-timeline-roadmap` |
| Teams with members, no single leader | `wknd-team-structure`, `wknd-team-squads` (with photos) |
| One leader above the teams | `wknd-team-org` (team cards), `wknd-team-tree` (team leads) |
| Pricing or package comparison | `wknd-table-packages` |
| Scope of work: services × phases, each cell Lead, Support or — | `wknd-table-scope` |
| A bug or QA issue list by severity | `wknd-table-bug-triage` |
| A closing with contact details | `wknd-thank-you` |
| A closing with Q&A and 3 next steps | `wknd-questions` |

**No layout exists for:** charts, KPI or big-number slides, quote-only slides, logo walls, testimonials, or device mockups (the mockups can only be added by hand in the editor). Reshape that content instead:

- **Metrics:** use `wknd-bento-grid` with the number in the card title.
- **Five pillars:** use `wknd-bento-grid` for four of them, or split over two slides.
- **Seven agenda items:** merge them into six.

### Standard structures

**Proposal or pitch (12–20 slides)**

1. Cover
2. `wknd-agenda-chapters` or `wknd-agenda-overview`
3. Why: context and challenges. Use `wknd-full-text-statement`, `wknd-full-text-paragraphs` or `wknd-image-field-notes`.
4. What: vision and solution. Use `wknd-bento-columns`, `wknd-bento-grid` or `wknd-image-approach`.
5. How: approach and plan. Use `wknd-timeline-steps`, `wknd-timeline-road` and `wknd-table-scope`.
6. Who: the team. Use `wknd-team-org` or `wknd-team-structure`.
7. Value: investment and next steps. Use `wknd-table-packages`, then `wknd-questions`.
8. `wknd-thank-you`

Put an `wknd-agenda-spotlight` divider before each section when the deck has more than about 10 slides.

**Workshop:** cover, `wknd-agenda` (the schedule), the content slides for each session, then `wknd-questions`.

**Project update or report:** cover, `wknd-agenda-overview`, `wknd-timeline-roadmap`, `wknd-bento-grid` for highlights, `wknd-table-bug-triage` or `wknd-table-scope`, then `wknd-thank-you`.

---

## 4. Layout reference

Field names are what a JSON spec uses, and they make good labels in a `.md` concept too. **Bold** marks a required field. A limit such as "≤ 36 chars, 1 line" is the most the box holds, so stay a little under it. Optional fields that you leave out are removed from the slide.

The `eyebrow` field on most layouts is a small pill label above the title, 1–3 words. Leave it out to hide the pill.

### Covers

**`wknd-cover-brand`** · Cover Brand. Opening slide on blue with a huge one-line title.

- `eyebrow`
- **`title`**: 1 line, ≤ 17 chars (about 12 looks best). Usually the client or project name.
- `subtitle`: tagline, 1 line, ≤ 92 chars

**`wknd-cover-star`** · Cover Star. Opening slide on black with a 3D star.

- **`title`**: 1 line, ≤ 15 chars
- `subtitle`: 1 line, ≤ 59 chars

**`wknd-cover-arches`** · Cover Arches. Opening slide on yellow with 3D letters on arches.

- **`title`**: 1 line, ≤ 14 chars
- `subtitle`: ≤ 58 chars, 2 lines

**`wknd-cover-d`** · Cover D. Opening slide on orange with a large 3D "D".

- `eyebrow`
- **`title`**: ≤ 24 chars, 2 lines, for example `"Project\nName."`
- `subtitle`: ≤ 74 chars, 2 lines

### Agenda and dividers

Every agenda layout holds **1–6 items**. `title` is the slide title (two short lines at most) and `intro` is one or two lines under it. When `intro` is left out, an automatic English intro is shown, so **always set `intro` in non-English decks**.

**`wknd-agenda-chapters`** · What's Inside. A table of contents.

- `eyebrow`, `title`, `intro`
- `items[]`: **`title`** (one line), `page` (page number, optional)

**`wknd-agenda-overview`** · On the Agenda. Topics as cards.

- `eyebrow`, `title`, `intro`
- `items[]`: **`title`** (one line), `description` (one line, under ~40 chars)

**`wknd-agenda`** · Today's Agenda. A workshop or meeting schedule.

- `eyebrow`, `title`, `intro`
- `date` (`YYYY-MM-DD`), `location`, `startTime` (`HH:MM`, 24h)
- `items[]`: **`title`** (may use `\n` for a second line; short sessions only fit short titles), `durationMinutes` (integer), `kind` (`session` or `break`)
- All sessions must end before midnight.

**`wknd-agenda-spotlight`** · Agenda Spotlight. A section divider that lists all topics and highlights the current one. Repeat it before each section with the same items and a different highlighted item.

- `eyebrow`
- `items[]`: **`title`** (one line), `description` (one line, under ~40 chars), `highlighted` (exactly one item is `true`)

### Text

**`wknd-full-text-statement`** · Full Text Statement. Yellow, with a huge statement on the left and three numbered columns.

- `eyebrow`
- **`title`**: a bold statement, ≤ 20 chars, 2–3 short lines
- `subtitle`: ≤ 116 chars, 2–4 lines
- **`columns[]`**: exactly 3, each with a **`body`** paragraph of 40–60 words (≤ 370 chars)

**`wknd-full-text`** · Full Text Columns. Blue, with a title, an intro, an optional quote and three numbered columns.

- `eyebrow`
- **`title`**: 1 line, ≤ 36 chars
- `subtitle`: intro, ≤ 164 chars, 2 lines
- `quote`: pull quote, ≤ 126 chars, 2 lines
- **`columns[]`**: exactly 3, each with a **`body`** paragraph of 40–60 words (≤ 360 chars)

**`wknd-full-text-paragraphs`** · Full Text Paragraphs. Cream, with a title, an intro and stacked paragraphs.

- `eyebrow`
- **`title`**: 1 line, ≤ 36 chars
- `subtitle`: intro, ≤ 164 chars, 2 lines
- **`paragraphs[]`**: 1–3, each with a **`text`** of 30–50 words (≤ 416 chars)
- `note`: footnote, ≤ 132 chars, 2 lines

### Bento

**`wknd-bento-columns`** · Bento Columns. Three tall cards.

- **`title`**: ≤ 48 chars, 2 lines
- `intro`: ≤ 196 chars, 2–3 sentences
- **`cards[]`**: exactly 3, each with:
  - **`title`**: 1–3 words, ≤ 26 chars
  - `subtitle`: 1 line, ≤ 50 chars
  - `body`: 1–2 sentences, ≤ 122 chars
  - `detail`: 2–4 sentences, ≤ 244 chars
  - **`bullets`**: exactly 3 short bullets, ≤ 177 chars in total

**`wknd-bento-grid`** · Bento Grid. Text and a button on the left, a 2×2 grid of numbered cards on the right.

- `eyebrow`
- **`title`**: ≤ 51 chars, up to 3 short lines
- `body`: 2–3 sentences, ≤ 220 chars
- `button`: call to action, ≤ 40 chars, for example `"Learn more →"`
- **`cards[]`**: exactly 4, each with:
  - **`title`**: 1–3 words, ≤ 27 chars
  - `subtitle`: 1 line, ≤ 47 chars
  - `body`: 2–3 sentences, ≤ 165 chars
  - `detail`: 1–2 sentences, ≤ 110 chars

### Image

Every image field is optional. Leave it out to keep the placeholder photo. Only a JSON spec can set an image, as an `https://` or `data:image/…` URL.

**`wknd-image-chapter`** · Chapter Photo. A section divider over a full-bleed photo, with a text card.

- `background` (image)
- `eyebrow`
- **`title`**: ≤ 48 chars, 2 lines
- `subtitle`: 1 line, ≤ 72 chars
- `body`: 2–3 sentences, ≤ 255 chars
- `caption`: 1 line, ≤ 51 chars

**`wknd-image-approach`** · Our Approach. Three statement cards over a full-bleed photo.

- `background` (image)
- **`title`**: 1 short line, ≤ 19 chars, for example `"Our approach:"`
- `subtitle`: 1 line, ≤ 53 chars
- **`points[]`**: exactly 3, each with a **`text`** statement of 5–8 words (≤ 78 chars)

**`wknd-image-moods`** · Four Moods. Four photos in a row.

- `eyebrow`
- **`title`**: 1 line, ≤ 24 chars
- `intro`: 2–3 sentences, ≤ 186 chars
- **`items[]`**: exactly 4, each with `image`, **`title`** (1–2 words, for example `"01 Warm"`, ≤ 31 chars) and **`body`** (one sentence, ≤ 98 chars)

**`wknd-image-two-studies`** · Two Studies. Two large photos side by side.

- `eyebrow`
- **`title`**: 1 line, ≤ 24 chars
- `intro`: 2–3 sentences, ≤ 183 chars
- **`studies[]`**: exactly 2, each with `image`, **`title`** (≤ 60 chars) and **`body`** (2–3 sentences, ≤ 273 chars)

**`wknd-image-materials`** · Materials. Text on the left, a 2×2 photo grid on the right.

- `eyebrow`
- **`title`**: ≤ 32 chars, 2 lines
- `subtitle`: 1 line, ≤ 49 chars
- **`paragraphs[]`**: 1–2, each with a **`text`** of 2–3 sentences (≤ 201 chars)
- **`items[]`**: exactly 4, each with `image`, **`title`** (≤ 51 chars) and **`body`** (one short sentence, ≤ 66 chars)

**`wknd-image-field-notes`** · Field Notes. A wide photo banner under the title.

- `eyebrow`
- **`title`**: 1 line, ≤ 26 chars
- `banner` (image)
- `heading`: ≤ 66 chars, 2 lines
- **`notes[]`**: 1–2, each with a **`text`** of 2–3 sentences (≤ 171 chars). These are content notes on the slide, not presenter notes.
- `caption`: 1 line, ≤ 71 chars

### Timeline

`title` is the slide title and `intro` is one or two lines under it. **Set `intro` in non-English decks.** Each phase's period is labelled by `periodFormat`, which is `weeks`, `dates` or `months`. The default is weeks, and months for the roadmap.

Each phase has **`title`** (1–2 words), `description` (up to two short lines, about 60 chars), and **`start`** and **`end`** (`YYYY-MM-DD`, with the end on or after the start, in chronological order).

- **`wknd-timeline-road`** · Road to Launch. Milestones on a winding road. 1–5 phases. Fields: `eyebrow`, `title`, `intro`.
- **`wknd-timeline-steps`** · Step by Step. Phases as steps that build up. 1–5 phases. Fields: `eyebrow`, `title`, `intro`. The first step's description is not shown.
- **`wknd-timeline-roadmap`** · Roadmap. Across months or quarters. 1–6 phases. Fields: `title`, `intro`, with no eyebrow.

### Team

Each team layout has `eyebrow`, `title` and `intro`. **Set `intro` in non-English decks.**

A group has **`name`** (1–3 words), `description` (under ~40 chars) and `members[]`. A member has `name` (left out, it shows "Full Name") and `role` (under ~28 chars). Never invent people's names: leave the name out or use `[Nama]`.

| Layout | Leader | Groups | Members per group |
|---|---|---|---|
| `wknd-team-structure` · Team Structure | no | 1–4 | 1–3 |
| `wknd-team-squads` · Team Squads (member photos) | no | 1–4 | 1–3 |
| `wknd-team-org` · Org Cards | yes | 1–5 | 1–4, and the first member is the team lead |
| `wknd-team-tree` · Org Tree | yes | 1–5 | 1–4, and the first member is the team lead |

The leader has `name`, `role` and `badge` (short, for example `"CEO"`).

### Tables

Cell text shrinks to fit, but keep it short.

**`wknd-table-packages`** · Choose Your Package.

- `eyebrow`
- **`title`**: 1 line, ≤ 23 chars
- `subtitle`: 1 line, ≤ 70 chars
- `table.columns[]`: 2–6. The first column labels the rows, and each other column is a package with a `title` and a `subtitle` (for example the price).
- `table.rows[]`: 1–8. Each row has one text per column, and `✓` and `—` render as a check and a dash.
- `table.highlightColumn`: index of the recommended package (1 or more)
- `table.badge`: for example `"Recommended"`

**`wknd-table-scope`** · Scope of Work.

- `eyebrow`
- **`title`**: 1 line, ≤ 16 chars
- `subtitle`: 1 line, ≤ 59 chars
- `table.columns[]`: 2–6. The first column is the service, and the others are phases.
- `table.rows[]`: 1–8. Each row is the service, then `Lead`, `Support` or `—` for each phase.

**`wknd-table-bug-triage`** · Bug Triage.

- `eyebrow`
- **`title`**: 1 line, ≤ 27 chars
- `subtitle`: 1 line, ≤ 65 chars
- `table.groups[]`: 1–3 severity groups, colored orange, yellow and then blue, with up to 6 rows in total. Each group has a `label` (for example `"Critical"`) and `rows[]`.
- Each row has `id` (for example `"BUG-1042"`), `issue`, `impact` (one sentence), `steps` (2–3 short steps), `expected`, `actual`, and `status` (`Open`, `In progress` or `Fixed`).

### Closing

**`wknd-thank-you`** · Thank You. A huge "Thank you." with contact details.

- `subtitle`: 1 closing line, ≤ 49 chars
- `website` (≤ 17 chars), `email` (≤ 24 chars), `phone` (≤ 22 chars). Leave them out to keep Weekend's own details.

**`wknd-questions`** · Any Questions. A Q&A slide with three next steps.

- `eyebrow`: ≤ 37 chars, for example `"What's next"`
- **`steps[]`**: exactly 3, each with **`title`** (2–3 words, ≤ 25 chars) and **`body`** (one sentence, ≤ 100 chars)

---

## 5. Writing a `.md` concept

The importer reads any Markdown. It works best, and keeps your intent most faithfully, when each slide is written as the layout it will become.

### Shape

- Start with a short **deck header**: the title, the client, the language, the purpose, and an optional footer.
- Write **one `##` heading per slide**, numbered in order, for example `## 03 · Why this matters`.
- Under each heading:
  - Add a **`Layout:`** line with a layout id from [section 4](#4-layout-reference). It is optional but strongly recommended.
  - Write the content as **labeled fields** that use the layout's field names (`Eyebrow`, `Title`, `Subtitle`, `Intro`, `Quote`, `Body`, `Button`, and so on).
  - Write lists of items (`Columns`, `Cards`, `Items`, `Points`, `Steps`, `Phases`, `Paragraphs`, `Groups`) as numbered lists, with the item's fields indented under each number.
  - Write packages and scope of work as Markdown tables.
  - Put everything that is not slide text under `Presenter notes:` or `Visual direction:`.
- A `#` heading can mark a section, such as `# Why` or `# How`. Add an `wknd-agenda-spotlight` slide at the start of each section if you want a divider.
- Keep the file under **150,000 characters**. Split longer concepts into parts.

### Template

```md
# [Deck title]

Client: [Nama Klien]
Language: English | Indonesian
Purpose: [One sentence: what this deck must achieve]
Footer: [Client] × Weekend · Confidential

---

## 01 · Cover
Layout: wknd-cover-d
Eyebrow: Proposal 2026
Title: Built to\nGrow.
Subtitle: A commerce platform for [Nama Klien], built to scale.
Presenter notes: Open with the business value, not the feature list.

## 02 · Agenda
Layout: wknd-agenda-chapters
Title: What we'll cover
Intro: Five chapters, from context to next steps.
Items:
1. Business context
2. Our vision
3. Product experience
4. Delivery plan & team
5. Investment & next steps

## 03 · Three pillars
Layout: wknd-bento-columns
Title: Commerce is more\nthan a storefront
Intro: A good shopping experience connects discovery, payment and fulfilment in one system.
Cards:
1. Title: Experience
   Subtitle: From browsing to buying
   Body: Make finding and buying products simple on every device.
   Detail: Clear navigation, fast search and a checkout without friction.
   Bullets:
   - Smart search and filters
   - One-page checkout
   - Mobile-first design
2. Title: Operations
   Subtitle: Catalog, stock and orders in one place
   Body: Keep products, stock and orders under control.
   Detail: One back office for the catalog, inventory and order status.
   Bullets:
   - Central catalog
   - Live stock levels
   - Order tracking
3. Title: Growth
   Subtitle: Ready for what comes next
   Body: A foundation for acquisition, retention and expansion.
   Detail: Built-in analytics, promotions and room to add channels later.
   Bullets:
   - Promotions engine
   - Customer accounts
   - Analytics dashboard
Visual direction: Three columns with a small Discover → Buy → Fulfil flow.

## 04 · Delivery plan
Layout: wknd-timeline-steps
Title: How we get there
Intro: Four phases over twelve weeks.
Period format: weeks
Phases:
1. Discover · 2026-01-05 → 2026-01-23 · Interviews, audit and goals.
2. Design · 2026-01-26 → 2026-02-20 · UX flows and visual design.
3. Build · 2026-02-23 → 2026-03-20 · Development and integrations.
4. Launch · 2026-03-23 → 2026-03-27 · QA, go-live and handover.

## 05 · Investment
Layout: wknd-table-packages
Eyebrow: Investment
Title: Choose your package
Subtitle: Three options, scoped to where you are today.
Highlight: Growth
Badge: Recommended
| Feature | Starter | Growth | Scale |
|---|---|---|---|
| Price | Rp [TBD] | Rp [TBD] | Rp [TBD] |
| Custom design | ✓ | ✓ | ✓ |
| Payment gateway | ✓ | ✓ | ✓ |
| Promotions engine | — | ✓ | ✓ |
| Marketplace sync | — | — | ✓ |

## 06 · Next steps
Layout: wknd-questions
Eyebrow: What's next
Steps:
1. Title: Align on scope
   Body: A 90-minute session to confirm goals, scope and priorities.
2. Title: Confirm package
   Body: Choose the package and sign off the proposal.
3. Title: Kick off
   Body: Start discovery within two weeks of sign-off.
```

In a packages table, the first row (`Price` here) can hold each package's subtitle. `Highlight` names the recommended column.

### Tips

- **Write the final words, not a description of them.** `Title: Built to Grow.` is better than `Title: something about growth`.
- **Count your items before you pick a layout.** If you have 5 cards, either use two slides or merge them to 4 for `wknd-bento-grid`.
- **Use `\n` in titles** to choose where the line breaks.
- **Without a `Layout:` line**, describe the slide's shape in `Visual direction:` (for example "three columns", "timeline" or "photo with three points"), so the importer can choose.
- **Keep placeholders** for every fact you don't have.

---

## 6. Writing a `.pptx`

The importer reads each slide's text, not its design. The text is read like this:

- Text boxes are read **in the order they were added** (groups are flattened), together with the **font size** of each. The largest text is taken as the title, and small uppercase text above it as the eyebrow.
- **Tables** are read cell by cell, which works well for packages and scope of work.
- **Speaker notes** are read for context.
- Text that repeats on most slides (the deck name, footers, page numbers) is dropped, and so are slide number, date and footer placeholders.
- Pictures and charts are counted but not imported, and text inside an image is not read at all.

To get a good result:

1. **Make one source slide per WKND slide** when the person will use "Keep content".
2. **Shape the slide like its target layout.** For `wknd-full-text`, that is three text boxes for three columns. For `wknd-bento-grid`, it is four card text boxes.
3. **Use real text boxes** with a clear size hierarchy, so the title is clearly the biggest text.
4. **Add the target layout to the speaker notes**, for example `Layout: wknd-bento-columns`, together with any presenter cue or visual direction. Notes are never put on the slide.
5. **Put chart data in a table or in short text** if it matters, because charts are not read.
6. **Follow [section 2](#2-rules)** for item counts, title length and placeholders.

---

## 7. Writing a `.json` deck spec

When you can produce JSON, a deck spec is the most precise way in. It skips the importer, and the builder reports exact errors you can fix.

- Spec format, checks and import steps: [docs/deck-spec/README.md](../deck-spec/README.md)
- Machine-readable catalog with every layout, field, limit and example: `/deck-spec/catalog.json` (locally <http://localhost:3000/deck-spec/catalog.json>, and `out/deck-spec/catalog.json` in the static build). **The catalog is the source of truth.** If it disagrees with this guide, follow the catalog.
- A full 10-slide example: [docs/deck-spec/example-proposal.json](../deck-spec/example-proposal.json)

```json
{
  "version": 1,
  "title": "Client X — Proposal",
  "footer": { "left": "Client X × Weekend", "note": "Confidential" },
  "slides": [
    { "layout": "wknd-cover-brand", "content": { "eyebrow": "Proposal 2026", "title": "Client X", "subtitle": "One-line tagline" } },
    { "layout": "wknd-questions", "content": { "eyebrow": "What's next", "steps": [
      { "title": "Align on scope", "body": "A 90-minute session to confirm goals and priorities." },
      { "title": "Confirm package", "body": "Choose the package and sign off the proposal." },
      { "title": "Kick off", "body": "Start discovery within two weeks of sign-off." }
    ] } }
  ]
}
```

`theme` (`blue`, `cream`, `black`, `yellow` or `orange`) can be set for the whole deck or for each slide, but only in JSON. Leave it out to keep each layout's own colors, which is the usual WKND look.

---

## 8. Checklist before you hand off

- [ ] The deck opens with a cover and closes with `wknd-questions` or `wknd-thank-you`.
- [ ] Every slide has one idea and a layout from [section 4](#4-layout-reference).
- [ ] Item counts match exactly: 3 columns, 3 or 4 cards, 4 photos, 2 studies, 3 points, 3 steps.
- [ ] Every text is under its limit, and titles are short.
- [ ] No two slides in a row use the same layout, and no layout is used more than three times.
- [ ] Every unknown fact is a `[placeholder]`, and no names, numbers, prices or testimonials are invented.
- [ ] Production notes are labeled `Presenter notes:` or `Visual direction:`.
- [ ] Timelines have dates or week ranges, and agenda, team and timeline slides have an `intro` in non-English decks.
- [ ] The deck uses only layouts that exist here: no charts, KPI slides or device mockups.
