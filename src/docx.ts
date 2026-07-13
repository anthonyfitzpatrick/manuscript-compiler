/**
 * Manuscript Compiler — native semantic DOCX generation.
 *
 * Converts a prepared Book directly into an offline WordprocessingML package.
 * Called by DocxExporter; calls XML/ZIP helpers and measurement conversion. It
 * never scans the vault, reparses generic Markdown structure, or writes files.
 * Structural styles come from Book nodes and missing numbers remain missing.
 */
import { strToU8, zipSync } from "fflate";
import type { Book, Chapter, ManuscriptDocument, Part } from "./model";
import { numberWord } from "./ordering";
import type { CompileProfile, StructuralDisplay } from "./settings";
import { TemplateEngine } from "./template-engine";
import { centimetresToTwips, clampCentimetres } from "./measurements";

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Supported generator inputs. Callers may pass unresolved compatibility values. */
export interface DocxOptions {
  title: string;
  author: string;
  tableOfContents?: boolean;
  titlePage?: boolean;
  font?: string;
  fontSize?: number;
  lineSpacing?: number;
  firstLineIndentCm?: number;
  pageSize?: "letter" | "a4";
  chapterPageBreak?: boolean;
  sceneSeparator?: string;
  partDisplay?: StructuralDisplay;
  chapterDisplay?: StructuralDisplay;
}

/** Repaired, complete values safe for XML/style generation; owned by one build. */
export interface ResolvedDocxOptions extends DocxOptions {
  font: string;
  fontSize: number;
  lineSpacing: number;
  firstLineIndentCm: number;
  pageSize: "letter" | "a4";
  chapterPageBreak: boolean;
  titlePage: boolean;
  tableOfContents: boolean;
}

interface DocumentState {
  firstParagraph: boolean;
  atPageStart: boolean;
}

interface ParagraphOptions {
  bold?: boolean;
  keepNext?: boolean;
  pageBreakBefore?: boolean;
  pageBreakAfter?: boolean;
}

/** Repairs compatibility/profile values to the supported native-DOCX range. */
export function resolveDocxOptions(options: DocxOptions): ResolvedDocxOptions {
  return {
    ...options,
    title: String(options.title ?? ""),
    author: String(options.author ?? ""),
    font: cleanFont(options.font),
    fontSize: clamp(options.fontSize, 8, 24, 12),
    lineSpacing: clamp(options.lineSpacing, 0.8, 3, 2),
    firstLineIndentCm: clampCentimetres(options.firstLineIndentCm, 0, 3.81, 1.27),
    pageSize: options.pageSize === "letter" ? "letter" : "a4",
    chapterPageBreak: options.chapterPageBreak !== false,
    titlePage: options.titlePage === true,
    tableOfContents: options.tableOfContents === true
  };
}

/** Builds a fiction manuscript directly from the parsed model, preserving semantic Word styles. */
export function createManuscriptDocx(book: Book, profile: CompileProfile, options: DocxOptions): Uint8Array {
  const resolved = resolveDocxOptions(options);
  const blocks: string[] = [];
  const state: DocumentState = { firstParagraph: true, atPageStart: true };
  const separator = options.sceneSeparator ?? profile.sceneSeparator ?? "#";

  if (resolved.titlePage) {
    blocks.push(paragraph(resolved.title, "Title"));
    blocks.push(paragraph(resolved.author, "Author", { pageBreakAfter: true }));
    state.atPageStart = true;
  }
  if (resolved.tableOfContents) {
    addPageHeading(blocks, "Contents", "FrontMatterHeading", state);
    blocks.push(tocField());
    state.atPageStart = false;
  }
  if (profile.includeFrontMatter) {
    addMatter(blocks, book.frontMatter.documents, "FrontMatterHeading", state, resolved.titlePage ? "title page" : undefined);
  }
  for (const part of book.parts) {
    if (profile.useParts && !part.synthetic) {
      addStructuralHeading(blocks, "Part", part, resolved.partDisplay ?? profile.partDisplay ?? "word-title", profile.partHeadingTemplate, !state.atPageStart);
      state.firstParagraph = true;
      state.atPageStart = false;
    }
    addScenes(blocks, part.orphanScenes, profile, separator, state);
    for (const chapter of part.chapters) {
      addStructuralHeading(blocks, "Chapter", chapter, resolved.chapterDisplay ?? profile.chapterDisplay ?? "word-title", profile.chapterHeadingTemplate, resolved.chapterPageBreak && !state.atPageStart);
      state.firstParagraph = true;
      state.atPageStart = false;
      addScenes(blocks, chapter.scenes, profile, separator, state);
    }
  }
  addScenes(blocks, book.orphanScenes, profile, separator, state);
  if (profile.includeBackMatter) addMatter(blocks, book.backMatter.documents, "BackMatterHeading", state);
  return packageDocx(documentXml(blocks, resolved), resolved);
}

