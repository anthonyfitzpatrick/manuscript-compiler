import { strToU8, zipSync } from "fflate";
import type { Book, Chapter, ManuscriptDocument, Part } from "./model";
import { numberWord } from "./ordering";
import type { CompileProfile, StructuralDisplay } from "./settings";
import { TemplateEngine } from "./template-engine";

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const escapeXml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export interface DocxOptions { title: string; author: string; tableOfContents?: boolean; titlePage?: boolean; font?: string; fontSize?: number; lineSpacing?: number; firstLineIndent?: number; pageSize?: "letter" | "a4"; chapterPageBreak?: boolean; sceneSeparator?: string; partDisplay?: StructuralDisplay; chapterDisplay?: StructuralDisplay; }

/** Compatibility entry point for callers that only have canonical Markdown. */
export function createDocx(markdown: string, options: DocxOptions): Uint8Array { return packageDocx(markdownDocument(markdown, options), options); }

/** Builds a fiction manuscript directly from the parsed model, preserving semantic Word styles. */
export function createManuscriptDocx(book: Book, profile: CompileProfile, options: DocxOptions): Uint8Array {
  const blocks: string[] = []; const state = { firstParagraph: true }; const separator = (options.sceneSeparator ?? profile.sceneSeparator) || "* * *";
  if (options.titlePage) blocks.push(paragraph(options.title, "Title"), paragraph(options.author, "Author"));
  if (options.tableOfContents) blocks.push(paragraph("Contents", "FrontMatterHeading"), tocField());
  if (profile.includeFrontMatter) addMatter(blocks, book.frontMatter.documents, "FrontMatterHeading", state, options.titlePage ? "title page" : undefined);
  for (const part of book.parts) {
    if (profile.useParts && !part.synthetic) { addStructuralHeading(blocks, "Part", part, options.partDisplay ?? profile.partDisplay ?? "word-title", profile.partHeadingTemplate, true); state.firstParagraph = true; }
    addScenes(blocks, part.orphanScenes, profile, separator, state);
    for (const chapter of part.chapters) { addStructuralHeading(blocks, "Chapter", chapter, options.chapterDisplay ?? profile.chapterDisplay ?? "word-title", profile.chapterHeadingTemplate, true); state.firstParagraph = true; addScenes(blocks, chapter.scenes, profile, separator, state); }
  }
  addScenes(blocks, book.orphanScenes, profile, separator, state);
  if (profile.includeBackMatter) addMatter(blocks, book.backMatter.documents, "BackMatterHeading", state);
  return packageDocx(documentXml(blocks, options), options);
}

function addMatter(blocks: string[], documents: ManuscriptDocument[], style: "FrontMatterHeading" | "BackMatterHeading", state: { firstParagraph: boolean }, skipTitle?: string): void {
  documents.filter(included).filter((document) => document.title.trim().toLowerCase() !== skipTitle).forEach((document) => { blocks.push(paragraph(document.title, style)); state.firstParagraph = true; addMarkdownBody(blocks, document.content, state); });
}

function addScenes(blocks: string[], documents: ManuscriptDocument[], profile: CompileProfile, separator: string, state: { firstParagraph: boolean }): void {
  const scenes = documents.filter(included); scenes.forEach((scene, index) => { if (index > 0 && separator.trim()) { blocks.push(plainParagraph(normalizeSceneBreak(separator), "SceneBreak")); state.firstParagraph = true; } if (profile.includeSceneTitles) blocks.push(paragraph(scene.title, "ChapterTitle")); addMarkdownBody(blocks, scene.content, state); });
}

function included(document: ManuscriptDocument): boolean { return !document.excluded && !!document.content.trim(); }

function addStructuralHeading(blocks: string[], kind: "Part" | "Chapter", item: Part | Chapter, display: StructuralDisplay, customTemplate: string, newPage: boolean): void {
  const [numberLine, titleLine] = structuralLines(kind, item, display, customTemplate); const numberStyle = kind === "Part" ? "PartNumber" : "ChapterNumber"; const titleStyle = kind === "Part" ? "PartTitle" : "ChapterTitle";
  if (newPage && !numberLine) blocks.push(pageBreak()); if (numberLine) blocks.push(paragraph(numberLine, numberStyle)); if (titleLine) blocks.push(paragraph(titleLine, titleStyle));
}

