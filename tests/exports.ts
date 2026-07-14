/** Native multi-format generation, validation, and browser-delivery regression suite. */
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { BrowserDownloadService, type DownloadEnvironment } from "../src/browser-download";
import { CompilePreparationService } from "../src/compile-preparation";
import { EXPORT_FORMAT_DETAILS, EXPORT_FORMATS, type ExportFormat, type ManuscriptExportContext } from "../src/export-types";
import { exportFilename } from "../src/export-filename";
import { EXPORTERS } from "../src/native-exporters";
import { EXPORT_VALIDATORS } from "../src/export-validators";
import { createNativePdf, escapePdfLiteral, measureNativePdfText, pdfPageDimensions, pdfPointsFromCm, recoverNativePdfText, wrapNativePdfText } from "../src/native-pdf";
import { createDefaultProfiles } from "../src/profiles";
import { createSemanticDocument } from "../src/semantic-document";
import { createContentPlan, classifyContentPlan } from "../src/content-plan";
import { loadFixtureTree } from "./fixture-loader";
import { ExportCoordinator } from "../src/export-coordinator";
import { OperationStateController } from "../src/operation-state";
import { CompileHistoryService } from "../src/compile-history";
import { DEFAULT_SETTINGS } from "../src/settings";

const selected = EXPORT_FORMATS.includes(process.argv.at(-1) as ExportFormat) ? process.argv.at(-1) as ExportFormat : undefined;
const tests: Array<[string, ExportFormat | "common", () => void | Promise<void>]> = [];
const test = (name: string, format: ExportFormat | "common", action: () => void | Promise<void>): void => { tests.push([name, format, action]); };

const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence");
const profile = createDefaultProfiles()[1]; profile.useParts = true; profile.sceneSeparator = "#"; profile.partDisplay = "word-title"; profile.chapterDisplay = "word-title";
const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
const session = await new CompilePreparationService(loaded.vault as never, profile, 250).prepare({ manuscriptRoot: loaded.root.path, structurePreset: "novel-parts", includeFrontMatter: true, includeBackMatter: true, exportFolder: "", outputFilename: "Warden of Silence.docx", outputFormat: "docx", docxPreset: "vellum", contentPlan: plan, formatting: { font: "Times New Roman", fontSize: 12, lineSpacing: 1.5, firstLineIndentCm: 0.75, pageSize: "a4", chapterPageBreak: true, titlePage: true }, tableOfContents: true, custom: { variables: { BookTitle: "Warden & <Silence> 雪", Author: "A & B 'Writer'" } } }, plan);
const options = { title: "Warden & <Silence> 雪", author: "A & B 'Writer'", language: "en", titlePage: true, tableOfContents: true, font: "Times New Roman", fontSize: 12, lineSpacing: 1.5, firstLineIndentCm: 0.75, pageSize: "a4" as const, pageMarginCm: 2.54, chapterPageBreak: true, sceneSeparator: "#" };
const document = createSemanticDocument(session.book, profile, options, session.statistics.totalWordCount);
const generated = new Map<ExportFormat, Awaited<ReturnType<(typeof EXPORTERS)[ExportFormat]["generate"]>>>();
async function output(format: ExportFormat) { let value = generated.get(format); if (!value) { const context: ManuscriptExportContext = { session, document, options, filename: exportFilename("Warden.docx", format) }; value = await EXPORTERS[format].generate(context); generated.set(format, value); } return value; }

test("all exporters share one prepared Book projection and expose correct MIME metadata", "common", async () => {
  assert.equal(document.sections.length > 0, true);
  for (const format of EXPORT_FORMATS) { const value = await output(format); assert.equal(value.format, format); assert.equal(value.mimeType, EXPORT_FORMAT_DETAILS[format].mimeType); assert.equal(value.filename, `Warden.${EXPORT_FORMAT_DETAILS[format].extension}`); assert.equal(EXPORT_VALIDATORS[format].validate(value.bytes).valid, true); }
});

test("portable filenames correct paths, duplicate extensions, and Windows reserved names", "common", () => {
  assert.equal(exportFilename("folder/book.docx", "pdf"), "book.pdf"); assert.equal(exportFilename("book.HTML", "html"), "book.html"); assert.equal(exportFilename("book.epub.epub", "epub"), "book.epub"); assert.equal(exportFilename("CON", "xml"), "_CON.xml");
});

