# Custom slides

> **Draft, not shipped.** Step 2 of the `wknd-deck` work: custom slides and the `element` commands. It was taken out of `skills/wknd-deck/` on 2026-11-24 so the skill only describes commands that exist. When the commands are built:
>
> 1. Move this file back to `skills/wknd-deck/references/custom-slides.md` and add `custom-slides` to `GUIDE_TOPICS` in `lib/deck-cli/guide.ts`.
> 2. Put back the parts of SKILL.md listed at the end of this file.


Use a custom slide only when no template fits the content, for example:

- a big number or KPI,
- a quote,
- a logo wall,
- a before–after comparison,
- a comparison of two to five items, where the templates need a fixed count,
- a layout the user asks for.

If a template fits, use the template: it is tested and needs no design decisions.

## Slide spec

```json
{
  "layout": "custom",
  "theme": "cream",
  "content": {
    "elements": [
      { "type": "text", "style": "title", "text": "Pembeli berhenti\ndi langkah bayar", "slot": { "col": 2, "row": 2, "cols": 12, "rows": 3 } }
    ]
  }
}
```

- `theme`: the slide's background. Text color follows the theme unless you set `color`.
- `elements`: 1–12 elements. They are drawn in order, so later elements sit on top.

The same spec works in `check`, `deck create`, `slide add` and `slide update --spec`.

## Slots

Every element sits in a slot on the 24 × 12 grid:

```json
"slot": { "col": 2, "row": 3, "cols": 10, "rows": 4 }
```

- `col` is 1–24 and `row` is 1–12. `cols` and `rows` are how many columns and rows the element covers.
- The slot must stay on the grid: `col + cols − 1 ≤ 24` and `row + rows − 1 ≤ 12`.
- Column 1 starts at the left margin, and row 1 starts under the header. The gutters between columns are already part of the grid.
- Common splits: halves (12 + 12), thirds (8 + 8 + 8), quarters (6 + 6 + 6 + 6) and two-thirds with one third (16 + 8).

## Element types

| Type | Fields (**bold** = required) |
|---|---|
| `text` | **`style`**, **`text`**, `align` (`left`, `center`, `right`), `color` (palette token) |
| `shape` | **`shape`** (`rectangle`, `rounded`, `circle`), **`color`** (palette token) |
| `image` | `fit` (`cover`, `contain`), `rounded` (`true` or `false`). Always a placeholder photo that the user swaps in the editor |
| `object3d` | **`object`** (`w`, `k`, `n`, `d`, `arrow`, `stars`), `color` (one of the 3D colors in `wknd-deck brand`) |
| `cards` | **`columns`** (2–4), **`items`**: one `{ "title", "description" }` per column, `color` (palette token for the card background) |
| `timeline` | **`phases`**: the same phase fields as the timeline templates (`title`, `description`, `start`, `end`), and `periodFormat` |
| `table` | **`columns`** and **`rows`**, the same fields as the table templates |

Every element also needs a **`slot`**. Timelines and tables need a minimum slot size, which `check` reports. Planned for later: agendas and teams inside custom slides, and device mockups.

## Text styles

| Style | Use it for |
|---|---|
| `display` | one huge word or number, at most one per slide |
| `title` | the slide's claim, one per slide |
| `heading` | titles of columns or blocks |
| `body` | paragraphs |
| `caption` | sources, notes and labels under images |
| `eyebrow` | a small pill label above the title, 1–3 words |

`wknd-deck brand` lists the size of each style. Text must fit its slot: `check` measures it and reports overflowing text as an error.

## Composition rules

- **One focal point.** The single `display` or `title` is the biggest thing on the slide.
- **Shared edges.** Blocks that belong together start in the same column.
- **Room to breathe.** Fill at most about two thirds of the grid, and don't stretch text to fill a slot.
- **One accent color** at most, besides the theme.
- **No overlapping text.** Text may sit on a shape or photo only when it stays readable; `check` warns about weak contrast.
- **Same copy rules** as template slides: a title is a claim, and every unknown fact is a placeholder.

## Examples

**A big number:**

```json
{ "layout": "custom", "theme": "yellow", "content": { "elements": [
  { "type": "text", "style": "eyebrow", "text": "Hasil pilot", "slot": { "col": 2, "row": 1, "cols": 6, "rows": 1 } },
  { "type": "text", "style": "display", "text": "[X]%", "slot": { "col": 2, "row": 3, "cols": 10, "rows": 5 } },
  { "type": "text", "style": "title", "text": "lebih sedikit pembeli\nberhenti di checkout", "slot": { "col": 13, "row": 4, "cols": 10, "rows": 3 } },
  { "type": "text", "style": "caption", "text": "Sumber: [Data pilot, Bulan 2026]", "slot": { "col": 2, "row": 11, "cols": 10, "rows": 1 } }
] } }
```

**A quote:**

```json
{ "layout": "custom", "theme": "blue", "content": { "elements": [
  { "type": "object3d", "object": "stars", "color": "yellow", "slot": { "col": 19, "row": 1, "cols": 5, "rows": 4 } },
  { "type": "text", "style": "title", "text": "“[Kutipan dari pelanggan\natau klien]”", "slot": { "col": 2, "row": 3, "cols": 16, "rows": 5 } },
  { "type": "text", "style": "caption", "text": "[Nama], [Jabatan] — [Perusahaan]", "slot": { "col": 2, "row": 9, "cols": 10, "rows": 1 } }
] } }
```

## Changing elements

`wknd-deck element list <deck> <slide>` gives each element's id. `element update` takes a patch with any element field, such as `text`, `slot`, `style` or `color`. Element commands work on custom slides only; change a template slide with `slide update`.

---

## SKILL.md parts to put back

Front matter description: "…to plan, build and revise WKND presentations, from templates or as custom slides on the brand grid."

Section 1, "How the app works", under **Slides**:

- **Custom slide:** elements you place yourself on the brand grid, for content that no template fits. See `wknd-deck guide custom-slides`.
- **The grid:** 24 columns × 12 rows inside the content area. The logo and footer frame is fixed. Custom elements sit in grid slots, never at free pixel positions.
- **Brand tokens:** five themes (blue, cream, black, yellow, orange), a fixed color palette, named text styles and the WKND 3D objects. `wknd-deck brand` lists them. The CLI rejects any other color, font or size.

Section 2, "Decide yourself": "…the layouts, whether a slide is a template or custom slide, the copy…"

Section 5, step 2 (Storyline): "…then its layout, or `custom` with a few words on what it shows."

Section 6, recipes:

- **Add a custom slide:** read `wknd-deck guide custom-slides`, then `wknd-deck slide add <deck> specs/custom.json --after <slide>`.
- **Fine-tune a custom slide:** `element list` for the element ids, then `element update … --patch '{"slot":{"col":2,"row":4,"cols":10,"rows":3}}'`.
- In "The user asks for a look": "If none fits, tell the user which template comes closest, or propose a custom slide."

Section 7, references table: `custom-slides` | Grid slots, element types, text styles and composition rules for custom slides.
