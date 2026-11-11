import JSZip from "jszip";

// Reads a Markdown or PowerPoint file in the browser into plain text that the
// AI can turn into a deck spec. PowerPoint slides are listed one by one with
// each text's font size, their tables and their speaker notes.

export interface SourceDocument {
  kind: "markdown" | "pptx";
  name: string;
  text: string;
  summary: string;
}

const MAX_SOURCE_CHARS = 150_000;
const MAX_FILE_BYTES = 50_000_000;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
} as const;

type SlideItem =
  | { kind: "text"; text: string; size: number | null; x: number; y: number }
  | { kind: "table"; rows: string[][] }
  | { kind: "picture" }
  | { kind: "chart" };

interface SlideContent {
  index: number;
  items: SlideItem[];
  notes: string;
}

function children(element: Element, ns: string, name: string) {
  return Array.from(element.children).filter((child) => child.namespaceURI === ns && child.localName === name);
}

function child(element: Element | undefined, ns: string, name: string) {
  return element ? children(element, ns, name)[0] : undefined;
}

function parseXml(source: string) {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("The PowerPoint file is damaged.");
  return document;
}

async function readXml(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? parseXml(await file.async("text")) : null;
}

// "slides/slide1.xml" relative to "ppt/presentation.xml" → "ppt/slides/slide1.xml".
function resolvePath(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

async function readRelationships(zip: JSZip, partPath: string) {
  const slash = partPath.lastIndexOf("/");
  const relsPath = `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
  const document = await readXml(zip, relsPath);
  const relationships = new Map<string, { type: string; target: string }>();
  if (!document) return relationships;
  for (const element of Array.from(document.getElementsByTagNameNS(NS.rel, "Relationship"))) {
    relationships.set(element.getAttribute("Id") ?? "", {
      type: element.getAttribute("Type") ?? "",
      target: resolvePath(partPath, element.getAttribute("Target") ?? ""),
    });
  }
  return relationships;
}

function paragraphText(paragraph: Element) {
  let text = "";
  for (const node of Array.from(paragraph.getElementsByTagNameNS(NS.a, "*"))) {
    if (node.localName === "t") text += node.textContent ?? "";
    else if (node.localName === "br") text += "\n";
  }
  return text.trim();
}

function shapeText(shape: Element) {
  const body = child(shape, NS.p, "txBody");
  if (!body) return { text: "", size: null };
  const lines: string[] = [];
  let size: number | null = null;
  for (const paragraph of children(body, NS.a, "p")) {
    const text = paragraphText(paragraph);
    if (!text) continue;
    const level = Number(child(paragraph, NS.a, "pPr")?.getAttribute("lvl") ?? 0);
    lines.push(`${"  ".repeat(level)}${text}`);
    for (const run of Array.from(paragraph.getElementsByTagNameNS(NS.a, "rPr"))) {
      const value = Number(run.getAttribute("sz"));
      if (value) size = Math.max(size ?? 0, value / 100);
    }
  }
  return { text: lines.join("\n"), size };
}

function offset(element: Element) {
  const off = element.getElementsByTagNameNS(NS.a, "off")[0];
  return { x: Number(off?.getAttribute("x") ?? 0), y: Number(off?.getAttribute("y") ?? 0) };
}

// Shapes in document order, which is the order they were added and usually
// the reading order. Groups are flattened.
function collectItems(tree: Element, items: SlideItem[]) {
  for (const element of Array.from(tree.children)) {
    if (element.namespaceURI !== NS.p) continue;
    if (element.localName === "grpSp") collectItems(element, items);
    else if (element.localName === "sp") {
      const placeholder = element.getElementsByTagNameNS(NS.p, "ph")[0]?.getAttribute("type");
      if (placeholder === "sldNum" || placeholder === "dt" || placeholder === "ftr") continue;
      const { text, size } = shapeText(element);
      if (text) items.push({ kind: "text", text, size, ...offset(element) });
    } else if (element.localName === "graphicFrame") {
      const table = element.getElementsByTagNameNS(NS.a, "tbl")[0];
      const uri = element.getElementsByTagNameNS(NS.a, "graphicData")[0]?.getAttribute("uri") ?? "";
      if (table) {
        items.push({
          kind: "table",
          rows: children(table, NS.a, "tr").map((row) => children(row, NS.a, "tc").map((cell) =>
            Array.from(cell.getElementsByTagNameNS(NS.a, "p")).map(paragraphText).filter(Boolean).join(" "))),
        });
      } else if (uri.includes("chart")) items.push({ kind: "chart" });
    } else if (element.localName === "pic") items.push({ kind: "picture" });
  }
}

async function readNotes(zip: JSZip, path: string) {
  const document = await readXml(zip, path);
  if (!document) return "";
  return Array.from(document.getElementsByTagNameNS(NS.p, "sp"))
    .filter((shape) => {
      const type = shape.getElementsByTagNameNS(NS.p, "ph")[0]?.getAttribute("type");
      return type !== "sldNum" && type !== "sldImg";
    })
    .map((shape) => shapeText(shape).text)
    .filter(Boolean)
    .join("\n");
}

// Text repeated on most slides (deck name, page numbers) is chrome, not
// content.
function removeRepeatedText(slides: SlideContent[]) {
  if (slides.length < 3) return;
  const threshold = Math.max(3, Math.ceil(slides.length * 0.5));
  const counts = new Map<string, number>();
  const pageNumberSpots = new Map<string, number>();
  const spot = (item: { x: number; y: number }) => `${Math.round(item.x / 91440)}:${Math.round(item.y / 91440)}`;
  for (const slide of slides) {
    const seen = new Set<string>();
    for (const item of slide.items) {
      if (item.kind !== "text") continue;
      if (!seen.has(item.text)) counts.set(item.text, (counts.get(item.text) ?? 0) + 1);
      seen.add(item.text);
      if (/^\d{1,3}$/.test(item.text) && Number(item.text) === slide.index) {
        pageNumberSpots.set(spot(item), (pageNumberSpots.get(spot(item)) ?? 0) + 1);
      }
    }
  }
  for (const slide of slides) {
    slide.items = slide.items.filter((item) => item.kind !== "text" || (
      (counts.get(item.text) ?? 0) < threshold &&
      !(/^\d{1,3}$/.test(item.text) && (pageNumberSpots.get(spot(item)) ?? 0) >= threshold)
    ));
  }
}

function formatSlide(slide: SlideContent) {
  const lines = [`## Slide ${slide.index}`];
  for (const item of slide.items) {
    if (item.kind === "text") {
      const [first, ...rest] = item.text.split("\n");
      lines.push(`${item.size ? `[${Math.round(item.size)}pt] ` : ""}${first}`, ...rest.map((line) => `  ${line}`));
    } else if (item.kind === "table") {
      lines.push("Table:", ...item.rows.map((row) => `| ${row.join(" | ")} |`));
    } else lines.push(item.kind === "chart" ? "[chart]" : "[picture]");
  }
  if (slide.notes) lines.push(`Notes: ${slide.notes.replace(/\s*\n\s*/g, " ")}`);
  return lines.join("\n");
}

async function readPowerPoint(file: File): Promise<SourceDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("This is not a valid .pptx file.");
  }
  const presentationPath = "ppt/presentation.xml";
  const presentation = await readXml(zip, presentationPath);
  if (!presentation) throw new Error("This is not a valid .pptx file.");
  const relationships = await readRelationships(zip, presentationPath);
  const slidePaths = Array.from(presentation.getElementsByTagNameNS(NS.p, "sldId"))
    .map((element) => relationships.get(element.getAttributeNS(NS.r, "id") ?? "")?.target)
    .filter((path): path is string => Boolean(path));

  const slides: SlideContent[] = [];
  for (const [index, path] of slidePaths.entries()) {
    const document = await readXml(zip, path);
    const tree = document?.getElementsByTagNameNS(NS.p, "spTree")[0];
    if (!tree) continue;
    const items: SlideItem[] = [];
    collectItems(tree, items);
    const notesPath = [...(await readRelationships(zip, path)).values()].find((rel) => rel.type.endsWith("/notesSlide"))?.target;
    slides.push({ index: index + 1, items, notes: notesPath ? await readNotes(zip, notesPath) : "" });
  }
  if (!slides.length) throw new Error("No slides were found in this file.");
  removeRepeatedText(slides);

  const count = (kind: SlideItem["kind"]) => slides.reduce((total, slide) => total + slide.items.filter((item) => item.kind === kind).length, 0);
  const notes = slides.filter((slide) => slide.notes).length;
  const parts = [
    `${slides.length} slide${slides.length === 1 ? "" : "s"}`,
    count("table") ? `${count("table")} tables` : "",
    count("picture") ? `${count("picture")} pictures (not imported)` : "",
    count("chart") ? `${count("chart")} charts (not imported)` : "",
    notes ? `notes on ${notes} slides` : "",
  ].filter(Boolean);
  return { kind: "pptx", name: file.name, text: slides.map(formatSlide).join("\n\n"), summary: parts.join(" · ") };
}

export async function readSourceDocument(file: File): Promise<SourceDocument> {
  if (file.size > MAX_FILE_BYTES) throw new Error("That file is too large.");
  const extension = file.name.toLowerCase().split(".").pop();
  let document: SourceDocument;
  if (extension === "pptx") document = await readPowerPoint(file);
  else if (extension === "md" || extension === "markdown" || extension === "txt") {
    const text = (await file.text()).trim();
    if (!text) throw new Error("The file is empty.");
    const headings = text.split("\n").filter((line) => /^#{1,3}\s/.test(line)).length;
    document = { kind: "markdown", name: file.name, text, summary: `${Math.ceil(text.length / 1000)}k characters · ${headings} headings` };
  } else {
    throw new Error("Use a .md or .pptx file.");
  }
  if (document.text.length > MAX_SOURCE_CHARS) {
    throw new Error(`The document is too long (${Math.round(document.text.length / 1000)}k characters). Split it into parts of up to ${MAX_SOURCE_CHARS / 1000}k.`);
  }
  return document;
}