test("browser download clicks once, uses properties, removes the anchor, and revokes its URL", "common", async () => {
  let clicks = 0; let removes = 0; const revoked: string[] = []; let appended = 0; const anchor = { href: "", download: "", style: { display: "" }, click: () => { clicks += 1; }, remove: () => { removes += 1; } } as unknown as HTMLAnchorElement;
  const environment: DownloadEnvironment = { createObjectURL: (blob) => { assert.equal(blob.type, "application/pdf"); return "blob:test"; }, revokeObjectURL: (url) => revoked.push(url), createAnchor: () => anchor, append: () => { appended += 1; }, defer: (action) => action() };
  const result = await new BrowserDownloadService(environment).download({ filename: "folder/book.pdf", bytes: new Uint8Array([1, 2, 3]), mimeType: "application/pdf" });
  assert.deepEqual(result, { started: true, filename: "book.pdf" }); assert.equal(anchor.href, "blob:test"); assert.equal(anchor.download, "book.pdf"); assert.equal(clicks, 1); assert.equal(appended, 1); assert.equal(removes, 1); assert.deepEqual(revoked, ["blob:test"]);
});

test("browser download cleans up synchronously when dispatch fails", "common", async () => {
  let removed = false; let revoked = false; const anchor = { href: "", download: "", style: {}, click: () => { throw new Error("blocked"); }, remove: () => { removed = true; } } as unknown as HTMLAnchorElement;
  const result = await new BrowserDownloadService({ createObjectURL: () => "blob:failed", revokeObjectURL: () => { revoked = true; }, createAnchor: () => anchor, append: () => undefined, defer: () => assert.fail("failed downloads must not defer cleanup") }).download({ filename: "book.xml", bytes: new Uint8Array([1]), mimeType: "application/xml" });
  assert.equal(result.started, false); assert.equal(removed, true); assert.equal(revoked, true);
});

test("coordinator blocks invalid bytes before download dispatch", "common", async () => {
  const original = EXPORTERS.pdf; let downloads = 0; EXPORTERS.pdf = { format: "pdf", generate: async (context) => ({ format: "pdf", filename: context.filename, mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]), warnings: [] }) };
  const settings = { ...DEFAULT_SETTINGS, profiles: [profile], exportHistory: [], compileLogs: [], defaultDownloadFormat: "pdf" as const }; const history = new CompileHistoryService(() => settings, async () => undefined, "0.9.2"); const coordinator = new ExportCoordinator({ vault: loaded.vault } as never, () => settings, async () => undefined, new OperationStateController(), history, { download: async () => { downloads += 1; return { started: true, filename: "Warden.pdf" }; } } as never);
  try { const result = await coordinator.exportPreparedSession(session, { format: "pdf", filename: "Warden.pdf", showResult: false }); assert.equal(result.status, "failed"); assert.equal(result.validationPassed, false); assert.equal(downloads, 0); assert.equal(settings.exportHistory[0].downloadStarted, false); }
  finally { EXPORTERS.pdf = original; }
});

test("coordinator validates once, starts one download, and records format without a path", "common", async () => {
  let downloads = 0; const settings = { ...DEFAULT_SETTINGS, profiles: [profile], exportHistory: [], compileLogs: [], defaultDownloadFormat: "html" as const }; const history = new CompileHistoryService(() => settings, async () => undefined, "0.9.2"); const coordinator = new ExportCoordinator({ vault: loaded.vault } as never, () => settings, async () => undefined, new OperationStateController(), history, { download: async (request: { filename: string }) => { downloads += 1; return { started: true, filename: request.filename }; } } as never);
  const result = await coordinator.exportPreparedSession(session, { format: "html", filename: "folder/Warden.docx", showResult: false }); assert.equal(result.status, "success", result.error); assert.equal(downloads, 1); assert.equal(settings.exportHistory[0].format, "html"); assert.equal(settings.exportHistory[0].downloadStarted, true); assert.deepEqual(settings.exportHistory[0].outputFiles, ["Warden.html"]); assert.doesNotMatch(JSON.stringify(settings.exportHistory[0]), /blob:|\/Users\/|\\Users\\/);
});

