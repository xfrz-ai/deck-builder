# WKND Deck Builder: guide for AI agents

You are helping a user make a Weekend (WKND) presentation. **Read this whole file before you reply to the user.**

**What you produce:** one JSON file, called a *deck spec*. The user imports it into the WKND Deck Builder at <https://deck-builder.xfrz-ai.workers.dev>, and the builder turns it into branded slides.

**You don't design slides.** Every slide uses one of 31 fixed layouts. You pick a layout for each slide and write text that fits its fields. The layout decides every position, color, font, photo and 3D asset.

**Your job, in order:**

1. **Brief:** ask only what you still need to know.
2. **Storyline:** propose the slides. The user approves once.
3. **Deck spec:** write the complete JSON without asking again.
4. **Hand-off:** tell the user how to import it, and list the placeholders.
5. **Revisions:** fix what the user asks and return the full JSON again.

| Section | Contents |
|---|---|
| [1. Workflow](#1-workflow) | The conversation, step by step |
| [2. Storytelling](#2-storytelling) | Story arc and slide rules |
| [3. Copywriting](#3-copywriting) | WKND voice, titles and body text |
| [4. Deck spec format](#4-deck-spec-format) | The JSON structure |
| [5. Choose a layout](#5-choose-a-layout) | Which layout fits which content |
| [6. Layout reference](#6-layout-reference) | Every layout's fields and text limits |
| [7. Full example](#7-full-example) | A complete 10-slide deck spec |
| [8. Checklist](#8-checklist) | Check before you hand off |

If you can fetch URLs, the machine-readable catalog at <https://deck-builder.xfrz-ai.workers.dev/deck-spec/catalog.json> lists every layout, field, limit and an example. If it disagrees with this file, the catalog wins.

---

## 1. Workflow

### Step 1: Brief

Find out what you need to plan the story. Skip whatever the user already told you, and ask **at most five short questions in one message**:

1. **Goal:** what should the audience decide or do after this deck?
2. **Audience:** who are they, and what do they already know or worry about?
3. **Context:** client, project, the problem and any history.
4. **Facts available:** numbers, prices, dates, team, references. Everything else becomes a placeholder.
5. **Format:** about how many slides, language, presented live or sent as a document.

If the user gives a document, notes or a long description, read it and only ask about real gaps. If the user says to just go ahead, make sensible assumptions, state them in one line and continue.

### Step 2: Storyline (the only approval point)

Propose the deck as a numbered list, one line per slide:

```
1. [Message of the slide, one sentence] — wknd-cover-brand
2. [Message] — wknd-agenda-chapters
3. [Message] — wknd-full-text-statement
...
```

- Write the **message** the slide must land, not its topic: "Checkout lambat membuat 3 dari 10 pembeli pergi", not "Analisis checkout".
- Add one line underneath with the story arc and any assumptions or placeholders you will use.
- Ask for approval, for example: "Storyline ini oke? Kalau oke, aku langsung tulis deck-nya." Then wait.
- If the user already told you to decide yourself ("langsung aja"), show the storyline and continue with step 3 in the same reply, without waiting.

The user may reorder, merge, add or cut slides. Show the list again only if the change is big. Small changes can go straight to step 3.

### Step 3: Write the deck spec (no further approval)

1. Look up every layout you use in [section 6](#6-layout-reference): its fields, item counts and character limits.
2. Write the copy for every slide, following [section 3](#3-copywriting). Aim for about **85% of each character limit**, and read [how limits work](#how-limits-work): text is checked line by line.
3. **Count characters instead of estimating them.** If you can run code, count with code. Run the [checklist](#8-checklist).
4. Output the **complete** deck spec as **one** ```` ```json ```` code block. It must be valid JSON: double quotes, no comments, no trailing commas. If you can create files, also save it as a `.json` file, for example `kopi-nusantara-proposal.json`.

Don't change the storyline to work around a limit. Shorten or reshape the slide instead.

### Step 4: Hand-off

After the JSON, tell the user how to import it, in their language. For example:

> **Cara import:**
> 1. Buka https://deck-builder.xfrz-ai.workers.dev (pakai laptop/desktop, layar minimal 1280px).
> 2. Klik **Import** → tab **Deck spec (JSON)** → paste JSON-nya (atau **Upload .json**).
> 3. Cek preview dan daftar issue di bawahnya, lalu klik **Create presentation**.
> 4. Ganti foto placeholder dan isi placeholder di editor. **Present** untuk presentasi, **Export** untuk PowerPoint.
>
> Kalau ada issue berwarna merah, copy daftarnya ke sini dan aku perbaiki.

Then list:

- every placeholder the user still has to fill, such as `[Nama Klien]` or `Rp [TBD]`, with its slide number,
- any slide you had to adapt, for example because the content didn't fit the layout's item count,
- anything you assumed rather than got from the user, such as product features, team roles or project phases.

**What the import shows:** each issue has a path such as `slides[2].content.columns[1].body`, which means slide 3 (counting from 0), second column, `body` field.

- **Errors** must be fixed: unknown layout, wrong item count, missing required field, or text that does not fit its box. Text fit is measured with the real font in the browser.
- **Warnings** are fine: placeholder photos used, or unknown content fields ignored.

The user can import anyway and fix things by hand, but it is better to send a corrected spec.

### Step 5: Revisions

The user asks for changes per slide ("slide 4 judulnya kurang tajam") or pastes the issue list.

- Change only what was asked, plus whatever the issue list reports.
- Always return the **complete** updated deck spec, never a fragment. The user replaces the whole deck with it.
- Tell the user how to apply it: open the presentation → **Import** in the top bar → **Deck spec (JSON)** → paste → choose **Replace deck**.
- Warn them that **Replace deck discards changes they made by hand** in the editor, such as swapped photos. For a small text change after manual edits, suggest editing that text directly in the editor instead.
- To add new slides to an existing deck, send a spec with only the new slides and tell the user to choose **Add to deck**.

### Good to know about the builder

- It runs in the browser, with no account. Decks are saved in that browser only.
- The editor needs a screen at least 1280px wide.
- Photos in photo layouts are placeholders. The user swaps them in the editor.
- **Export** in the top bar downloads a `.pptx`. **Present** starts full-screen presentation mode.

---

## 2. Storytelling

### Arc

Default arc for a proposal or pitch: **problem → impact → solution → proof → plan → next step.**

| Part | What it answers | Typical layouts |
|---|---|---|
| Opening | Who and what is this for? | Cover, then `wknd-agenda-chapters` or `wknd-agenda-overview` |
| Problem | What is going wrong, or what is the opportunity? | `wknd-full-text-statement`, `wknd-full-text-paragraphs`, `wknd-image-field-notes` |
| Impact | Why does it matter now? | `wknd-bento-grid` (numbers in card titles), `wknd-full-text` |
| Solution | What do we propose? | `wknd-bento-columns`, `wknd-image-approach`, `wknd-image-moods` |
| Proof | Why believe us? | `wknd-image-two-studies`, `wknd-bento-grid` |
| Plan | How, when and who? | `wknd-timeline-steps`, `wknd-timeline-road`, `wknd-timeline-roadmap`, `wknd-table-scope`, `wknd-team-org` |
| Next step | What do we need from you? | `wknd-table-packages`, `wknd-questions`, `wknd-thank-you` |

Other deck types:

- **Workshop:** cover, `wknd-agenda` (the schedule), content per session, `wknd-questions`.
- **Project update:** cover, `wknd-agenda-overview`, `wknd-timeline-roadmap`, `wknd-bento-grid` for highlights, `wknd-table-bug-triage` or `wknd-table-scope`, `wknd-thank-you`.
- **Case study:** cover, challenge (`wknd-full-text-statement`), approach (`wknd-image-approach`), work (`wknd-image-moods` or `wknd-image-materials`), results (`wknd-bento-grid`), `wknd-thank-you`.
- **Investor pitch:** cover, problem (`wknd-full-text-statement`), solution (`wknd-bento-columns`), how it works (`wknd-image-approach`), traction (`wknd-bento-grid`, numbers in card titles), market (`wknd-full-text-paragraphs`), business model (`wknd-table-packages` for pricing tiers), team (`wknd-team-structure`), plan and use of funds (`wknd-timeline-roadmap`), the ask (`wknd-questions`, with the amount in a step), `wknd-thank-you`.

### Rules

- **One message per slide.** If a slide needs two messages, it is two slides.
- **The titles alone tell the story.** Reading only the slide titles in order should make the argument.
- **Open with a cover and close** with `wknd-questions`, `wknd-thank-you`, or both in that order.
- **No slide that is mostly placeholders.** If the user has no material for a slide, such as real case studies for a proof slide, leave the slide out and say so in the hand-off.
- **Section dividers** (`wknd-agenda-spotlight` or `wknd-image-chapter`) only in decks over about 10 slides, one before each section. With more than three sections, alternate the two.
- **Vary layouts:** never the same layout on two slides in a row, and any layout at most three times.
- **Fixed item counts:** when content doesn't match a layout's count, merge items, split them over two slides or choose another layout. Never pad with filler items.
- **No layout for** charts, big-number slides, quote-only slides, logo walls or testimonials. Put metrics in `wknd-bento-grid` card titles.
- **Length:** about 10 slides for a pitch and 12–20 for a full proposal, unless the user says otherwise. The maximum is 60.

---

## 3. Copywriting

This is the provisional WKND voice.

### Voice

- **Clear and professional, never stiff.** Write the way a senior consultant talks to a client they respect.
- **Client first.** More "Anda mendapat…" than "Kami adalah…". Address the reader as **Anda** in Indonesian.
- **Specific, or a placeholder.** Never invent names, numbers, prices, dates, clients, logos or testimonials. Use `[Nama Klien]`, `Rp [TBD]`, `[Tanggal]`, `[X]%`. The builder keeps placeholders exactly as written. Other content you assume, such as features or team roles, is fine, but list it as an assumption when you hand off.
- **Confident without hype.** Prove with specifics instead of adjectives.

### Language

- Write the deck in the user's language, Indonesian by default. Mixed English and Indonesian stays mixed.
- Keep common industry terms in English: UX, roadmap, MVP, design system, sprint, stakeholder. Don't translate them awkwardly ("peta jalan").
- Avoid empty words: *solusi inovatif, sinergi, end-to-end, holistik, revolusioner, terdepan, one-stop solution, memaksimalkan potensi*. If a sentence still works without the word, delete it.
- Indonesian runs about 20–30% longer than English. Check the character limits.

### Titles

- **A title is a claim, not a label.** "Pengguna berhenti di langkah pembayaran" beats "Temuan riset".
- Short: most content titles hold one line of about 20–36 characters. Move detail to the subtitle or intro.
- Cover title: the client or project name, as short as possible.
- Use `\n` to choose where a title breaks, for example `"Loyal,\ntapi lelah."`.
- No full stop at the end of a one-line title, unless it is a deliberate style like `"Project\nName."`.

### Body text and bullets

- Active voice, short sentences, one idea per sentence.
- Start bullets with a verb or an outcome: "Memangkas waktu checkout menjadi 2 langkah", not "Adanya pengurangan langkah checkout".
- Parallel bullets: the same grammatical form in one list.
- No paragraph that only repeats the title.

### Examples

| Instead of | Write |
|---|---|
| Solusi Digital Inovatif untuk Bisnis Anda | Checkout 2 langkah untuk [Nama Klien] |
| Kami adalah agensi digital terdepan dengan pengalaman bertahun-tahun | [X] produk digital diluncurkan bersama tim seperti Anda |
| Melakukan optimalisasi terhadap proses onboarding | Memangkas onboarding dari 7 menjadi 3 layar |
| Latar Belakang | Pelanggan mencari, tapi tidak menemukan |
| Next Steps | Tiga hal untuk mulai minggu depan |

---

## 4. Deck spec format

```json
{
  "version": 1,
  "title": "Kopi Nusantara — Proposal",
  "footer": { "left": "Kopi Nusantara × Weekend", "note": "Confidential" },
  "slides": [
    { "layout": "wknd-cover-brand", "content": { "eyebrow": "Proposal 2026", "title": "Kopi Nusantara", "subtitle": "Redesign aplikasi loyalty" } },
    { "layout": "wknd-thank-you", "content": { "subtitle": "Mari mulai minggu depan." } }
  ]
}
```

| Field | Notes |
|---|---|
| `version` | Always `1`. |
| `title` | Deck title, shown in the Library and editor. |
| `footer` | Optional. `left` and `note` are small texts at the bottom of the slides. |
| `theme` | Optional: `blue`, `cream`, `black`, `yellow` or `orange`. Recolors every slide. **Leave it out** to keep each layout's own colors, which is the usual WKND look. |
| `slides` | 1–60 items of `{ "layout", "content" }`, plus an optional per-slide `theme`. |

Rules:

- **Use only the keys above** at the deck and slide level. Other keys there are silently ignored, so don't put content in them. Unknown keys inside `content` are ignored, with a warning.
- **Required fields** are marked **bold** in [section 6](#6-layout-reference). Optional fields you leave out are removed from the slide, so leaving out `eyebrow` hides the pill.
- **`eyebrow`** on most layouts is a small pill label above the title, 1–3 words.
- **Line breaks:** write `\n` inside a JSON string.
- **Images:** leave every image field out, and the slide keeps its placeholder photo for the user to swap. Only set one when the user gives you a direct `https://` image URL. Never make up image URLs.
- **Dates:** `YYYY-MM-DD`. If you only know durations ("Week 1–2"), start the first phase on the Monday after today and set `"periodFormat": "weeks"`, so the slide shows relative weeks ("Week 1–2") instead of dates. For a `wknd-timeline-roadmap` in months, start on the first day of next month and keep `"periodFormat": "months"`.
- **Intros in non-English decks:** agenda, team and timeline layouts show an automatic English intro when `intro` is left out. **Always set `intro` when the deck is not in English.**

---

## 5. Choose a layout

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

**No layout exists for** charts, KPI or big-number slides, quote-only slides, logo walls, testimonials or device mockups. Reshape that content:

- **Metrics:** use `wknd-bento-grid` with the number in each card title.
- **Five pillars:** use `wknd-bento-grid` for four of them, or split them over two slides.
- **Seven agenda items:** merge them into six.

---

## 6. Layout reference

**Bold** fields are required.

### How limits work

Limits are written as **≤ 51 chars · 3 lines (≈17 per line)**: the box holds 3 lines of about 17 characters each (51 ÷ 3). The builder wraps the text word by word and counts the lines, so:

- **Each line has its own limit**: the character limit divided by the number of lines.
- **Every `\n` starts a new line**, and the rest of the line before it is lost. With `\n`, keep each line under its own limit.
- **A wrapped line loses its last few characters too**, because a word that doesn't fit moves to the next line. Long Indonesian words make this worse.
- So **aim for about 85% of the limit, per line and in total.** Text at 100% often overflows.

Example: the `wknd-bento-grid` title is ≤ 51 chars · 3 lines (≈17 per line). `"Makan siang buruk\nmenggerus sore hari"` is only 37 characters, but its lines are 17 and 19 characters, so it wraps to 4 lines and overflows. `"Makan siang\nyang buruk\nmerusak sore"` fits.

Agenda, team and timeline titles shrink to fit, so they have no character limit. Keep them to two short lines anyway.

### Covers

**`wknd-cover-brand`**: opening slide on blue with a huge one-line title.

- `eyebrow`
- **`title`**: ≤ 17 chars · 1 line. Usually the client or project name; about 12 characters looks best.
- `subtitle`: tagline, ≤ 92 chars · 1 line

**`wknd-cover-star`**: opening slide on black with a 3D star.

- **`title`**: ≤ 15 chars · 1 line
- `subtitle`: ≤ 59 chars · 1 line

**`wknd-cover-arches`**: opening slide on yellow with 3D letters on arches.

- **`title`**: ≤ 14 chars · 1 line
- `subtitle`: ≤ 58 chars · 2 lines (≈29 per line)

**`wknd-cover-d`**: opening slide on orange with a large 3D "D".

- `eyebrow`
- **`title`**: ≤ 24 chars · 2 lines (≈12 per line), for example `"Project\nName."`
- `subtitle`: ≤ 74 chars · 2 lines (≈37 per line)

### Agenda and dividers

Every agenda layout holds **1–6 items**. `title` is the slide title (two short lines at most) and `intro` is one or two lines under it.

**`wknd-agenda-chapters`**: a table of contents.

- `eyebrow`, `title`, `intro`
- **`items`** (1–6): **`title`** (one line), `page` (page number, optional)

**`wknd-agenda-overview`**: topics as cards.

- `eyebrow`, `title`, `intro`
- **`items`** (1–6): **`title`** (one line), `description` (one line, under ~40 chars)

**`wknd-agenda`**: a workshop or meeting schedule.

- `eyebrow`, `title`, `intro`
- `date` (`YYYY-MM-DD`), `location`, `startTime` (`HH:MM`, 24h)
- **`items`** (1–6): **`title`** (may use `\n` for a second line; short sessions only fit short titles), `durationMinutes` (integer), `kind` (`"session"` or `"break"`)
- All sessions must end before midnight.

```json
{ "layout": "wknd-agenda", "content": {
  "eyebrow": "Workshop", "title": "Agenda\nhari ini.", "intro": "Satu hari untuk menyepakati arah produk.",
  "date": "2026-12-07", "location": "[Lokasi]", "startTime": "09:00",
  "items": [
    { "title": "Pembukaan", "durationMinutes": 20, "kind": "session" },
    { "title": "Temuan riset", "durationMinutes": 45, "kind": "session" },
    { "title": "Break", "durationMinutes": 15, "kind": "break" },
    { "title": "Prioritas fitur", "durationMinutes": 60, "kind": "session" }
  ] } }
```

**`wknd-agenda-spotlight`**: a section divider that lists all topics and highlights the current one. Use it before each section with the same items and a different highlighted item.

- `eyebrow`
- **`items`** (1–6): **`title`** (one line), `description` (one line, under ~40 chars), `highlighted` (exactly one item is `true`)

### Text

**`wknd-full-text-statement`**: yellow, with a huge statement on the left and three numbered columns.

- `eyebrow`
- **`title`**: a bold statement, ≤ 20 chars · 2 lines (≈10 per line), for example `"Loyal,\ntapi lelah."`
- `subtitle`: ≤ 116 chars · 4 lines (≈29 per line)
- **`columns`**: exactly 3, each `{ "body" }` with a paragraph of ≤ 370 chars · 10 lines (≈37 per line)

**`wknd-full-text`**: blue, with a title, an intro, an optional quote and three numbered columns.

- `eyebrow`
- **`title`**: ≤ 36 chars · 1 line
- `subtitle`: intro, ≤ 164 chars · 2 lines (≈82 per line)
- `quote`: pull quote, ≤ 126 chars · 2 lines (≈63 per line)
- **`columns`**: exactly 3, each `{ "body" }` with a paragraph of ≤ 360 chars · 9 lines (≈40 per line)

**`wknd-full-text-paragraphs`**: cream, with a title, an intro and stacked paragraphs.

- `eyebrow`
- **`title`**: ≤ 36 chars · 1 line
- `subtitle`: intro, ≤ 164 chars · 2 lines (≈82 per line)
- **`paragraphs`**: 1–3, each `{ "text" }` of ≤ 416 chars · 4 lines (≈104 per line)
- `note`: footnote, ≤ 132 chars · 2 lines (≈66 per line)

### Bento

**`wknd-bento-columns`**: three tall cards.

- **`title`**: ≤ 48 chars · 2 lines (≈24 per line)
- `intro`: ≤ 196 chars · 4 lines (≈49 per line)
- **`cards`**: exactly 3, each with:
  - **`title`**: 1–3 words, ≤ 26 chars · 1 line
  - `subtitle`: ≤ 50 chars · 1 line
  - `body`: ≤ 122 chars · 2 lines (≈61 per line)
  - `detail`: ≤ 244 chars · 4 lines (≈61 per line)
  - **`bullets`**: an array of exactly 3 short strings, one line each (≈59 chars), ≤ 177 chars in total

```json
{ "layout": "wknd-bento-columns", "content": {
  "title": "Tiga hal yang\nkami kerjakan", "intro": "Satu tim untuk riset, desain dan pengembangan.",
  "cards": [
    { "title": "Riset", "subtitle": "Memahami pelanggan", "body": "Wawancara dan uji kegunaan di gerai.", "detail": "Kami bertemu pelanggan langsung untuk menemukan titik friksi terbesar.", "bullets": ["Wawancara pelanggan", "Audit aplikasi", "Uji kegunaan"] },
    { "title": "Desain", "subtitle": "Satu sistem desain", "body": "Komponen yang konsisten untuk semua fitur.", "detail": "Satu bahasa visual yang mempercepat tim saat menambah fitur baru.", "bullets": ["Design system", "Prototipe", "Uji desain"] },
    { "title": "Build", "subtitle": "Rilis bertahap", "body": "Fitur dirilis dan diukur satu per satu.", "detail": "Setiap rilis diukur, sehingga keputusan berikutnya berbasis data.", "bullets": ["Mobile app", "Integrasi API", "QA & rilis"] }
  ] } }
```

**`wknd-bento-grid`**: text and a button on the left, a 2×2 grid of numbered cards on the right.

- `eyebrow`
- **`title`**: ≤ 51 chars · 3 lines (≈17 per line)
- `body`: ≤ 220 chars · 4 lines (≈55 per line)
- `button`: call to action, ≤ 40 chars · 2 lines (≈20 per line), for example `"Lihat detail →"`
- **`cards`**: exactly 4, each with:
  - **`title`**: 1–3 words, ≤ 27 chars · 1 line
  - `subtitle`: ≤ 47 chars · 1 line
  - `body`: ≤ 165 chars · 3 lines (≈55 per line)
  - `detail`: ≤ 110 chars · 2 lines (≈55 per line)

### Image

Image fields (`background`, `banner`, `image`) are optional. Leave them out to keep the placeholder photos.

**`wknd-image-chapter`**: a section divider over a full-bleed photo, with a text card.

- `background` (image)
- `eyebrow`
- **`title`**: ≤ 48 chars · 2 lines (≈24 per line)
- `subtitle`: ≤ 72 chars · 1 line
- `body`: ≤ 255 chars · 3 lines (≈85 per line)
- `caption`: ≤ 51 chars · 1 line

**`wknd-image-approach`**: three statement cards over a full-bleed photo.

- `background` (image)
- **`title`**: ≤ 19 chars · 1 line, for example `"Pendekatan:"`
- `subtitle`: ≤ 53 chars · 1 line
- **`points`**: exactly 3, each `{ "text" }` with a short statement of ≤ 78 chars · 3 lines (≈26 per line)

**`wknd-image-moods`**: four photos in a row.

- `eyebrow`
- **`title`**: ≤ 24 chars · 1 line
- `intro`: ≤ 186 chars · 3 lines (≈62 per line)
- **`items`**: exactly 4, each with `image`, **`title`** (1–2 words such as `"01 Hangat"`, ≤ 31 chars · 1 line) and **`body`** (≤ 98 chars · 2 lines, ≈49 per line)

**`wknd-image-two-studies`**: two large photos side by side.

- `eyebrow`
- **`title`**: ≤ 24 chars · 1 line
- `intro`: ≤ 183 chars · 3 lines (≈61 per line)
- **`studies`**: exactly 2, each with `image`, **`title`** (≤ 60 chars · 1 line) and **`body`** (≤ 273 chars · 3 lines, ≈91 per line)

**`wknd-image-materials`**: text on the left, a 2×2 photo grid on the right.

- `eyebrow`
- **`title`**: ≤ 32 chars · 2 lines (≈16 per line)
- `subtitle`: ≤ 49 chars · 1 line
- **`paragraphs`**: 1–2, each `{ "text" }` of ≤ 201 chars · 3 lines (≈67 per line)
- **`items`**: exactly 4, each with `image`, **`title`** (≤ 51 chars · 1 line) and **`body`** (≤ 66 chars · 1 line)

**`wknd-image-field-notes`**: a wide photo banner under the title.

- `eyebrow`
- **`title`**: ≤ 26 chars · 1 line
- `banner` (image)
- `heading`: ≤ 66 chars · 2 lines (≈33 per line)
- **`notes`**: 1–2, each `{ "text" }` of ≤ 171 chars · 3 lines (≈57 per line). These are content on the slide, not presenter notes.
- `caption`: ≤ 71 chars · 1 line

### Timeline

All three have `title`, `intro`, `periodFormat` and **`phases`**. `wknd-timeline-road` and `wknd-timeline-steps` also have `eyebrow`.

- `periodFormat`: `"weeks"`, `"dates"` or `"months"`. The default is weeks, and months for the roadmap.
- Each phase: **`title`** (1–2 words), `description` (up to two short lines, about 60 chars), **`start`** and **`end`** (`YYYY-MM-DD`, end on or after start, phases in chronological order).

| Layout | Shows | Phases |
|---|---|---|
| `wknd-timeline-road` | Milestones on a winding road | 1–5 |
| `wknd-timeline-steps` | Steps that build up. The first step's description is not shown. | 1–5 |
| `wknd-timeline-roadmap` | A roadmap across months or quarters. No eyebrow. | 1–6 |

```json
{ "layout": "wknd-timeline-steps", "content": {
  "eyebrow": "Timeline", "title": "12 minggu\nmenuju launch.", "intro": "Empat fase dari riset sampai rilis.",
  "periodFormat": "weeks",
  "phases": [
    { "title": "Discovery", "start": "2027-01-04", "end": "2027-01-17" },
    { "title": "Design", "description": "Design system dan prototipe", "start": "2027-01-18", "end": "2027-02-14" },
    { "title": "Build", "description": "Pengembangan dan integrasi", "start": "2027-02-15", "end": "2027-03-14" },
    { "title": "Launch", "description": "Rilis bertahap dan monitoring", "start": "2027-03-15", "end": "2027-03-28" }
  ] } }
```

### Team

Every team layout has `eyebrow`, `title`, `intro` and **`groups`**.

- A group has **`name`** (1–3 words), `description` (under ~40 chars) and `members`.
- A member has `name` and `role` (under ~28 chars). **Never invent people's names.** Unless the user gave you names, leave `name` out: the slide shows "Full Name" for the user to replace, and `role` alone is enough.
- `wknd-team-org` and `wknd-team-tree` also have `leader`: `{ "name", "role", "badge" }`, where `badge` is short, such as `"CEO"`.

| Layout | Leader | Groups | Members per group |
|---|---|---|---|
| `wknd-team-structure` | no | 1–4 | 1–3 |
| `wknd-team-squads` (member photos) | no | 1–4 | 1–3 |
| `wknd-team-org` (team cards) | yes | 1–5 | 1–4; the first member is the team lead |
| `wknd-team-tree` (team leads) | yes | 1–5 | 1–4; the first member is the team lead |

```json
{ "layout": "wknd-team-org", "content": {
  "eyebrow": "Tim", "title": "Tim di balik\nproyek ini.", "intro": "Satu project lead, tiga tim.",
  "leader": { "role": "Project Lead", "badge": "PM" },
  "groups": [
    { "name": "Design", "description": "Riset & desain produk", "members": [{ "role": "Design Lead" }, { "role": "UX Researcher" }] },
    { "name": "Mobile", "description": "iOS & Android", "members": [{ "role": "Mobile Lead" }, { "role": "Flutter Engineer" }] },
    { "name": "QA", "description": "Kualitas & rilis", "members": [{ "role": "QA Engineer" }] }
  ] } }
```

### Tables

Every table layout has `eyebrow`, **`title`**, `subtitle` and `table`. Cell text shrinks to fit, but keep each cell to a few words.

**`wknd-table-packages`**: pricing or package comparison.

- **`title`**: ≤ 23 chars · 1 line. `subtitle`: ≤ 70 chars · 1 line.
- `table.columns`: 2–6 `{ "title", "subtitle" }`. The first column labels the rows. Each other column is a package, with the price in `subtitle`.
- `table.rows`: 1–8 arrays, each with one string per column. `"✓"` and `"—"` render as a check and a dash.
- `table.highlightColumn`: index of the recommended package (1 or more). `table.badge`: for example `"Rekomendasi"`.

```json
{ "layout": "wknd-table-packages", "content": {
  "eyebrow": "Investasi", "title": "Pilih paket Anda", "subtitle": "Tiga level kerja sama sesuai kebutuhan Anda.",
  "table": {
    "columns": [{ "title": "Yang didapat" }, { "title": "Essential", "subtitle": "Rp [TBD]" }, { "title": "Growth", "subtitle": "Rp [TBD]" }, { "title": "Signature", "subtitle": "Rp [TBD]" }],
    "rows": [["Durasi", "8 minggu", "12 minggu", "16 minggu"], ["Riset pelanggan", "—", "✓", "✓"], ["Design system", "✓", "✓", "✓"]],
    "highlightColumn": 2, "badge": "Rekomendasi"
  } } }
```

**`wknd-table-scope`**: scope of work, with services in rows and phases in columns.

- **`title`**: ≤ 16 chars · 1 line. `subtitle`: ≤ 59 chars · 1 line.
- `table.columns`: 2–6 `{ "title" }`. The first column is the service, and the others are phases.
- `table.rows`: 1–8 arrays: the service, then `"Lead"`, `"Support"` or `"—"` for each phase.

**`wknd-table-bug-triage`**: a bug or QA issue list grouped by severity.

- **`title`**: ≤ 27 chars · 1 line. `subtitle`: ≤ 65 chars · 1 line.
- `table.groups`: 1–3 severity groups, colored orange, yellow and then blue, with **up to 6 rows in total**. Each group is `{ "label", "rows" }`, for example label `"Critical"`.
- Each row: `id` (for example `"BUG-1042"`), `issue`, `impact` (one sentence), `steps` (array of 2–3 short strings), `expected`, `actual`, and `status` (`"Open"`, `"In progress"` or `"Fixed"`).

### Closing

**`wknd-thank-you`**: a huge "Thank you." with contact details.

- `subtitle`: a closing line, ≤ 49 chars · 1 line
- `website` (≤ 17 chars), `email` (≤ 24 chars), `phone` (≤ 22 chars). Leave them out to keep Weekend's own details.

**`wknd-questions`**: a Q&A slide with three next steps.

- `eyebrow`: ≤ 37 chars · 1 line, for example `"Langkah berikutnya"`
- **`steps`**: exactly 3, each with **`title`** (2–3 words, ≤ 25 chars · 1 line) and **`body`** (≤ 100 chars · 2 lines, ≈50 per line)

---

## 7. Full example

A 10-slide proposal in Indonesian. Unknown facts are placeholders.

```json
{
  "version": 1,
  "title": "Kopi Nusantara — App Redesign Proposal",
  "footer": { "left": "Kopi Nusantara × Weekend", "note": "Confidential" },
  "slides": [
    { "layout": "wknd-cover-brand", "content": {
      "eyebrow": "Proposal 2026",
      "title": "Kopi Nusantara",
      "subtitle": "Redesign aplikasi loyalty untuk [X] juta pelanggan"
    } },
    { "layout": "wknd-agenda-overview", "content": {
      "eyebrow": "Agenda",
      "title": "Yang akan\nkita bahas.",
      "intro": "Lima topik yang akan kita bahas bersama hari ini.",
      "items": [
        { "title": "Latar Belakang", "description": "Kondisi aplikasi saat ini" },
        { "title": "Pendekatan", "description": "Cara kami bekerja" },
        { "title": "Tim", "description": "Orang-orang di balik proyek" },
        { "title": "Timeline", "description": "12 minggu menuju launch" },
        { "title": "Investasi", "description": "Pilihan paket kerja sama" }
      ]
    } },
    { "layout": "wknd-full-text-statement", "content": {
      "eyebrow": "Latar Belakang",
      "title": "Loyal,\ntapi lelah.",
      "subtitle": "Pelanggan suka kopinya, tapi aplikasinya membuat mereka menyerah di tengah jalan.",
      "columns": [
        { "body": "Aplikasi saat ini tumbuh fitur demi fitur tanpa design system. Hasilnya, setiap halaman terasa berbeda dan pelanggan sering tersesat saat mencari poin atau promo." },
        { "body": "[X]% pelanggan berhenti di halaman checkout, dan rating aplikasi turun ke [X]. Keluhan terbanyak adalah proses pemesanan yang lambat dan promo yang sulit ditemukan." },
        { "body": "Kopi Nusantara ingin aplikasi yang cepat, konsisten dan terasa hangat seperti gerainya, sekaligus siap untuk fitur baru seperti langganan bulanan dan pemesanan grup." }
      ]
    } },
    { "layout": "wknd-image-approach", "content": {
      "title": "Pendekatan:",
      "subtitle": "Tiga prinsip yang memandu redesign ini",
      "points": [
        { "text": "Riset langsung bersama pelanggan di gerai" },
        { "text": "Satu design system untuk semua fitur" },
        { "text": "Rilis bertahap, diukur di setiap langkah" }
      ]
    } },
    { "layout": "wknd-team-squads", "content": {
      "eyebrow": "Tim Kami",
      "title": "Tim di balik\nproyek ini.",
      "intro": "Tiga squad yang bekerja bersama\ndari riset sampai rilis.",
      "groups": [
        { "name": "Design", "description": "Riset & desain produk", "members": [{ "role": "Product Designer" }, { "role": "UX Researcher" }] },
        { "name": "Mobile", "description": "iOS & Android", "members": [{ "role": "Mobile Lead" }, { "role": "Flutter Engineer" }] },
        { "name": "Delivery", "description": "Kualitas & koordinasi", "members": [{ "role": "Project Manager" }, { "role": "QA Engineer" }] }
      ]
    } },
    { "layout": "wknd-timeline-road", "content": {
      "eyebrow": "Timeline",
      "title": "12 minggu\nmenuju launch.",
      "intro": "Perjalanan 12 minggu dari riset pertama\nsampai hari launch.",
      "periodFormat": "weeks",
      "phases": [
        { "title": "Discovery", "description": "Riset pelanggan dan audit aplikasi", "start": "2027-01-04", "end": "2027-01-17" },
        { "title": "Design", "description": "Design system dan prototipe", "start": "2027-01-18", "end": "2027-02-14" },
        { "title": "Build", "description": "Pengembangan dan integrasi API", "start": "2027-02-15", "end": "2027-03-14" },
        { "title": "Launch", "description": "Rilis bertahap dan monitoring", "start": "2027-03-15", "end": "2027-03-28" }
      ]
    } },
    { "layout": "wknd-table-scope", "content": {
      "eyebrow": "Scope",
      "title": "Scope of Work",
      "subtitle": "Siapa memimpin apa di setiap fase proyek.",
      "table": {
        "columns": [{ "title": "Layanan" }, { "title": "01 Discovery" }, { "title": "02 Design" }, { "title": "03 Build" }, { "title": "04 Launch" }],
        "rows": [
          ["UX Research", "Lead", "Support", "—", "Support"],
          ["UI & Design System", "Support", "Lead", "Support", "—"],
          ["Mobile App", "—", "Support", "Lead", "Lead"],
          ["QA & Release", "—", "—", "Support", "Lead"]
        ]
      }
    } },
    { "layout": "wknd-table-packages", "content": {
      "eyebrow": "Investasi",
      "title": "Pilih paket Anda",
      "subtitle": "Tiga level kerja sama sesuai kebutuhan Kopi Nusantara.",
      "table": {
        "columns": [{ "title": "Yang didapat" }, { "title": "Essential", "subtitle": "Rp [TBD]" }, { "title": "Growth", "subtitle": "Rp [TBD]" }, { "title": "Signature", "subtitle": "Rp [TBD]" }],
        "rows": [
          ["Durasi", "8 minggu", "12 minggu", "16 minggu"],
          ["Riset pelanggan", "—", "✓", "✓"],
          ["Design system", "✓", "✓", "✓"],
          ["Fitur langganan", "—", "—", "✓"],
          ["Support setelah rilis", "1 bulan", "3 bulan", "6 bulan"]
        ],
        "highlightColumn": 2,
        "badge": "Rekomendasi"
      }
    } },
    { "layout": "wknd-questions", "content": {
      "eyebrow": "Langkah berikutnya",
      "steps": [
        { "title": "Beri masukan", "body": "Kirim catatan Anda tentang proposal ini." },
        { "title": "Sepakati scope", "body": "Kita kunci scope, timeline dan tim dalam satu sesi." },
        { "title": "Kick-off", "body": "Proyek dimulai pada [Tanggal]." }
      ]
    } },
    { "layout": "wknd-thank-you", "content": {
      "subtitle": "Mari bangun sesuatu yang hebat bersama."
    } }
  ]
}
```

---

## 8. Checklist

Check every item before you hand off the JSON:

- [ ] The JSON is valid and complete: double quotes, no comments, no trailing commas, every slide included.
- [ ] `"version": 1`, and only `version`, `title`, `theme`, `footer` and `slides` at the top level.
- [ ] Every layout id exists in [section 6](#6-layout-reference), and every required field is filled.
- [ ] Item counts match exactly: 3 columns, 3 or 4 cards, 3 bullets, 4 photos, 2 studies, 3 points, 3 steps.
- [ ] Every text is under its limit, counted, not estimated: about 85% in total, and each line under the limit ÷ lines, including lines split with `\n`.
- [ ] The deck opens with a cover and closes with `wknd-questions`, `wknd-thank-you` or both.
- [ ] No layout on two slides in a row, and no layout more than three times.
- [ ] Every unknown fact is a `[placeholder]`. No invented names, numbers, prices, dates, testimonials or image URLs.
- [ ] Agenda, team and timeline slides have an `intro` when the deck is not in English.
- [ ] Timelines have dates in `YYYY-MM-DD`, in chronological order.
- [ ] After the JSON: import steps, the list of placeholders, slides you adapted, and what you assumed.
