/** Dependency-free PDF generation using the built-in WinAnsi font repertoire. */
import type { CompileWarning } from "./model";
import { plainText, type SemanticBlock, type SemanticDocument } from "./semantic-document";
import type { ExportFormattingOptions } from "./export-types";

interface EncodedPdfText { display: string; bytes: Uint8Array; }
type PdfBaseFont = "Helvetica" | "Times-Roman";
type PdfLineRole = "title" | "author" | "part-number" | "part-title" | "chapter-number" | "chapter-title" | "matter-heading" | "body-heading" | "body" | "scene-break";
export interface PdfPlacedLine { text: string; x: number; y: number; width: number; size: number; leading: number; role: PdfLineRole; bold: boolean; firstLineIndent: number; }
export interface PdfPageLayout { lines: PdfPlacedLine[]; }
export interface PdfLayoutMetadata { pageWidth: number; pageHeight: number; leftMargin: number; rightMargin: number; topMargin: number; bottomMargin: number; usableWidth: number; pages: PdfPageLayout[]; }
export interface NativePdfResult { bytes: Uint8Array; warnings: CompileWarning[]; layout: PdfLayoutMetadata; }
export interface InspectedPdfTextLine { text: string; size: number; leading: number; x: number; y: number; bold: boolean; }

const encoder = new TextEncoder();
const WIN_ANSI_SPECIAL = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91],
  [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98],
  [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

export function createNativePdf(document: SemanticDocument, options: ExportFormattingOptions): NativePdfResult {
  const unsupported = new Set<number>();
  const normalise = (value: string): string => encodeWinAnsi(value, unsupported).display;
  const dimensions = pdfPageDimensions(options.pageSize); const margin = clamp(pdfPointsFromCm(options.pageMarginCm), 28, dimensions.width / 3);
  const font = pdfBaseFont(options.font); const layout = layoutPdf(document, options, font, normalise, dimensions.width, dimensions.height, margin);

  const mappings = new Map<number, number>();
  const encodedPages = layout.pages.map((page) => page.lines.map((line) => {
    const encoded = encodeWinAnsi(line.text, unsupported);
    encoded.bytes.forEach((byte) => mappings.set(byte, unicodeForWinAnsi(byte)));
    return { ...line, encoded: encoded.bytes };
  }));
  const pageRefs = encodedPages.map((_page, index) => `${6 + index * 2} 0 R`);
  const cmap = toUnicodeCMap(mappings);
  const objects: Uint8Array[] = [
    ascii(`<< /Type /Catalog /Pages 2 0 R >>`),
    ascii(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${encodedPages.length} >>`),
    ascii(`<< /Type /Font /Subtype /Type1 /BaseFont /${font} /Encoding /WinAnsiEncoding /ToUnicode 5 0 R >>`),
    ascii(`<< /Type /Font /Subtype /Type1 /BaseFont /${font === "Times-Roman" ? "Times-Bold" : "Helvetica-Bold"} /Encoding /WinAnsiEncoding /ToUnicode 5 0 R >>`),
    streamObject(ascii(cmap))
  ];
  encodedPages.forEach((page, index) => {
    const pageObject = 6 + index * 2; const contentObject = pageObject + 1;
    const commands = page.map((line) => `BT /F${line.bold ? "2" : "1"} ${line.size.toFixed(2)} Tf ${line.leading.toFixed(2)} TL ${line.x.toFixed(2)} ${line.y.toFixed(2)} Td 0 Tr <${hex(line.encoded)}> Tj ET`).join("\n");
    objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${layout.pageWidth.toFixed(2)} ${layout.pageHeight.toFixed(2)}] /MCLayout << /LeftMargin ${layout.leftMargin.toFixed(2)} /RightMargin ${layout.rightMargin.toFixed(2)} /TopMargin ${layout.topMargin.toFixed(2)} /BottomMargin ${layout.bottomMargin.toFixed(2)} /UsableWidth ${layout.usableWidth.toFixed(2)} >> /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`));
    objects.push(streamObject(ascii(commands)));
  });
  const warnings: CompileWarning[] = unsupported.size ? [{ severity: "information", code: "pdf-unsupported-glyphs", message: `${unsupported.size} unsupported PDF character${unsupported.size === 1 ? " was" : "s were"} replaced with an intentional fallback glyph.` }] : [];
  return { bytes: assemblePdf(objects), warnings, layout };
}