test("DOCX remains a validated native OOXML package", "docx", async () => { const value = await output("docx"); const files = unzipSync(value.bytes); assert.ok(files["word/document.xml"]); assert.match(strFromU8(files["word/document.xml"]), /Part One/); });

test("ODT has required native package entries, first mimetype, styles, Unicode, and escaped XML", "odt", async () => { const value = await output("odt"); const files = unzipSync(value.bytes); for (const name of ["mimetype", "META-INF/manifest.xml", "content.xml", "styles.xml", "meta.xml", "settings.xml"]) assert.ok(files[name]); const content = strFromU8(files["content.xml"]); assert.match(content, /Östersund/); assert.match(strFromU8(files["meta.xml"]), /Warden &amp; &lt;Silence&gt; 雪/); assert.doesNotMatch(content, /Revision Notes|Internal synopsis/); });

test("PDF has searchable WinAnsi text, an exact ToUnicode map, proportional layout and A4 margins", "pdf", async () => { const value = await output("pdf"); const text = new TextDecoder("latin1").decode(value.bytes); assert.match(text, /^%PDF-1\.7/); assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/); assert.match(text, /\/MCLayout << \/LeftMargin 72\.00 \/RightMargin 72\.00[\s\S]*\/UsableWidth 451\.28/); assert.match(text, /\/Subtype \/Type1 \/BaseFont \/Times-Roman \/Encoding \/WinAnsiEncoding/); assert.match(text, /\/Subtype \/Type1 \/BaseFont \/Times-Bold \/Encoding \/WinAnsiEncoding/); assert.doesNotMatch(text, /\/Identity-H|\/CIDToGIDMap \/Identity/); assert.match(text, /BT \/F2 24\.00 Tf 30\.00 TL/); assert.match(text, /D67374657273756E64/); assert.match(text, /<D6> <00D6>/); assert.match(recoverNativePdfText(value.bytes), /Östersund/); assert.match(text, /%%EOF$/); const alternate = await EXPORTERS.pdf.generate({ session, document, options: { ...options, font: "Arial", pageMarginCm: 2 }, filename: "alternate.pdf" }); const alternateText = new TextDecoder("latin1").decode(alternate.bytes); assert.match(alternateText, /\/BaseFont \/Helvetica/); assert.match(alternateText, /\/BaseFont \/Helvetica-Bold/); assert.match(alternateText, /\/LeftMargin 56\.69 \/RightMargin 56\.69/); });

test("PDF units and proportional built-in font metrics are correct", "pdf", () => {
  const a4 = pdfPageDimensions("a4"); const letter = pdfPageDimensions("letter"); assert.ok(Math.abs(a4.width - 595.28) < 0.01); assert.ok(Math.abs(a4.height - 841.89) < 0.01); assert.deepEqual(letter, { width: 612, height: 792 }); assert.ok(Math.abs(pdfPointsFromCm(2.54) - 72) < 0.001); assert.ok(Math.abs(pdfPointsFromCm(1.27) - 36) < 0.001); assert.ok(Math.abs(pdfPointsFromCm(0.75) - 21.26) < 0.01);
  assert.ok(measureNativePdfText("iiiiiiiiii", "Times-Roman", 12) < measureNativePdfText("WWWWWWWWWW", "Times-Roman", 12)); assert.ok(measureNativePdfText("The Silence of Östersund", "Times-Roman", 12) > 100); assert.ok(measureNativePdfText("A narrow sentence.", "Times-Roman", 12) < measureNativePdfText("A much wider sentence — with punctuation.", "Times-Roman", 12));
});

test("PDF word wrapping uses full width after the first indented line and cannot hang on long tokens", "pdf", () => {
  const source = "The Silence of Östersund carried across the valley while a much wider sentence — with punctuation — continued toward the right margin without losing or duplicating words."; const usable = pdfPageDimensions("a4").width - 144; const wrapped = wrapNativePdfText(source, "Times-Roman", 12, usable - 36, usable); assert.equal(wrapped.join(" "), source); assert.ok(wrapped.length < wrapNativePdfText(source, "Times-Roman", 12, 260, 260).length); assert.ok(measureNativePdfText(wrapped[0], "Times-Roman", 12) <= usable - 36 + 0.01); wrapped.slice(1).forEach((line) => assert.ok(measureNativePdfText(line, "Times-Roman", 12) <= usable + 0.01)); const token = "W".repeat(500); const tokenLines = wrapNativePdfText(token, "Times-Roman", 12, 100); assert.ok(tokenLines.length > 1); assert.equal(tokenLines.join(""), token);
});

