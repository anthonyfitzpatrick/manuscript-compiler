/**
 * Manuscript Compiler — pre-delivery structural validation registry.
 *
 * Purpose: reject empty, malformed, unsafe, or semantically incomplete bytes
 * before BrowserDownloadService can run. Validators inspect only supplied bytes
 * and optional shared export context; they do not repair output, read the vault,
 * or claim full external standards conformance. ExportCoordinator calls the
 * exhaustive registry. Bad input returns deterministic errors rather than
 * throwing. Validation is synchronous/non-cancellable and mobile-neutral.
 * Future format changes must update generation and validation together.
 */
import { strFromU8, unzipSync } from "fflate";
import { validateDocxBytes } from "./docx-validator";
import type { ExportFormat, ExportValidationResult, ExportValidator, ManuscriptExportContext } from "./export-types";
import { renderSemanticMarkdown } from "./markdown-exporter";

const valid = (): ExportValidationResult => ({ valid: true, errors: [] });
const invalid = (...errors: string[]): ExportValidationResult => ({ valid: false, errors });
const decode = (bytes: Uint8Array): string => new TextDecoder("utf-8", { fatal: false }).decode(bytes);

class DocxValidator implements ExportValidator { validate(bytes: Uint8Array): ExportValidationResult { return validateDocxBytes(bytes); } }
class OdtValidator implements ExportValidator {
  validate(bytes: Uint8Array): ExportValidationResult { try { const files = unzipSync(bytes); const required = ["mimetype", "META-INF/manifest.xml", "content.xml", "styles.xml", "meta.xml", "settings.xml"]; const missing = required.filter((name) => !files[name]); if (missing.length) return invalid(`Missing ODT entries: ${missing.join(", ")}`); if (strFromU8(files.mimetype) !== "application/vnd.oasis.opendocument.text") return invalid("ODT mimetype is invalid."); if (firstZipEntry(bytes) !== "mimetype" || !firstZipEntryStored(bytes)) return invalid("ODT mimetype must be the first uncompressed package entry."); const manifest = strFromU8(files["META-INF/manifest.xml"]); for (const match of manifest.matchAll(/manifest:full-path="([^"]+)"/g)) if (match[1] !== "/" && !files[match[1]]) return invalid(`ODT manifest target ${match[1]} is missing.`); const content = strFromU8(files["content.xml"]); const styles = strFromU8(files["styles.xml"]); if (![manifest, content, styles, strFromU8(files["meta.xml"]), strFromU8(files["settings.xml"])].every(wellFormedXml)) return invalid("ODT contains malformed XML."); if (!/<office:text>[\s\S]*<text:p/.test(content)) return invalid("ODT has no text body."); for (const style of requiredStyles) if (!styles.includes(`style:name="${style}"`)) return invalid(`ODT style ${style} is missing.`); return valid(); } catch { return invalid("ODT is not a readable ZIP package."); } }
}
class EpubValidator implements ExportValidator {
  validate(bytes: Uint8Array): ExportValidationResult { try { const files = unzipSync(bytes); if (firstZipEntry(bytes) !== "mimetype" || !firstZipEntryStored(bytes) || strFromU8(files.mimetype ?? new Uint8Array()) !== "application/epub+zip") return invalid("EPUB mimetype is invalid, compressed, or misplaced."); for (const name of ["META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/style.css"]) if (!files[name]) return invalid(`EPUB entry ${name} is missing.`); const container = strFromU8(files["META-INF/container.xml"]); if (!wellFormedXml(container) || !container.includes(`full-path="OEBPS/content.opf"`)) return invalid("EPUB container rootfile is invalid."); const opf = strFromU8(files["OEBPS/content.opf"]); if (!wellFormedXml(opf)) return invalid("EPUB package document is malformed."); const ids = new Set([...opf.matchAll(/<item\s+id="([^"]+)"[^>]*href="([^"]+)"/g)].map((match) => match[1])); for (const match of opf.matchAll(/<item\s+id="[^"]+"[^>]*href="([^"]+)"/g)) if (!files[`OEBPS/${match[1]}`]) return invalid(`EPUB manifest target ${match[1]} is missing.`); for (const match of opf.matchAll(/<itemref\s+idref="([^"]+)"/g)) if (!ids.has(match[1])) return invalid(`EPUB spine reference ${match[1]} is invalid.`); const xhtmlEntries = Object.entries(files).filter(([name]) => name.endsWith(".xhtml")); const xhtml = xhtmlEntries.map(([, value]) => strFromU8(value)).join("\n"); if (!xhtmlEntries.every(([, value]) => wellFormedXml(strFromU8(value)))) return invalid("EPUB XHTML is malformed."); for (const match of xhtml.matchAll(/(?:src|href)=["']([^"'#]+)(?:#[^"']*)?["']/gi)) if (!/^[a-z]+:/i.test(match[1]) && !files[`OEBPS/${match[1]}`]) return invalid(`EPUB internal reference ${match[1]} is missing.`); if (/<script\b|(?:src|href)=["']https?:|url\(\s*https?:/i.test(xhtml)) return invalid("EPUB contains scripts or remote resources."); return valid(); } catch { return invalid("EPUB is not a readable ZIP package."); } }
}
class HtmlValidator implements ExportValidator { validate(bytes: Uint8Array): ExportValidationResult { const text = decode(bytes); if (!/^<!doctype html>/i.test(text) || !/<html\b[\s\S]*<head\b[\s\S]*<body\b/i.test(text)) return invalid("HTML document structure is incomplete."); if (!/<meta charset="utf-8">/i.test(text) || !/<title>[^<]+<\/title>/i.test(text) || !/<main>[\s\S]*<section\b/.test(text)) return invalid("HTML metadata or manuscript content is missing."); if (/<script\b|(?:src|href)=["']https?:|url\(\s*https?:/i.test(text)) return invalid("HTML contains scripts or remote resources."); return valid(); } }
/**
 * Verifies deterministic Markdown against the same SemanticDocument used for
 * generation, including required structure, exclusions, UTF-8, and final newline.
 * It owns no state or side effects and returns errors instead of throwing.
 */
export class MarkdownValidator implements ExportValidator {
  validate(bytes: Uint8Array, context?: ManuscriptExportContext): ExportValidationResult {
    const errors: string[] = []; let text = "";
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return invalid("Markdown is not valid UTF-8."); }
    if (!text.trim()) errors.push("Markdown manuscript is empty.");
    if (!text.endsWith("\n") || text.endsWith("\n\n")) errors.push("Markdown must end with exactly one newline.");
    if (/\r/.test(text)) errors.push("Markdown contains non-canonical line endings.");
    if (/\n{3,}/.test(text)) errors.push("Markdown contains duplicate blank lines.");
    if (/(?:^|\n\n)---\n(?:[A-Za-z_][\w -]*:\s*[^\n]*\n)+---(?:\n|$)/.test(text)) errors.push("Markdown contains YAML frontmatter.");
    if (/^#{1,6}\s+(?:Synopsis|Revision Notes)\s*$/im.test(text)) errors.push("Markdown contains an excluded authoring section.");
    if (/^#{1,6}\s+.*dashboard.*$/im.test(text)) errors.push("Markdown contains a dashboard heading.");
    if (/^#{1,6}\s+Part\s+(?:0|Zero)\b/im.test(text)) errors.push("Markdown contains Part 0.");
    if (/^#{1,6}\s+Chapter\s+(?:0|Zero)\b/im.test(text)) errors.push("Markdown contains Chapter 0.");
    const headings = text.split("\n").filter((line) => /^#{1,6}\s+\S/.test(line)).map((line) => line.replace(/^#{1,6}\s+/, "").trim().toLocaleLowerCase());
    if (headings.some((heading, index) => index > 0 && heading === headings[index - 1])) errors.push("Markdown contains duplicate adjacent headings.");
    if (context) this.validateContext(text, bytes, context, errors);
    return errors.length ? invalid(...new Set(errors)) : valid();
  }

  private validateContext(text: string, bytes: Uint8Array, context: ManuscriptExportContext, errors: string[]): void {
    const { document, options } = context;
    const expected = new TextEncoder().encode(renderSemanticMarkdown(document));
    if (expected.length !== bytes.length || expected.some((value, index) => value !== bytes[index])) errors.push("Markdown output is not the deterministic semantic-document rendering.");
    if (options.titlePage && (!text.includes(`# ${document.title}`) || document.author && !text.includes(document.author))) errors.push("Markdown title page or author is missing.");
    for (const section of document.sections) {
      if ((section.kind === "front-matter" || section.kind === "back-matter") && !text.includes(`# ${section.title}`)) errors.push(`Markdown ${section.kind} heading is missing.`);
      if ((section.kind === "part" || section.kind === "chapter") && section.number !== 0 && !section.blocks.some((block) => block.kind === "heading" && text.includes(block.inlines.map((item) => item.text).join("")))) errors.push(`Markdown ${section.kind} heading is missing.`);
    }
    const separators = document.sections.flatMap((section) => section.blocks).filter((block) => block.kind === "scene-break").map((block) => block.kind === "scene-break" ? block.text.trim() || "* * *" : ""); const outputLines = text.split("\n");
    for (const separator of new Set(separators)) if (outputLines.filter((line) => line === separator).length !== separators.filter((value) => value === separator).length) errors.push("Markdown scene separator count is incorrect.");
  }
}
class XmlValidator implements ExportValidator { validate(bytes: Uint8Array): ExportValidationResult { const text = decode(bytes); if (!text.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`)) return invalid("XML declaration is missing."); if (!wellFormedXml(text)) return invalid("XML element nesting is malformed."); if (!/<manuscript xmlns="https:\/\/manuscript-compiler\.dev\/schema" schemaVersion="1\.0">/.test(text)) return invalid("XML namespace or schema version is invalid."); if (!/<metadata>[\s\S]*<title>[\s\S]*<frontMatter>[\s\S]*<body>[\s\S]*<backMatter>/.test(text)) return invalid("XML manuscript hierarchy is incomplete."); if (/(?:file|vault|profile)Path=|<settings>|<profileId>/i.test(text)) return invalid("XML contains compiler-internal data."); return valid(); } }

const requiredStyles = ["Title", "Author", "FrontMatterHeading", "BackMatterHeading", "PartNumber", "PartTitle", "ChapterNumber", "ChapterTitle", "FirstParagraph", "BodyText", "SceneBreak"];
export const EXPORT_VALIDATORS: Record<ExportFormat, ExportValidator> = { docx: new DocxValidator(), odt: new OdtValidator(), epub: new EpubValidator(), html: new HtmlValidator(), markdown: new MarkdownValidator(), xml: new XmlValidator() };

function firstZipEntry(bytes: Uint8Array): string { if (bytes.length < 30 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) return ""; const length = bytes[26] | bytes[27] << 8; return new TextDecoder().decode(bytes.slice(30, 30 + length)); }
function firstZipEntryStored(bytes: Uint8Array): boolean { return bytes.length >= 10 && bytes[8] === 0 && bytes[9] === 0; }
function wellFormedXml(value: string): boolean { const stack: string[] = []; for (const match of value.matchAll(/<([^!?][^>]*?)>/g)) { const token = match[1].trim(); if (!token || token.endsWith("/")) continue; if (token.startsWith("/")) { if (stack.pop() !== token.slice(1).trim()) return false; } else stack.push(token.split(/\s/, 1)[0]); } return stack.length === 0; }