export function pdfPointsFromCm(value: number): number { return value * 72 / 2.54; }
export function pdfPointsFromMm(value: number): number { return value * 72 / 25.4; }
export function pdfPageDimensions(size: ExportFormattingOptions["pageSize"]): { width: number; height: number } { return size === "letter" ? { width: 612, height: 792 } : { width: pdfPointsFromMm(210), height: pdfPointsFromMm(297) }; }

export function measureNativePdfText(value: string, font: PdfBaseFont, size: number, bold = false): number {
  const encoded = encodeWinAnsi(value, new Set()).bytes; let units = 0; encoded.forEach((byte) => { units += glyphWidth(byte, font, bold); }); return units / 1000 * size;
}

export function wrapNativePdfText(value: string, font: PdfBaseFont, size: number, firstWidth: number, laterWidth = firstWidth, bold = false): string[] {
  const normal = encodeWinAnsi(value, new Set()).display.trim().replace(/\s+/g, " "); if (!normal) return [""];
  const words = normal.split(" "); const lines: string[] = []; let line = ""; let lineWidth = 0; const spaceWidth = measureNativePdfText(" ", font, size, bold);
  const widthForLine = (): number => lines.length === 0 ? firstWidth : laterWidth;
  const pushLongWord = (word: string): void => { let part = ""; let partWidth = 0; for (const character of word) { const characterWidth = measureNativePdfText(character, font, size, bold); if (part && partWidth + characterWidth > widthForLine()) { lines.push(part); part = character; partWidth = characterWidth; } else { part += character; partWidth += characterWidth; } } line = part; lineWidth = partWidth; };
  for (const word of words) { const wordWidth = measureNativePdfText(word, font, size, bold); const candidateWidth = line ? lineWidth + spaceWidth + wordWidth : wordWidth; if (candidateWidth <= widthForLine()) { line = line ? `${line} ${word}` : word; lineWidth = candidateWidth; continue; } if (line) { lines.push(line); line = ""; lineWidth = 0; } if (wordWidth > widthForLine()) pushLongWord(word); else { line = word; lineWidth = wordWidth; } }
  if (line || !lines.length) lines.push(line); return lines;
}

function layoutPdf(document: SemanticDocument, options: ExportFormattingOptions, font: PdfBaseFont, normalise: (value: string) => string, pageWidth: number, pageHeight: number, margin: number): PdfLayoutMetadata {
  const usableWidth = pageWidth - margin - margin; const pages: PdfPageLayout[] = [{ lines: [] }]; let y = pageHeight - margin;
  const blocks = document.sections.flatMap((section) => section.blocks); const indent = pdfPointsFromCm(options.firstLineIndentCm);
  const newPage = (): void => { if (pages.at(-1)!.lines.length) pages.push({ lines: [] }); y = pageHeight - margin; };
  const remaining = (): number => y - margin;
  const place = (text: string, style: PdfBlockStyle, firstLineIndent = 0): void => { const width = measureNativePdfText(text, font, style.size, style.bold); const x = style.align === "center" ? margin + Math.max(0, (usableWidth - width) / 2) : margin + firstLineIndent; pages.at(-1)!.lines.push({ text, x, y, width, size: style.size, leading: style.leading, role: style.role, bold: style.bold, firstLineIndent }); y -= style.leading; };
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]; if (block.kind === "page-break") { newPage(); continue; }
    const style = pdfBlockStyle(block, options); const text = normalise(plainText(block));
    if (block.kind === "heading" && block.pageBreakBefore) newPage();
    if (block.kind === "heading" && remaining() < keepGroupHeight(blocks, index, options, font, usableWidth, indent, normalise)) newPage();
    if (block.kind === "scene-break" && remaining() < sceneKeepHeight(blocks, index, options, font, usableWidth, indent, normalise)) newPage();
    y -= style.before;
    if (block.kind === "paragraph") {
      const firstIndent = block.first ? 0 : indent; const wrapped = wrapNativePdfText(text, font, style.size, usableWidth - firstIndent, usableWidth, style.bold);
      wrapped.forEach((line, lineIndex) => { if (remaining() < style.leading) newPage(); place(line, style, lineIndex === 0 ? firstIndent : 0); });
    } else {
      const wrapped = wrapNativePdfText(text, font, style.size, usableWidth, usableWidth, style.bold);
      const needed = wrapped.length * style.leading + style.after; if (remaining() < needed) newPage();
      wrapped.forEach((line) => place(line, style));
    }
    y -= style.after;
    if (block.kind === "heading" && block.pageBreakAfter) newPage();
  }
  if (!pages[0].lines.length) { const style = pdfBlockStyle({ kind: "heading", style: "title", inlines: [{ text: document.title }] }, options); place(normalise(document.title), style); }
  return { pageWidth, pageHeight, leftMargin: margin, rightMargin: margin, topMargin: margin, bottomMargin: margin, usableWidth, pages };
}

