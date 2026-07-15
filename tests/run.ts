/**
 * Core and release-regression suite.
 * Protects parsing, cleaning, inference, migration, prepared-session identity,
 * route unification, workspace state, real-vault structure, privacy, and package
 * invariants from drifting independently.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cleanManuscriptContent, ContentCleaningPipeline, removeCallouts, removeDataviewBlocks, removeHtmlComments, removeObsidianComments, removeProjectMetadataRegions, stripInternalLinks, stripYamlFrontmatter } from "../src/filters";
import { MarkdownGenerator } from "../src/markdown-generator";
import { MetadataFilterEngine } from "../src/metadata-filter";
import type { Book, ManuscriptDocument } from "../src/model";
import { extractNumber, sortDocuments, titleName } from "../src/ordering";
import { ManuscriptParser, mapConcurrent } from "../src/parser";
import { createDefaultProfiles } from "../src/profiles";
import { StatisticsEngine } from "../src/statistics";
import { TemplateEngine } from "../src/template-engine";
import { WarningEngine } from "../src/warnings";
import { ManuscriptValidationService } from "../src/validation";
import { DiagnosticsReportGenerator, redactTechnicalMessage } from "../src/diagnostics";
import { DEFAULT_SETTINGS } from "../src/settings";
import { repairSettings } from "../src/profiles";
import { profileFromWizard } from "../src/wizards";
import { loadFixtureScan, loadFixtureTree } from "./fixture-loader";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { TFile, TFolder } from "obsidian";
import { VaultScanner } from "../src/vault-scanner";
import { exportFilename } from "../src/export-filename";
import { CompilationCancelledError } from "../src/cancellation";
import { DOCX_FORMATTING_PRESETS, docxFormattingForPreset, inferStructurePreset, resolveSimpleCompileRequest, validateSimpleCompileRequest } from "../src/simple-workflow";
import type { SimpleCompileRequest } from "../src/simple-workflow";
import { canProceedWithExport } from "../src/export-safety";
import { applyContentPlan, classifyContentPlan, createContentPlan, type ContentPlanItem } from "../src/content-plan";
import { calculateSourceFingerprint, compileInputSignature, CompilePreparationService, createPreparedExportRequest, preparedSessionMatchesInputs } from "../src/compile-preparation";
import { createManuscriptDocx } from "../src/docx";
import { strFromU8, unzipSync } from "fflate";
import { COMMAND_IDS } from "../src/commands";
import { BookRootResolver } from "../src/book-root-resolver";
import { CompileWorkspaceController } from "../src/workspace/compile-workspace-controller";
import { buildExportPreviewViewModel } from "../src/workspace/export-preview";
import { isEffectivelyIncluded, moveSibling, setItemIncluded } from "../src/workspace/content-tree";
import { changedRowPaths, snapshotRows } from "../src/workspace/contents-step";
import { ContentsTreeViewState } from "../src/workspace/contents-tree-view-state";
import { formatAfterKey, supportsParagraphIndentation } from "../src/workspace/create-docx-step";
import { OperationStateController } from "../src/operation-state";
import { CompileHistoryService } from "../src/compile-history";
import { centimetresToInches, centimetresToTwips, clampCentimetres, inchesToCentimetres, twipsToCentimetres } from "../src/measurements";
import { addCompileFolderMenuItem, COMPILE_FOLDER_MENU_TITLE } from "../src/folder-context-menu";
import { WORKSPACE_STEPS } from "../src/workspace/workspace-types";
import { attentionWarnings, cleanBookTitle, folderIdentity, ignoredGroups, informationMessages, manuscriptPlanSummary, resolveAuthor, resolveBookTitle, reviewItems, showUseCurrentFolder, warningCategories } from "../src/workspace/workspace-view-model";
import { createTestDocx } from "./docx-test-fixture";

const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, action: () => void | Promise<void>): void => { tests.push([name, action]); };
const execFileAsync = promisify(execFile);
async function sourceFiles(folder: string): Promise<string[]> { const entries = await readdir(folder, { withFileTypes: true }); const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(path.join(folder, entry.name)) : Promise.resolve(entry.name.endsWith(".ts") ? [path.join(folder, entry.name)] : []))); return nested.flat(); }
const file = (name: string, content: string, metadata: Record<string, unknown> = {}): ManuscriptDocument => ({ file: { name: `${name}.md`, basename: name, path: `Book/${name}.md` } as never, title: name, number: extractNumber(name), metadata: { values: metadata }, content, excluded: false });
const preparedRequest = (root: string, plan: ReturnType<typeof createContentPlan>): SimpleCompileRequest => ({ manuscriptRoot: root, structurePreset: "novel-parts", includeFrontMatter: true, includeBackMatter: true, exportFolder: "", outputFilename: "Warden of Silence.docx", outputFormat: "docx", docxPreset: "vellum", contentPlan: plan, formatting: { font: "Times New Roman", fontSize: 12, lineSpacing: 2, indentParagraphs: true, firstLineIndentCm: 1.27, pageSize: "a4", chapterPageBreak: true, titlePage: true }, tableOfContents: false, partDisplay: "word-title", chapterDisplay: "word-title", custom: { variables: { BookTitle: "Warden of Silence", Author: "Anthony Fitzpatrick" }, bodySectionAliases: ["Scene", "Manuscript", "Text", "Draft", "Body"] } });

test("template engine resolves known and unknown variables", () => assert.equal(new TemplateEngine().render("{BookTitle} — {Unknown}", { BookTitle: "North" }), "North —"));
test("internal links retain visible text", () => assert.equal(stripInternalLinks("[[People/Elin|Elin Andersson]] met [[Noah]]."), "Elin Andersson met Noah."));
test("cleaning pipeline removes optional plugin syntax without plugin APIs", () => { const profile = createDefaultProfiles()[0]; profile.removeDataviewBlocks = true; profile.removeCallouts = true; const output = new ContentCleaningPipeline().clean("> [!note] Note\n> Body\n\n```dataview\nTABLE x\n```", profile); assert.equal(output.trim(), "Body"); });
test("callouts convert to plain text while ordinary blockquotes remain quoted", () => {
  const callout = "> [!note]+ Author note\n> First line.\n> Second line.\n>> Nested quoted line.\n\n> Ordinary quotation.";
  assert.equal(removeCallouts(callout), "First line.\nSecond line.\n> Nested quoted line.\n\n> Ordinary quotation.");
  const profile = createDefaultProfiles()[0]; profile.removeCallouts = false;
  assert.match(new ContentCleaningPipeline().clean(callout, profile), /\[!note\]\+ Author note/);
});
test("metadata equality and inequality filters", () => { const engine = new MetadataFilterEngine(); const metadata = { values: { pov: "Elin", editingstatus: "Complete" } }; assert.equal(engine.matches(metadata, [{ id: "1", field: "POV", operator: "equals", value: "Elin" }]).included, true); assert.equal(engine.matches(metadata, [{ id: "2", field: "Editing Status", operator: "not-equals", value: "Complete" }]).included, false); });
test("ordering prioritizes metadata then numeric names", () => { const a = file("Scene 10", "a", { scene: 10 }); const b = file("Scene 2", "b", { scene: 2 }); a.metadata.scene = 10; b.metadata.scene = 2; sortDocuments([a, b], true); assert.equal([a, b].sort(() => 0)[0].title, "Scene 10"); const docs = [a, b]; sortDocuments(docs, true); assert.equal(docs[0].title, "Scene 2"); });
test("number extraction handles padded, word, punctuation, Unicode, and long names", () => { assert.equal(extractNumber("Chapter 01"), 1); assert.equal(extractNumber("Chapter One"), 1); assert.equal(extractNumber("Chapter 10: Ωmega"), 10); assert.equal(extractNumber(`Chapter 42 — ${"Long ".repeat(40)}Title`), 42); assert.equal(titleName("Chapter Twenty-One: Return"), "Return"); assert.equal(titleName("Chapter One"), ""); assert.equal(titleName("Part 1 - The Silence Breaks"), "The Silence Breaks"); assert.equal(titleName("Chapter 01 - Title"), "Title"); assert.equal(titleName("01 Chapter Title"), "Title"); assert.equal(titleName("01 Opening Scene"), "Opening Scene"); });
test("scanner ignores hidden files and retains nested unexpected Markdown", () => { const markdown = Object.assign(new TFile(), { name: "Nested.md", path: "Book/Part 1/Chapter 1/Extra/Nested.md", extension: "md", basename: "Nested" }); const hidden = Object.assign(new TFile(), { name: ".hidden.md", path: "Book/Part 1/.hidden.md", extension: "md", basename: ".hidden" }); const extra = Object.assign(new TFolder(), { name: "Extra", path: "Book/Part 1/Chapter 1/Extra", children: [markdown] }); const chapter = Object.assign(new TFolder(), { name: "Chapter 1", path: "Book/Part 1/Chapter 1", children: [extra] }); const part = Object.assign(new TFolder(), { name: "Part 1", path: "Book/Part 1", children: [chapter, hidden] }); const root = Object.assign(new TFolder(), { name: "Book", path: "Book", children: [part] }); const scan = new VaultScanner().scan(root as never); assert.equal(scan.allMarkdown.length, 1); assert.equal(scan.allMarkdown[0].name, "Nested.md"); });
test("parser reads metadata and excludes matching status", async () => { const source = "---\nScene: 1\nEditing Status: Excluded\n---\nBody"; const fakeFile = { path: "Book/Part 1/Chapter 1/Scene 1.md", name: "Scene 1.md", basename: "Scene 1" } as never; const vault = { cachedRead: async () => source } as never; const scan = { root: { name: "Book", path: "Book" }, frontMatter: [], backMatter: [], looseScenes: [], parts: [{ folder: { name: "Part 1", path: "Book/Part 1" }, looseScenes: [], chapters: [{ folder: { name: "Chapter 1", path: "Book/Part 1/Chapter 1" }, scenes: [fakeFile] }] }], allMarkdown: [fakeFile], warnings: [] } as never; const book = await new ManuscriptParser(vault).parse(scan, createDefaultProfiles()[0]); assert.equal(book.parts[0].chapters[0].scenes[0].excluded, true); });
test("parser reports invalid metadata without aborting or retaining YAML details", async () => { const fakeFile = { path: "Book/Part 1/Chapter 1/Scene 1.md", name: "Scene 1.md", basename: "Scene 1" } as never; const vault = { cachedRead: async () => "---\ninvalid yaml SecretCharacter\n---\nBody" } as never; const scan = { root: { name: "Book", path: "Book" }, frontMatter: [], backMatter: [], looseScenes: [], parts: [{ folder: { name: "Part 1", path: "Book/Part 1" }, looseScenes: [], chapters: [{ folder: { name: "Chapter 1", path: "Book/Part 1/Chapter 1" }, scenes: [fakeFile] }] }], allMarkdown: [fakeFile], warnings: [] } as never; const book = await new ManuscriptParser(vault).parse(scan, createDefaultProfiles()[0]); assert.ok(book.warnings.some((warning) => warning.includes("Invalid metadata"))); assert.doesNotMatch(JSON.stringify(book.warnings), /SecretCharacter|invalid yaml/); });
test("parser supports chapter notes in manuscripts without Parts", async () => { const chapterFile = { path: "Book/Chapter 1.md", name: "Chapter 1.md", basename: "Chapter 1" } as never; const vault = { cachedRead: async () => "---\nChapter: 1\n---\nChapter prose" } as never; const scan = { root: { name: "Book", path: "Book" }, frontMatter: [], backMatter: [], looseScenes: [chapterFile], parts: [], allMarkdown: [chapterFile], warnings: [] } as never; const profile = createDefaultProfiles()[0]; profile.useParts = false; profile.chapterSource = "notes"; const book = await new ManuscriptParser(vault).parse(scan, profile); assert.equal(book.parts[0].chapters[0].title, "Chapter 1"); const stats = new StatisticsEngine().calculate(book, profile, 250); assert.match(new MarkdownGenerator().generate(book, profile, stats), /^## Chapter 1/); });
test("bounded concurrency processes every item", async () => { const seen: number[] = []; await mapConcurrent([1, 2, 3, 4], 2, async (value) => { seen.push(value); }); assert.deepEqual(seen.sort(), [1, 2, 3, 4]); });
test("bounded parsing cancels without processing the remaining queue", async () => { const controller = new AbortController(); const seen: number[] = []; await assert.rejects(mapConcurrent([1, 2, 3, 4], 1, async (value) => { seen.push(value); controller.abort(); }, controller.signal), CompilationCancelledError); assert.deepEqual(seen, [1]); });
test("statistics and Markdown generation are deterministic", () => { const scene = file("Scene 1", "one two three"); const profile = createDefaultProfiles()[0]; const book = { root: { path: "Book", name: "Book" }, title: "Book", frontMatter: { kind: "front", title: "Front Matter", documents: [] }, parts: [{ title: "Part 1", name: "Part 1", number: 1, path: "Book/Part 1", chapters: [{ title: "Chapter 1", name: "Chapter 1", number: 1, path: "Book/Part 1/Chapter 1", scenes: [scene], orphan: false }], orphanScenes: [] }], orphanScenes: [], backMatter: { kind: "back", title: "Back Matter", documents: [] }, includedFiles: [scene.file], excludedFiles: [], warnings: [], issues: [] } as Book; const stats = new StatisticsEngine().calculate(book, profile, 250); assert.equal(stats.totalWordCount, 3); const generator = new MarkdownGenerator(); const date = new Date("2026-01-02T00:00:00Z"); assert.equal(generator.generate(book, profile, stats, date), generator.generate(book, profile, stats, date)); assert.match(generator.generate(book, profile, stats, date), /^# Part 1/); const issues = new WarningEngine().analyze(book, profile, "Exports/Book.md"); assert.ok(issues.some((issue) => issue.code === "missing-front-matter")); });
test("download filenames repair reserved names, strip paths, and correct extensions", () => { assert.equal(exportFilename("Östersund 雪.docx", "docx"), "Östersund 雪.docx"); assert.equal(exportFilename("CON.docx", "docx"), "_CON.docx"); assert.equal(exportFilename("Bad\u0001Name. .docx", "docx"), "Bad-Name.docx"); assert.equal(exportFilename("folder/book.docx", "markdown"), "book.md"); assert.equal(exportFilename("book.HTML", "html"), "book.html"); });
test("invalid configuration blocks every format while structural findings remain reviewable", () => { assert.equal(canProceedWithExport([{ severity: "error", code: "invalid-profile", message: "unsafe" }]), false); assert.equal(canProceedWithExport([{ severity: "error", code: "structure", message: "review" }]), true); assert.equal(canProceedWithExport([]), true); });
test("native DOCX defaults require no desktop or Pandoc state", () => { assert.equal(DEFAULT_SETTINGS.defaultExportFormat, "docx"); assert.equal(DEFAULT_SETTINGS.defaultDocxStyle, "vellum"); assert.equal(DEFAULT_SETTINGS.automaticallyDetectPandoc, false); });
for (const preset of ["novel-parts", "novel", "chapter-notes", "short-story", "anthology", "custom"] as const) test(`simple workflow resolves ${preset}`, () => { const base = createDefaultProfiles()[0]; const profile = resolveSimpleCompileRequest({ manuscriptRoot: "Books/Test", structurePreset: preset, includeFrontMatter: true, includeBackMatter: false, exportFolder: "Exports", outputFilename: "Test.docx", outputFormat: "docx", docxPreset: "vellum", custom: { useParts: false, chapterSource: "folders" } }, base); assert.equal(profile.manuscriptRoot, "Books/Test"); assert.equal(profile.exportFolder, "Exports"); assert.equal(profile.exportTarget, "docx"); assert.equal(profile.referenceDocx, ""); });
test("Vellum preset applies safe cleaning and readable links", () => { const profile = resolveSimpleCompileRequest({ manuscriptRoot: "Book", structurePreset: "novel-parts", includeFrontMatter: true, includeBackMatter: true, exportFolder: "Exports", outputFilename: "Book.docx", outputFormat: "docx", docxPreset: "vellum" }, createDefaultProfiles()[0]); assert.equal(profile.removeDataviewBlocks, true); assert.equal(profile.removeCallouts, true); assert.equal(profile.stripInternalLinks, true); assert.equal(profile.generateTableOfContents, false); assert.equal(profile.sceneSeparator, "#"); assert.equal(profile.docxPageSize, "a4"); assert.equal(profile.docxIndentParagraphs, true); assert.equal(profile.docxFirstLineIndentCm, 0.75); });
test("TOC selection survives preset resolution as a real compile-request choice", () => { const profile = resolveSimpleCompileRequest({ manuscriptRoot: "Book", structurePreset: "novel-parts", includeFrontMatter: true, includeBackMatter: true, exportFolder: "Exports", outputFilename: "Book.docx", outputFormat: "docx", docxPreset: "vellum", tableOfContents: true }, createDefaultProfiles()[0]); assert.equal(profile.generateTableOfContents, true); });
test("Standard DOCX preset uses conventional filename ordering", () => { const profile = resolveSimpleCompileRequest({ manuscriptRoot: "Book", structurePreset: "novel", includeFrontMatter: true, includeBackMatter: true, exportFolder: "Exports", outputFilename: "Book.docx", outputFormat: "docx", docxPreset: "standard" }, createDefaultProfiles()[0]); assert.equal(profile.orderingMethod, "filename"); assert.equal(profile.stripYamlFrontmatter, true); assert.equal(profile.sceneSeparator, "* * *"); assert.equal(profile.docxPageSize, "a4"); });
test("Vellum, Standard, and Custom DOCX formatting resolve deterministically", () => {
  assert.deepEqual(docxFormattingForPreset("vellum"), DOCX_FORMATTING_PRESETS.vellum);
  assert.deepEqual(docxFormattingForPreset("standard"), DOCX_FORMATTING_PRESETS.standard);
  assert.deepEqual(docxFormattingForPreset("vellum"), docxFormattingForPreset("vellum"));
  const custom = { font: "Georgia", fontSize: 13, lineSpacing: 1.5, indentParagraphs: false, firstLineIndentCm: 0.75, pageSize: "a4" as const, chapterPageBreak: false, titlePage: true };
  assert.deepEqual(docxFormattingForPreset("custom", true, custom), custom);
  assert.equal(DOCX_FORMATTING_PRESETS.vellum.chapterPageBreak, true);
  assert.equal(DOCX_FORMATTING_PRESETS.standard.chapterPageBreak, true);
  assert.equal(DOCX_FORMATTING_PRESETS.standard.fontSize, 12);
  assert.equal(DOCX_FORMATTING_PRESETS.standard.lineSpacing, 2);
  assert.equal(DOCX_FORMATTING_PRESETS.vellum.indentParagraphs, true); assert.equal(DOCX_FORMATTING_PRESETS.standard.indentParagraphs, true);
  assert.equal(DOCX_FORMATTING_PRESETS.vellum.pageSize, "a4"); assert.equal(DOCX_FORMATTING_PRESETS.standard.pageSize, "a4");
});

test("metric formatting conversions are stable and constrained", () => {
  assert.equal(centimetresToTwips(0.75), 425); assert.equal(centimetresToTwips(1.27), 720); assert.equal(centimetresToTwips(2.54), 1440);
  assert.equal(inchesToCentimetres(0.5), 1.27); assert.equal(centimetresToInches(2.54), 1); assert.equal(twipsToCentimetres(720), 1.27);
  assert.equal(clampCentimetres(-1, 0, 3.81, 1.27), 0); assert.equal(clampCentimetres(99, 0, 3.81, 1.27), 3.81); assert.equal(clampCentimetres(Number.NaN, 0, 3.81, 1.27), 1.27);
});
test("scene-break preset selection is distinct and Custom retains its choice", () => {
  const root = "Book"; const plan: ContentPlanItem[] = [{ path: `${root}/Scene.md`, parentPath: root, name: "Scene", kind: "note", role: "scene", included: true, order: 0 }]; const request = preparedRequest(root, plan); request.custom!.sceneSeparator = "§";
  const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDocxPreset("vellum"); assert.equal(request.custom?.sceneSeparator, "§"); controller.setDocxPreset("standard"); assert.equal(request.custom?.sceneSeparator, "§"); controller.setDocxPreset("custom"); assert.equal(request.custom?.sceneSeparator, "§");
});
test("simple workflow validates missing folders and invalid filenames", () => { const request = { manuscriptRoot: "", structurePreset: "novel" as const, includeFrontMatter: true, includeBackMatter: true, exportFolder: "Exports", outputFilename: "bad/name.docx", outputFormat: "docx" as const, docxPreset: "standard" as const }; const errors = validateSimpleCompileRequest(request); assert.ok(errors.some((item) => /folder/i.test(item))); assert.ok(errors.some((item) => /filename/i.test(item))); });
test("custom workflow preserves advanced profile options", () => { const base = createDefaultProfiles()[0]; base.metadataFilters = [{ id: "1", field: "POV", operator: "equals", value: "Elin" }]; const profile = resolveSimpleCompileRequest({ manuscriptRoot: "Book", structurePreset: "custom", includeFrontMatter: true, includeBackMatter: true, exportFolder: "Exports", outputFilename: "Book.docx", outputFormat: "docx", docxPreset: "custom", custom: { sceneSeparator: "***" } }, base); assert.equal(profile.sceneSeparator, "***"); assert.equal(profile.metadataFilters.length, 1); });
test("structure inference preserves existing layout", () => { const profile = createDefaultProfiles()[0]; profile.useParts = false; profile.chapterSource = "notes"; assert.equal(inferStructurePreset(profile), "chapter-notes"); });
test("content cleaners cover YAML, comments, Dataview, callouts, links, embeds, blocks, and line endings", () => { assert.equal(stripYamlFrontmatter("---\r\ntitle: Test\r\n---\r\nBody"), "Body"); assert.equal(removeHtmlComments("A<!-- x -->B"), "AB"); assert.equal(removeObsidianComments("A%% x %%B"), "AB"); assert.equal(removeDataviewBlocks("A\n```dataviewjs\nx\n```\nB"), "A\nB"); assert.equal(removeCallouts("> [!note] Title\n> Body\n\n> Ordinary"), "Body\n\n> Ordinary"); assert.equal(stripInternalLinks("[[Note]] [[Folder/Note|Alias]] [[Note#^block]] ![[image.png]] ![[Embedded Note]]"), "Note Alias Note image.png Embedded Note"); });
test("manuscript metadata cleaning removes exact leaked property formats only at structured boundaries", () => { const source = "**Series:** The Watchers of Silence Series Dashboard\nBook:: [[Warden of Silence Dashboard]]\nPart: Part 1 - The Silence Breaks\nChapter: Chapter 1 - The Silence of Östersund\nScene Number: 2\nCharacters:\n  - Henrik\n\nActual prose begins with Book in an ordinary sentence.\n\nEditing Status: Included"; const cleaned = removeProjectMetadataRegions(source); assert.equal(cleaned, "Actual prose begins with Book in an ordinary sentence."); assert.doesNotMatch(cleaned, /Dashboard|Part 1|Chapter 1|Henrik|Editing Status/); });
test("scene body extraction omits synopsis and revision sections", () => { const source = "---\nBook: Warden of Silence Dashboard\n---\n# Synopsis\nInternal synopsis.\n# Scene\nActual manuscript prose.\n# Revision Notes\nInternal revision notes."; assert.equal(cleanManuscriptContent(source), "Actual manuscript prose."); });
test("validation engine reports the prepared semantic manuscript without export", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const profile = createDefaultProfiles()[0]; profile.partHeadingTemplate = ""; const service = new CompilePreparationService(loaded.vault as never, profile, 250); const session = await service.prepareAuthoritative({ manuscriptRoot: loaded.root.path, profile, structurePreset: "novel-parts", purpose: "validation", route: "validation" }); const settings = { configurationWarnings: [] } as never; const result = await new ManuscriptValidationService(loaded.vault as never, settings).validate(session); assert.ok(result.issues.some((issue) => issue.code === "invalid-profile" || issue.code === "invalid-template")); assert.equal(result.book, session.book); assert.equal(result.statistics.sceneCount, 3); });
test("Stage 5 profiles migrate to release-candidate structure", () => { const old = createDefaultProfiles()[0] as unknown as Record<string, unknown>; delete old.chapterSource; delete old.useParts; const settings = { ...DEFAULT_SETTINGS, profiles: [old], activeProfileId: old.id, defaultProfileId: old.id } as never; const repaired = repairSettings(settings); assert.equal(repaired.profiles[0].chapterSource, "folders"); assert.equal(repaired.profiles[0].useParts, true); });
test("profile wizard creates a usable Vellum note-chapter profile", () => { const profile = profileFromWizard({ name: "Submission", manuscriptRoot: "Books/Submission", exportFolder: "Exports", chapterSource: "notes", useParts: false, sceneSeparators: false, includeFrontMatter: true, includeBackMatter: false, referenceDocx: "", vellum: true }); assert.equal(profile.chapterSource, "notes"); assert.equal(profile.useParts, false); assert.equal(profile.sceneSeparator, ""); assert.match(profile.chapterHeadingTemplate, /Chapter/); });
test("diagnostics excludes manuscript content and reports timings", () => { const profile = createDefaultProfiles()[0]; const settings = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, compileLogs: [{ id: "1", timestamp: "2026-01-01", profile: profile.name, manuscript: "Book", outputFiles: [], wordCount: 10, success: true, exportFormats: "markdown", compilerVersion: "0.6.0", durationMs: 10, scanDurationMs: 1, parseDurationMs: 2, filterDurationMs: 1, generationDurationMs: 3, exportDurationMs: 1, warnings: [] }] } as never; const report = new DiagnosticsReportGenerator().generate({ pluginVersion: "0.8.0", obsidianVersion: "1.13.1", operatingSystem: "Test OS", profile, settings, generatedAt: new Date("2026-01-01T00:00:00Z") }); assert.match(report, /Parse: 2 ms/); assert.match(report, /Built in/); assert.match(report, /intentionally excludes manuscript contents/); });
test("diagnostics redact profile names, absolute paths, legacy reference paths, and filter values", () => { const profile = createDefaultProfiles()[0]; profile.name = "Secret Project Identifier"; profile.manuscriptRoot = "/Users/alice/SecretBook"; profile.referenceDocx = "/Users/alice/Templates/private.docx"; profile.metadataFilters = [{ id: "1", field: "POV", operator: "equals", value: "SecretName" }]; const settings = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as never; const report = new DiagnosticsReportGenerator().generate({ pluginVersion: "0.8.0", obsidianVersion: "1.13.1", operatingSystem: "Mac /Users/alice", profile, settings }); assert.doesNotMatch(report, /alice|private\.docx|SecretName|Secret Project Identifier/); });
test("technical errors redact Unix, Windows, and multiline details", () => { const redacted = redactTechnicalMessage(new Error("Failed at /Volumes/Private/Book.docx and C:\\Users\\alice\\Book.docx\nstack Secret")); assert.doesNotMatch(redacted, /Volumes|Private|Users|alice|stack Secret/); assert.match(redacted, /<path redacted>/); });
test("diagnostics omit legacy warning details that may contain private metadata", () => { const profile = createDefaultProfiles()[0]; const settings = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, compileLogs: [{ timestamp: "2026-01-01", warnings: ["Invalid YAML near SecretCharacter: Elin"] }] } as never; const report = new DiagnosticsReportGenerator().generate({ pluginVersion: "0.9.2", obsidianVersion: "1.13.1", operatingSystem: "Test", profile, settings }); assert.match(report, /details omitted for privacy/); assert.doesNotMatch(report, /SecretCharacter|Elin/); });

for (const version of ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6"]) test(`settings migration is repeatable from ${version}`, () => { const legacyProfile = createDefaultProfiles()[0] as unknown as Record<string, unknown>; legacyProfile.manuscriptRoot = "Books/Legacy"; legacyProfile.exportFolder = "Exports/Legacy"; if (version < "0.4") { delete legacyProfile.exportTarget; delete legacyProfile.referenceDocx; } if (version < "0.6") { delete legacyProfile.useParts; delete legacyProfile.chapterSource; } const hasProfiles = version >= "0.3"; const originalId = legacyProfile.id as string; const legacy = { ...DEFAULT_SETTINGS, profiles: hasProfiles ? [legacyProfile] : [], activeProfileId: hasProfiles ? originalId : "", defaultProfileId: hasProfiles ? originalId : "", defaultManuscriptFolder: "Books/Legacy", defaultExportFolder: "Exports/Legacy", includeBackMatter: false } as never; const once = repairSettings(legacy); const snapshot = JSON.stringify(once); const twice = repairSettings(once); assert.equal(JSON.stringify(twice), snapshot); assert.ok(twice.profiles.length >= 1); const migrated = twice.profiles.find((profile) => profile.manuscriptRoot === "Books/Legacy"); assert.ok(migrated); if (hasProfiles) assert.equal(migrated.id, originalId); else assert.equal(migrated.includeBackMatter, false); });
test("settings repair recovers malformed profile entries before migration", () => { const repaired = repairSettings({ ...DEFAULT_SETTINGS, profiles: [null] } as never); assert.equal(repaired.profiles.length, 1); assert.ok(repaired.profiles[0].id); assert.ok(repaired.configurationWarnings.some((warning) => warning.includes("Invalid profile entry"))); });
test("settings repair removes malformed history and normalizes log arrays", () => { const profile = createDefaultProfiles()[0]; const repaired = repairSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, exportHistory: [null], compileLogs: [{ timestamp: "2026-01-01", profile: "Test", outputFiles: null, warnings: null }] } as never); assert.deepEqual(repaired.exportHistory, []); assert.deepEqual(repaired.compileLogs[0].outputFiles, []); assert.deepEqual(repaired.compileLogs[0].warnings, []); });
test("settings repair bounds records, removes unknown private fields, and repairs nested profile state", () => {
  const profile = { ...createDefaultProfiles()[0], variables: { BookTitle: 42, Series: "Series", Author: null }, metadataFilters: [null, { id: "valid", field: "Status", operator: "equals", value: "Draft" }], bodySectionAliases: "Scene" } as never;
  const privateRecord = { id: "history", timestamp: "2026-01-01", profile: "Test", manuscript: "/Volumes/Private/Book", outputFiles: ["C:\\Private\\Book.docx", "Exports/Book.docx"], wordCount: -2, success: true, manuscriptProse: "Secret manuscript sentence", yamlValues: { Character: "SecretName" } };
  const repaired = repairSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, maximumExportHistoryEntries: 1, exportHistory: [privateRecord, privateRecord], compileLogs: [{ ...privateRecord, warnings: ["1 × invalid-metadata"], diagnostics: "Failure at /Users/alice/SecretBook/output.docx\nstack" }] } as never);
  assert.equal(repaired.exportHistory.length, 1); assert.equal(repaired.compileLogs.length, 1); assert.deepEqual(repaired.exportHistory[0].outputFiles, ["Exports/Book.docx"]); assert.equal(repaired.exportHistory[0].manuscript, "<path redacted>"); assert.equal(repaired.exportHistory[0].wordCount, 0);
  assert.doesNotMatch(JSON.stringify({ history: repaired.exportHistory, logs: repaired.compileLogs }), /Secret manuscript sentence|SecretName|alice|SecretBook|yamlValues|manuscriptProse/);
  assert.deepEqual(repaired.profiles[0].variables, { BookTitle: "", Series: "Series", Author: "" }); assert.equal(repaired.profiles[0].metadataFilters.length, 1); assert.deepEqual(repaired.profiles[0].bodySectionAliases, ["Scene", "Manuscript", "Text", "Draft", "Body"]);
});
test("large-manuscript pipeline handles 500 chapters, 2,000 scenes, and 2 million words", async () => { const profile = createDefaultProfiles()[0]; const content = `${"word ".repeat(999)}word`; let sceneIndex = 0; const allMarkdown: Array<{ name: string; basename: string; path: string }> = []; const parts = Array.from({ length: 10 }, (_, partIndex) => ({ folder: { name: `Part ${partIndex + 1}`, path: `Book/Part ${partIndex + 1}` }, looseScenes: [], chapters: Array.from({ length: 50 }, (_, chapterIndex) => ({ folder: { name: `Chapter ${partIndex * 50 + chapterIndex + 1}`, path: `Book/Part ${partIndex + 1}/Chapter ${chapterIndex + 1}` }, scenes: Array.from({ length: 4 }, () => { const name = `Scene ${++sceneIndex}`; const scene = { name: `${name}.md`, basename: name, path: `Book/Part ${partIndex + 1}/Chapter ${chapterIndex + 1}/${name}.md` }; allMarkdown.push(scene); return scene; }) })) })); const scan = { root: { path: "Book", name: "Book" }, frontMatter: [], backMatter: [], looseScenes: [], parts, allMarkdown, warnings: [] } as never; const started = performance.now(); const book = await new ManuscriptParser({ cachedRead: async () => content } as never).parse(scan, profile); const stats = new StatisticsEngine().calculate(book, profile, 250); const generator = new MarkdownGenerator(); const date = new Date("2026-01-01T00:00:00Z"); const markdown = generator.generate(book, profile, stats, date); assert.equal(stats.chapterCount, 500); assert.equal(stats.sceneCount, 2000); assert.equal(stats.totalWordCount, 2_000_000); assert.equal(generator.generate(book, profile, stats, date), markdown); assert.ok(markdown.length > 9_000_000); const duration = performance.now() - started; assert.ok(duration < 15_000, `Possible runaway regression: expected under 15 seconds, received ${Math.round(duration)} ms`); process.stdout.write(`  synthetic full parse-to-Markdown correctness run: ${Math.round(duration)} ms (informational)\n`); });

for (const fixture of [
  { name: "complete-sample", folder: "Complete Sample Book", useParts: true, chapterSource: "folders" as const, vellum: true },
  { name: "novel-with-parts", folder: "Novel with Parts", useParts: true, chapterSource: "folders" as const, vellum: false },
  { name: "small-novel", folder: "Small Novel", useParts: false, chapterSource: "folders" as const, vellum: false },
  { name: "short-story", folder: "Short Story", useParts: false, chapterSource: "notes" as const, vellum: false },
  { name: "anthology", folder: "Anthology", useParts: true, chapterSource: "notes" as const, vellum: false },
  { name: "mixed-malformed", folder: "Mixed and Malformed", useParts: true, chapterSource: "notes" as const, vellum: false }
]) test(`golden Markdown: ${fixture.name}`, async () => { const loaded = await loadFixtureScan(path.join("samples", fixture.folder)); const profile = createDefaultProfiles()[fixture.vellum ? 1 : 0]; profile.useParts = fixture.useParts; profile.chapterSource = fixture.chapterSource; profile.removeDataviewBlocks = true; profile.removeHtmlComments = true; profile.removeCallouts = true; profile.stripInternalLinks = true; const parser = new ManuscriptParser(loaded.vault as never); const book = await parser.parse(loaded.scan, profile); const stats = new StatisticsEngine().calculate(book, profile, 250); const markdown = new MarkdownGenerator().generate(book, profile, stats, new Date("2026-01-01T00:00:00Z")); const goldenPath = path.join("tests", "golden", `${fixture.name}.md`); if (process.env.UPDATE_GOLDEN === "1") { await mkdir(path.dirname(goldenPath), { recursive: true }); await writeFile(goldenPath, markdown, "utf8"); } const expected = await readFile(goldenPath, "utf8"); assert.equal(markdown, expected); assert.doesNotMatch(markdown, /^---$/m); assert.doesNotMatch(markdown, /\[\[/); if (fixture.name === "complete-sample") assert.ok(book.warnings.some((warning) => warning.includes("Duplicate scene"))); if (fixture.name === "mixed-malformed") { assert.ok(book.warnings.some((warning) => warning.includes("Invalid metadata"))); assert.ok(book.warnings.some((warning) => warning.includes("Orphan scene"))); } });

test("0.7 settings migrate idempotently into the simplified model", () => { const profile = createDefaultProfiles()[0]; profile.manuscriptRoot = "Books/Existing"; profile.exportFolder = "Exports/Existing"; profile.outputFilename = "Existing.docx"; const legacy = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as Record<string, unknown>; delete legacy.defaultStructurePreset; delete legacy.defaultDocxStyle; delete legacy.warnBeforeOverwrite; delete legacy.openAfterCompile; delete legacy.showAdvancedOptions; const once = repairSettings(legacy as never); const snapshot = JSON.stringify(once); const twice = repairSettings(once); assert.equal(JSON.stringify(twice), snapshot); assert.equal(once.profiles[0].manuscriptRoot, "Books/Existing"); assert.equal(once.profiles[0].exportFolder, "Exports/Existing"); assert.equal(once.profiles[0].outputFilename, "Existing.docx"); assert.equal(once.defaultStructurePreset, "novel-parts"); });
test("saved Chapter page-break compatibility values survive repair", () => { const profile = { ...createDefaultProfiles()[0], docxChapterPageBreak: false }; const settings = repairSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as never); assert.equal(settings.profiles[0].docxChapterPageBreak, false); });
test("0.9.1 settings migrate to 0.9.2 idempotently without losing author choices", () => {
  const profile = { ...createDefaultProfiles()[0], name: "My 0.9.1 Profile", manuscriptRoot: "Books/My Novel", exportFolder: "Exports/Books", outputFilename: "{BookTitle}.docx", variables: { BookTitle: "My Novel", Series: "My Series", Author: "A. Writer" }, metadataFilters: [{ id: "filter-1", field: "Status", operator: "not-equals" as const, value: "Excluded" }], stripInternalLinks: true, removeCallouts: false, bodySectionAliases: ["Scene", "Body"], docxFont: "Georgia", docxFontSize: 13, docxLineSpacing: 1.5, docxFirstLineIndentCm: undefined, docxFirstLineIndent: 0.25, docxPageSize: "a4" as const, docxChapterPageBreak: false, docxTitlePage: true, generateTableOfContents: true };
  const history = [{ id: "history-1", timestamp: "2026-07-01T10:00:00.000Z", profile: profile.name, manuscript: profile.manuscriptRoot, outputFiles: ["Exports/Books/My Novel.docx"], wordCount: 1234, success: true }];
  const persisted = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, defaultManuscriptFolder: profile.manuscriptRoot, defaultExportFolder: profile.exportFolder, defaultStructurePreset: "novel-parts" as const, defaultDocxStyle: "standard" as const, includeTitlePageByDefault: true, includeTableOfContentsByDefault: true, exportHistory: history, compileLogs: [], showAdvancedOptions: true };
  const once = repairSettings(structuredClone(persisted)); const snapshot = JSON.stringify(once); const twice = repairSettings(once);
  assert.equal(JSON.stringify(twice), snapshot); const migrated = twice.profiles[0];
  assert.deepEqual({ root: migrated.manuscriptRoot, folder: migrated.exportFolder, filename: migrated.outputFilename, variables: migrated.variables, filters: migrated.metadataFilters, font: migrated.docxFont, size: migrated.docxFontSize, spacing: migrated.docxLineSpacing, indentCm: migrated.docxFirstLineIndentCm, page: migrated.docxPageSize, chapterBreak: migrated.docxChapterPageBreak, titlePage: migrated.docxTitlePage, toc: migrated.generateTableOfContents }, { root: profile.manuscriptRoot, folder: profile.exportFolder, filename: profile.outputFilename, variables: profile.variables, filters: profile.metadataFilters, font: "Georgia", size: 13, spacing: 1.5, indentCm: 0.635, page: "a4", chapterBreak: false, titlePage: true, toc: true });
  assert.equal(twice.activeProfileId, profile.id); assert.equal(twice.defaultProfileId, profile.id); assert.equal(twice.exportHistory[0].id, "history-1"); assert.equal(twice.showAdvancedOptions, true);
});
test("first-run defaults are DOCX, Vellum, A4, metric, previewed, and overwrite-safe", () => { assert.equal(DEFAULT_SETTINGS.defaultExportFormat, "docx"); assert.equal(DEFAULT_SETTINGS.defaultDocxStyle, "vellum"); assert.equal(DEFAULT_SETTINGS.defaultDocxPageSize, "a4"); assert.equal(DEFAULT_SETTINGS.defaultIndentParagraphs, true); assert.equal(DEFAULT_SETTINGS.defaultDocxFirstLineIndentCm, 0.75); assert.equal(DEFAULT_SETTINGS.showPreview, true); assert.equal(DEFAULT_SETTINGS.warnBeforeOverwrite, true); assert.equal(DEFAULT_SETTINGS.showAdvancedOptions, false); const profiles = createDefaultProfiles(); assert.deepEqual(profiles.map((profile) => profile.docxPageSize), ["a4", "a4"]); assert.deepEqual(profiles.map((profile) => profile.docxIndentParagraphs), [true, true]); assert.deepEqual(profiles.map((profile) => profile.docxFirstLineIndentCm), [1.27, 0.75]); assert.deepEqual(profiles.map((profile) => profile.sceneSeparator), ["#", "#"]); });

test("paragraph indentation migration is idempotent and preserves existing indent values", () => {
  const profile = createDefaultProfiles()[1]; delete profile.docxIndentParagraphs; profile.docxFirstLineIndentCm = 0.635;
  const legacy = { ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as Record<string, unknown>; delete legacy.defaultIndentParagraphs;
  const once = repairSettings(legacy as never); const snapshot = JSON.stringify(once); const twice = repairSettings(once);
  assert.equal(once.defaultIndentParagraphs, true); assert.equal(once.profiles[0].docxIndentParagraphs, true); assert.equal(once.profiles[0].docxFirstLineIndentCm, 0.635); assert.equal(JSON.stringify(twice), snapshot);
  const disabled = repairSettings({ ...once, defaultIndentParagraphs: false, profiles: [{ ...once.profiles[0], docxIndentParagraphs: false }] }); assert.equal(disabled.defaultIndentParagraphs, false); assert.equal(disabled.profiles[0].docxIndentParagraphs, false); assert.equal(disabled.profiles[0].docxFirstLineIndentCm, 0.635);
});

test("legacy inch indentation and explicit Letter page size migrate once without drift", () => {
  const profile = createDefaultProfiles()[0]; delete profile.docxFirstLineIndentCm; profile.docxFirstLineIndent = 0.5; profile.docxPageSize = "letter";
  const once = repairSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as never); const snapshot = JSON.stringify(once); const twice = repairSettings(once);
  assert.equal(once.profiles[0].docxFirstLineIndentCm, 1.27); assert.equal(once.profiles[0].docxPageSize, "letter"); assert.equal(once.defaultDocxFirstLineIndentCm, 1.27); assert.equal(once.defaultDocxPageSize, "letter"); assert.equal(JSON.stringify(twice), snapshot);
});
test("older Vellum profiles without formatting fields receive metric A4 defaults", () => {
  const profile = createDefaultProfiles()[1]; delete profile.docxFirstLineIndentCm; delete profile.docxFirstLineIndent; delete profile.docxPageSize;
  const repaired = repairSettings({ ...DEFAULT_SETTINGS, defaultDocxStyle: "vellum", profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id } as never); assert.equal(repaired.profiles[0].docxFirstLineIndentCm, 0.75); assert.equal(repaired.profiles[0].docxPageSize, "a4"); assert.equal(repaired.defaultDocxFirstLineIndentCm, 0.75); assert.equal(repaired.defaultDocxPageSize, "a4");
});
test("invalid metric indentation settings are repaired to supported bounds", () => {
  const negative = createDefaultProfiles()[0]; negative.docxFirstLineIndentCm = -2; const repairedNegative = repairSettings({ ...DEFAULT_SETTINGS, profiles: [negative], activeProfileId: negative.id, defaultProfileId: negative.id } as never); assert.equal(repairedNegative.profiles[0].docxFirstLineIndentCm, 0);
  const excessive = createDefaultProfiles()[0]; excessive.docxFirstLineIndentCm = 20; const repairedExcessive = repairSettings({ ...DEFAULT_SETTINGS, profiles: [excessive], activeProfileId: excessive.id, defaultProfileId: excessive.id } as never); assert.equal(repairedExcessive.profiles[0].docxFirstLineIndentCm, 3.81);
});
test("existing-output warnings do not block overwrite handling", () => { assert.equal(canProceedWithExport([{ severity: "warning", code: "output-exists", message: "Already exists" }], "docx", true), true); });
test("native DOCX generation has no platform or executable prerequisite", () => { const bytes = createTestDocx("Text", "Book"); assert.equal(String.fromCharCode(bytes[0], bytes[1]), "PK"); });
test("Warden regression exports only publishable content through a transparent Manuscript container", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const role = (suffix: string) => plan.find((item) => item.path.endsWith(suffix)); assert.equal(role("/Manuscript")?.role, "transparent"); for (const folder of ["Archive", "Development", "Exports"]) { assert.equal(role(`/${folder}`)?.role, "ignore"); assert.equal(role(`/${folder}`)?.included, false); } assert.equal(role("/Warden of Silence Dashboard.md")?.role, "ignore"); const profile = createDefaultProfiles()[1]; profile.useParts = true; profile.chapterSource = "folders"; profile.contentOrder = plan.filter((item) => item.included).map((item) => item.path); profile.bodySectionAliases = ["Scene", "Manuscript", "Text", "Draft", "Body"]; const scan = applyContentPlan(new VaultScanner().scan(loaded.root), plan, profile); const book = await new ManuscriptParser(loaded.vault as never).parse(scan, profile); const markdown = new MarkdownGenerator().generate(book, profile, new StatisticsEngine().calculate(book, profile, 250), new Date("2026-01-01")); const forbidden = ["Archive", "Development", "Previous Export", "Dashboard", "Revision Notes", "Internal synopsis", "Editing Status", "Characters:", "Part 0", "Chapter 0", "# Manuscript"]; forbidden.forEach((value) => assert.doesNotMatch(markdown, new RegExp(value, "i"), value)); assert.equal((markdown.match(/The Silence Breaks/g) ?? []).length, 1); assert.equal((markdown.match(/The Silence of Östersund/g) ?? []).length, 1); assert.equal((markdown.match(/Östersund was silent/g) ?? []).length, 1); assert.equal((markdown.match(/The barn door opened/g) ?? []).length, 1); assert.ok(markdown.indexOf("Copyright ©") < markdown.indexOf("The Silence Breaks")); assert.ok(markdown.indexOf("The Weight of Knowing") < markdown.indexOf("With gratitude")); assert.equal((markdown.match(/^#$/gm) ?? []).length, 1); });

test("prepared preview is built from the final Warden Book model used by DOCX", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan); assert.equal(session.book.title, "Book 1 - Warden of Silence"); assert.equal(session.book.parts.length, 2); assert.deepEqual(session.book.parts.map((part) => part.chapters.map((chapter) => [chapter.name, chapter.scenes.filter((scene) => !scene.excluded && scene.content.trim()).length])), [[ ["The Silence of Östersund", 2] ], [ ["The Cold Welcome", 1] ]]); assert.equal(session.statistics.sceneCount, 3); assert.equal(session.book.frontMatter.documents.filter((item) => !item.excluded && item.content.trim()).length, 2); assert.equal(session.book.backMatter.documents.filter((item) => !item.excluded && item.content.trim()).length, 1); assert.equal(createPreparedExportRequest(session, session.outputPaths[0], false).book, session.book); assert.ok((session.result.timings?.totalMs ?? -1) >= 0); assert.ok((session.result.timings?.generationMs ?? -1) >= 0); const bytes = createManuscriptDocx(session.book, session.profile, { title: "Warden of Silence", author: "Anthony Fitzpatrick", titlePage: true, partDisplay: "word-title", chapterDisplay: "word-title" }); const document = strFromU8(unzipSync(bytes)["word/document.xml"]); const forbidden = ["Archive", "Development", "Exports", "Dashboard", "Revision Notes", "Synopsis", "Internal synopsis", "Editing Status", "Characters:", "The Watchers of Silence Series Dashboard"]; for (const value of forbidden) { assert.doesNotMatch(session.result.markdown, new RegExp(value, "i")); assert.doesNotMatch(document, new RegExp(value, "i")); } });

test("empty cleaned notes are excluded from both prepared preview counts and DOCX", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const emptyPath = `${loaded.root.path}/Manuscript/Part 1 - The Silence Breaks/Chapter 1 - The Silence of Östersund/Scene 2 - The Barn.md`; loaded.setContent(emptyPath, "# Synopsis\n\nOnly an internal synopsis.\n\n# Revision Notes\n\nNothing publishable."); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const emptyItem = plan.find((item) => item.path === emptyPath)!; emptyItem.included = true; emptyItem.role = "scene"; emptyItem.userOverride = true; const request = preparedRequest(loaded.root.path, plan); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan); assert.equal(session.statistics.sceneCount, 2); assert.ok(session.exclusions.some((item) => item.path === emptyPath && /No manuscript body remains/i.test(item.reason))); const document = strFromU8(unzipSync(createManuscriptDocx(session.book, session.profile, { title: "Warden", author: "Author" }))["word/document.xml"]); assert.doesNotMatch(session.result.markdown, /Only an internal synopsis|Nothing publishable/); assert.doesNotMatch(document, /Only an internal synopsis|Nothing publishable/); });

test("prepared-session input signatures invalidate on inclusion, role, order, and root changes", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan); assert.ok(preparedSessionMatchesInputs(session, request, plan)); const target = plan.find((item) => item.kind === "note" && item.included)!; const included = target.included; target.included = !included; assert.ok(!preparedSessionMatchesInputs(session, request, plan)); target.included = included; const role = target.role; target.role = role === "scene" ? "chapter" : "scene"; assert.ok(!preparedSessionMatchesInputs(session, request, plan)); target.role = role; const order = target.order; target.order += 1; assert.ok(!preparedSessionMatchesInputs(session, request, plan)); target.order = order; const root = request.manuscriptRoot; request.manuscriptRoot = `${root} changed`; assert.ok(!preparedSessionMatchesInputs(session, request, plan)); request.manuscriptRoot = root; assert.equal(compileInputSignature(request, plan), session.inputSignature); });

test("source changes block a prepared session and refresh preparation rebuilds it", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const service = new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250); const first = await service.prepare(request, plan); const scenePath = `${loaded.root.path}/Manuscript/Part 2 - The Weight of Knowing/Chapter 11 - The Cold Welcome/Scene 1.md`; loaded.setContent(scenePath, "# Scene\n\nFresh preview prose after a source edit."); assert.notEqual(await calculateSourceFingerprint(loaded.vault as never, first.sourcePaths), first.sourceFingerprint); const refreshed = await service.prepare(request, plan); assert.notEqual(refreshed.sourceFingerprint, first.sourceFingerprint); assert.match(refreshed.result.markdown, /Fresh preview prose after a source edit/); assert.doesNotMatch(first.result.markdown, /Fresh preview prose after a source edit/); });
test("source fingerprints detect equal-size edits with unchanged file statistics", async () => { const source = Object.assign(new TFile(), { path: "Book/Scene.md", stat: { mtime: 1, size: 4 } }); let content = "aaaa"; const vault = { getAbstractFileByPath: () => source, cachedRead: async () => content } as never; const before = await calculateSourceFingerprint(vault, [source.path]); content = "bbbb"; const after = await calculateSourceFingerprint(vault, [source.path]); assert.notEqual(after, before); });

test("all automatic compile routes produce the same safe Warden semantic manuscript", async () => {
  const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const profile = createDefaultProfiles()[1];
  profile.explicitlyIncludedPaths = [`${loaded.root.path}/Archive/Old Chapter.md`];
  const service = new CompilePreparationService(loaded.vault as never, profile, 250);
  const routes = ["current-book", "selected-folder", "legacy-profile", "validation", "sample"] as const;
  const sessions = await Promise.all(routes.map((route) => service.prepareAuthoritative({ manuscriptRoot: loaded.root.path, profile, structurePreset: "novel-parts", purpose: route === "validation" ? "validation" : "compile", route })));
  const semantic = (session: typeof sessions[number]) => ({ front: session.book.frontMatter.documents.filter((item) => !item.excluded && item.content.trim()).map((item) => item.title), parts: session.book.parts.map((part) => ({ number: part.number, name: part.name, chapters: part.chapters.map((chapter) => ({ number: chapter.number, name: chapter.name, scenes: chapter.scenes.filter((scene) => !scene.excluded && scene.content.trim()).length })) })), back: session.book.backMatter.documents.filter((item) => !item.excluded && item.content.trim()).map((item) => item.title) });
  const expected = { front: ["Title Page", "Copyright"], parts: [{ number: 1, name: "The Silence Breaks", chapters: [{ number: 1, name: "The Silence of Östersund", scenes: 2 }] }, { number: 2, name: "The Weight of Knowing", chapters: [{ number: 11, name: "The Cold Welcome", scenes: 1 }] }], back: ["Acknowledgements"] };
  const forbidden = ["Archive", "Development", "Exports", "Warden of Silence Dashboard", "The Watchers of Silence Series Dashboard", "Revision Notes", "Synopsis", "Editing Status", "Part 0", "Chapter 0", "# Manuscript", "Chapter 0: Book 1 - Warden of Silence"];
  sessions.forEach((session) => { assert.deepEqual(semantic(session), expected, session.route); forbidden.forEach((value) => assert.doesNotMatch(session.result.markdown, new RegExp(value, "i"), `${session.route}: ${value}`)); assert.ok(session.contentPlan.some((item) => item.name === "Manuscript" && item.role === "transparent")); assert.ok(session.exclusions.some((item) => /Archive\/Old Chapter\.md$/.test(item.path))); });
  sessions.slice(1).forEach((session) => assert.deepEqual(semantic(session), semantic(sessions[0])));
  const validation = await new ManuscriptValidationService(loaded.vault as never, { configurationWarnings: [] } as never).validate(sessions[3]); assert.equal(validation.book, sessions[3].book); assert.equal(validation.statistics.sceneCount, 3);
  const document = strFromU8(unzipSync(createManuscriptDocx(sessions[0].book, sessions[0].profile, { title: "Warden of Silence", author: "Anthony Fitzpatrick" }))["word/document.xml"]); forbidden.forEach((value) => assert.doesNotMatch(document, new RegExp(value, "i"), value));
});

test("guided preparation keeps explicit inclusion, role, and manual order authoritative", async () => {
  const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
  const excluded = plan.find((item) => item.name === "Scene 2 - The Barn")!; excluded.included = false; excluded.userOverride = true;
  const partOne = plan.find((item) => item.name === "Part 1 - The Silence Breaks")!; const partTwo = plan.find((item) => item.name === "Part 2 - The Weight of Knowing")!; partOne.order = 1; partTwo.order = 0; partOne.userOverride = true; partTwo.userOverride = true;
  const request = preparedRequest(loaded.root.path, plan); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan);
  assert.deepEqual(session.book.parts.map((part) => part.number), [2, 1]); assert.equal(session.statistics.sceneCount, 2); assert.equal(session.contentPlan.find((item) => item.path === excluded.path)?.userOverride, true); assert.doesNotMatch(session.result.markdown, /The barn door opened/);
});

test("book-root resolution and command identifiers are central and stable", async () => {
  const root = Object.assign(new TFolder(), { name: "Book", path: "Books/Book", children: [] }); const vault = { getAbstractFileByPath: (value: string) => value === root.path ? root : null } as never;
  assert.equal(new BookRootResolver(vault).require(root.path), root); assert.equal(new BookRootResolver(vault).selected(root), root); assert.deepEqual(Object.values(COMMAND_IDS), ["compile-manuscript", "compile-current-book", "compile-selected-folder", "validate-manuscript", "generate-diagnostics-report"]); const main = await readFile(path.join("src", "main.ts"), "utf8"); for (const title of ["Compile manuscript", "Compile current book", "Compile selected folder", "Validate manuscript", "Generate diagnostics report"]) assert.match(main, new RegExp(`name: "${title}"`)); assert.match(main, /workspace\.on\("file-menu"/); assert.match(main, /openCompilerForFolder\(folder/);
});

test("File Explorer context action is folder-only and preserves the exact clicked root", () => {
  const folder = Object.assign(new TFolder(), { name: "Book 1 - Warden of Silence", path: "Library/Book 1 - Warden of Silence", children: [] });
  const note = Object.assign(new TFile(), { name: "Scene.md", path: `${folder.path}/Scene.md` });
  let title = ""; let icon = ""; let click: (() => void) | undefined; let opened: TFolder | undefined;
  const menu = { addItem: (build: (item: unknown) => void) => { const item = { setTitle: (value: string) => { title = value; return item; }, setIcon: (value: string) => { icon = value; return item; }, onClick: (value: () => void) => { click = value; return item; } }; build(item); } } as never;
  assert.equal(addCompileFolderMenuItem(menu, note as never, (selected) => { opened = selected; }), false);
  assert.equal(title, "");
  assert.equal(addCompileFolderMenuItem(menu, folder as never, (selected) => { opened = selected; }), true);
  assert.equal(title, COMPILE_FOLDER_MENU_TITLE); assert.equal(icon, "book-open"); click?.(); assert.equal(opened, folder);
});

test("mixed matter aliases and copyright containers never infer Chapter roles", () => {
  const copyright = Object.assign(new TFile(), { name: "Copyright - eBook version - First Edition.md", basename: "Copyright - eBook version - First Edition", extension: "md", path: "Book/Font and back matter/Copyright notices/Copyright - eBook version - First Edition.md" });
  const notices = Object.assign(new TFolder(), { name: "Copyright notices", path: "Book/Font and back matter/Copyright notices", children: [copyright] });
  const about = Object.assign(new TFile(), { name: "About the Author.md", basename: "About the Author", extension: "md", path: "Book/Font and back matter/About the Author.md" });
  const matter = Object.assign(new TFolder(), { name: "Font and back matter", path: "Book/Font and back matter", children: [about, notices] });
  const root = Object.assign(new TFolder(), { name: "Book", path: "Book", children: [matter] });
  const plan = createContentPlan(root, "novel-parts"); const role = (name: string) => plan.find((item) => item.name === name)?.role;
  assert.equal(role("Font and back matter"), "transparent"); assert.equal(role("Copyright notices"), "transparent"); assert.equal(role("Copyright - eBook version - First Edition"), "front-matter"); assert.equal(role("About the Author"), "back-matter"); assert.ok(!plan.some((item) => item.role === "chapter"));
});

test("real-vault Warden hierarchy keeps transparent containers, chapters, scenes, and matter roles", async () => {
  const loaded = await loadFixtureTree("tests/fixtures/real-vault/Book 1 - Warden of Silence");
  const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
  const role = (name: string) => plan.find((item) => item.name === name)?.role;
  assert.equal(loaded.root.name, "Book 1 - Warden of Silence");
  assert.equal(role("Manuscript"), "transparent");
  assert.equal(plan.find((item) => item.kind === "folder" && item.name === "Book 1 - Warden of Silence")?.role, "transparent");
  assert.equal(role("Front and back matter"), "transparent");
  assert.equal(role("Copyright notices"), "transparent");
  for (const name of ["Copyright - eBook version - First Edition", "Copyright - Hardcover version - First Edition", "Copyright - Paperback version - First Edition"]) assert.equal(role(name), "front-matter", name);
  for (const name of ["A note from Elin", "About the Author", "Acknowledgments", "Also by Anthony Fitzpatrick", "Back Cover Blurb"]) assert.equal(role(name), "back-matter", name);
  const profile = createDefaultProfiles()[1];
  const session = await new CompilePreparationService(loaded.vault as never, profile, 250).prepare(preparedRequest(loaded.root.path, plan), plan);
  assert.equal(session.book.root, loaded.root); assert.equal(session.book.parts.length, 1); assert.equal(session.statistics.chapterCount, 1); assert.equal(session.statistics.sceneCount, 3);
  assert.equal(session.book.orphanScenes.filter((scene) => !scene.excluded).length, 0); assert.equal(session.book.parts[0].orphanScenes.filter((scene) => !scene.excluded).length, 0);
  assert.equal(session.book.parts[0].chapters[0].scenes.length, 3);
  assert.equal(new Set(session.scannedBook.allMarkdown.map((file) => file.path)).size, session.scannedBook.allMarkdown.length);
  assert.ok(session.book.frontMatter.documents.every((item) => /Copyright/.test(item.title)));
  assert.deepEqual(session.book.backMatter.documents.map((item) => item.title), ["A note from Elin", "About the Author", "Acknowledgments", "Also by Anthony Fitzpatrick", "Back Cover Blurb"]);
  const document = strFromU8(unzipSync(createManuscriptDocx(session.book, session.profile, { title: "Warden of Silence", author: "Anthony Fitzpatrick" }))["word/document.xml"]);
  assert.ok(document.indexOf("The Silence Breaks") < document.indexOf("About the Author"));
  for (const matter of ["About the Author", "Acknowledgments", "Also by Anthony Fitzpatrick", "Back Cover Blurb"]) {
    const paragraph = [...document.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].find((match) => match[0].includes(matter))?.[0] ?? "";
    assert.doesNotMatch(paragraph, /w:pStyle w:val="(?:PartNumber|ChapterNumber)"/, matter);
  }
  assert.doesNotMatch(document, />Manuscript<|>Front and back matter<|>Copyright notices</);
});

test("matter-role inheritance updates only non-overridden descendant notes", async () => {
  const loaded = await loadFixtureTree("tests/fixtures/real-vault/Book 1 - Warden of Silence");
  const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
  const request = preparedRequest(loaded.root.path, plan); const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(loaded.root.path, plan);
  const container = plan.find((item) => item.name === "Front and back matter")!; const explicit = plan.find((item) => item.name === "About the Author")!; explicit.role = "scene"; explicit.userOverride = true;
  const order = plan.map((item) => [item.path, item.order]); controller.setRole(container.path, "back-matter");
  assert.equal(explicit.role, "scene");
  assert.ok(plan.filter((item) => item.kind === "note" && item.path.startsWith(`${container.path}/`) && !item.userOverride).every((item) => item.role === "back-matter"));
  assert.deepEqual(plan.map((item) => [item.path, item.order]), order);
});

test("manual Scene order survives multiple transparent ancestors", async () => {
  const loaded = await loadFixtureTree("tests/fixtures/real-vault/Book 1 - Warden of Silence");
  const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
  const scenes = plan.filter((item) => item.kind === "note" && /^Scene 00/.test(item.name));
  const desired = [scenes[2], scenes[0], scenes[1]]; desired.forEach((item, order) => { item.order = order; item.userOverride = true; });
  const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(preparedRequest(loaded.root.path, plan), plan);
  assert.deepEqual(session.book.parts[0].chapters[0].scenes.map((scene) => scene.title), desired.map((item) => item.name));
});

test("orphan hierarchy diagnostics are relative, structural, and prose-free", async () => {
  const loaded = await loadFixtureTree("tests/fixtures/real-vault/Book 1 - Warden of Silence");
  const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts"));
  const chapter = plan.find((item) => item.name === "Chapter 1 - The Silence of Östersund")!; chapter.role = "transparent"; chapter.userOverride = true;
  const profile = createDefaultProfiles()[1]; profile.useParts = true; profile.chapterSource = "folders"; profile.contentOrder = plan.map((item) => item.path);
  const scan = applyContentPlan(new VaultScanner().scan(loaded.root), plan, profile);
  assert.equal(scan.hierarchyDiagnostics?.length, 3); const diagnostic = scan.hierarchyDiagnostics![0];
  assert.match(diagnostic.scenePath, /^Manuscript\/Book 1 - Warden of Silence\/Part 1/); assert.equal(diagnostic.inferredRole, "scene"); assert.equal(diagnostic.parentRole, "transparent"); assert.match(diagnostic.nearestStructuralAncestor, /^Manuscript\/.*\/Part 1/); assert.equal(diagnostic.transparentReparenting, true); assert.equal(diagnostic.parentExcluded, false); assert.doesNotMatch(JSON.stringify(diagnostic), /Östersund was silent beneath/);
});

test("production preparation has one scanner-to-semantic boundary", async () => {
  const mainSource = await readFile(path.join("src", "main.ts"), "utf8"); const validationSource = await readFile(path.join("src", "validation.ts"), "utf8"); const preparationSource = await readFile(path.join("src", "compile-preparation.ts"), "utf8"); const exporterSource = await readFile(path.join("src", "native-exporters.ts"), "utf8");
  assert.doesNotMatch(mainSource, /VaultScanner|buildModel\(|applyContentPlan\(/); assert.doesNotMatch(validationSource, /VaultScanner|buildModel\(|ScannedBook/); assert.match(preparationSource, /new VaultScanner\(\)\.scan/); assert.match(preparationSource, /compiler\.buildModel/); assert.doesNotMatch(exporterSource, /ScannedBook/);
});

test("workspace controller centralises every prepared-session invalidation rule", async () => {
  const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const formatting = request.formatting!;
  const prepared = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan);
  const controller = new CompileWorkspaceController(request, formatting, { prepare: async () => prepared, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(loaded.root.path, plan);
  const invalidates = (mutation: () => void): void => { controller.state.preparedSession = prepared; mutation(); assert.equal(controller.state.preparedSession, undefined); };
  invalidates(() => controller.setRoot(`${loaded.root.path} changed`)); controller.setRoot(loaded.root.path); controller.setDetectedPlan(loaded.root.path, plan);
  invalidates(() => controller.setPreset("novel")); invalidates(() => controller.setRole(plan.find((item) => item.kind === "folder")!.path, "transparent")); invalidates(() => controller.setIncluded(plan.find((item) => item.kind === "note")!.path, false)); invalidates(() => controller.moveItem(plan.find((item) => item.kind === "note")!.path, 1)); invalidates(() => controller.setBodyAliases(["Body"])); invalidates(() => controller.setMatter("front", false)); invalidates(() => controller.setFormatting({ fontSize: 11 })); const signatureBeforeIndentation = compileInputSignature(request, plan); invalidates(() => controller.setFormatting({ indentParagraphs: false })); assert.notEqual(compileInputSignature(request, plan), signatureBeforeIndentation); assert.equal(request.docxPreset, "custom"); invalidates(() => controller.setTableOfContents(true)); invalidates(() => controller.setVariable("BookTitle", "Changed"));
  controller.state.preparedSession = prepared; controller.setDownloadFilename("Changed.md"); controller.setExportFormat("markdown"); controller.setExportFormat("html"); assert.equal(controller.state.formatting.indentParagraphs, false); assert.equal(controller.state.preparedSession, prepared);
});

test("guided workspace has exactly three stages and combines format choices with Create file", async () => {
  assert.deepEqual([...WORKSPACE_STEPS], ["manuscript", "contents", "create"]);
  const modal = await readFile(path.join("src", "compile-modal.ts"), "utf8"); const create = await readFile(path.join("src", "workspace", "create-docx-step.ts"), "utf8");
  assert.match(modal, /\["Manuscript", "Contents", "Create file"\]/); assert.match(create, /Advanced formatting/); assert.doesNotMatch(create, /Save compatibility|Save to vault/); assert.match(create, /Start chapters on a new page/); assert.match(create, /Add table of contents/);
});

test("folder-context launch never offers the redundant current-folder action", () => {
  assert.equal(showUseCurrentFolder(true, true), false); assert.equal(showUseCurrentFolder(false, true), false); assert.equal(showUseCurrentFolder(false, false), true); assert.equal(showUseCurrentFolder(true, false), false);
});

test("compact manuscript and focused Contents summaries classify included, ignored, and warning notes", () => {
  const root = "Book"; const part = `${root}/Part 1`; const chapter = `${part}/Chapter 1`;
  const plan: ContentPlanItem[] = [
    { path: part, parentPath: root, name: "Part 1", kind: "folder", role: "part", detectedRole: "part", included: true, order: 0 },
    { path: chapter, parentPath: part, name: "Chapter 1", kind: "folder", role: "chapter", detectedRole: "chapter", included: true, order: 0 },
    { path: `${chapter}/Scene.md`, parentPath: chapter, name: "Scene", kind: "note", role: "scene", detectedRole: "scene", included: true, order: 0 },
    { path: `${chapter}/Warning.md`, parentPath: chapter, name: "Warning", kind: "note", role: "scene", detectedRole: "scene", included: true, order: 1, warning: "Metadata remains" },
    { path: `${root}/Notes.md`, parentPath: root, name: "Notes", kind: "note", role: "ignore", detectedRole: "ignore", included: false, order: 1, exclusionReason: "Project note" }
  ];
  assert.deepEqual(manuscriptPlanSummary(plan, root), { totalNotes: 3, includedNotes: 2, ignoredNotes: 1, parts: 1, chapters: 1, scenes: 2, frontMatter: 0, backMatter: 0, warnings: 1, ambiguous: 0 });
  assert.deepEqual(reviewItems(plan, root, "ignored").map((item) => item.name), ["Notes"]); assert.deepEqual(reviewItems(plan, root, "warnings").map((item) => item.name), ["Warning"]);
  const view = new ContentsTreeViewState(); view.prepare(root, plan); assert.equal(view.correctionMode, false); assert.equal(view.reviewFilter, "outline"); assert.equal(view.isExpanded(part), true); assert.equal(view.isExpanded(chapter), true); view.setCorrectionMode(true); assert.equal(view.correctionMode, true);
});

test("document identity resolves from metadata, root metadata, then folder", () => {
  assert.equal(cleanBookTitle("Book 1 - Warden of Silence"), "Warden of Silence"); assert.equal(cleanBookTitle("Book of Dreams"), "Book of Dreams");
  assert.equal(resolveBookTitle("Metadata Title", "Root Title", "Book 1 - Folder"), "Metadata Title"); assert.equal(resolveBookTitle("", "Root Title", "Book 1 - Folder"), "Root Title"); assert.equal(resolveBookTitle(undefined, undefined, "Book 1 - Folder"), "Folder");
  assert.equal(resolveAuthor("Metadata Author", "Root Author", "Profile Author"), "Metadata Author"); assert.equal(resolveAuthor("", "Root Author", "Profile Author"), "Root Author"); assert.equal(resolveAuthor(undefined, undefined, "Profile Author"), "Profile Author");
});

test("warning summaries expose only stable categories and counts", () => {
  const warnings = [{ severity: "warning", code: "invalid-metadata", message: "Private metadata value" }, { severity: "warning", code: "invalid-metadata", message: "Different private value" }, { severity: "information", code: "metadata-removed", message: "2 metadata fields removed" }] as never;
  const summary = warningCategories(attentionWarnings(warnings));
  assert.deepEqual(summary, [{ code: "invalid-metadata", label: "invalid metadata", count: 2 }]); assert.doesNotMatch(JSON.stringify(summary), /Private|Different/);
  assert.equal(informationMessages(warnings).length, 1);
});

test("unused metadata is one informational summary and never attention", () => {
  const scene = file("Scene 1", "Body", { character: "Private", synopsis: "Private", order: 1 }); const profile = createDefaultProfiles()[0];
  const book = { root: { path: "Book", name: "Book" }, title: "Book", frontMatter: { kind: "front", title: "Front Matter", documents: [] }, parts: [{ title: "Part 1", name: "Part 1", number: 1, path: "Book/Part 1", chapters: [{ title: "Chapter 1", name: "Chapter 1", number: 1, path: "Book/Part 1/Chapter 1", scenes: [scene], orphan: false }], orphanScenes: [] }], orphanScenes: [], backMatter: { kind: "back", title: "Back Matter", documents: [] }, includedFiles: [scene.file], excludedFiles: [], warnings: [], issues: [] } as Book;
  const issues = new WarningEngine().analyze(book, profile, "Exports/Book.docx"); const metadata = issues.filter((issue) => issue.code === "metadata-removed");
  assert.equal(metadata.length, 1); assert.equal(metadata[0].severity, "information"); assert.match(metadata[0].message, /^2 metadata fields removed/); assert.equal(attentionWarnings(metadata).length, 0); assert.doesNotMatch(JSON.stringify(metadata), /Private|character|synopsis/i);
});

test("ignored folders collapse into one review row without losing item counts", () => {
  const plan = [{ path: "Book/Archive", parentPath: "Book", name: "Archive", kind: "folder", role: "ignore", included: false, order: 0, exclusionReason: "ignored" }, { path: "Book/Archive/Old 1.md", parentPath: "Book/Archive", name: "Old 1", kind: "note", role: "ignore", included: false, order: 0 }, { path: "Book/Archive/Nested", parentPath: "Book/Archive", name: "Nested", kind: "folder", role: "ignore", included: false, order: 1 }, { path: "Book/Archive/Nested/Old 2.md", parentPath: "Book/Archive/Nested", name: "Old 2", kind: "note", role: "ignore", included: false, order: 0 }] as ContentPlanItem[];
  assert.deepEqual(ignoredGroups(plan, "Book"), [{ path: "Book/Archive", name: "Archive", itemCount: 2, reason: "ignored" }]);
});

test("polished screens use compact manuscript wording and universal create order", async () => {
  const modal = await readFile("src/compile-modal.ts", "utf8"); const manuscript = await readFile("src/workspace/manuscript-step.ts", "utf8"); const create = await readFile("src/workspace/create-docx-step.ts", "utf8");
  assert.match(modal, /Review Structure/); assert.match(manuscript, /Selected from File Explorer|selectedFromFileExplorer/); assert.match(manuscript, /Detected structure/); assert.doesNotMatch(manuscript, /setDesc\(folder\?\.path/);
  const order = ['text: "Book summary"', "renderFormatSelector(container, controller, actions, title);", "renderFormatting(container, controller, actions, format);", "renderAdvancedFormatting(container, controller, actions, format);", "renderWarnings(container, prepared?.warnings ?? [], counts.ignoredNotes);", 'text: "Output filename"'].map((label) => create.indexOf(label)); assert.ok(order.every((index) => index >= 0)); assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.deepEqual(folderIdentity("Publishing/The Watchers of Silence/Books/Book 1 – Warden"), { name: "Book 1 – Warden", parentPath: "Publishing / The Watchers of Silence / Books" });
});

test("legacy vault-save settings remain migration data but cannot select an active export route", () => {
  const profile = createDefaultProfiles()[0]; const migrated = repairSettings({ ...DEFAULT_SETTINGS, profiles: [profile], activeProfileId: profile.id, defaultProfileId: profile.id, saveToVaultByDefault: undefined, rememberExternalSaveFolder: undefined, lastExternalSaveFolder: undefined } as never);
  assert.equal(migrated.saveToVaultByDefault, false); assert.equal(migrated.rememberExternalSaveFolder, false); assert.equal(migrated.lastExternalSaveFolder, "");
  const explicit = repairSettings({ ...migrated, saveToVaultByDefault: true, rememberExternalSaveFolder: true, lastExternalSaveFolder: "/chosen/folder" }); assert.equal(explicit.saveToVaultByDefault, true); assert.equal(explicit.rememberExternalSaveFolder, true); assert.equal(explicit.lastExternalSaveFolder, "/chosen/folder"); assert.equal(explicit.defaultDownloadFormat, "docx");
});

test("advanced controls remain available and settings lead with Defaults", async () => {
  const create = await readFile(path.join("src", "workspace", "create-docx-step.ts"), "utf8"); const settings = await readFile(path.join("src", "ui.ts"), "utf8");
  for (const label of ["Book title override", "Author override", "Font", "Font size", "Line spacing", "First-line indent (cm)", "Page size", "Custom scene break", "Part heading style", "Chapter heading style", "Manuscript body headings", "Filename template"]) assert.match(create, new RegExp(label.replace(/[()]/g, "\\$&")));
  for (const removed of ["Vault folder", "Warn before overwriting", "Open after export", "Reveal after export", "Save to vault"]) assert.doesNotMatch(create, new RegExp(removed));
  assert.match(settings, /setName\("Defaults"\)\.setHeading\(\)/); assert.match(settings, /setName\("Advanced profile"\)/); assert.match(settings, /Used for customised or older workflows/); assert.match(settings, /Advanced profiles, records, and compatibility/); assert.doesNotMatch(settings, /Active legacy profile|Saved defaults/);
});

test("settings end with an accessible responsive Support & Links panel", async () => {
  const ui = await readFile(path.join("src", "ui.ts"), "utf8"); const css = await readFile("styles.css", "utf8");
  const records = ui.indexOf('setName("Export records")'); const support = ui.indexOf("this.renderSupportPanel(container);"); assert.ok(records >= 0 && support > records, "support must render after every setting");
  assert.match(ui, /container\.addClass\("manuscript-compiler-settings"\)/); assert.match(css, /\.manuscript-compiler-settings > \.setting-item:not\(\.setting-item-heading\)[\s\S]*padding-block: var\(--size-4-2\)/); assert.match(css, /\.manuscript-compiler-settings > details > \.setting-item/);
  assert.match(ui, /const SUPPORT_SECTION_TITLE = "Support & Links"/); assert.match(ui, /text: `Version \$\{this\.plugin\.manifest\.version\}`/); assert.equal((ui.match(/\{ label: /g) ?? []).length, 5);
  for (const value of ["Report a bug", "Feature request", "wolf359.app", "Wolf 359 Press", "Buy me a coffee", "https://wolf359.app", "https://wolf359.press", "https://buymeacoffee.com/wolf359pressab"]) assert.match(ui, new RegExp(value.replace(/[.]/g, "\\.")));
  assert.match(ui, /Bug reporting portal coming soon\./); assert.match(ui, /Feature request portal coming soon\./); assert.match(ui, /new ButtonComponent\(actions\)/); assert.match(ui, /setIcon\(action\.icon\)/); assert.match(ui, /buyMeACoffeeArtwork/); assert.match(ui, /manuscript-support-bmc-icon/); assert.match(ui, /manuscript-support-button-label/); assert.match(ui, /setAttribute\("aria-label", action\.label\)/); assert.match(ui, /button\.buttonEl\.win\.open\(action\.url, "_blank", "noopener,noreferrer"\)/);
  assert.match(css, /\.manuscript-support-panel \{[^}]*width: 100%;[^}]*padding: var\(--size-4-3\);[^}]*var\(--background-modifier-border\)[^}]*var\(--background-secondary\)/s); assert.match(css, /\.manuscript-support-identity p \{[^}]*font-size: var\(--font-ui-smaller\)/s); assert.match(css, /\.manuscript-support-actions \{[^}]*display: flex;[^}]*flex-wrap: wrap;[^}]*justify-content: center;/s); assert.match(css, /\.manuscript-support-button \{[^}]*display: inline-flex;[^}]*flex: 0 1 auto;[^}]*min-height: 36px;[^}]*border: 2px solid var\(--interactive-accent\);[^}]*box-shadow: var\(--shadow-s\);[^}]*font-size: var\(--font-ui-smaller\)/s); assert.match(css, /\.manuscript-support-bmc-icon \{[^}]*overflow: hidden;/s); assert.match(css, /\.manuscript-support-button:focus-visible/); assert.doesNotMatch(css, /\.manuscript-support-button \{ flex-basis: 100%; \}/);
});

test("workspace controller deduplicates preparation/export and cancels on close", async () => {
  const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const prepared = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan); let prepares = 0; let exports = 0; let resolvePrepare!: (session: typeof prepared) => void;
  const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: (_request, _plan, signal) => { prepares += 1; return new Promise((resolve, reject) => { resolvePrepare = resolve; signal.addEventListener("abort", () => reject(new CompilationCancelledError()), { once: true }); }); }, sessionIsCurrent: async () => true, export: async () => { exports += 1; } }); controller.setDetectedPlan(loaded.root.path, plan);
  const first = controller.prepare(); const second = controller.prepare(); assert.equal(first, second); assert.equal(prepares, 1); resolvePrepare(prepared); await first; controller.state.preparedSession = prepared;
  const exportOne = controller.export(); const exportTwo = controller.export(); assert.equal(exportOne, exportTwo); await exportOne; assert.equal(exports, 1);
  const cancelling = new CompileWorkspaceController(request, request.formatting!, { prepare: (_request, _plan, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new CompilationCancelledError()), { once: true })), sessionIsCurrent: async () => true, export: async () => undefined }); cancelling.setDetectedPlan(loaded.root.path, plan); const pending = cancelling.prepare(); cancelling.close(); await pending; assert.equal(cancelling.state.preparedSession, undefined);
});

test("operation cancellation retains its lock until settled and finalisation disables cancellation", () => { const operations = new OperationStateController(); const operation = operations.begin("exporting")!; assert.equal(operation.cancel(), true); assert.equal(operations.begin("exporting"), undefined); operation.settle(); const next = operations.begin("exporting")!; next.finalise(); assert.equal(next.cancel(), false); next.complete(); assert.equal(operations.busy, false); });

test("content-tree helpers preserve child choices and authoritative sibling order", () => { const root = "Book"; const plan = [{ path: "Book/Manuscript", parentPath: root, name: "Manuscript", kind: "folder", role: "transparent", included: true, order: 0 }, { path: "Book/Manuscript/A.md", parentPath: "Book/Manuscript", name: "A", kind: "note", role: "scene", included: false, order: 0 }, { path: "Book/Manuscript/B.md", parentPath: "Book/Manuscript", name: "B", kind: "note", role: "scene", included: true, order: 1 }] as never; const controller = new CompileWorkspaceController(preparedRequest(root, plan), preparedRequest(root, plan).formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(root, plan); controller.setIncluded("Book/Manuscript", false); controller.setIncluded("Book/Manuscript", true); assert.equal(plan[1].included, false); assert.equal(plan[2].included, true); assert.equal(isEffectivelyIncluded(plan[2], plan, root), true); const moved = moveSibling(plan, root, plan[2].path, -1); assert.equal(moved.find((item) => item.path === plan[2].path)?.order, 0); });

test("long Contents edits preserve scroll, focus, selection, and update only changed rows", () => {
  const root = "Book"; const folder = "Book/Manuscript";
  const plan: ContentPlanItem[] = [{ path: folder, parentPath: root, name: "Manuscript", kind: "folder", role: "transparent", included: true, order: 0 }];
  for (let index = 0; index < 1_000; index += 1) plan.push({ path: `${folder}/Scene ${index + 1}.md`, parentPath: folder, name: `Scene ${index + 1}`, kind: "note", role: "scene", included: true, order: index });
  const request = preparedRequest(root, plan); const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(root, plan);
  const view = new ContentsTreeViewState(); view.prepare(root, plan); view.setScrollTop(8_420); const halfway = plan[501].path; view.setFocus(halfway, "role");
  const before = snapshotRows(controller.state.contentPlan, root); controller.setRole(halfway, "chapter"); const after = snapshotRows(controller.state.contentPlan, root);
  assert.deepEqual(changedRowPaths(before, after), [halfway]); assert.equal(view.scrollTop, 8_420); assert.deepEqual(view.focus, { path: halfway, control: "role" }); assert.equal(controller.state.contentPlan.find((item) => item.path === halfway)?.role, "chapter");
  for (let offset = 1; offset <= 20; offset += 1) { const path = plan[501 + offset].path; const prior = snapshotRows(controller.state.contentPlan, root); view.setFocus(path, "role"); controller.setRole(path, "chapter"); assert.deepEqual(changedRowPaths(prior, snapshotRows(controller.state.contentPlan, root)), [path]); }
  assert.equal(view.scrollTop, 8_420); assert.equal(view.focus?.path, plan[521].path);
});

test("Contents include toggles remain local and stable after manual ordering", () => {
  const root = "Book"; const folder = "Book/Manuscript"; const plan: ContentPlanItem[] = [
    { path: folder, parentPath: root, name: "Manuscript", kind: "folder", role: "transparent", included: true, order: 0 },
    ...["A", "B", "C", "D"].map((name, order): ContentPlanItem => ({ path: `${folder}/${name}.md`, parentPath: folder, name, kind: "note", role: "scene", included: true, order }))
  ];
  const request = preparedRequest(root, plan); const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(root, plan); const view = new ContentsTreeViewState(); view.prepare(root, plan); view.setScrollTop(320);
  const target = `${folder}/C.md`; controller.moveItem(target, -1); assert.deepEqual(controller.state.contentPlan.filter((item) => item.parentPath === folder).map((item) => item.name), ["A", "C", "B", "D"]);
  for (let index = 0; index < 4; index += 1) { const before = snapshotRows(controller.state.contentPlan, root); view.setFocus(target, "include"); controller.setIncluded(target, index % 2 === 1); assert.deepEqual(changedRowPaths(before, snapshotRows(controller.state.contentPlan, root)), [target]); }
  const orderBeforeRoleEdit = controller.state.contentPlan.filter((item) => item.parentPath === folder).map((item) => item.path); controller.setRole(target, "chapter"); assert.deepEqual(controller.state.contentPlan.filter((item) => item.parentPath === folder).map((item) => item.path), orderBeforeRoleEdit); assert.equal(view.scrollTop, 320); assert.deepEqual(view.focus, { path: target, control: "include" });
});

test("Contents folder expansion survives edits in expanded and collapsed branches", () => {
  const root = "Book"; const expanded = `${root}/Expanded`; const collapsed = `${root}/Collapsed`;
  const plan: ContentPlanItem[] = [
    { path: expanded, parentPath: root, name: "Expanded", kind: "folder", role: "chapter", detectedRole: "chapter", included: true, order: 0 },
    { path: `${expanded}/Scene.md`, parentPath: expanded, name: "Scene", kind: "note", role: "scene", detectedRole: "scene", included: true, order: 0 },
    { path: collapsed, parentPath: root, name: "Collapsed", kind: "folder", role: "chapter", detectedRole: "chapter", included: true, order: 1 },
    { path: `${collapsed}/Scene.md`, parentPath: collapsed, name: "Scene", kind: "note", role: "scene", detectedRole: "scene", included: true, order: 0 }
  ];
  const request = preparedRequest(root, plan); const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(root, plan); const view = new ContentsTreeViewState(); view.prepare(root, plan); assert.equal(view.isExpanded(expanded), false); view.toggle(expanded); view.setScrollTop(180); view.setFocus(collapsed, "role"); const indexed = new Map(plan.map((item) => [item.path, item]));
  assert.equal(view.isExpanded(expanded), true); assert.equal(view.isExpanded(collapsed), false); assert.equal(view.isVisible(plan[1], indexed), true); assert.equal(view.isVisible(plan[3], indexed), false);
  controller.setRole(expanded, "transparent"); controller.setRole(collapsed, "transparent"); controller.setIncluded(collapsed, false); controller.setIncluded(collapsed, true);
  assert.equal(view.isExpanded(expanded), true); assert.equal(view.isExpanded(collapsed), false); assert.equal(view.isVisible(plan[1], indexed), true); assert.equal(view.isVisible(plan[3], indexed), false); assert.equal(view.scrollTop, 180); assert.deepEqual(view.focus, { path: collapsed, control: "role" });
});

test("the first warning folder can be collapsed and expanded like every other folder", () => {
  const root = "Book"; const first = `${root}/Copyright notices`; const second = `${root}/Back matter`;
  const plan: ContentPlanItem[] = [
    { path: first, parentPath: root, name: "Copyright notices", kind: "folder", role: "transparent", detectedRole: "transparent", included: true, order: 0, warning: "Check structure" },
    { path: `${first}/Copyright.md`, parentPath: first, name: "Copyright", kind: "note", role: "front-matter", detectedRole: "front-matter", included: true, order: 0 },
    { path: second, parentPath: root, name: "Back matter", kind: "folder", role: "back-matter", detectedRole: "back-matter", included: true, order: 1 },
    { path: `${second}/About.md`, parentPath: second, name: "About", kind: "note", role: "back-matter", detectedRole: "back-matter", included: true, order: 0 }
  ];
  const indexed = new Map(plan.map((item) => [item.path, item])); const view = new ContentsTreeViewState(); view.prepare(root, plan);
  assert.equal(view.isExpanded(first), true); view.toggle(first); view.prepare(root, plan); assert.equal(view.isExpanded(first), false); assert.equal(view.isVisible(plan[1], indexed), false);
  view.toggle(first); assert.equal(view.isExpanded(first), true); assert.equal(view.isVisible(plan[1], indexed), true);
  view.toggle(second); assert.equal(view.isExpanded(second), true); view.toggle(second); assert.equal(view.isExpanded(second), false);
});

test("excluding a folder collapses descendants without clearing child choices or order", () => {
  const root = "Book"; const folder = `${root}/Chapter`; const plan: ContentPlanItem[] = [
    { path: folder, parentPath: root, name: "Chapter", kind: "folder", role: "chapter", included: true, order: 0 },
    { path: `${folder}/A.md`, parentPath: folder, name: "A", kind: "note", role: "scene", included: false, order: 1 },
    { path: `${folder}/B.md`, parentPath: folder, name: "B", kind: "note", role: "scene", included: true, order: 0 }
  ];
  const request = preparedRequest(root, plan); const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => { throw new Error(); }, sessionIsCurrent: async () => true, export: async () => undefined }); controller.setDetectedPlan(root, plan); const view = new ContentsTreeViewState(); view.prepare(root, plan); const indexed = new Map(plan.map((item) => [item.path, item])); const childState = plan.slice(1).map((item) => [item.path, item.included, item.order]);
  controller.setIncluded(folder, false); view.collapse(folder); assert.equal(view.isExpanded(folder), false); assert.equal(view.isVisible(plan[1], indexed), false); assert.deepEqual(plan.slice(1).map((item) => [item.path, item.included, item.order]), childState);
  controller.setIncluded(folder, true); assert.equal(view.isExpanded(folder), false); assert.deepEqual(plan.slice(1).map((item) => [item.path, item.included, item.order]), childState);
  controller.setRole(folder, "ignore"); view.collapse(folder); controller.setRole(folder, "chapter"); assert.equal(view.isExpanded(folder), false); assert.deepEqual(plan.slice(1).map((item) => [item.path, item.included, item.order]), childState);
});

test("Contents correction mode lazily renders expanded branches and retains focus identity", async () => {
  const modal = await readFile(path.join("src", "compile-modal.ts"), "utf8"); const contents = await readFile(path.join("src", "workspace", "contents-step.ts"), "utf8");
  assert.match(modal, /renderContentsStep\(body, this\.controller, this\.contentsViewState\)/); assert.doesNotMatch(modal, /renderContentsStep\(body, this\.controller, \(\) => this\.render\(\)\)/);
  assert.match(contents, /filter\(\(\{ item \}\) => viewState\.isVisible/); assert.match(contents, /viewState\.collapse\(item\.path\)/); assert.match(contents, /focus\(\{ preventScroll: true \}\)/);
});
test("Correct structure is the primary accessible Contents action with an active finish state", async () => {
  const contents = await readFile(path.join("src", "workspace", "contents-step.ts"), "utf8"); const css = await readFile("styles.css", "utf8");
  assert.match(contents, /"Finish correcting structure"\s*:\s*"Correct structure"/); assert.match(contents, /Change folder and note types, inclusion, and order\./); assert.match(contents, /mod-cta manuscript-correct-structure/); assert.match(contents, /setIcon\(icon, "list-tree"\)/); assert.match(contents, /"aria-label": label/); assert.match(contents, /setAttribute\("aria-pressed", String\(viewState\.correctionMode\)\)/); assert.match(contents, /setCorrectionMode\(!viewState\.correctionMode\)/);
  assert.match(css, /\.manuscript-correct-structure[^}]*min-height:\s*44px/); assert.match(css, /\.manuscript-correct-structure\.is-active/); assert.match(css, /\.manuscript-compile-workspace button:focus-visible/);
});
test("folder disclosure controls have a 30px target without enlarging note markers or order controls", async () => {
  const contents = await readFile(path.join("src", "workspace", "contents-step.ts"), "utf8"); const css = await readFile("styles.css", "utf8");
  assert.equal((contents.match(/function createFolderToggle\(/g) ?? []).length, 1); assert.match(contents, /item\.kind === "folder"[\s\S]*createFolderToggle\(label/);
  assert.doesNotMatch(contents, /role === "transparent"\) \{ renderOutlineChildren/);
  assert.match(contents, /setAttribute\("aria-expanded", String\(expanded\)\)/); assert.match(contents, /setAttribute\("aria-label", `\$\{expanded \? "Collapse" : "Expand"\}/);
  assert.match(css, /\.manuscript-folder-toggle\s*\{[\s\S]*min-width:\s*30px;[\s\S]*min-height:\s*30px;[\s\S]*font-size:\s*21px;[\s\S]*transition:\s*transform/);
  assert.match(css, /\.manuscript-outline-row[^}]*column-gap:\s*14px/); assert.match(css, /\.manuscript-content-name[^}]*column-gap:\s*14px/);
  assert.doesNotMatch(css, /\.manuscript-order-buttons[^}]*font-size:\s*21px/); assert.doesNotMatch(css, /\.manuscript-outline-marker[^}]*font-size:\s*21px/);
});

test("format selector is an accessible responsive radio group with obvious selection", async () => {
  const source = await readFile(path.join("src", "workspace", "create-docx-step.ts"), "utf8"); const css = await readFile("styles.css", "utf8");
  assert.match(source, /text: "Export format"/); assert.match(source, /role: "radiogroup"/); assert.match(source, /role: "radio"/); assert.match(source, /"aria-checked": String\(active\)/);
  assert.doesNotMatch(source, /setName\(EXPORT_FORMAT_DETAILS\[format\]\.label\)[\s\S]*addDropdown/);
  for (const label of ["Microsoft Word document", "OpenDocument Text", "Ebook", "Standalone webpage", "Portable plain-text manuscript", "Structured manuscript"]) assert.match(source, new RegExp(label));
  assert.equal(formatAfterKey("docx", "ArrowRight"), "odt"); assert.equal(formatAfterKey("docx", "ArrowLeft"), "xml"); assert.equal(formatAfterKey("epub", "ArrowDown"), "html"); assert.equal(formatAfterKey("html", "ArrowUp"), "epub"); assert.equal(formatAfterKey("epub", "Home"), "docx"); assert.equal(formatAfterKey("epub", "End"), "xml"); assert.equal(formatAfterKey("epub", "Enter"), undefined);
  assert.match(css, /\.manuscript-format-option[^}]*min-height:\s*64px/); assert.match(css, /\.manuscript-format-option\.is-selected[^}]*border-color:\s*var\(--interactive-accent\)/); assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.manuscript-format-selector \{ grid-template-columns: 1fr; \}/);
});
test("combined Create DOCX UI exposes metric indentation and every supported scene break distinctly", async () => {
  const source = await readFile(path.join("src", "workspace", "create-docx-step.ts"), "utf8"); const css = await readFile("styles.css", "utf8"); assert.match(source, /First-line indent \(cm\)/); assert.doesNotMatch(source, /0\.25 in|0\.5 in|inch/i);
  assert.deepEqual(["docx", "odt", "epub", "html", "markdown", "xml"].map((format) => supportsParagraphIndentation(format as never)), [true, true, true, true, false, false]);
  assert.match(source, /setName\("Indent first line of paragraphs"\)\.setDesc\("Indent only the first line of later body paragraphs; first paragraphs after headings and scene breaks stay flush left\."\)\.addToggle/); assert.match(source, /setDisabled\(!formatting\.indentParagraphs\)/); assert.match(source, /toggleClass\("is-disabled", !value\)/); assert.doesNotMatch(source, /indentSize\.settingEl\.hidden/); assert.match(css, /\.manuscript-indent-size\.is-disabled \.setting-item-name/); assert.match(css, /\.manuscript-indent-size\.is-disabled \.setting-item-control/); assert.match(source, /Markdown does not support portable first-line indentation\./); assert.match(source, /Paragraph indentation is controlled by the application that consumes the XML\./);
  for (const option of ["#", "*", "***", "* * *", "", "custom"]) assert.match(source, new RegExp(`addOption\\(\\"${option.replace(/\*/g, "\\*")}\\"`));
});

