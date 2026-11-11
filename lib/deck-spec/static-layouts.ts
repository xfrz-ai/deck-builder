// Content fields of the fixed WKND layouts. Each field names the template
// element it fills, by its id without the layout prefix: for layout
// "wknd-full-text", element "title" is "wknd-full-text-title".

export interface StaticTextField {
  type: "text";
  element: string;
  description: string;
  required?: boolean;
  // When the field is left out: "remove" deletes the element (and
  // `removeWith`), "keep" leaves the template text. Defaults to "remove".
  fallback?: "remove" | "keep";
  removeWith?: readonly string[];
  // An outlined pill whose outline ("…-outline") grows with the label.
  pill?: boolean;
  // The value is an array of exactly this many lines, e.g. bullet points
  // next to fixed bullet dots.
  lines?: number;
}

export interface StaticImageField {
  type: "image";
  element: string;
  description: string;
}

export type StaticItemField = StaticTextField | StaticImageField;

export interface StaticListField {
  type: "list";
  description: string;
  min: number;
  max: number;
  // Item element ids use "{n}" for the item key: 1, 2, 3… unless `keys`
  // names them.
  keys?: readonly string[];
  // Elements of unused items (fewer than `max`) start with this prefix.
  itemPrefix: string;
  fields: Record<string, StaticItemField>;
}

export type StaticField = StaticTextField | StaticImageField | StaticListField;

export interface StaticLayoutContent {
  layoutId: string;
  purpose: string;
  fields: Record<string, StaticField>;
}

const eyebrow = (element = "pill-label"): StaticTextField => ({
  type: "text",
  element,
  pill: true,
  description: "Short label in the outlined pill above the title, 1–3 words. Leave out to hide the pill.",
});

const text = (element: string, description: string, options: Partial<StaticTextField> = {}): StaticTextField => ({
  type: "text",
  element,
  description,
  ...options,
});

const title = (element = "title", description = "Slide title. Use \"\\n\" to break lines on purpose.") =>
  text(element, description, { required: true });

const image = (element: string, description: string): StaticImageField => ({ type: "image", element, description });

const IMAGE_NOTE = "Image URL (https:// or data:image/…). Leave out to keep the placeholder photo.";