interface PdfBlockStyle { size: number; leading: number; before: number; after: number; align: "left" | "center"; role: PdfLineRole; bold: boolean; }
function pdfBlockStyle(block: Exclude<SemanticBlock, { kind: "page-break" }>, options: ExportFormattingOptions): PdfBlockStyle {
  const bodyLeading = options.fontSize * options.lineSpacing;
  if (block.kind === "paragraph") return { size: options.fontSize, leading: bodyLeading, before: 0, after: 0, align: "left", role: "body", bold: false };
  if (block.kind === "scene-break") return { size: options.fontSize, leading: bodyLeading, before: bodyLeading * 0.5, after: bodyLeading * 0.5, align: "center", role: "scene-break", bold: false };
  const styles: Record<Extract<SemanticBlock, { kind: "heading" }>["style"], PdfBlockStyle> = {
    title: { size: 24, leading: 30, before: 108, after: 0, align: "center", role: "title", bold: true },
    author: { size: 14, leading: 20, before: 24, after: 24, align: "center", role: "author", bold: false },
    "part-number": { size: 14, leading: 19, before: 72, after: 14, align: "center", role: "part-number", bold: true },
    "part-title": { size: 20, leading: 25, before: 0, after: 36, align: "center", role: "part-title", bold: true },
    "chapter-number": { size: 13, leading: 18, before: 48, after: 12, align: "center", role: "chapter-number", bold: true },
    "chapter-title": { size: 18, leading: 23, before: 0, after: 30, align: "center", role: "chapter-title", bold: true },
    "front-matter": { size: 18, leading: 23, before: 30, after: 24, align: "center", role: "matter-heading", bold: true },
    "back-matter": { size: 18, leading: 23, before: 30, after: 24, align: "center", role: "matter-heading", bold: true },
    "body-heading": { size: 15, leading: 20, before: 18, after: 12, align: "center", role: "body-heading", bold: true }
  };
  return styles[block.style];
}