test("PDF block layout applies margins once, preserves indentation, spaces headings, and keeps text in bounds", "pdf", () => {
  const repeated = Array.from({ length: 150 }, () => "Östersund remained quiet while the long manuscript paragraph flowed naturally across the full readable page width.").join(" ");
  const fixture = { title: "Warden of Silence", author: "A Writer", language: "sv", wordCount: 2_000, sections: [{ id: "layout", kind: "body", title: "Layout", blocks: [
    { kind: "heading", style: "title", inlines: [{ text: "Warden of Silence" }] }, { kind: "heading", style: "author", inlines: [{ text: "A Writer" }], pageBreakAfter: true },
    { kind: "heading", style: "front-matter", inlines: [{ text: "Copyright" }], pageBreakBefore: true }, { kind: "paragraph", inlines: [{ text: "Front matter text." }], first: true },
    { kind: "heading", style: "part-number", inlines: [{ text: "Part One" }], pageBreakBefore: true }, { kind: "heading", style: "part-title", inlines: [{ text: "Arrival" }] },
    { kind: "heading", style: "chapter-number", inlines: [{ text: "Chapter One" }], pageBreakBefore: true }, { kind: "heading", style: "chapter-title", inlines: [{ text: "The Silence of Östersund" }] },
    { kind: "paragraph", inlines: [{ text: "First prose after the Chapter heading stays unindented and readable." }], first: true }, { kind: "paragraph", inlines: [{ text: repeated }], first: false },
    { kind: "scene-break", text: "#" }, { kind: "paragraph", inlines: [{ text: "First prose after the scene break is unindented." }], first: true }, { kind: "paragraph", inlines: [{ text: "Later prose is indented once and wraps back to the normal left margin when needed because this sentence is deliberately long enough to wrap." }], first: false },
    { kind: "heading", style: "chapter-number", inlines: [{ text: "Chapter Two" }], pageBreakBefore: true }, { kind: "heading", style: "chapter-title", inlines: [{ text: "The Weight of Knowing" }] }, { kind: "paragraph", inlines: [{ text: repeated }], first: true },
    { kind: "heading", style: "back-matter", inlines: [{ text: "Acknowledgements" }], pageBreakBefore: true }, { kind: "paragraph", inlines: [{ text: "Back matter text." }], first: true }
  ] }] } as const;
  const result = createNativePdf(fixture as never, options); const { layout } = result; assert.ok(Math.abs(layout.pageWidth - 595.28) < 0.01); assert.ok(Math.abs(layout.pageHeight - 841.89) < 0.01); assert.ok(Math.abs(layout.leftMargin - 72) < 0.01); assert.ok(Math.abs(layout.usableWidth - 451.28) < 0.02); assert.equal(EXPORT_VALIDATORS.pdf.validate(result.bytes).valid, true); assert.ok(layout.pages.length > 4);
  const located = layout.pages.flatMap((page, pageIndex) => page.lines.map((line) => ({ ...line, pageIndex }))); const chapterNumber = located.find((line) => line.text === "Chapter One")!; const chapterTitle = located.find((line) => line.text === "The Silence of Östersund")!; const firstProse = located.find((line) => line.text.startsWith("First prose after the Chapter"))!; assert.equal(chapterNumber.pageIndex, chapterTitle.pageIndex); assert.equal(chapterTitle.pageIndex, firstProse.pageIndex); assert.ok(chapterNumber.y - chapterTitle.y >= 29); assert.ok(chapterTitle.y - firstProse.y >= 52); assert.equal(firstProse.x, layout.leftMargin);
  const indented = located.find((line) => line.text.startsWith("Östersund remained"))!; assert.ok(Math.abs(indented.firstLineIndent - pdfPointsFromCm(0.75)) < 0.01); assert.ok(Math.abs(indented.x - (layout.leftMargin + pdfPointsFromCm(0.75))) < 0.01); const following = located.find((line) => line.role === "body" && line.pageIndex === indented.pageIndex && line.y < indented.y)!; assert.equal(following.x, layout.leftMargin);
  const scene = located.find((line) => line.role === "scene-break")!; assert.ok(Math.abs(scene.x - (layout.leftMargin + (layout.usableWidth - scene.width) / 2)) < 0.01); const scenePage = layout.pages[scene.pageIndex].lines; assert.notEqual(scenePage.at(-1)?.role, "scene-break"); const afterScene = located.find((line) => line.text.startsWith("First prose after the scene"))!; assert.equal(afterScene.x, layout.leftMargin);
  for (const line of located) { assert.ok(line.x >= layout.leftMargin - 0.01); assert.ok(line.x + line.width <= layout.pageWidth - layout.rightMargin + 0.01); assert.ok(line.y >= layout.bottomMargin - 0.01); assert.ok(line.y <= layout.pageHeight - layout.topMargin + 0.01); assert.ok(line.leading > 0); }
});

