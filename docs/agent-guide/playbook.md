# WKND deck playbook

How to plan, write and build a Weekend (WKND) deck with the user. Every agent (Codex, Claude CLI, Claude Desktop) gets this text from the `get_deck_playbook` tool or the `plan_deck` prompt of the deck_builder MCP server, so editing this file changes all of them. The file is read on every call, so an edit applies to the next deck without restarting anything.

Layout ids, fields and character limits come from `list_layouts`. This playbook covers the conversation, the story (including which layout fits which content) and the copy.

Sections 2 and 3 are also in `DECK-GUIDE.md` in the project root, the guide for agents without these tools. Keep both copies the same.

---

## 1. Workflow

The user approves **once**, at the storyline. After that you write the copy and build without asking again.

### Step 1: Brief

Find out what you need to plan the story. Skip whatever the user already told you, and ask at most five short questions in one message:

1. **Goal:** what should the audience decide or do after this deck?
2. **Audience:** who are they, and what do they already know or worry about?
3. **Context:** client, project, the problem and any history.
4. **Facts available:** numbers, prices, dates, team, references. Everything else becomes a placeholder.
5. **Format:** about how many slides, language, presented live or sent as a document.

If the user gives a document, notes or a long description, read it and only ask about real gaps. If the user says to just go ahead, make sensible assumptions, state them in one line and continue.

### Step 2: Storyline (approval point)

Propose the deck as a numbered list, one line per slide:

```
1. [Message of the slide, one sentence] — <cover layout> (<its color>)
2. [Message] — <layout>
3. [Message] — <layout>
...
```

- Write the **message** the slide must land, not its topic ("Checkout lambat membuat 3 dari 10 pembeli pergi", not "Analisis checkout").
- Pick each layout from that slide's content, as described in [Choose layouts by content](#choose-layouts-by-content), and the cover with [Choose a cover](#choose-a-cover). Write the cover's color in the user's language, for example `(kuning)`, so the user can ask for another one.
- Add one line underneath with the story arc and any assumptions or placeholders you will use.
- Ask: "Storyline ini oke? Kalau oke, aku langsung tulis copy dan build." Then wait.

The user may reorder, merge, add or cut slides. Revise and show the list again only if the change is big. Small changes can go straight to building.

### Step 3: Copy and build (no further approval)

Once the storyline is approved:

1. Call `list_layouts` with `layoutId` for each layout you need, so you know the exact fields, item counts and limits.
2. Write the copy for every slide, following [section 3](#3-copywriting). Aim for about 85% of each character limit.
3. Build live: `create_deck` with `live: true`, `plannedSlides` and only the cover, then `add_slide` one slide at a time in storyline order. Share the Library link right after the cover so the user can watch.
4. When a slide fails with a text-fit or field error, shorten or reshape that slide and retry it. Do not change the storyline to work around errors.
5. Call `finish_deck`. Then reply with the deck title, the Library link, a list of every placeholder the user still has to fill, and any slide you had to adapt.

### Step 4: Revisions

The user asks for changes per slide ("slide 4 judulnya kurang tajam"). Call `get_deck` for the current revision and slide ids, then `update_slide`. For changes across several slides, `start_deck_run` first. Keep manual edits the user made in the editor unless they ask you to replace them.

---

## 2. Storytelling

### Arc

Default arc for a proposal or pitch: **problem → impact → solution → proof → plan → next step.**

| Part | What it answers |
|---|---|
| Opening | Who and what is this for? |
| Problem | What is going wrong, or what is the opportunity? |
| Impact | Why does it matter now? |
| Solution | What do we propose? |
| Proof | Why believe us? |
| Plan | How, when and who? |
| Next step | What do we need from you? |

Other deck types:

- **Workshop:** cover, the schedule (`wknd-agenda`), content per session, Q&A.
- **Project update:** cover, agenda, progress against the plan, highlights, open issues or bugs, closing.
- **Case study:** cover, the challenge, the approach, the work, the results, closing.
- **Investor pitch:** cover, problem, solution, how it works, traction, market, business model, team, plan and use of funds, the ask (with the amount), closing.

### Choose layouts by content

The same arc does not mean the same layouts. Choose each slide's layout from what its content actually is, using the options below. **The options are not in order of preference, and none of them is the default.** Don't reuse an opening or a sequence from an example or an earlier deck: the layouts follow from this brief. When two options fit the content equally well, take the one that contrasts with the slides next to it, such as a photo layout after text layouts.

**Opening**

- Cover: see [Choose a cover](#choose-a-cover).
- Agenda, in decks of more than about 8 slides:
  - a plain list of chapters, optionally with page numbers → `wknd-agenda-chapters`
  - topics that each need a one-line explanation → `wknd-agenda-overview`
  - a meeting or workshop with a date and session times → `wknd-agenda`

**Problem or challenge**

- one bold claim of two short lines, backed by two or three points → `wknd-full-text-statement`
- an observation from research, interviews or a visit, shown with a photo → `wknd-image-field-notes`, or `wknd-image-text-photo` / `wknd-image-photo-text` when one photo and a few paragraphs tell it
- background or context that needs a few paragraphs of prose → `wknd-full-text-paragraphs`
- a claim, two or three points and a quote from the client or a user → `wknd-full-text`

**Impact**

- two to four numbers, such as results, market size or the cost of the problem → `wknd-stats`
- four effects that need a sentence or two each → `wknd-bento-grid`
- the cost of doing nothing in two or three points, with a quote if you have one → `wknd-full-text`
- one bold claim on its own → `wknd-full-text-statement`, without columns

**Solution or approach**

- three services or pillars, each with detail and bullets → `wknd-bento-columns`
- three short principles for how we will work → `wknd-image-approach`
- four features or benefits, with a call to action → `wknd-bento-grid`
- four creative directions, moods or concepts → `wknd-image-moods`
- references, materials or visual inspiration → `wknd-image-materials`

**Proof**

- two case studies, or two options side by side → `wknd-image-two-studies`
- one case or story told with a single photo → `wknd-image-text-photo` or `wknd-image-photo-text`
- results as numbers → `wknd-stats`

**Plan**

- phases told as a journey toward a launch → `wknd-timeline-road`
- phases where each one builds on the one before → `wknd-timeline-steps`
- work spread over months or quarters → `wknd-timeline-roadmap`
- who leads and who supports in each phase → `wknd-table-scope`
- open issues or bugs by severity → `wknd-table-bug-triage`

**Team**

- teams of equals → `wknd-team-structure`, or `wknd-team-squads` when the slide should show faces
- one leader, with the teams in focus → `wknd-team-org`
- one leader, with the team leads in focus → `wknd-team-tree`

**Next step**

- packages or prices to choose from → `wknd-table-packages`
- three next steps for the client, such as the ask in a pitch → `wknd-questions`
- contact details → `wknd-thank-you`

**Section dividers:** `wknd-agenda-spotlight` (shows where we are in the agenda) or `wknd-image-chapter` (a photo and a short text). See the rules below.

### Choose a cover

All four covers hold the client or project name. Choose in this order:

1. **Length of the name.** Aim for about 14 characters on `wknd-cover-brand`, 13 on `wknd-cover-star` and 12 on `wknd-cover-arches`, all on one line. A longer name, or one that reads better on two lines, goes on `wknd-cover-d`, for example `"Kopi\nNusantara"`.
2. **The client's brand color**, if you know it and it is close to one of the four: blue `wknd-cover-brand`, black `wknd-cover-star`, yellow `wknd-cover-arches`, orange `wknd-cover-d`.
3. **Otherwise, the tone of the deck:** blue for calm and trustworthy, black for premium and bold, yellow for warm and friendly, orange for energetic.

### Rules

- **One message per slide.** If a slide needs two messages, it is two slides.
- **The titles alone tell the story.** Reading only the slide titles in order should make the argument.
- **Open with a cover and close** with `wknd-questions`, `wknd-thank-you`, or both in that order.
- **No slide that is mostly placeholders.** If the user has no material for a slide, such as real case studies for a proof slide, leave the slide out and say so in the hand-off.
- **Section dividers** (`wknd-agenda-spotlight` or `wknd-image-chapter`) only in decks over about 10 slides, one before each section. With more than three sections, alternate the two.
- **Vary layouts:** never the same layout on two slides in a row, and any layout at most three times.
- **Fixed item counts:** when content doesn't match a layout's count, merge items, split them over two slides or choose another layout. Never pad with filler items.
- **Big numbers** go on `wknd-stats`, two to four per slide. A number without a real source is a placeholder such as `[X]%`.
- **No layout for** charts, quote-only slides, logo walls or testimonials.
- **When the user asks for a look** ("two columns", "text and a photo", "big numbers"), take a layout with that shape. If none has it, say which layout comes closest instead of silently using another look.
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
