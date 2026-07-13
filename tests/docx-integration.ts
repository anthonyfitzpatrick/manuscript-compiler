import assert from "node:assert/strict";
import { readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { createManuscriptDocx, resolveDocxOptions, structuralLines, type DocxOptions } from "../src/docx";
import { CompilePreparationService } from "../src/compile-preparation";
import { createDefaultProfiles } from "../src/profiles";
import { loadFixtureTree } from "./fixture-loader";
import { validateDocxBytes } from "../src/docx-validator";
import { SafeBinaryWriter, type SafeBinaryBackend } from "../src/safe-binary-writer";
import { centimetresToTwips } from "../src/measurements";

const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence");
const profile = createDefaultProfiles()[1]; profile.useParts = true; profile.chapterSource = "folders"; profile.sceneSeparator = "#"; profile.partDisplay = "word-title"; profile.chapterDisplay = "word-title"; profile.bodySectionAliases = ["Scene", "Manuscript", "Text", "Draft", "Body"];
const session = await new CompilePreparationService(loaded.vault as never, profile, 250).prepareAuthoritative({ manuscriptRoot: loaded.root.path, profile, structurePreset: "novel-parts", purpose: "compile", route: "legacy-profile" });
const { book } = session;
const baseOptions: DocxOptions = { title: "Warden of Silence", author: "Anthony Fitzpatrick", titlePage: true, font: "Times New Roman", fontSize: 12, lineSpacing: 2, firstLineIndentCm: 1.27, partDisplay: "word-title", chapterDisplay: "word-title", chapterPageBreak: true };
const bytes = createManuscriptDocx(book, profile, baseOptions);
assert.equal(validateDocxBytes(bytes).valid, true);
const backend: SafeBinaryBackend = { kind: "filesystem", exists: async (value) => { try { await stat(value); return true; } catch { return false; } }, read: async (value) => new Uint8Array(await readFile(value)), write: async (value, data) => { await writeFile(value, data); }, rename: async (from, to) => { await rename(from, to); }, remove: async (value) => { await rm(value, { force: true }); }, list: async (folder) => (await readdir(folder)).map((name) => ({ path: path.join(folder, name), mtime: 0 })) };
const stages: string[] = []; const outputPath = ".test-build/Warden-of-Silence-regression.docx"; const saved = await new SafeBinaryWriter(backend).writeValidated(outputPath, bytes, { token: "docx-integration", onProgress: (stage) => stages.push(stage) });
assert.equal(saved.finalValidation.valid, true); assert.ok(stages.includes("Verifying temporary file")); assert.ok(stages.includes("Verifying saved DOCX"));
const finalBytes = new Uint8Array(await readFile(outputPath)); assert.equal(validateDocxBytes(finalBytes).valid, true); assert.deepEqual(finalBytes, bytes);
assert.equal((await readdir(".test-build")).some((name) => /Warden-of-Silence-regression\.docx\.manuscript-compiler-.*\.(?:tmp|backup)$/.test(name)), false);
assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
const entries = unzipSync(bytes); for (const required of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "docProps/core.xml"]) assert.ok(entries[required], `Missing ${required}`);
const document = strFromU8(entries["word/document.xml"]); const styles = strFromU8(entries["word/styles.xml"]); const core = strFromU8(entries["docProps/core.xml"]);
for (const style of ["Title", "Author", "PartNumber", "PartTitle", "ChapterNumber", "ChapterTitle", "BodyText", "FirstParagraph", "SceneBreak", "FrontMatterHeading", "BackMatterHeading"]) assert.match(styles, new RegExp(`w:styleId="${style}"`), `Missing ${style}`);
assert.doesNotMatch(styles, /w:styleId="Subtitle"/);
assert.match(document, /w:pStyle w:val="Title"[\s\S]*?Warden of Silence/); assert.match(document, /w:pStyle w:val="Author"[\s\S]*?Anthony Fitzpatrick/);
assert.match(document, /w:pStyle w:val="PartNumber"[\s\S]*?Part One/); assert.match(document, /w:pStyle w:val="PartTitle"[\s\S]*?The Silence Breaks/);
assert.match(document, /w:pStyle w:val="ChapterNumber"[\s\S]*?Chapter One/); assert.match(document, /w:pStyle w:val="ChapterTitle"[\s\S]*?The Silence of Östersund/);
assert.match(document, /w:pStyle w:val="SceneBreak"[\s\S]*?#/); assert.match(document, /w:pStyle w:val="FirstParagraph"[\s\S]*?Östersund was silent/); assert.match(document, /w:pStyle w:val="BodyText"[\s\S]*?The barn answered/);
assert.match(document, /winter stars—too silent/); assert.match(document, /“Listen,”/); assert.match(document, /Östersund/);
for (const forbidden of ["Part: Archive", "Part: Development", "Part: Exports", "Part 0: Manuscript", "Chapter 0: Book 1 - Warden of Silence", "Warden of Silence Dashboard", "The Watchers of Silence Series Dashboard", "Revision Notes", "Internal synopsis", "Editing Status", "Character Notes", "Previous Export"]) assert.doesNotMatch(document, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), forbidden);
assert.ok(document.indexOf("Copyright ©") < document.indexOf("Part One")); assert.ok(document.indexOf("Part Two") < document.indexOf("With gratitude"));
assert.match(core, /Warden of Silence/);