test("PDF regression fixture round-trips European text, syntax characters, wrapping, and pages", "pdf", () => {
  const fixtureText = `“Quoted text” – with an en dash — and an em dash. Å Ä Ö å ä ö Café, naïve, façade, déjà vu. English apostrophe: don’t Symbols: © ® ™ € £ ¥ Parentheses: (test) Backslash: C:\\Books\\Test Ampersand: A & B Angle brackets: <chapter> Combining: Cafe\u0301.`;
  const longText = Array.from({ length: 90 }, () => fixtureText).join(" ");
  const fixture = { title: "Warden of Silence", author: "A Writer", language: "sv", wordCount: 1_000, sections: [
    { id: "title", kind: "title", title: "Warden of Silence", blocks: [{ kind: "heading", style: "title", inlines: [{ text: "Warden of Silence" }] }, { kind: "heading", style: "author", inlines: [{ text: "A Writer" }] }, { kind: "page-break" }] },
    { id: "part", kind: "part", title: "Part One", blocks: [{ kind: "heading", style: "part-title", inlines: [{ text: "Part One" }], pageBreakBefore: true }] },
    { id: "chapter", kind: "chapter", title: "The Silence of Östersund", blocks: [{ kind: "heading", style: "chapter-title", inlines: [{ text: "The Silence of Östersund" }], pageBreakBefore: true }, { kind: "paragraph", inlines: [{ text: fixtureText }], first: true }, { kind: "scene-break", text: "#" }, { kind: "paragraph", inlines: [{ text: longText }], first: false }, { kind: "page-break" }, { kind: "paragraph", inlines: [{ text: "After the page break." }], first: true }] }
  ] } as const;
  const generatedPdf = createNativePdf(fixture as never, options); const source = new TextDecoder("latin1").decode(generatedPdf.bytes); const recovered = recoverNativePdfText(generatedPdf.bytes);
  assert.equal(EXPORT_VALIDATORS.pdf.validate(generatedPdf.bytes).valid, true); assert.match(source, /<93> <201C>/); assert.match(source, /<94> <201D>/); assert.match(source, /<96> <2013>/); assert.match(source, /<97> <2014>/); assert.match(source, /<80> <20AC>/); assert.match(recovered, /Warden of Silence/); assert.match(recovered, /The Silence of Östersund/); assert.match(recovered, /“Quoted text” – with an en dash — and an em dash\./); assert.match(recovered, /Å Ä Ö å ä ö/); assert.match(recovered, /Café, naïve, façade, déjà vu/); assert.match(recovered, /don’t/); assert.match(recovered, /© ® ™ € £ ¥/); assert.match(recovered, /\(test\)/); assert.match(recovered, /C:\\Books\\Test/); assert.match(recovered, /A & B/); assert.match(recovered, /<chapter>/); assert.match(recovered, /Combining: Café/); assert.match(recovered, /After the page break/); assert.ok((source.match(/\/Type \/Page\b/g) ?? []).length > 1); assert.doesNotMatch(recovered, /Ã.|â€|Â©/); assert.doesNotMatch(source, /Revision Notes|Synopsis|Internal synopsis|---\s*\n/);
  assert.equal(generatedPdf.warnings.length, 0);
});

