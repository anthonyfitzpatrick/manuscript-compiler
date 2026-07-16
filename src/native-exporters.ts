/**
 * Manuscript Compiler — native offline exporter implementations and registry.
 *
 * Adapts one SemanticDocument into DOCX, ODT, EPUB, HTML, Markdown, or XML bytes.
 * Owns format packaging/markup and controlled escaping, not vault reads, semantic
 * inference, validation, delivery, settings, or history. ExportCoordinator calls
 * the exhaustive `EXPORTERS` registry. Generation either returns complete bytes
 * or throws; no partial output is delivered. Transforms are in-memory, contain no
 * cancellation boundary, network, remote asset, script, or platform API, and must
 * remain deterministic across desktop/mobile.
 */
import { strToU8, zipSync } from "fflate";
import { createManuscriptDocx } from "./docx";
import { EXPORT_FORMAT_DETAILS, type GeneratedExport, type ManuscriptExporter, type ManuscriptExportContext, type ExportFormat } from "./export-types";
import type { SemanticBlock, SemanticDocument, SemanticInline, SemanticSection } from "./semantic-document";
import { MarkdownExporter } from "./markdown-exporter";

const XML = `<?xml version="1.0" encoding="UTF-8"?>`;

abstract class NativeExporter implements ManuscriptExporter {
  abstract readonly format: ExportFormat;
  protected result(context: ManuscriptExportContext, bytes: Uint8Array): GeneratedExport { return { format: this.format, filename: context.filename, mimeType: EXPORT_FORMAT_DETAILS[this.format].mimeType, bytes, warnings: [] }; }
  abstract generate(context: ManuscriptExportContext): Promise<GeneratedExport>;
}

/** Stateless adapter for the native WordprocessingML generator. */
export class DocxMemoryExporter extends NativeExporter {
  readonly format = "docx" as const;
  async generate(context: ManuscriptExportContext): Promise<GeneratedExport> { const { session, options } = context; return this.result(context, createManuscriptDocx(session.book, session.profile, { ...options, partDisplay: session.profile.partDisplay, chapterDisplay: session.profile.chapterDisplay })); }
}

/** Stateless native OpenDocument package generator with controlled ZIP paths. */
export class OdtExporter extends NativeExporter {
  readonly format = "odt" as const;
  async generate(context: ManuscriptExportContext): Promise<GeneratedExport> {
    const { document, options } = context; const mimetype = EXPORT_FORMAT_DETAILS.odt.mimeType;
    const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
      mimetype: [strToU8(mimetype), { level: 0 }],
      "META-INF/manifest.xml": strToU8(`${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mimetype}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/></manifest:manifest>`),
      "content.xml": strToU8(odtContent(document, options)), "styles.xml": strToU8(odtStyles(options)),
      "meta.xml": strToU8(`${XML}<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><dc:title>${xml(document.title)}</dc:title><dc:creator>${xml(document.author)}</dc:creator><dc:language>${xml(document.language)}</dc:language></office:meta></office:document-meta>`),
      "settings.xml": strToU8(`${XML}<office:document-settings xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:settings/></office:document-settings>`)
    };
    return this.result(context, zipSync(files, { level: 6 }));
  }
}

/** Stateless standalone HTML5 generator with embedded local CSS only. */
export class HtmlExporter extends NativeExporter { readonly format = "html" as const; async generate(context: ManuscriptExportContext): Promise<GeneratedExport> { return this.result(context, strToU8(htmlDocument(context.document, context.options))); } }
/** Stateless presentation-neutral manuscript XML generator. */
export class XmlExporter extends NativeExporter { readonly format = "xml" as const; async generate(context: ManuscriptExportContext): Promise<GeneratedExport> { return this.result(context, strToU8(xmlDocument(context.document))); } }