export const STATIC_LAYOUT_CONTENT: readonly StaticLayoutContent[] = [
  {
    layoutId: "wknd-cover-brand",
    purpose: "Opening slide on blue with a huge one-line title, such as the client or project name.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "One short line, about 12 characters."),
      subtitle: text("subtitle", "One-line tagline under the title."),
    },
  },
  {
    layoutId: "wknd-cover-star",
    purpose: "Opening slide on black with a 3D star and a huge one-line title.",
    fields: {
      title: title("title", "One short line, about 12 characters."),
      subtitle: text("subtitle", "One-line tagline under the title."),
    },
  },
  {
    layoutId: "wknd-cover-arches",
    purpose: "Opening slide on yellow with 3D letters standing on arches.",
    fields: {
      title: title("title", "One short line, about 12 characters."),
      subtitle: text("subtitle", "Tagline of up to two short lines."),
    },
  },
  {
    layoutId: "wknd-cover-d",
    purpose: "Opening slide on orange with a large 3D D and a two-line title.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "Up to two short lines, e.g. \"Project\\nName.\""),
      subtitle: text("subtitle", "Tagline of up to two short lines."),
    },
  },
  {
    layoutId: "wknd-full-text",
    purpose: "Text-heavy slide on blue: title, intro, an optional pull quote and three numbered text columns.",
    fields: {
      eyebrow: eyebrow(),
      title: title(),
      subtitle: text("subtitle", "Intro of one or two sentences."),
      quote: text("quote", "Optional pull quote, up to two lines.", { removeWith: ["quote-mark"] }),
      columns: {
        type: "list",
        description: "Exactly three numbered columns of body text.",
        min: 3,
        max: 3,
        itemPrefix: "column-{n}-",
        fields: { body: text("column-{n}-body", "A paragraph of 40–60 words.", { required: true }) },
      },
    },
  },
  {
    layoutId: "wknd-full-text-paragraphs",
    purpose: "Text-heavy slide on cream: title, intro, up to three stacked paragraphs and a small note.",
    fields: {
      eyebrow: eyebrow(),
      title: title(),
      subtitle: text("subtitle", "Intro of one or two sentences."),
      paragraphs: {
        type: "list",
        description: "One to three paragraphs, the first may be a little longer.",
        min: 1,
        max: 3,
        itemPrefix: "paragraph-{n}",
        fields: { text: text("paragraph-{n}", "A paragraph of 30–50 words.", { required: true }) },
      },
      note: text("note", "Optional footnote of one or two lines.", { removeWith: ["note-label"] }),
    },
  },
  {
    layoutId: "wknd-full-text-statement",
    purpose: "Statement slide on yellow: a huge title on the left with three numbered text columns.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "Up to three short lines; a bold statement."),
      subtitle: text("subtitle", "Short supporting text beside the title, 2–4 lines."),
      columns: {
        type: "list",
        description: "Exactly three numbered columns of body text.",
        min: 3,
        max: 3,
        itemPrefix: "column-{n}-",
        fields: { body: text("column-{n}-body", "A paragraph of 40–60 words.", { required: true }) },
      },
    },
  },
  {
    layoutId: "wknd-image-chapter",
    purpose: "Chapter divider over a full-bleed photo, with a text card.",
    fields: {
      background: image("background", IMAGE_NOTE),
      eyebrow: eyebrow(),
      title: title("title", "Up to two lines."),
      subtitle: text("subtitle", "One line."),
      body: text("body", "Two or three sentences."),
      caption: text("caption", "Photo caption, one short line."),
    },
  },
  {
    layoutId: "wknd-image-approach",
    purpose: "Approach or key-points slide over a full-bleed photo with three statement cards.",
    fields: {
      background: image("background", IMAGE_NOTE),
      title: title("title", "One short line, e.g. \"Our approach:\""),
      subtitle: text("subtitle", "One line introducing the three points."),
      points: {
        type: "list",
        description: "Exactly three points.",
        min: 3,
        max: 3,
        itemPrefix: "point-{n}-",
        fields: { text: text("point-{n}-text", "A statement of 5–8 words.", { required: true }) },
      },
    },
  },
  {
    layoutId: "wknd-image-two-studies",
    purpose: "Two large photos side by side, each with a title and description.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "One line."),
      intro: text("intro", "Two or three sentences."),
      studies: {
        type: "list",
        description: "Exactly two studies.",
        min: 2,
        max: 2,
        itemPrefix: "study-{n}-",
        fields: {
          image: image("study-{n}-image", IMAGE_NOTE),
          title: text("study-{n}-title", "Short title, e.g. \"01 Sunlit terracotta\".", { required: true }),
          body: text("study-{n}-body", "Two or three sentences.", { required: true }),
        },
      },
    },
  },
  {
    layoutId: "wknd-image-moods",
    purpose: "Four photos in a row, each with a short title and one sentence.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "One line."),
      intro: text("intro", "Two or three sentences."),
      items: {
        type: "list",
        description: "Exactly four items.",
        min: 4,
        max: 4,
        itemPrefix: "mood-{n}-",
        fields: {
          image: image("mood-{n}-image", IMAGE_NOTE),
          title: text("mood-{n}-title", "One or two words, e.g. \"01 Warm\".", { required: true }),
          body: text("mood-{n}-body", "One sentence, up to two lines.", { required: true }),
        },
      },
    },
  },
  {
    layoutId: "wknd-image-materials",
    purpose: "Title and paragraphs on the left, a 2×2 grid of photos with captions on the right.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "Up to two lines."),
      subtitle: text("subtitle", "One line."),
      paragraphs: {
        type: "list",
        description: "One or two short paragraphs.",
        min: 1,
        max: 2,
        itemPrefix: "paragraph-{n}",
        fields: { text: text("paragraph-{n}", "Two or three sentences.", { required: true }) },
      },
      items: {
        type: "list",
        description: "Exactly four photos.",
        min: 4,
        max: 4,
        itemPrefix: "material-{n}-",
        fields: {
          image: image("material-{n}-image", IMAGE_NOTE),
          title: text("material-{n}-title", "Short title, e.g. \"01 Terracotta\".", { required: true }),
          body: text("material-{n}-body", "One short sentence.", { required: true }),
        },
      },
    },
  },
  {
    layoutId: "wknd-image-field-notes",
    purpose: "A wide photo banner under the title, with a heading and two notes.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "One line."),
      banner: image("banner", IMAGE_NOTE),
      heading: text("heading", "Up to two short lines."),
      notes: {
        type: "list",
        description: "One or two notes.",
        min: 1,
        max: 2,
        itemPrefix: "note-{n}",
        fields: { text: text("note-{n}", "Two or three sentences.", { required: true }) },
      },
      caption: text("caption", "Photo caption, one short line."),
    },
  },
  {
    layoutId: "wknd-bento-columns",
    purpose: "Three tall cards, each with a title, subtitle, two paragraphs and three bullet points.",
    fields: {
      title: title("title", "Up to two lines."),
      intro: text("intro", "Two or three sentences."),
      cards: {
        type: "list",
        description: "Exactly three cards.",
        min: 3,
        max: 3,
        itemPrefix: "card-{n}-",
        fields: {
          title: text("card-{n}-title", "One to three words.", { required: true }),
          subtitle: text("card-{n}-subtitle", "One short line."),
          body: text("card-{n}-paragraph-1", "One or two sentences."),
          detail: text("card-{n}-paragraph-2", "Two to four sentences."),
          bullets: text("card-{n}-list", "Exactly three short bullet points.", { required: true, lines: 3 }),
        },
      },
    },
  },
  {
    layoutId: "wknd-bento-grid",
    purpose: "Title, text and a button on the left with a 2×2 grid of numbered cards.",
    fields: {
      eyebrow: eyebrow(),
      title: title("title", "Up to three short lines."),
      body: text("body", "Two or three sentences."),
      button: text("button-label", "Short call to action, e.g. \"Learn more →\".", { removeWith: ["button"] }),
      cards: {
        type: "list",
        description: "Exactly four cards.",
        min: 4,
        max: 4,
        itemPrefix: "card-{n}-",
        fields: {
          title: text("card-{n}-title", "One to three words.", { required: true }),
          subtitle: text("card-{n}-subtitle", "One short line."),
          body: text("card-{n}-paragraph-1", "Two or three sentences."),
          detail: text("card-{n}-paragraph-2", "One or two sentences."),
        },
      },
    },
  },
  {
    layoutId: "wknd-thank-you",
    purpose: "Closing slide with a huge \"Thank you.\" and contact details.",
    fields: {
      subtitle: text("subtitle", "One closing line."),
      website: text("website-value", "Website. Leave out to keep Weekend's.", { fallback: "keep" }),
      email: text("email-value", "Email address. Leave out to keep Weekend's.", { fallback: "keep" }),
      phone: text("phone-value", "Phone number. Leave out to keep Weekend's.", { fallback: "keep" }),
    },
  },
  {
    layoutId: "wknd-questions",
    purpose: "Closing \"Any questions?\" slide with three next steps.",
    fields: {
      eyebrow: text("eyebrow", "Small heading above the steps, e.g. \"What's next\".", { fallback: "keep" }),
      steps: {
        type: "list",
        description: "Exactly three next steps.",
        min: 3,
        max: 3,
        keys: ["feedback", "scope", "kickoff"],
        itemPrefix: "{n}-",
        fields: {
          title: text("{n}-title", "Two or three words.", { required: true }),
          body: text("{n}-body", "One sentence, up to two lines.", { required: true }),
        },
      },
    },
  },
];

// Header fields of the table layouts; their table comes from `table`.
export const TABLE_HEADER_FIELDS: Record<string, StaticField> = {
  eyebrow: eyebrow(),
  title: title("title", "One line."),
  subtitle: text("subtitle", "One line."),
};
