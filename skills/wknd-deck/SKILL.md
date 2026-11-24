---
name: wknd-deck
description: Operate the WKND Deck Builder through the wknd-deck CLI to plan, build and revise WKND presentations from its branded templates. Use when the user wants to make, change or review a deck, presentation, pitch or proposal.
---

# WKND Deck Builder

You build and revise presentations in the WKND Deck Builder for the user, and you work only through the `wknd-deck` command. This file explains how the app works, what you may and may not do, and which commands exist. Read it before your first command.

## 1. How the app works

- **Decks** live in the user's Library, on their own computer. The user can watch a deck in the Library or the editor while you build it, and can edit it by hand at any time.
- **Slides** are 1920×1080, and every slide is a **template**: one of the layouts that `wknd-deck layouts` lists. You choose the template and write the text for its fields. The template decides every position, font, color, photo and 3D object, so you never design a slide yourself.
- **Category and shapes:** each template has a category, what it is for (cover, agenda, image, stats…), and shapes, what it looks like (`text-image`, `two-column`, `numbers`, `statement`…).
- **Themes:** blue, cream, black, yellow or orange recolor a whole deck or one slide. Without a theme each template keeps its own colors, which is the usual WKND look. `wknd-deck brand` lists the themes, palette, font and grid.
- **Photos** are always placeholders. The user swaps them in the editor.
- **Manual edits:** when the user changes a slide by hand, the slide is marked *manual*. You don't overwrite a manual slide unless the user asks.
- **Saving:** every command that changes a deck saves at once, as a new revision. The CLI keeps track of revisions, request ids and run tokens, so you never handle them.
- **Not in the CLI:** presenting, exporting to PowerPoint, uploading images, deleting decks, and slides that no template covers. The user does these in the app.

## 2. Boundaries

**Never:**

- run anything other than `wknd-deck`, or read or edit any file except your own JSON specs in `./specs/`, and never the app's source code;
- invent facts: names, numbers, prices, dates, clients, logos, testimonials or image URLs. Use placeholders such as `[Nama Klien]`, `Rp [TBD]`, `[Tanggal]` or `[X]%`. The builder keeps them exactly as written;
- print tokens, or links that contain them;
- overwrite a manual slide or delete a slide unless the user asked for it in this conversation.

**Ask the user, then wait:**

- once, at the storyline, before you build a new deck;
- before you use `--replace-manual`, and before `slide delete`.

**Decide yourself:**

- the templates, the copy, splitting or merging slides, and which commands you run in which order. The recipes in section 6 are examples, not a script: combine the commands however the task needs.

## 3. Commands

- `<deck>` is a deck id from `wknd-deck decks`.
- `<slide>` is a slide's number in the deck (1 = first), its id, or the short id that `deck show` prints. Numbers shift when slides move, so check `deck show` again after you reorder.
- `<spec>` is either inline JSON in single quotes, which suits one slide, or a file path. Write a whole deck to a file such as `specs/deck.json` with your file tool: when a field fails, you fix just that field in the file instead of sending the whole deck again. If inline text contains an apostrophe, use a file.
- Run one `wknd-deck` command per tool call. Heredocs, pipes, loops and `$(…)` are blocked. Commands take several names at once where it helps, such as `layouts show a b c` and `guide storytelling copywriting`.
- Add `--json` to any command for machine-readable output, for example to pick up ids for the next command. `wknd-deck <command> --help` shows one command's options.

<!-- commands:start — generated from the CLI's command registry by `npm run skill:sync`; do not edit by hand -->
| Command | What it does |
|---|---|
| `wknd-deck guide [topic...]` | Print this guide, or one or more references: `storytelling`, `copywriting` |
| `wknd-deck layouts [--category <name>] [--shape <shape>]` | List the templates: id, purpose and shapes, one per line |
| `wknd-deck layouts show <layout...>` | Fields, limits and an example for one or more templates |
| `wknd-deck layouts usage [--decks <count>]` | Templates used most in recent decks, to help you vary them |
| `wknd-deck brand` | Themes, palette tokens, fonts and the grid |
| `wknd-deck decks` | List decks: id, title, slide count and last change |
| `wknd-deck deck show <deck>` | List a deck's slides: number, id, layout, title and manual flag, plus its placeholders |
| `wknd-deck slide show <deck> <slide>` | Show one slide's spec, or its text when it was edited by hand |
| `wknd-deck check <spec>` | Validate a deck spec or one slide spec without saving anything |
| `wknd-deck deck create <spec> [--live] [--planned <count>]` | Create a deck from a spec. With --live it saves the slides one by one, so the user can watch |
| `wknd-deck deck set <deck> [--title <text>] [--theme <theme>] [--footer-left <text>] [--footer-note <text>]` | Change the deck's title, theme or footer |
| `wknd-deck deck finish <deck> [--partial \| --failed] [--summary <text>]` | Close a live build you left open with --planned |
| `wknd-deck slide add <deck> <spec> [--after <slide>]` | Add a slide, at the end or after a given slide |
| `wknd-deck slide update <deck> <slide> (--patch <json> \| --spec <spec>) [--replace-manual]` | Change some fields of a slide (--patch), or replace it with a new spec (--spec) |
| `wknd-deck slide move <deck> <slide> (--after <slide> \| --first)` | Move a slide after another slide, or to the start |
| `wknd-deck slide duplicate <deck> <slide>` | Copy a slide and place the copy right after it |
| `wknd-deck slide delete <deck> <slide> --yes` | Delete a slide, once the user agreed |
| `wknd-deck open <deck>` | Open the deck in the editor, when you run in a terminal |
<!-- commands:end -->