test("export preview view model references the exact prepared Book", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(preparedRequest(loaded.root.path, plan), plan); const view = buildExportPreviewViewModel(session); assert.equal(view.book, session.book); assert.equal(createPreparedExportRequest(session, session.outputPaths[0], false).book, view.book); assert.deepEqual(view.parts.map((part) => part.chapters.map((chapter) => chapter.sceneCount)), [[2], [1]]); });

test("history service records success only after requested and distinguishes failure/cancellation", async () => { const settings = { ...DEFAULT_SETTINGS, exportHistory: [], compileLogs: [], maximumExportHistoryEntries: 10, enableCompileLogs: true }; let saves = 0; const history = new CompileHistoryService(() => settings, async () => { saves += 1; }, "0.9.1"); const record = { timestamp: new Date("2026-01-01"), started: Date.now(), profile: "Test", manuscript: "Book", format: "docx" as const, outputFiles: ["Exports/Book.docx"] }; assert.equal(history.getHistory().length, 0); await history.recordFailure({ ...record, message: "failed" }); await history.recordCancellation(record); await history.recordSuccess(record); assert.deepEqual(history.getHistory().map((item) => [item.success, item.cancelled]), [[true, undefined], [false, true], [false, undefined]]); assert.equal(saves, 3); });
test("compile logs persist warning codes, ignore information, and redact absolute failure paths", async () => { const settings = { ...DEFAULT_SETTINGS, exportHistory: [], compileLogs: [], maximumExportHistoryEntries: 10, enableCompileLogs: true }; const history = new CompileHistoryService(() => settings, async () => undefined, "0.9.2"); const result = { wordCount: 10, issues: [{ severity: "warning", code: "invalid-metadata", message: "SecretCharacter: Elin" }, { severity: "warning", code: "invalid-metadata", message: "SecretCharacter: Henrik" }, { severity: "information", code: "metadata-removed", message: "2,894 metadata fields removed" }] } as never; await history.recordFailure({ timestamp: new Date("2026-01-01"), started: Date.now(), profile: "Test", manuscript: "Book", format: "docx", outputFiles: [], result, message: "Failed at /Users/alice/SecretBook/output.docx" }); assert.deepEqual(settings.compileLogs[0].warnings, ["2 × invalid-metadata"]); assert.doesNotMatch(JSON.stringify(settings.compileLogs[0]), /Elin|Henrik|alice|SecretBook|metadata-removed/); });