function addMatter(blocks: string[], documents: ManuscriptDocument[], style: "FrontMatterHeading" | "BackMatterHeading", state: DocumentState, skipTitle?: string): void {
  for (const document of documents.filter(included).filter((item) => item.title.trim().toLowerCase() !== skipTitle)) {
    addPageHeading(blocks, document.title, style, state);
    state.firstParagraph = true;
    addMarkdownBody(blocks, document.content, state);
  }
}

function addPageHeading(blocks: string[], value: string, style: string, state: DocumentState): void {
  blocks.push(paragraph(value, style, { keepNext: true, pageBreakBefore: !state.atPageStart }));
  state.atPageStart = false;
}

function addScenes(blocks: string[], documents: ManuscriptDocument[], profile: CompileProfile, separator: string, state: DocumentState): void {
  const scenes = documents.filter(included);
  scenes.forEach((scene, index) => {
    if (index > 0) {
      blocks.push(plainParagraph(separator.trim(), "SceneBreak"));
      state.firstParagraph = true;
      state.atPageStart = false;
    }
    if (profile.includeSceneTitles) {
      blocks.push(paragraph(scene.title, "ChapterTitle", { keepNext: true }));
      state.firstParagraph = true;
      state.atPageStart = false;
    }
    addMarkdownBody(blocks, scene.content, state);
  });
}

function included(document: ManuscriptDocument): boolean {
  return !document.excluded && !!document.content.trim();
}

function addStructuralHeading(blocks: string[], kind: "Part" | "Chapter", item: Part | Chapter, display: StructuralDisplay, customTemplate: string, newPage: boolean): void {
  const [numberLine, titleLine] = structuralLines(kind, item, display, customTemplate);
  const lines = [
    numberLine ? { text: numberLine, style: kind === "Part" ? "PartNumber" : "ChapterNumber" } : undefined,
    titleLine ? { text: titleLine, style: kind === "Part" ? "PartTitle" : "ChapterTitle" } : undefined
  ].filter((line): line is { text: string; style: string } => !!line);
  lines.forEach((line, index) => {
    const hasFollowingTitleLine = index < lines.length - 1;
    blocks.push(paragraph(line.text, line.style, { keepNext: hasFollowingTitleLine || kind === "Chapter", pageBreakBefore: newPage && index === 0 }));
  });
}

export function structuralLines(kind: "Part" | "Chapter", item: Part | Chapter, display: StructuralDisplay, customTemplate: string): [string, string] {
  const number = item.number;
  const title = item.name && item.name !== item.title ? item.name : "";
  const numeric = number === undefined ? "" : `${kind} ${number}`;
  const word = number === undefined ? "" : `${kind} ${numberWord(number)}`;
  if (display === "custom") {
    const rendered = new TemplateEngine().render(customTemplate, { number, name: title, title: item.title }).replace(/[\s:—–-]+$/g, "").trim();
    return ["", rendered || title || item.title];
  }
  if (display === "title") return ["", title || item.title];
  if (display === "numeric") return [numeric || title || item.title, ""];
  if (display === "word") return [word || title || item.title, ""];
  return [display === "numeric-title" ? numeric : word, title || (number === undefined ? item.title : "")];
}

function addMarkdownBody(blocks: string[], markdown: string, state: DocumentState): void {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let current: string[] = [];
  const flush = (): void => {
    const value = current.join(" ").trim();
    current = [];
    if (!value) return;
    blocks.push(paragraph(value, state.firstParagraph ? "FirstParagraph" : "BodyText"));
    state.firstParagraph = false;
    state.atPageStart = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^(?:---+|\*\s*\*\s*\*|#)$/.test(line)) {
      flush();
      blocks.push(plainParagraph("* * *", "SceneBreak"));
      state.firstParagraph = true;
      state.atPageStart = false;
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push(paragraph(heading[1], "FirstParagraph", { bold: true, keepNext: true }));
      state.firstParagraph = true;
      state.atPageStart = false;
      continue;
    }
    current.push(line.replace(/^>\s?/, "").replace(/^[-*+]\s+/, "• "));
  }
  flush();
}

