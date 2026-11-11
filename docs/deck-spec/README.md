# Deck spec

A deck spec is a JSON description of a deck that any tool or AI agent can produce. The deck builder turns it into WKND slides: the spec picks a layout for each slide and fills that layout's content fields, and the layout sets every position, color and font.

```json
{
  "version": 1,
  "title": "Client X — Proposal",
  "theme": "blue",
  "footer": { "left": "Client X × Weekend", "note": "Confidential" },
  "slides": [
    { "layout": "wknd-cover-brand", "content": { "eyebrow": "Proposal — 2026", "title": "Client X", "subtitle": "One-line tagline" } },
    { "layout": "wknd-thank-you", "content": { "subtitle": "Let's build something great together." } }
  ]
}
```

| Field | Notes |
|---|---|
| `title` | Deck title shown in the editor. |
| `theme` | Optional: `blue`, `cream`, `black`, `yellow` or `orange`. Recolors every slide. Leave it out to keep each layout's own colors. |
| `footer` | Optional text at the bottom of every slide. |
| `slides[].layout` | A layout id from the catalog. |
| `slides[].content` | That layout's fields. |
| `slides[].theme` | Optional per-slide theme. |

See [example-proposal.json](example-proposal.json) for a full 10-slide proposal.

## The catalog

`/deck-spec/catalog.json` lists every supported layout with:

- what it is for (`purpose`),
- its fields, with required flags, item counts and estimated `maxChars` / `maxLines`,
- an example `content` object.

Give this file to an agent together with the brief. Locally it is at <http://localhost:3000/deck-spec/catalog.json>. The static build writes it to `out/deck-spec/catalog.json`.

31 of the 40 layouts are supported. Image Split, SOW Modules and the seven device mockups are not, because their content is positioned by hand.

## Checks

The builder reports issues with a path such as `slides[2].content.columns[1].body`:

- **Errors:** unknown layout, wrong shape or item count, missing required field, or text that does not fit its box. Text fit is measured with the real font in the editor and estimated elsewhere.
- **Warnings:** ignored unknown fields, or placeholder photos used because no image URL was given.

An agent should fix the errors and send the spec again.

## Importing

In the editor, click **Import** in the top bar:

- **Document (MD, PPTX):** Claude writes the deck spec from a Markdown or PowerPoint file through the local AI bridge. See the main README.
- **Deck spec (JSON):** paste the JSON or upload a `.json` file.

Check the preview and the issue list, then choose **Replace deck** or **Add to deck**. The import is one undo step.

## Code

| File | Contents |
|---|---|
| [lib/deck-spec/deck-spec.ts](../../lib/deck-spec/deck-spec.ts) | Spec and result types |
| [lib/deck-spec/static-layouts.ts](../../lib/deck-spec/static-layouts.ts) | Fields of the fixed layouts, mapped to template element ids |
| [lib/deck-spec/component-layouts.ts](../../lib/deck-spec/component-layouts.ts) | Agenda, Team, Timeline and Table content, built with the same models and checks as the forms |
| [lib/deck-spec/build-deck.ts](../../lib/deck-spec/build-deck.ts) | `buildDeckFromSpec(spec, measure?)` |
| [lib/deck-spec/layout-catalog.ts](../../lib/deck-spec/layout-catalog.ts) | `getDeckSpecCatalog()` |
| [lib/deck-spec/source-document.ts](../../lib/deck-spec/source-document.ts) | Reads `.md` and `.pptx` files into text for Claude |
| [lib/ai/deck-generation.ts](../../lib/ai/deck-generation.ts) | Draft with Claude, check, and let Claude fix problems |

To support another fixed layout, add an entry to `STATIC_LAYOUT_CONTENT` whose `element` values match the layout's element ids (without the `<layoutId>-` prefix). The builder throws an error if an id does not exist.