function structuralLines(kind: "Part" | "Chapter", item: Part | Chapter, display: StructuralDisplay, customTemplate: string): [string, string] {
  const number = item.number; const title = item.name && item.name !== item.title ? item.name : ""; const numeric = number === undefined ? "" : `${kind} ${number}`; const word = number === undefined ? "" : `${kind} ${numberWord(number)}`;
  if (display === "custom") return ["", new TemplateEngine().render(customTemplate, { number, name: title, title: item.title }).replace(/[\s:—–-]+$/g, "").trim() || title || item.title];
  if (display === "title") return ["", title || item.title]; if (display === "numeric") return [numeric || title || item.title, ""]; if (display === "word") return [word || title || item.title, ""];
  return [display === "numeric-title" ? numeric : word, title || (number === undefined ? item.title : "")];
}

function addMarkdownBody(blocks: string[], markdown: string, state: { firstParagraph: boolean }): void {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); let current: string[] = [];
  const flush = (): void => { const value = current.join(" ").trim(); current = []; if (!value) return; blocks.push(paragraph(value, state.firstParagraph ? "FirstParagraph" : "BodyText")); state.firstParagraph = false; };
  for (const raw of lines) { const line = raw.trim(); if (!line) { flush(); continue; } if (/^(?:---+|\*\s*\*\s*\*|#)$/.test(line)) { flush(); blocks.push(plainParagraph("* * *", "SceneBreak")); state.firstParagraph = true; continue; } const heading = /^#{1,6}\s+(.+)$/.exec(line); if (heading) { flush(); blocks.push(paragraph(heading[1], "FirstParagraph", true)); state.firstParagraph = false; continue; } current.push(line.replace(/^>\s?/, "").replace(/^[-*+]\s+/, "• ")); }
  flush();
}

function markdownDocument(markdown: string, options: DocxOptions): string {
  const blocks: string[] = []; const state = { firstParagraph: true }; if (options.titlePage) blocks.push(paragraph(options.title, "Title"), paragraph(options.author, "Author"));
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); let body: string[] = []; const flush = (): void => { if (body.length) { addMarkdownBody(blocks, body.join("\n"), state); body = []; } };
  for (const line of lines) { const heading = /^(#{1,3})\s+(.+)$/.exec(line); if (!heading) { body.push(line); continue; } flush(); const style = heading[1].length === 1 ? "PartNumber" : heading[1].length === 2 ? "ChapterNumber" : "ChapterTitle"; blocks.push(paragraph(heading[2], style)); state.firstParagraph = true; }
  flush(); return documentXml(blocks, options);
}

function packageDocx(document: string, options: DocxOptions): Uint8Array {
  const created = new Date().toISOString(); const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": text(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`),
    "word/document.xml": text(document), "word/styles.xml": text(stylesXml(options)), "word/settings.xml": text(`${XML}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat/></w:settings>`),
    "docProps/core.xml": text(`${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(options.title)}</dc:title><dc:creator>${escapeXml(options.author)}</dc:creator><cp:lastModifiedBy>Manuscript Compiler</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": text(`${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Manuscript Compiler</Application><AppVersion>0.9.1</AppVersion></Properties>`)
  }; return zipSync(files, { level: 6 });
}

function documentXml(blocks: string[], options: DocxOptions): string { const size = options.pageSize === "a4" ? { width: 11906, height: 16838 } : { width: 12240, height: 15840 }; return `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="${size.width}" w:h="${size.height}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/><w:cols w:space="720"/></w:sectPr></w:body></w:document>`; }
function pageBreak(): string { return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`; }
function tocField(): string { return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Update this field in Word.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`; }
function paragraph(value: string, style: string, bold = false): string { return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inlineRuns(value, bold)}</w:p>`; }
function plainParagraph(value: string, style: string): string { return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${run(value)}</w:p>`; }
function inlineRuns(value: string, wholeBold = false): string { if (wholeBold) return run(value, "<w:b/>"); const runs: string[] = []; const pattern = /(\*\*|__)(.+?)\1|(?<!\*)\*([^*]+?)\*|_([^_]+?)_|\[([^\]]+)\]\([^)]+\)|`([^`]+)`/g; let offset = 0; let match: RegExpExecArray | null; while ((match = pattern.exec(value))) { if (match.index > offset) runs.push(run(value.slice(offset, match.index))); if (match[2]) runs.push(run(match[2], "<w:b/>")); else if (match[3] || match[4]) runs.push(run(match[3] ?? match[4], "<w:i/>")); else runs.push(run(match[5] ?? match[6] ?? "")); offset = match.index + match[0].length; } if (offset < value.length) runs.push(run(value.slice(offset))); return runs.join(""); }
function run(value: string, properties = ""): string { return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`; }
function normalizeSceneBreak(value: string): string { return /^#$/m.test(value.trim()) || /^\*{3}$/.test(value.trim()) ? "* * *" : value.trim(); }
function text(value: string): Uint8Array { return strToU8(value); }

function stylesXml(options: DocxOptions): string {
  const font = escapeXml(options.font ?? "Times New Roman"); const size = Math.round((options.fontSize ?? 12) * 2); const line = Math.round((options.lineSpacing ?? 2) * 240); const indent = Math.round((options.firstLineIndent ?? 0.5) * 1440);
  const style = (id: string, name: string, basedOn: string, paragraphProperties: string, runProperties = ""): string => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${basedOn === id ? "" : `<w:basedOn w:val="${basedOn}"/>`}<w:next w:val="${id === "BodyText" ? "BodyText" : "FirstParagraph"}"/><w:qFormat/><w:pPr>${paragraphProperties}</w:pPr>${runProperties ? `<w:rPr>${runProperties}</w:rPr>` : ""}</w:style>`;
  const centered = `<w:jc w:val="center"/><w:ind w:firstLine="0"/>`; const page = `<w:pageBreakBefore/>`; const keep = `<w:keepNext/>`;
  return `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}"/><w:sz w:val="${size}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${style("Normal", "Normal", "Normal", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/>`)}${style("Title", "Title", "Normal", `${centered}<w:spacing w:before="3600" w:after="480"/>`, `<w:b/><w:sz w:val="40"/>`)}${style("Subtitle", "Subtitle", "Normal", `${centered}<w:spacing w:after="360"/>`, `<w:i/><w:sz w:val="28"/>`)}${style("Author", "Author", "Normal", `${centered}<w:spacing w:before="480"/>`, `<w:sz w:val="28"/>`)}${style("PartNumber", "Part Number", "Normal", `${page}${keep}${centered}<w:spacing w:before="1440" w:after="240"/>`, `<w:b/><w:sz w:val="32"/>`)}${style("PartTitle", "Part Title", "Normal", `${keep}${centered}<w:spacing w:after="720"/>`, `<w:b/><w:sz w:val="32"/>`)}${style("ChapterNumber", "Chapter Number", "Normal", `${page}${keep}${centered}<w:spacing w:before="720" w:after="180"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("ChapterTitle", "Chapter Title", "Normal", `${keep}${centered}<w:spacing w:after="720"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("BodyText", "Body Text", "Normal", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="${indent}"/>`)}${style("FirstParagraph", "First Paragraph", "BodyText", `<w:spacing w:after="0" w:line="${line}" w:lineRule="auto"/><w:ind w:firstLine="0"/>`)}${style("SceneBreak", "Scene Break", "Normal", `${centered}<w:spacing w:before="240" w:after="240"/>`)}${style("FrontMatterHeading", "Front Matter Heading", "Normal", `${page}${keep}${centered}<w:spacing w:before="720" w:after="480"/>`, `<w:b/><w:sz w:val="28"/>`)}${style("BackMatterHeading", "Back Matter Heading", "Normal", `${page}${keep}${centered}<w:spacing w:before="720" w:after="480"/>`, `<w:b/><w:sz w:val="28"/>`)}</w:styles>`;
}

export { DOCX_MIME };