function packageDocx(document: string, options: ResolvedDocxOptions): Uint8Array {
  const created = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": text(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`),
    "word/document.xml": text(document),
    "word/styles.xml": text(stylesXml(options)),
    "word/settings.xml": text(`${XML}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat/></w:settings>`),
    "docProps/core.xml": text(`${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(options.title)}</dc:title><dc:creator>${escapeXml(options.author)}</dc:creator><cp:lastModifiedBy>Manuscript Compiler</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": text(`${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Manuscript Compiler</Application><AppVersion>0.9.2</AppVersion></Properties>`)
  };
  return zipSync(files, { level: 6 });
}

function documentXml(blocks: string[], options: ResolvedDocxOptions): string {
  const size = options.pageSize === "a4" ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 };
  const margin = centimetresToTwips(2.54);
  return `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="${size.width}" w:h="${size.height}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720"/><w:cols w:space="720"/></w:sectPr></w:body></w:document>`;
}

function tocField(): string {
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Update this field in Word.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function paragraph(value: string, style: string, options: ParagraphOptions = {}): string {
  const properties = `${options.pageBreakBefore ? "<w:pageBreakBefore/>" : ""}${options.keepNext ? "<w:keepNext/>" : ""}`;
  const after = options.pageBreakAfter ? `<w:r><w:br w:type="page"/></w:r>` : "";
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${properties}</w:pPr>${inlineRuns(value, options.bold)}${after}</w:p>`;
}

function plainParagraph(value: string, style: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${value ? run(value) : ""}</w:p>`;
}

function inlineRuns(value: string, wholeBold = false): string {
  if (wholeBold) return run(value, "<w:b/>");
  const runs: string[] = [];
  const pattern = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(?<!\*)\*([^*]+?)\*|_([^_]+?)_|\[([^\]]+)\]\([^)]+\)|`([^`]+)`/g;
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > offset) runs.push(run(value.slice(offset, match.index)));
    if (match[2]) runs.push(run(match[2], "<w:b/><w:i/>"));
    else if (match[4]) runs.push(run(match[4], "<w:b/>"));
    else if (match[5] || match[6]) runs.push(run(match[5] ?? match[6], "<w:i/>"));
    else runs.push(run(match[7] ?? match[8] ?? ""));
    offset = match.index + match[0].length;
  }
  if (offset < value.length) runs.push(run(value.slice(offset)));
  return runs.join("");
}

function run(value: string, properties = ""): string {
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
}

function stylesXml(options: ResolvedDocxOptions): string {
  const font = escapeXml(options.font);
  const size = Math.round(options.fontSize * 2);
  const line = Math.round(options.lineSpacing * 240);
  const indent = centimetresToTwips(options.firstLineIndentCm);
  const style = (id: string, name: string, basedOn: string, paragraphProperties: string, runProperties = ""): string => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${basedOn === id ? "" : `<w:basedOn w:val="${basedOn}"/>`}<w:next w:val="${id === "BodyText" ? "BodyText" : "FirstParagraph"}"/><w:qFormat/><w:pPr>${paragraphProperties}</w:pPr>${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ""}</w:style>`;
  const centered = `<w:jc w:val="center"/><w:ind w:firstLine="0"/>`;
  return `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style("Normal", "Normal", "Normal", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/>`)}${style("Title", "Title", "Normal", `${centered}<w:spacing w:before="3600" w:after="480"/>`, `<w:b/><w:sz w:val="40"/>`)}${style("Author", "Author", "Normal", `${centered}<w:spacing w:before="480"/>`, `<w:sz w:val="28"/>`)}${style("PartNumber", "Part Number", "Normal", `${centered}<w:spacing w:before="1440" w:after="240"/>`, `<w:b/><w:sz w:val="32"/>`)}${style("PartTitle", "Part Title", "Normal", `${centered}<w:spacing w:after="720"/>`, `<w:b/><w:sz w:val="32"/>`)}${style("ChapterNumber", "Chapter Number", "Normal", `${centered}<w:spacing w:before="720" w:after="180"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("ChapterTitle", "Chapter Title", "Normal", `${centered}<w:spacing w:after="720"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("BodyText", "Body Text", "Normal", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="${indent}"/>`)}${style("FirstParagraph", "First Paragraph", "BodyText", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="0"/>`)}${style("SceneBreak", "Scene Break", "Normal", `${centered}<w:spacing w:before="240" w:after="240"/>`)}${style("FrontMatterHeading", "Front Matter Heading", "Normal", `${centered}<w:spacing w:before="720" w:after="480"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("BackMatterHeading", "Back Matter Heading", "Normal", `${centered}<w:spacing w:before="720" w:after="480"/>`, `<w:b/><w:sz w:val="28"/>`)}</w:styles>`;
}

function clamp(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function cleanFont(value: string | undefined): string {
  const font = typeof value === "string" ? value.trim().slice(0, 100) : "";
  return font || "Times New Roman";
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function text(value: string): Uint8Array {
  return strToU8(value);
}

export { DOCX_MIME };