const paragraphs = (xml: string, style: string): string[] => [...xml.matchAll(new RegExp(`<w:p><w:pPr><w:pStyle w:val="${style}"\/>[\\s\\S]*?<\\/w:p>`, "g"))].map((match) => match[0]);
const paragraphText = (xml: string): string => xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'");
const documentFor = (options: Partial<DocxOptions> = {}, selectedProfile = profile, selectedBook = book): string => strFromU8(unzipSync(createManuscriptDocx(selectedBook, selectedProfile, { ...baseOptions, ...options }))["word/document.xml"]);
const stylesFor = (options: Partial<DocxOptions> = {}): string => strFromU8(unzipSync(createManuscriptDocx(book, profile, { ...baseOptions, ...options }))["word/styles.xml"]);

const breaksEnabled = documentFor({ chapterPageBreak: true });
assert.ok(paragraphs(breaksEnabled, "ChapterNumber").every((item) => item.includes("<w:pageBreakBefore/>")));
const breaksDisabled = documentFor({ chapterPageBreak: false });
assert.ok(paragraphs(breaksDisabled, "ChapterNumber").every((item) => !item.includes("<w:pageBreakBefore/>")));
assert.ok(paragraphs(breaksDisabled, "PartNumber").every((item) => item.includes("<w:pageBreakBefore/>")));
assert.doesNotMatch(breaksEnabled, /<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p>/);
assert.match(breaksEnabled, /w:pStyle w:val="ChapterNumber"\/><w:pageBreakBefore\/><w:keepNext\/>/);
assert.ok(paragraphs(breaksEnabled, "PartNumber").every((item) => item.includes("<w:keepNext/>")));
assert.ok(paragraphs(breaksEnabled, "PartTitle").every((item) => !item.includes("<w:keepNext/>")));
const titleThenPart = documentFor({}, profile, { ...book, frontMatter: { ...book.frontMatter, documents: [] } });
assert.ok(!paragraphs(titleThenPart, "PartNumber")[0].includes("<w:pageBreakBefore/>"));
assert.match(paragraphs(titleThenPart, "Author")[0], /w:br w:type="page"/);

for (const mode of ["word", "numeric", "word-title", "numeric-title", "title", "custom"] as const) {
  const chapterXml = documentFor({ chapterDisplay: mode });
  const [numberLine, titleLine] = structuralLines("Chapter", book.parts[0].chapters[0], mode, profile.chapterHeadingTemplate);
  if (numberLine) assert.ok(paragraphs(chapterXml, "ChapterNumber").some((item) => paragraphText(item).includes(numberLine)), `Chapter mode ${mode} number`);
  if (titleLine) assert.ok(paragraphs(chapterXml, "ChapterTitle").some((item) => paragraphText(item).includes(titleLine)), `Chapter mode ${mode} title`);
  const first = numberLine ? paragraphs(chapterXml, "ChapterNumber")[0] : paragraphs(chapterXml, "ChapterTitle")[0];
  assert.match(first, /w:pageBreakBefore/);
  const partXml = documentFor({ partDisplay: mode });
  const [partNumber, partTitle] = structuralLines("Part", book.parts[0], mode, profile.partHeadingTemplate);
  if (partNumber) assert.ok(paragraphs(partXml, "PartNumber").some((item) => paragraphText(item).includes(partNumber)), `Part mode ${mode} number`);
  if (partTitle) assert.ok(paragraphs(partXml, "PartTitle").some((item) => paragraphText(item).includes(partTitle)), `Part mode ${mode} title`);
}
const unnumberedChapter = { ...book.parts[0].chapters[0], number: undefined, name: "Unnumbered Arrival", title: "Unnumbered Arrival" };
const unnumberedPart = { ...book.parts[0], number: undefined, name: "Interlude", title: "Interlude", chapters: [unnumberedChapter] };
const unnumberedBook = { ...book, parts: [unnumberedPart] };
const unnumberedXml = documentFor({}, profile, unnumberedBook);
assert.doesNotMatch(unnumberedXml, /Part 0|Chapter 0/);
assert.match(unnumberedXml, /w:pStyle w:val="PartTitle"[\s\S]*?Interlude/);
assert.match(unnumberedXml, /w:pStyle w:val="ChapterTitle"[\s\S]*?Unnumbered Arrival/);
const numberOnlyPart = { ...book.parts[0], name: "Part 1", title: "Part 1", chapters: [] };
const numberOnlyPartXml = documentFor({}, profile, { ...book, frontMatter: { ...book.frontMatter, documents: [] }, parts: [numberOnlyPart], backMatter: { ...book.backMatter, documents: [] } });
assert.equal(paragraphs(numberOnlyPartXml, "PartNumber").length, 1);
assert.equal(paragraphs(numberOnlyPartXml, "PartTitle").length, 0);