## 4. Specs

**Deck spec** (`deck create`, `check`):

```json
{
  "version": 1,
  "title": "Kopi Nusantara — Proposal",
  "footer": { "left": "Kopi Nusantara × Weekend", "note": "Confidential" },
  "slides": [{ "layout": "wknd-cover-d", "content": { "title": "Kopi\nNusantara" } }]
}
```

- `title` is the deck's name in the Library, and `footer` is optional small text at the bottom of every slide.
- `theme` is optional: `blue`, `cream`, `black`, `yellow` or `orange` recolors every slide. Leave it out to keep each template's own colors, which is the usual WKND look.
- `slides` holds 1–60 slide specs.

**Slide spec** (`slide add`, `slide update --spec`, `check`): `{ "layout": "<template id>", "content": { … } }`, with an optional `theme` for that slide alone.

Content rules:

- Use only the fields that `wknd-deck layouts show <layout>` lists. Required fields are marked `*`, and optional fields you leave out disappear from the slide.
- Lists have fixed item counts, which `layouts show` gives. Some lists take fewer items and then spread them wider, such as two columns instead of three; their field descriptions say so. When your content doesn't match, merge items, split them over two slides or choose another template. Never pad with filler items.
- Text must fit its box. Aim for about 85% of each limit, and keep every line under its own share of it. `\n` starts a new line.
- Leave image fields out.
- Agenda, team and timeline templates show an English intro when `intro` is left out, so always set `intro` when the deck is not in English.
- Dates are `YYYY-MM-DD`. If you only know durations, start the first phase on the Monday after today and set `"periodFormat": "weeks"`.

## 5. Workflow

### New deck

1. **Brief.** Ask at most five short questions in one message, and skip what the user already told you: the goal, the audience, the context, the facts available and the format (about how many slides, language). If the user says to just go ahead, state your assumptions in one line and continue.
2. **Storyline (the only approval point).** Read `wknd-deck guide storytelling copywriting` first. Propose one line per slide: the message the slide must land, then its template. Ask for approval and wait.
3. **Write the copy.** Look up every template in the storyline with one `wknd-deck layouts show <layout> <layout> …`, then write the whole deck spec to `specs/deck.json`.
4. **Build.** Run `wknd-deck deck create specs/deck.json --live`. It checks every slide before it saves anything, so a failed check leaves nothing behind: fix the reported fields in the file and run it again. Don't change the storyline to work around an error; shorten or reshape the slide instead.
5. **Hand off.** Run `wknd-deck deck show <deck>`; it lists the placeholders per slide. Reply with the deck title, every placeholder the user still has to fill, any slide you had to adapt, and what you assumed. Don't paste links: the deck is already in the user's Library.

### Revisions

The user asks for changes per slide ("slide 4 judulnya kurang tajam"). Run `wknd-deck deck show <deck>`, then change only what was asked. A manual slide needs the user's permission before you replace it.

## 6. Recipes

Examples of how the commands combine. Adapt them; they are not the only way.

**The user asks for a look,** such as "two columns, text and a photo" or "a slide with big numbers": filter by shape, then read the templates that fit.

```sh
wknd-deck layouts --shape text-image
wknd-deck layouts show wknd-image-text-photo wknd-image-two-studies
```

Choose by the purpose line, since one shape fits several templates. If none fits, say so and offer the closest template; never swap in a different look without saying so.

**Check one slide while you write:**

```sh
wknd-deck check '{ "layout": "wknd-bento-grid", "content": { "title": "…", "cards": [ … ] } }'
```

**Build a new deck:** write `specs/deck.json`, then:

```sh
wknd-deck deck create specs/deck.json --live
```

**Build step by step,** when you want to tell the user about each slide as it lands: `deck create specs/cover.json --live --planned <total>` with only the cover, then `slide add <deck> '<slide spec>'` for each next slide, then `deck finish <deck>`.

**Sharpen one title:**

```sh
wknd-deck deck show deck-1a2b
wknd-deck slide update deck-1a2b 4 --patch '{"title":"Pembeli berhenti\ndi langkah bayar"}'
```

**Put a slide in the middle:** `slide add <deck> '<slide spec>' --after 3`.

**Restructure:** `slide move` to reorder, `slide duplicate` followed by `slide update` for a variation of a slide, and `slide delete --yes` once the user agreed.

**Change the look of the whole deck:** `deck set <deck> --theme cream`, or `--theme none` to go back to each template's own colors.

**Vary your templates:** `wknd-deck layouts usage` shows which templates recent decks used most. When two templates fit the content equally well, take the one used less.

**Chain commands with ids:** add `--json` when you need a value from one command in the next, such as the new slide id from `slide add`.

## 7. References

Read these with `wknd-deck guide <topic>` before you write:

| Topic | Contents |
|---|---|
| `storytelling` | The story arc, choosing templates by content, choosing a cover, slide rules |
| `copywriting` | The WKND voice, titles, body text and placeholders |