function keepGroupHeight(blocks: SemanticBlock[], index: number, options: ExportFormattingOptions, font: PdfBaseFont, usableWidth: number, indent: number, normalise: (value: string) => string): number {
  let total = 0; const first = blocks[index]; if (first.kind !== "heading") return 0;
  const stylesToKeep = new Set(["title", "part-number", "chapter-number"]); const limit = stylesToKeep.has(first.style) ? 3 : 2;
  for (let offset = 0; offset < limit && index + offset < blocks.length; offset += 1) { const block = blocks[index + offset]; if (block.kind === "page-break") break; const style = pdfBlockStyle(block, options); const text = normalise(plainText(block)); if (block.kind === "paragraph") { const firstIndent = block.first ? 0 : indent; total += style.before + style.leading + style.after; if (!wrapNativePdfText(text, font, style.size, usableWidth - firstIndent, usableWidth, style.bold).length) break; break; } const lines = wrapNativePdfText(text, font, style.size, usableWidth, usableWidth, style.bold); total += style.before + lines.length * style.leading + style.after; if (block.kind === "scene-break") break; }
  return total;
}
function sceneKeepHeight(blocks: SemanticBlock[], index: number, options: ExportFormattingOptions, font: PdfBaseFont, usableWidth: number, indent: number, normalise: (value: string) => string): number { const scene = blocks[index]; if (scene.kind !== "scene-break") return 0; const style = pdfBlockStyle(scene, options); let total = style.before + style.leading + style.after; const next = blocks[index + 1]; if (next?.kind === "paragraph") { const nextStyle = pdfBlockStyle(next, options); const firstIndent = next.first ? 0 : indent; if (wrapNativePdfText(normalise(plainText(next)), font, nextStyle.size, usableWidth - firstIndent, usableWidth, nextStyle.bold).length) total += nextStyle.before + nextStyle.leading; } return total; }

/** Recover generated text through the same ToUnicode mapping a PDF viewer uses. */
export function recoverNativePdfText(bytes: Uint8Array): string {
  return inspectNativePdfTextLines(bytes).map((line) => line.text).join("\n");
}

export function inspectNativePdfTextLines(bytes: Uint8Array): InspectedPdfTextLine[] {
  const source = new TextDecoder("latin1").decode(bytes); const mapping = new Map<number, string>();
  for (const match of source.matchAll(/<([0-9A-F]{2})>\s*<([0-9A-F]{4}(?:[0-9A-F]{4})?)>/g)) mapping.set(Number.parseInt(match[1], 16), utf16BeHexToString(match[2]));
  const output: InspectedPdfTextLine[] = [];
  for (const match of source.matchAll(/BT \/F([12]) ([\d.]+) Tf ([\d.]+) TL ([\d.]+) ([\d.]+) Td 0 Tr <([0-9A-F]*)> Tj ET/g)) { const value = match[6]; if (value.length % 2) return []; let text = ""; for (let index = 0; index < value.length; index += 2) { const character = mapping.get(Number.parseInt(value.slice(index, index + 2), 16)); if (character === undefined) return []; text += character; } output.push({ text, size: Number(match[2]), leading: Number(match[3]), x: Number(match[4]), y: Number(match[5]), bold: match[1] === "2" }); }
  return output;
}

export function escapePdfLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\x08/g, "\\b").replace(/\f/g, "\\f");
}