/** Stateless EPUB 3 package generator with controlled manifest/spine entries. */
export class EpubExporter extends NativeExporter {
  readonly format = "epub" as const;
  async generate(context: ManuscriptExportContext): Promise<GeneratedExport> {
    const { document, options } = context; const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = { mimetype: [strToU8("application/epub+zip"), { level: 0 }] };
    files["META-INF/container.xml"] = strToU8(`${XML}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    const sections = document.sections.length ? document.sections : [{ id: "section-1", kind: "body", title: document.title, blocks: [] } as SemanticSection];
    sections.forEach((section, index) => { files[`OEBPS/section-${index + 1}.xhtml`] = strToU8(xhtmlSection(document, section, options)); });
    if (options.tableOfContents) files["OEBPS/contents.xhtml"] = strToU8(`${XML}<html xmlns="http://www.w3.org/1999/xhtml" lang="${xmlAttr(document.language)}"><head><title>Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><nav aria-label="Contents"><h1>Contents</h1><ol>${sections.map((section, index) => `<li><a href="section-${index + 1}.xhtml">${xml(section.title)}</a></li>`).join("")}</ol></nav></body></html>`);
    files["OEBPS/style.css"] = strToU8(reflowableCss(options)); files["OEBPS/nav.xhtml"] = strToU8(`${XML}<html xmlns="http://www.w3.org/1999/xhtml" lang="${xmlAttr(document.language)}"><head><title>Contents</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>Contents</h1><ol>${sections.map((section, index) => `<li><a href="section-${index + 1}.xhtml">${xml(section.title)}</a></li>`).join("")}</ol></nav></body></html>`);
    const manifest = `${options.tableOfContents ? `<item id="tocpage" href="contents.xhtml" media-type="application/xhtml+xml"/>` : ""}${sections.map((_section, index) => `<item id="s${index + 1}" href="section-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}`; const spine = `${options.tableOfContents ? `<itemref idref="tocpage"/>` : ""}${sections.map((_section, index) => `<itemref idref="s${index + 1}"/>`).join("")}`;
    files["OEBPS/content.opf"] = strToU8(`${XML}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${xmlAttr(document.language)}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:manuscript-compiler:${stableId(document.title)}</dc:identifier><dc:title>${xml(document.title)}</dc:title><dc:creator>${xml(document.author)}</dc:creator><dc:language>${xml(document.language)}</dc:language><meta property="dcterms:modified">2000-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${manifest}</manifest><spine>${spine}</spine></package>`);
    return this.result(context, zipSync(files, { level: 6 }));
  }
}

export const EXPORTERS: Record<ExportFormat, ManuscriptExporter> = { docx: new DocxMemoryExporter(), odt: new OdtExporter(), epub: new EpubExporter(), html: new HtmlExporter(), markdown: new MarkdownExporter(), xml: new XmlExporter() };

function odtContent(document: SemanticDocument, options: ManuscriptExportContext["options"]): string { const toc = options.tableOfContents ? `<text:table-of-content text:name="Table of Contents"><text:table-of-content-source text:outline-level="3"/><text:index-body><text:index-title text:name="Table of Contents"><text:p text:style-name="ChapterTitle">Contents</text:p></text:index-title></text:index-body></text:table-of-content>` : ""; return `${XML}<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${toc}${document.sections.flatMap((section) => section.blocks).map(odtBlock).join("")}</office:text></office:body></office:document-content>`; }
function odtBlock(block: SemanticBlock): string { if (block.kind === "page-break") return `<text:p text:style-name="PageBreak"/>`; if (block.kind === "scene-break") return `<text:p text:style-name="SceneBreak">${xml(block.text)}</text:p>`; const style = block.kind === "paragraph" ? block.first ? "FirstParagraph" : "BodyText" : odtStyle(block.style); const pageBreak = block.kind === "heading" && block.pageBreakBefore ? `<text:p text:style-name="PageBreak"/>` : ""; return `${pageBreak}<text:p text:style-name="${style}">${odtInlines(block.inlines)}</text:p>`; }
function odtInlines(inlines: SemanticInline[]): string { return inlines.map((item) => item.bold || item.italic ? `<text:span text:style-name="${item.bold && item.italic ? "BoldItalic" : item.bold ? "Bold" : "Italic"}">${xml(item.text)}</text:span>` : xml(item.text)).join(""); }
function odtStyle(style: Extract<SemanticBlock, { kind: "heading" }>["style"]): string { return ({ title: "Title", author: "Author", "front-matter": "FrontMatterHeading", "back-matter": "BackMatterHeading", "part-number": "PartNumber", "part-title": "PartTitle", "chapter-number": "ChapterNumber", "chapter-title": "ChapterTitle", "body-heading": "BodyHeading" })[style]; }
function odtStyles(options: ManuscriptExportContext["options"]): string { const page = options.pageSize === "letter" ? ["21.59cm", "27.94cm"] : ["21cm", "29.7cm"]; const names = ["Title", "Author", "FrontMatterHeading", "BackMatterHeading", "PartNumber", "PartTitle", "ChapterNumber", "ChapterTitle", "BodyHeading", "FirstParagraph", "BodyText", "SceneBreak", "PageBreak"]; const boldStyles = new Set(["Title", "FrontMatterHeading", "BackMatterHeading", "PartNumber", "PartTitle", "ChapterNumber", "ChapterTitle", "BodyHeading"]); return `${XML}<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"><office:styles>${names.map((name) => `<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties fo:line-height="${options.lineSpacing * 100}%" fo:text-indent="${name === "BodyText" && options.indentParagraphs ? options.firstLineIndentCm : 0}cm"${name === "PageBreak" ? ` fo:break-before="page"` : ""}${/Heading|Number|Title|Author|SceneBreak/.test(name) ? ` fo:text-align="center"` : ""}/><style:text-properties style:font-name="${xmlAttr(options.font)}" fo:font-size="${options.fontSize}pt"${boldStyles.has(name) ? ` fo:font-weight="bold"` : ""}/></style:style>`).join("")}<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="BoldItalic" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic"/></style:style></office:styles><office:automatic-styles><style:page-layout style:name="Page"><style:page-layout-properties fo:page-width="${page[0]}" fo:page-height="${page[1]}" fo:margin="2.54cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="Page"/></office:master-styles></office:document-styles>`; }

function htmlDocument(document: SemanticDocument, options: ManuscriptExportContext["options"]): string { const toc = options.tableOfContents ? `<nav class="table-of-contents" aria-label="Contents"><h1>Contents</h1><ol>${document.sections.filter((section) => section.kind === "part" || section.kind === "chapter").map((section) => `<li><a href="#${htmlAttr(section.id)}">${html(section.title)}</a></li>`).join("")}</ol></nav>` : ""; return `<!doctype html><html lang="${htmlAttr(document.language)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(document.title)}</title><style>${reflowableCss(options)}</style></head><body>${toc}<main>${document.sections.map(htmlSection).join("")}</main></body></html>`; }
function htmlSection(section: SemanticSection): string { return `<section id="${htmlAttr(section.id)}" class="${htmlAttr(section.kind)}">${htmlBlocks(section.blocks)}</section>`; }
function htmlBlocks(blocks: SemanticBlock[]): string { const output: string[] = []; for (let index = 0; index < blocks.length; index += 1) { const block = blocks[index]; const next = blocks[index + 1]; if (block.kind === "heading" && next?.kind === "heading" && block.style === "part-number" && next.style === "part-title") { output.push(htmlCombinedHeading(1, "manuscript-part-heading", block, next)); index += 1; } else if (block.kind === "heading" && next?.kind === "heading" && block.style === "chapter-number" && next.style === "chapter-title") { output.push(htmlCombinedHeading(2, "manuscript-chapter-heading", block, next)); index += 1; } else output.push(htmlBlock(block)); } return output.join(""); }
function htmlCombinedHeading(level: number, className: string, first: Extract<SemanticBlock, { kind: "heading" }>, second: Extract<SemanticBlock, { kind: "heading" }>): string { return `<h${level} class="${className}">${htmlInlines(first.inlines)} — ${htmlInlines(second.inlines)}</h${level}>`; }
function htmlBlock(block: SemanticBlock): string { if (block.kind === "page-break") return `<hr class="page-break">`; if (block.kind === "scene-break") return `<div class="scene-break" role="separator">${html(block.text)}</div>`; const content = htmlInlines(block.inlines); if (block.kind === "paragraph") return `<p class="${block.first ? "first-paragraph" : "body-text"}">${content}</p>`; const presentation = ({ title: [1, "manuscript-title"], author: [2, "manuscript-author"], "front-matter": [2, "manuscript-matter-heading"], "back-matter": [2, "manuscript-matter-heading"], "part-number": [1, "manuscript-part-number"], "part-title": [1, "manuscript-part-title"], "chapter-number": [2, "manuscript-chapter-number"], "chapter-title": [2, "manuscript-chapter-title"], "body-heading": [3, "manuscript-body-heading"] } as const)[block.style]; return `<h${presentation[0]} class="${presentation[1]}">${content}</h${presentation[0]}>`; }
function htmlInlines(inlines: SemanticInline[]): string { return inlines.map((item) => { let value = html(item.text); if (item.italic) value = `<em>${value}</em>`; if (item.bold) value = `<strong>${value}</strong>`; return value; }).join(""); }
function reflowableCss(options: ManuscriptExportContext["options"]): string { return `:root{font-family:${cssString(options.font)},serif;font-size:${options.fontSize}pt;line-height:${options.lineSpacing}}body{max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}.title-page,.title,.part{text-align:center;break-before:page}.chapter${options.chapterPageBreak ? "{break-before:page}" : "{}"}.first-paragraph{text-indent:0}.body-text{text-indent:${options.indentParagraphs ? options.firstLineIndentCm : 0}cm;margin:0}.scene-break{text-align:center;margin:1.5em 0}.manuscript-title,.manuscript-matter-heading,.manuscript-part-number,.manuscript-part-title,.manuscript-part-heading,.manuscript-chapter-number,.manuscript-chapter-title,.manuscript-chapter-heading{font-weight:700;break-after:avoid}.front-matter,.back-matter{break-before:page}`; }
function xhtmlSection(document: SemanticDocument, section: SemanticSection, options: ManuscriptExportContext["options"]): string { return `${XML}<html xmlns="http://www.w3.org/1999/xhtml" lang="${xmlAttr(document.language)}"><head><title>${xml(section.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><main>${htmlSection(section)}</main></body></html>`; }

function xmlDocument(document: SemanticDocument): string {
  const front = document.sections.filter((section) => section.kind === "title" || section.kind === "front-matter").map(xmlDocumentSection).join("");
  const back = document.sections.filter((section) => section.kind === "back-matter").map(xmlDocumentSection).join("");
  const body: string[] = []; let openPart: string | undefined;
  for (const section of document.sections.filter((item) => item.kind === "part" || item.kind === "chapter" || item.kind === "body")) {
    if (section.kind === "part") { if (openPart) body.push(`</part>`); openPart = section.id; body.push(`<part id="${xmlAttr(section.id)}"${section.number === undefined ? "" : ` number="${section.number}"`} title="${xmlAttr(section.title)}">${section.blocks.map(xmlBlock).join("")}`); continue; }
    if (openPart && section.parentId !== openPart) { body.push(`</part>`); openPart = undefined; }
    body.push(section.kind === "chapter" ? `<chapter id="${xmlAttr(section.id)}"${section.number === undefined ? "" : ` number="${section.number}"`} title="${xmlAttr(section.title)}">${xmlScenes(section.blocks)}</chapter>` : `<sceneGroup id="${xmlAttr(section.id)}" title="${xmlAttr(section.title)}">${xmlScenes(section.blocks)}</sceneGroup>`);
  }
  if (openPart) body.push(`</part>`);
  return `${XML}<manuscript xmlns="https://manuscript-compiler.dev/schema" schemaVersion="1.0"><metadata><title>${xml(document.title)}</title><author>${xml(document.author)}</author><language>${xml(document.language)}</language><wordCount>${document.wordCount}</wordCount></metadata><frontMatter>${front}</frontMatter><body>${body.join("")}</body><backMatter>${back}</backMatter></manuscript>`;
}
function xmlDocumentSection(section: SemanticSection): string { return `<document id="${xmlAttr(section.id)}" title="${xmlAttr(section.title)}">${xmlScenes(section.blocks)}</document>`; }
function xmlScenes(blocks: SemanticBlock[]): string { const scenes: SemanticBlock[][] = [[]]; for (const block of blocks) { if (block.kind === "scene-break") scenes.push([]); else scenes.at(-1)!.push(block); } return scenes.filter((scene) => scene.length).map((scene, index) => `<scene order="${index + 1}">${scene.map(xmlBlock).join("")}</scene>`).join(""); }
function xmlBlock(block: SemanticBlock): string { if (block.kind === "page-break") return `<pageBreak/>`; if (block.kind === "scene-break") return `<sceneBreak>${xml(block.text)}</sceneBreak>`; const content = block.inlines.map((item) => item.bold || item.italic ? `<span${item.bold ? ` bold="true"` : ""}${item.italic ? ` italic="true"` : ""}>${xml(item.text)}</span>` : xml(item.text)).join(""); return block.kind === "paragraph" ? `<paragraph${block.first ? ` first="true"` : ""}>${content}</paragraph>` : `<heading type="${block.style}">${content}</heading>`; }

/**
 * Escapes text for XML/OOXML/ODT/EPUB element or attribute contexts after
 * removing XML 1.0-forbidden characters. Pure and non-throwing; callers remain
 * responsible for placing the returned text only in quoted/element contexts.
 */
export function xml(value: string): string { return cleanXml(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
const xmlAttr = xml;
function html(value: string): string { return cleanXml(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
const htmlAttr = html;
function cleanXml(value: string): string { return Array.from(String(value ?? "")).filter((character) => { const point = character.codePointAt(0)!; return point === 9 || point === 10 || point === 13 || point >= 32 && point <= 0xd7ff || point >= 0xe000 && point <= 0xfffd || point >= 0x10000 && point <= 0x10ffff; }).join(""); }
function cssString(value: string): string { const safe = Array.from(String(value ?? "").trim()).slice(0, 100).map((character) => /[A-Za-z0-9 _-]/.test(character) ? character : `\\${character.codePointAt(0)?.toString(16)} `).join("") || "serif"; return `"${safe}"`; }
function stableId(value: string): string { let hash = 2166136261; for (const character of value) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16); }