test("PDF unsupported glyphs use one grouped informational fallback", "pdf", () => {
  const unsupported = { title: "Fallback", author: "", language: "en", wordCount: 2, sections: [{ id: "one", kind: "body", title: "Body", blocks: [{ kind: "paragraph", inlines: [{ text: "Snow 雪 and snow 雪 remain readable." }], first: true }] }] } as const;
  const generatedPdf = createNativePdf(unsupported as never, options); assert.equal(generatedPdf.warnings.length, 1); assert.equal(generatedPdf.warnings[0].severity, "information"); assert.equal(generatedPdf.warnings[0].code, "pdf-unsupported-glyphs"); assert.match(recoverNativePdfText(generatedPdf.bytes), /Snow \? and snow \? remain readable/); assert.equal(EXPORT_VALIDATORS.pdf.validate(generatedPdf.bytes).valid, true);
});

test("PDF validator rejects the former identity-CID corruption strategy", "pdf", () => {
  const validPdf = createNativePdf({ title: "Test", author: "", language: "en", wordCount: 1, sections: [{ id: "one", kind: "body", title: "Body", blocks: [{ kind: "paragraph", inlines: [{ text: "Östersund" }], first: true }] }] } as never, options).bytes;
  const corrupted = new TextEncoder().encode(new TextDecoder("latin1").decode(validPdf).replace("/Encoding /WinAnsiEncoding", "/Encoding /Identity-H").replace("/Subtype /Type1", "/Subtype /Type0 /CIDToGIDMap /Identity")); assert.equal(EXPORT_VALIDATORS.pdf.validate(corrupted).valid, false);
  assert.equal(escapePdfLiteral("(test) C:\\Books\nNext\tLine"), "\\(test\\) C:\\\\Books\\nNext\\tLine");
});

test("EPUB 3 has native container, package, navigation, ordered XHTML, no scripts or remote resources", "epub", async () => { const value = await output("epub"); const files = unzipSync(value.bytes); for (const name of ["mimetype", "META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/style.css"]) assert.ok(files[name]); const all = Object.entries(files).filter(([name]) => name.endsWith(".xhtml")).map(([, bytes]) => strFromU8(bytes)).join("\n"); assert.match(all, /Part One/); assert.doesNotMatch(all, /<script\b|(?:src|href)=["']https?:/i); assert.doesNotMatch(all, /Revision Notes|Internal synopsis/); });

test("HTML is standalone, semantic, escaped, offline, and script-free", "html", async () => { const text = strFromU8((await output("html")).bytes); assert.match(text, /^<!doctype html>/); assert.match(text, /<style>[\s\S]+<main>/); assert.match(text, /class="part"/); assert.match(text, /Warden &amp; &lt;Silence&gt; 雪/); assert.doesNotMatch(text, /<script\b|(?:src|href)=["']https?:/i); assert.doesNotMatch(text, /Revision Notes|Internal synopsis/); });

test("XML is deterministic, versioned, hierarchical, escaped, and excludes compiler state", "xml", async () => { const first = await output("xml"); const second = await EXPORTERS.xml.generate({ session, document, options, filename: "Warden.xml" }); assert.deepEqual(first.bytes, second.bytes); const text = strFromU8(first.bytes); assert.match(text, /xmlns="https:\/\/manuscript-compiler\.dev\/schema" schemaVersion="1\.0"/); assert.match(text, /<frontMatter>[\s\S]*<body>[\s\S]*<part[\s\S]*<chapter[\s\S]*<scene order="1">[\s\S]*<backMatter>/); assert.match(text, /Warden &amp; &lt;Silence&gt; 雪/); assert.doesNotMatch(text, /profileId|vaultPath|filePath|<settings>|Revision Notes|Internal synopsis/); });

let passed = 0;
for (const [name, format, action] of tests) { if (selected && format !== "common" && format !== selected) continue; try { await action(); passed += 1; process.stdout.write(`✓ ${name}\n`); } catch (error) { process.stderr.write(`✗ ${name}\n`); throw error; } }
process.stdout.write(`${passed} export tests passed${selected ? ` for ${selected.toUpperCase()}` : ""}.\n`);