for (const separator of ["#", "*", "***", "* * *"] as const) { const sceneBreak = paragraphs(documentFor({ sceneSeparator: separator }), "SceneBreak"); assert.equal(sceneBreak.length, 1); assert.equal(paragraphText(sceneBreak[0]), separator); }
assert.equal(paragraphs(documentFor({ sceneSeparator: "§ & <雪>" }), "SceneBreak").length, 1);
assert.match(documentFor({ sceneSeparator: "§ & <雪>" }), /§ &amp; &lt;雪&gt;/);
const blankBreak = paragraphs(documentFor({ sceneSeparator: "" }), "SceneBreak");
assert.equal(blankBreak.length, 1);
assert.equal(paragraphText(blankBreak[0]), "");
const oneSceneBook = { ...book, parts: book.parts.map((part, partIndex) => ({ ...part, chapters: part.chapters.map((chapter) => ({ ...chapter, scenes: partIndex === 0 ? chapter.scenes.slice(0, 1) : chapter.scenes })) })) };
assert.equal(paragraphs(documentFor({}, profile, oneSceneBook), "SceneBreak").length, 0);
const excludedScene = { ...book.parts[0].chapters[0].scenes[0], title: "Excluded", excluded: true };
const emptyScene = { ...book.parts[0].chapters[0].scenes[0], title: "Empty", content: "" };
const filteredBook = { ...book, parts: [{ ...book.parts[0], chapters: [{ ...book.parts[0].chapters[0], scenes: [book.parts[0].chapters[0].scenes[0], excludedScene, emptyScene, book.parts[0].chapters[0].scenes[1]] }] }] };
assert.equal(paragraphs(documentFor({}, profile, filteredBook), "SceneBreak").length, 1);

const proseStyles = documentFor();
assert.match(proseStyles, /w:pStyle w:val="ChapterTitle"[\s\S]*?w:pStyle w:val="FirstParagraph"[\s\S]*?Östersund was silent/);
assert.match(proseStyles, /w:pStyle w:val="SceneBreak"[\s\S]*?w:pStyle w:val="FirstParagraph"[\s\S]*?The barn door opened/);
assert.match(proseStyles, /w:pStyle w:val="FirstParagraph"[\s\S]*?Östersund was silent[\s\S]*?w:pStyle w:val="BodyText"/);

const noTitlePage = documentFor({ titlePage: false });
assert.equal(paragraphs(noTitlePage, "Title").length, 0);
assert.equal(paragraphs(noTitlePage, "Author").length, 0);
const escapedTitle = documentFor({ title: "Fish & <Stars> 雪", author: "A & B", titlePage: true });
assert.match(escapedTitle, /Fish &amp; &lt;Stars&gt; 雪/);
assert.match(escapedTitle, /A &amp; B/);
assert.match(paragraphs(escapedTitle, "Author")[0], /w:br w:type="page"/);

const toc = documentFor({ tableOfContents: true });
assert.match(toc, /w:instrText[^>]*> TOC \\o "1-3" \\h \\z \\u <\/w:instrText>/);
assert.match(toc, /w:fldChar w:fldCharType="begin"/);
assert.doesNotMatch(documentFor({ tableOfContents: false }), /w:instrText[^>]*> TOC/);