test("stale prepared source keeps the workspace openable for Refresh Preview", async () => { const loaded = await loadFixtureTree("samples/Book 1 - Warden of Silence"); const plan = await classifyContentPlan(loaded.vault as never, createContentPlan(loaded.root, "novel-parts")); const request = preparedRequest(loaded.root.path, plan); const session = await new CompilePreparationService(loaded.vault as never, createDefaultProfiles()[1], 250).prepare(request, plan); let exports = 0; const controller = new CompileWorkspaceController(request, request.formatting!, { prepare: async () => session, sessionIsCurrent: async () => false, export: async () => { exports += 1; } }); controller.setDetectedPlan(loaded.root.path, plan); controller.state.preparedSession = session; assert.equal(await controller.export(), false); assert.equal(exports, 0); assert.equal(controller.state.preparedSession, undefined); assert.match(controller.state.error?.message ?? "", /Refresh the preview/i); });

test("main delegates orchestration and ExportCoordinator is the sole exporter owner", async () => { const mainSource = await readFile(path.join("src", "main.ts"), "utf8"); const coordinatorSource = await readFile(path.join("src", "export-coordinator.ts"), "utf8"); const otherProduction = (await Promise.all(["compile-command-service.ts", "compile-modal.ts", "validation.ts"].map((file) => readFile(path.join("src", file), "utf8")))).join("\n"); assert.doesNotMatch(mainSource, /new (DocxMemoryExporter|OdtExporter|EpubExporter|HtmlExporter|MarkdownExporter|XmlExporter)|recordSuccess\(|recordFailure\(|calculateSourceFingerprint/); assert.match(mainSource, /new ExportCoordinator/); assert.match(coordinatorSource, /exportPreparedSession\(session: PreparedCompileSession/); assert.match(coordinatorSource, /EXPORTERS\[format\]/); assert.doesNotMatch(otherProduction, /EXPORTERS\[/); assert.doesNotMatch(coordinatorSource, /ScannedBook/); });

test("0.9.2 production source has one preparation/export route and no external execution, network, telemetry, or plugin API access", async () => {
  const files = await sourceFiles("src"); const entries = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")] as const)); const source = entries.map(([, content]) => content).join("\n");
  assert.deepEqual(entries.filter(([, content]) => /new VaultScanner\(/.test(content)).map(([file]) => file), [path.join("src", "compile-preparation.ts")]);
  assert.deepEqual(entries.filter(([, content]) => /new ExportCoordinator\(/.test(content)).map(([file]) => file), [path.join("src", "main.ts")]);
  assert.doesNotMatch(source, /from\s+["'](?:node:)?child_process["']|\b(?:execFile|execSync|spawnSync)\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|telemetry|plugins\.getPlugin|app\.plugins/);
  assert.doesNotMatch(source, /createDocx\s*\(/);
  assert.deepEqual(entries.filter(([, content]) => /pandoc/i.test(content)).map(([file]) => file).sort(), ["src/history-storage.ts", "src/profiles.ts", "src/settings.ts", "src/simple-workflow.ts"]);
});
test("production source remains mobile-safe, popout-safe, and lifecycle-registered", async () => {
  const files = await sourceFiles("src"); const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n"); const main = await readFile(path.join("src", "main.ts"), "utf8");
  assert.doesNotMatch(source, /from\s+["'](?:node:|fs["'/]|path["'/]|os["'/]|electron["'/]|child_process["'/])/);
  assert.doesNotMatch(source, /\bglobalThis\b|\bprocess\.platform\b|document\.createElement|document\.body|\bwindow\.set(?:Timeout|Interval)\b/);
  assert.doesNotMatch(source, /\.innerHTML\b|\.style\.(?:display|color|background|width|height)|setAttribute\(["']style["']/);
  assert.doesNotMatch(source, /["']\.obsidian(?:\/|["'])|\bas any\b|\bas TFile\b|\bas TFolder\b/);
  assert.match(main, /registerEvent\(this\.app\.workspace\.on\("file-menu"/); assert.match(main, /onunload\(\): void \{ this\.operations\.cancel\(\); \}/); assert.doesNotMatch(main, /hotkeys\s*:/);
});
test("plugin CSS selectors are owned, theme-safe, and retain accessibility modes", async () => {
  const css = await readFile("styles.css", "utf8"); const selectorBlocks = [...css.matchAll(/(?:^|})(?!\s*@)([^{}]+)\{/g)].map((match) => match[1].trim()).filter((selector) => selector && !selector.startsWith("@"));
  for (const block of selectorBlocks) for (const selector of block.split(",")) assert.match(selector, /\.manuscript-/, `Unscoped selector: ${selector.trim()}`);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|!important/i); assert.match(css, /@media \(forced-colors: active\)/); assert.match(css, /@media \(prefers-reduced-motion: reduce\)/); assert.match(css, /:focus-visible/);
});

test("0.9.2 version metadata and release package allowlist are consistent", async () => { const manifest = JSON.parse(await readFile("manifest.json", "utf8")); const packageJson = JSON.parse(await readFile("package.json", "utf8")); const lock = JSON.parse(await readFile("package-lock.json", "utf8")); const versions = JSON.parse(await readFile("versions.json", "utf8")); const packaging = await readFile(path.join("scripts", "package.mjs"), "utf8"); assert.equal(manifest.version, "0.9.2"); assert.equal(packageJson.version, manifest.version); assert.equal(lock.version, manifest.version); assert.equal(lock.packages[""].version, manifest.version); assert.equal(Object.values(versions).at(-1), manifest.minAppVersion); assert.match(packaging, /const required = \["main\.js", "manifest\.json", "styles\.css"\]/); });
test("repository hygiene ignores runtime state and rejects tracked plugin data", async () => {
  for (const candidate of ["data.json", ".obsidian/plugins/manuscript-compiler/data.json", "nested/manuscript-compiler/data.json"]) {
    await execFileAsync("git", ["check-ignore", "--no-index", "--quiet", candidate]);
  }
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], { encoding: "utf8" });
  const prohibited = stdout.split("\0").filter((file) => /(?:^|\/)(?:\.obsidian\/plugins\/)?manuscript-compiler\/data\.json$/i.test(file) || /^data\.json$/i.test(file));
  assert.deepEqual(prohibited, []);
});

let failures = 0;
for (const [name, action] of tests) { try { await action(); process.stdout.write(`✓ ${name}\n`); } catch (error) { failures += 1; process.stderr.write(`✗ ${name}\n${error instanceof Error ? error.stack : String(error)}\n`); } }
if (failures) process.exitCode = 1; else process.stdout.write(`${tests.length} tests passed.\n`);