function encodeWinAnsi(value: string, unsupported: Set<number>): EncodedPdfText {
  const bytes: number[] = []; const display: string[] = [];
  for (const character of cleanPdfText(value.normalize("NFC"))) {
    const point = character.codePointAt(0)!; const byte = winAnsiByte(point);
    if (byte === undefined) { unsupported.add(point); bytes.push(0x3f); display.push("?"); } else { bytes.push(byte); display.push(character); }
  }
  return { display: display.join(""), bytes: Uint8Array.from(bytes) };
}
function winAnsiByte(point: number): number | undefined { if (point <= 0x7f || point >= 0xa0 && point <= 0xff) return point; return WIN_ANSI_SPECIAL.get(point); }
function unicodeForWinAnsi(byte: number): number { for (const [point, encoded] of WIN_ANSI_SPECIAL) if (encoded === byte) return point; return byte; }
function cleanPdfText(value: string): string { return Array.from(value).filter((character) => { const point = character.codePointAt(0)!; return point === 9 || point === 10 || point === 13 || point >= 32; }).join("").replace(/[\t\r\n]+/g, " "); }
function pdfBaseFont(value: string): PdfBaseFont { return /arial|helvetica|sans/i.test(value) ? "Helvetica" : "Times-Roman"; }
function rawGlyphWidth(byte: number, font: PdfBaseFont, bold: boolean): number {
  const unicode = unicodeForWinAnsi(byte); const base = baseLatinCharacter(unicode); const point = base.codePointAt(0) ?? 0x3f;
  if (font === "Helvetica") {
    if (point >= 0x30 && point <= 0x39) return 556;
    if (point >= 0x41 && point <= 0x5a) return (bold ? HELVETICA_BOLD_UPPER : HELVETICA_UPPER)[point - 0x41];
    if (point >= 0x61 && point <= 0x7a) return (bold ? HELVETICA_BOLD_LOWER : HELVETICA_LOWER)[point - 0x61];
    return (bold ? HELVETICA_BOLD_SPECIAL : HELVETICA_SPECIAL).get(unicode) ?? (bold ? HELVETICA_BOLD_SPECIAL : HELVETICA_SPECIAL).get(point) ?? 556;
  }
  if (point >= 0x30 && point <= 0x39) return 500;
  if (point >= 0x41 && point <= 0x5a) return (bold ? TIMES_BOLD_UPPER : TIMES_UPPER)[point - 0x41];
  if (point >= 0x61 && point <= 0x7a) return (bold ? TIMES_BOLD_LOWER : TIMES_LOWER)[point - 0x61];
  return (bold ? TIMES_BOLD_SPECIAL : TIMES_SPECIAL).get(unicode) ?? (bold ? TIMES_BOLD_SPECIAL : TIMES_SPECIAL).get(point) ?? 500;
}
function baseLatinCharacter(point: number): string { const value = String.fromCodePoint(point).normalize("NFD").replace(/[\u0300-\u036f]/g, ""); if (/^[A-Za-z]$/.test(value)) return value; if (point === 0x00d8) return "O"; if (point === 0x00f8) return "o"; if (point === 0x00c6) return "A"; if (point === 0x00e6) return "a"; if (point === 0x0152) return "O"; if (point === 0x0153) return "o"; if (point === 0x00d0 || point === 0x00de) return "D"; if (point === 0x00f0 || point === 0x00fe) return "d"; return String.fromCodePoint(point); }
const TIMES_UPPER = [722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611];
const TIMES_LOWER = [444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444];
const TIMES_BOLD_UPPER = [722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667];
const TIMES_BOLD_LOWER = [500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444];
const HELVETICA_UPPER = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const HELVETICA_LOWER = [556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500];
const HELVETICA_BOLD_UPPER = [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611];
const HELVETICA_BOLD_LOWER = [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500];
const TIMES_SPECIAL = new Map<number, number>([[0x20, 250], [0x21, 333], [0x22, 408], [0x23, 500], [0x24, 500], [0x25, 833], [0x26, 778], [0x27, 180], [0x28, 333], [0x29, 333], [0x2a, 500], [0x2b, 564], [0x2c, 250], [0x2d, 333], [0x2e, 250], [0x2f, 278], [0x3a, 278], [0x3b, 278], [0x3c, 564], [0x3d, 564], [0x3e, 564], [0x3f, 444], [0x40, 921], [0x5b, 333], [0x5c, 278], [0x5d, 333], [0x5e, 469], [0x5f, 500], [0x60, 333], [0x7b, 480], [0x7c, 200], [0x7d, 480], [0x7e, 541], [0x2018, 333], [0x2019, 333], [0x201c, 444], [0x201d, 444], [0x2013, 500], [0x2014, 1000], [0x2026, 1000], [0x2022, 350], [0x20ac, 500], [0x00a3, 500], [0x00a5, 500], [0x00a9, 760], [0x00ae, 760], [0x2122, 980], [0x00df, 500]]);
const HELVETICA_SPECIAL = new Map<number, number>([[0x20, 278], [0x21, 278], [0x22, 355], [0x23, 556], [0x24, 556], [0x25, 889], [0x26, 667], [0x27, 191], [0x28, 333], [0x29, 333], [0x2a, 389], [0x2b, 584], [0x2c, 278], [0x2d, 333], [0x2e, 278], [0x2f, 278], [0x3a, 278], [0x3b, 278], [0x3c, 584], [0x3d, 584], [0x3e, 584], [0x3f, 556], [0x40, 1015], [0x5b, 278], [0x5c, 278], [0x5d, 278], [0x5e, 469], [0x5f, 556], [0x60, 333], [0x7b, 334], [0x7c, 260], [0x7d, 334], [0x7e, 584], [0x2018, 222], [0x2019, 222], [0x201c, 333], [0x201d, 333], [0x2013, 556], [0x2014, 1000], [0x2026, 1000], [0x2022, 350], [0x20ac, 556], [0x00a3, 556], [0x00a5, 556], [0x00a9, 737], [0x00ae, 737], [0x2122, 1000], [0x00df, 611]]);
const TIMES_BOLD_SPECIAL = new Map(TIMES_SPECIAL); TIMES_BOLD_SPECIAL.set(0x22, 555).set(0x27, 278).set(0x3f, 500).set(0x2018, 333).set(0x2019, 333).set(0x201c, 555).set(0x201d, 555);
const HELVETICA_BOLD_SPECIAL = new Map(HELVETICA_SPECIAL); HELVETICA_BOLD_SPECIAL.set(0x22, 474).set(0x27, 238).set(0x3f, 611).set(0x2018, 278).set(0x2019, 278).set(0x201c, 500).set(0x201d, 500);
const PDF_WIDTHS = { "Times-Roman": { normal: widthTable("Times-Roman", false), bold: widthTable("Times-Roman", true) }, Helvetica: { normal: widthTable("Helvetica", false), bold: widthTable("Helvetica", true) } };
function widthTable(font: PdfBaseFont, bold: boolean): Uint16Array { return Uint16Array.from({ length: 256 }, (_value, byte) => rawGlyphWidth(byte, font, bold)); }
function glyphWidth(byte: number, font: PdfBaseFont, bold: boolean): number { return PDF_WIDTHS[font][bold ? "bold" : "normal"][byte]; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum)); }
function hex(bytes: Uint8Array): string { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(""); }
function unicodeHex(point: number): string { if (point <= 0xffff) return point.toString(16).padStart(4, "0").toUpperCase(); const adjusted = point - 0x10000; return `${(0xd800 + (adjusted >> 10)).toString(16).toUpperCase()}${(0xdc00 + (adjusted & 0x3ff)).toString(16).toUpperCase()}`; }
function toUnicodeCMap(mappings: ReadonlyMap<number, number>): string {
  const entries = [...mappings].sort(([left], [right]) => left - right);
  const groups: string[] = []; for (let index = 0; index < entries.length; index += 100) { const chunk = entries.slice(index, index + 100); groups.push(`${chunk.length} beginbfchar\n${chunk.map(([byte, point]) => `<${byte.toString(16).padStart(2, "0").toUpperCase()}> <${unicodeHex(point)}>`).join("\n")}\nendbfchar`); }
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /ManuscriptCompiler-WinAnsi-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n${groups.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
}
function utf16BeHexToString(value: string): string { const units: number[] = []; for (let index = 0; index < value.length; index += 4) units.push(Number.parseInt(value.slice(index, index + 4), 16)); return String.fromCharCode(...units); }
function ascii(value: string): Uint8Array { return encoder.encode(value); }
function streamObject(stream: Uint8Array): Uint8Array { return concatBytes([ascii(`<< /Length ${stream.byteLength} >>\nstream\n`), stream, ascii(`\nendstream`)]); }
function assemblePdf(objects: readonly Uint8Array[]): Uint8Array {
  const header = Uint8Array.from([...ascii("%PDF-1.7\n%"), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]); const chunks: Uint8Array[] = [header]; const offsets: number[] = []; let offset = header.byteLength;
  objects.forEach((object, index) => { const chunk = concatBytes([ascii(`${index + 1} 0 obj\n`), object, ascii(`\nendobj\n`)]); offsets.push(offset); offset += chunk.byteLength; chunks.push(chunk); });
  const xrefOffset = offset; const xref = ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((value) => `${String(value).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`); chunks.push(xref); return concatBytes(chunks);
}
function concatBytes(chunks: readonly Uint8Array[]): Uint8Array { const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0); const output = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return output; }