assert.match(documentFor({ pageSize: "letter" }), /w:pgSz w:w="12240" w:h="15840"/);
assert.match(documentFor({ pageSize: "a4" }), /w:pgSz w:w="11906" w:h="16838"/);
const customStyles = stylesFor({ font: "Georgia", fontSize: 13, lineSpacing: 1.5, firstLineIndentCm: 0.635 });
assert.match(customStyles, /w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/);
assert.match(customStyles, /w:sz w:val="26"/);
assert.match(customStyles, /w:spacing w:after="0" w:line="360" w:lineRule="auto"/);
assert.match(customStyles, /w:styleId="BodyText"[\s\S]*?w:ind w:firstLine="360"/);
assert.match(customStyles, /w:styleId="FirstParagraph"[\s\S]*?w:ind w:firstLine="0"/);
assert.match(stylesFor({ firstLineIndentCm: 0.75 }), /w:styleId="BodyText"[\s\S]*?w:ind w:firstLine="425"/);
assert.match(stylesFor({ firstLineIndentCm: 1.27 }), /w:styleId="BodyText"[\s\S]*?w:ind w:firstLine="720"/);
assert.equal(centimetresToTwips(0.75), 425); assert.equal(centimetresToTwips(1.27), 720); assert.equal(centimetresToTwips(2.54), 1440);
assert.match(documentFor({ pageSize: "a4" }), /w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/);
assert.deepEqual(resolveDocxOptions({ title: "x", author: "y", font: "", fontSize: 100, lineSpacing: -2, firstLineIndentCm: 9, pageSize: "a4" }), { title: "x", author: "y", font: "Times New Roman", fontSize: 24, lineSpacing: 0.8, firstLineIndentCm: 3.81, pageSize: "a4", chapterPageBreak: true, titlePage: false, tableOfContents: false });
assert.equal(resolveDocxOptions({ title: "x", author: "y" }).pageSize, "a4");

const richScene = { ...book.parts[0].chapters[0].scenes[0], content: "**bold** *italic* ***both*** [readable link](https://example.invalid) `code` & <angle> “smart”—Östersund 雪" };
const richBook = { ...book, parts: [{ ...book.parts[0], chapters: [{ ...book.parts[0].chapters[0], scenes: [richScene] }] }] };
const richXml = documentFor({}, profile, richBook);
assert.match(richXml, /<w:b\/>[\s\S]*?bold/);
assert.match(richXml, /<w:i\/>[\s\S]*?italic/);
assert.match(richXml, /<w:b\/><w:i\/>[\s\S]*?both/);
assert.match(richXml, /readable link/);
assert.doesNotMatch(richXml, /example\.invalid/);
assert.match(richXml, /&amp; &lt;angle&gt; “smart”—Östersund 雪/);

const realVault = await loadFixtureTree("tests/fixtures/real-vault/Book 1 - Warden of Silence");
const realProfile = createDefaultProfiles()[1]; realProfile.sceneSeparator = "#"; realProfile.partDisplay = "word-title"; realProfile.chapterDisplay = "word-title";
const realSession = await new CompilePreparationService(realVault.vault as never, realProfile, 250).prepareAuthoritative({ manuscriptRoot: realVault.root.path, profile: realProfile, structurePreset: "novel-parts", purpose: "compile", route: "selected-folder" });
assert.equal(realSession.book.parts.length, 1); assert.equal(realSession.statistics.chapterCount, 1); assert.equal(realSession.statistics.sceneCount, 3); assert.equal(realSession.book.orphanScenes.length, 0); assert.equal(realSession.book.parts[0].orphanScenes.length, 0);
const realBytes = createManuscriptDocx(realSession.book, realSession.profile, { title: "Warden of Silence", author: "Anthony Fitzpatrick", titlePage: true, sceneSeparator: "#", partDisplay: "word-title", chapterDisplay: "word-title" });
assert.equal(validateDocxBytes(realBytes).valid, true);
const realDocument = strFromU8(unzipSync(realBytes)["word/document.xml"]);
assert.match(realDocument, /w:pStyle w:val="PartNumber"[\s\S]*?Part One/); assert.match(realDocument, /w:pStyle w:val="ChapterNumber"[\s\S]*?Chapter One/);
assert.ok(realDocument.indexOf("Copyright ebook edition") < realDocument.indexOf("Part One")); assert.ok(realDocument.indexOf("The answer arrived without warning") < realDocument.indexOf("About the Author"));
for (const matter of ["About the Author", "Acknowledgments", "Also by Anthony Fitzpatrick", "Back Cover Blurb"]) { const paragraph = [...realDocument.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].find((match) => match[0].includes(matter))?.[0] ?? ""; assert.doesNotMatch(paragraph, /w:pStyle w:val="(?:PartNumber|ChapterNumber)"/, matter); }
assert.doesNotMatch(realDocument, />Manuscript<|>Front and back matter<|>Copyright notices<|Revision Notes|Internal summary/);
process.stdout.write(`Built-in Warden regression DOCX passed (${bytes.length.toLocaleString()} bytes); wrote .test-build/Warden-of-Silence-regression.docx.\n`);
