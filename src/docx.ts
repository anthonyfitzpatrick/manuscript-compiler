import { strToU8, zipSync } from "fflate";

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const escapeXml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export interface DocxOptions { title: string; author: string; tableOfContents?: boolean; }

/** Creates a deliberately simple, semantic DOCX suitable for importing into Vellum or Word. */
export function createDocx(markdown: string, options: DocxOptions): Uint8Array {
  const created = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": text(`${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": text(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`),
    "word/document.xml": text(documentXml(markdown, options.tableOfContents === true)),
    "word/styles.xml": text(stylesXml()),
    "word/settings.xml": text(`${XML}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:compat/></w:settings>`),
    "docProps/core.xml": text(`${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(options.title)}</dc:title><dc:creator>${escapeXml(options.author)}</dc:creator><cp:lastModifiedBy>Manuscript Compiler</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": text(`${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Manuscript Compiler</Application><AppVersion>1.0</AppVersion></Properties>`)
  };
  return zipSync(files, { level: 6 });
}

function text(value: string): Uint8Array { return strToU8(value); }
function documentXml(markdown: string, toc: boolean): string {
  const blocks: string[] = [];
  if (toc) blocks.push(`<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr><w:r><w:t>Contents</w:t></w:r></w:p>`, `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Update this field to build the table of contents.</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`);
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); let paragraph: string[] = [];
  const flush = (): void => { if (paragraph.length) { blocks.push(makeParagraph(paragraph.join(" "))); paragraph = []; } };
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { flush(); const level = Math.min(3, heading[1].length); blocks.push(makeParagraph(heading[2], `Heading${level}`)); continue; }
    if (/^\s*(?:---+|\*\s*\*\s*\*|#)\s*$/.test(line)) { flush(); blocks.push(`<w:p><w:pPr><w:pStyle w:val="SceneBreak"/></w:pPr><w:r><w:t>* * *</w:t></w:r></w:p>`); continue; }
    const list = /^\s*[-*+]\s+(.+)$/.exec(line); if (list) { flush(); blocks.push(makeParagraph(`• ${list[1]}`, "ListParagraph")); continue; }
    const quote = /^\s*>\s?(.*)$/.exec(line); if (quote) { flush(); blocks.push(makeParagraph(quote[1], "Quote")); continue; }
    if (!line.trim()) flush(); else paragraph.push(line.trim());
  }
  flush();
  return `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/><w:cols w:space="720"/></w:sectPr></w:body></w:document>`;
}

function makeParagraph(value: string, style = "Normal"): string { return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inlineRuns(value)}</w:p>`; }
function inlineRuns(value: string): string {
  const runs: string[] = []; const pattern = /(\*\*|__)(.+?)\1|(?<!\*)\*([^*]+?)\*|_([^_]+?)_|\[([^\]]+)\]\([^)]+\)|`([^`]+)`/g; let offset = 0; let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) { if (match.index > offset) runs.push(run(value.slice(offset, match.index))); if (match[2]) runs.push(run(match[2], "<w:b/>")); else if (match[3] || match[4]) runs.push(run(match[3] ?? match[4], "<w:i/>")); else runs.push(run(match[5] ?? match[6] ?? "")); offset = match.index + match[0].length; }
  if (offset < value.length) runs.push(run(value.slice(offset))); return runs.join("");
}
function run(value: string, properties = ""): string { return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`; }
function stylesXml(): string { return `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="480" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr></w:style>${headingStyle(1, 32, true)}${headingStyle(2, 28, true)}${headingStyle(3, 24, false)}<w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/><w:ind w:firstLine="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/></w:style></w:styles>`; }
function headingStyle(level: number, size: number, pageBreak: boolean): string { return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="${9 + level}"/><w:qFormat/><w:pPr>${pageBreak ? "<w:pageBreakBefore/>" : ""}<w:keepNext/><w:spacing w:before="240" w:after="240"/><w:outlineLvl w:val="${level - 1}"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`; }
