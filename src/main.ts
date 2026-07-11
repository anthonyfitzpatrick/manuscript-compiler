import { FileSystemAdapter, Notice, Plugin, TFile, TFolder } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { DocxExporter, MarkdownExporter, type ExportRequest } from "./exporter";
import type { CompilePreview, CompileResult, CompileWarning } from "./model";
import { PandocError, PandocService, pathExists, resolveVaultOrAbsolutePath } from "./pandoc";
import { activeProfile, migrateSettings, profileId } from "./profiles";
import { DEFAULT_SETTINGS, type CompileLogEntry, type ExportHistoryEntry, type ExportTarget, ManuscriptCompilerSettings } from "./settings";
import { CompilePreviewModal, CompileReportModal, ConfirmOverwriteModal, FolderSuggestModal, ManuscriptCompilerSettingTab, showError } from "./ui";
import { VaultScanner } from "./vault-scanner";
import { WarningEngine } from "./warnings";

const BOOK_FOLDER_PATTERN = /^(?:part\b|(?:ebook |print )?(?:front|back) matter$)/i;
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  async onload(): Promise<void> { await this.loadSettings(); this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this)); this.addCommand({ id: "compile-current-book", name: "Compile Current Book", callback: () => { void this.compileCurrentBook(); } }); this.addCommand({ id: "compile-selected-folder", name: "Compile Selected Folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.compileFolder(folder); }).open(); } }); }
  async loadSettings(): Promise<void> { const loaded = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ManuscriptCompilerSettings> | null); this.settings = migrateSettings(loaded); await this.saveSettings(); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  getActiveProfile() { return activeProfile(this.settings); }
  async detectPandoc() { return new PandocService(this.settings).detect(); }
  async openExport(path: string): Promise<void> { try { const file = this.app.vault.getAbstractFileByPath(path); if (file instanceof TFile && file.extension === "md") { await this.app.workspace.getLeaf(true).openFile(file); return; } if (!(this.app.vault.adapter instanceof FileSystemAdapter)) throw new Error("Exported files can only be opened automatically from a local vault."); const absolute = this.app.vault.adapter.getFullPath(path); const electron = (globalThis as typeof globalThis & { require: (id: string) => { shell: { openPath(path: string): Promise<string> } } }).require("electron"); const error = await electron.shell.openPath(absolute); if (error) throw new Error(error); } catch (error) { showError(error); } }
  async clearHistory(): Promise<void> { this.settings.exportHistory = []; this.settings.compileLogs = []; await this.saveSettings(); }
  private async compileCurrentBook(): Promise<void> { try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); await this.compileFolder(folder); } catch (error) { showError(error); } }
  private resolveCurrentBook(): TFolder | null { const configuredPath = this.getActiveProfile().manuscriptRoot || this.settings.defaultManuscriptFolder; if (configuredPath) { const configured = this.app.vault.getAbstractFileByPath(configuredPath); if (configured instanceof TFolder) return configured; } let folder = this.app.workspace.getActiveFile()?.parent ?? null; while (folder && folder.path !== "/") { if (folder.children.some((child) => child instanceof TFolder && BOOK_FOLDER_PATTERN.test(child.name))) return folder; folder = folder.parent; } return null; }

  private async compileFolder(folder: TFolder): Promise<void> {
    const started = Date.now(); const timestamp = new Date(); const profile = this.getActiveProfile(); const outputFiles: string[] = []; let result: CompileResult | undefined; let pandocVersion: string | undefined; let diagnostics = "";
    try {
      new Notice(`Preparing “${folder.name}” with profile “${profile.name}”…`);
      const compiler = new ManuscriptCompiler(this.app.vault); const book = await compiler.buildModel(new VaultScanner().scan(folder), profile); const markdownExporter = new MarkdownExporter(this.app.vault);
      const preliminary = compiler.compile(book, profile, "", this.settings.readingWordsPerMinute, timestamp);
      const variables = { ...profile.variables, BookTitle: profile.variables.BookTitle || book.title, Date: timestamp.toISOString().slice(0, 10), Year: timestamp.getFullYear(), WordCount: preliminary.statistics.totalWordCount, ChapterCount: preliminary.statistics.chapterCount };
      const markdownPath = markdownExporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".md"); const docxPath = markdownExporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".docx");
      const paths = this.targetPaths(profile.exportTarget, markdownPath, docxPath); const primaryPath = paths[0] ?? markdownPath; result = compiler.compile(book, profile, primaryPath, this.settings.readingWordsPerMinute, timestamp);
      const pandoc = profile.exportTarget === "markdown" ? { available: false, explanation: "Not required for Markdown export." } : await this.detectPandoc(); pandocVersion = pandoc.version;
      const exportIssues = await this.exportIssues(profile.exportTarget, paths, pandoc.available, pandoc.explanation, profile.referenceDocx, profile.pandocMetadataFile);
      const allIssues = [...result.issues, ...exportIssues]; const visibleIssues = new WarningEngine().filter(allIssues, this.settings.minimumWarningLevel);
      const docxReady = pandoc.available && !exportIssues.some((issue) => issue.severity === "error" && /template|metadata file/i.test(issue.message)); const canExport = profile.exportTarget !== "docx" || docxReady;
      const slash = primaryPath.lastIndexOf("/"); const preview: CompilePreview = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), book, outputPath: primaryPath, outputFolder: slash < 0 ? "" : primaryPath.slice(0, slash), outputFilename: slash < 0 ? primaryPath : primaryPath.slice(slash + 1), outputFormats: this.targetFormats(profile.exportTarget), outputPaths: paths, pandocAvailable: pandoc.available, pandocVersion: pandoc.version, pandocExplanation: pandoc.explanation, referenceDocx: profile.referenceDocx, estimatedPages: Math.max(1, Math.ceil(result.wordCount / 300)), canExport };
      if (this.settings.showPreview && !await this.confirmPreview(preview)) { new Notice("Compilation cancelled."); return; }
      if (!canExport) throw new Error(pandoc.explanation ?? "DOCX export is unavailable.");
      const effectivePaths = paths.filter((path) => !path.toLowerCase().endsWith(".docx") || docxReady);
      for (const path of effectivePaths) if (await this.outputExists(path) && !await this.confirmOverwrite(path)) { new Notice("Compilation cancelled."); return; }
      const request = (outputPath: string): ExportRequest => ({ book, profile, markdown: result!.markdown, outputPath, variables, pandoc, keepTemporaryMarkdown: profile.keepIntermediateMarkdown || this.settings.keepTemporaryMarkdown });
      if (profile.exportTarget !== "docx") { const exported = await markdownExporter.export(request(markdownPath)); outputFiles.push(exported.path); }
      if (profile.exportTarget !== "markdown" && docxReady) { const exported = await new DocxExporter(this.app.vault, new PandocService(this.settings), markdownExporter).export(request(docxPath)); outputFiles.push(exported.path); diagnostics = [exported.stdout, exported.stderr].filter(Boolean).join("\n"); }
      const report: CompileResult = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message) }; const fullSuccess = profile.exportTarget === "markdown" || docxReady; await this.recordExport(fullSuccess, timestamp, started, profile.name, folder.path, profile.exportTarget, outputFiles, report, pandocVersion, fullSuccess ? diagnostics : "DOCX output was skipped because Pandoc or its configured inputs were unavailable."); new CompileReportModal(this.app, outputFiles.join(", "), report, this.settings.showStatistics).open();
    } catch (error) {
      const detail = error instanceof PandocError ? [error.message, error.stderr, error.stdout].filter(Boolean).join("\n") : error instanceof Error ? error.message : String(error); diagnostics = detail; console.error("Manuscript Compiler export failure", error);
      await this.recordExport(false, timestamp, started, profile.name, folder.path, profile.exportTarget, outputFiles, result, pandocVersion, diagnostics); showError(new Error(this.friendlyError(error)));
    }
  }
  private targetFormats(target: ExportTarget): string[] { return target === "markdown-docx" ? ["Markdown", "DOCX"] : [target === "docx" ? "DOCX" : "Markdown"]; }
  private targetPaths(target: ExportTarget, markdown: string, docx: string): string[] { return target === "markdown-docx" ? [markdown, docx] : [target === "docx" ? docx : markdown]; }
  private async exportIssues(target: ExportTarget, paths: string[], pandocAvailable: boolean, explanation: string | undefined, reference: string, metadataFile: string): Promise<CompileWarning[]> {
    const issues: CompileWarning[] = []; if (target !== "markdown" && !pandocAvailable) issues.push({ severity: "error", code: "pandoc-missing", message: explanation ?? "Pandoc is unavailable." });
    if (target !== "markdown" && reference) { const resolved = resolveVaultOrAbsolutePath(this.app.vault, reference); if (!await pathExists(resolved)) issues.push({ severity: "error", code: "template-missing", message: `Reference DOCX template is missing: ${reference}` }); }
    if (target !== "markdown" && metadataFile) { const resolved = resolveVaultOrAbsolutePath(this.app.vault, metadataFile); if (!await pathExists(resolved)) issues.push({ severity: "error", code: "metadata-file-missing", message: `Pandoc metadata file is missing: ${metadataFile}` }); }
    for (const path of paths) if (await this.outputExists(path)) issues.push({ severity: "warning", code: "output-exists", message: `Output already exists and will require confirmation: ${path}`, path }); return issues;
  }
  private async outputExists(path: string): Promise<boolean> { if (this.app.vault.getAbstractFileByPath(path)) return true; if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return false; return pathExists(this.app.vault.adapter.getFullPath(path)); }
  private async recordExport(success: boolean, timestamp: Date, started: number, profile: string, manuscript: string, format: ExportTarget, outputFiles: string[], result?: CompileResult, pandocVersion?: string, diagnostics?: string): Promise<void> {
    const base: ExportHistoryEntry = { id: profileId(), timestamp: timestamp.toISOString(), profile, manuscript, outputFiles, wordCount: result?.wordCount ?? 0, success, message: success ? undefined : diagnostics?.split(/\r?\n/)[0] };
    this.settings.exportHistory.unshift(base); this.settings.exportHistory = this.settings.exportHistory.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries));
    if (this.settings.enableCompileLogs) { const log: CompileLogEntry = { ...base, exportFormats: format, pandocVersion, durationMs: Date.now() - started, warnings: result?.warnings ?? [], diagnostics }; this.settings.compileLogs.unshift(log); this.settings.compileLogs = this.settings.compileLogs.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries)); }
    await this.saveSettings();
  }
  private friendlyError(error: unknown): string { const message = error instanceof Error ? error.message : String(error); if (/ENOENT|not found/i.test(message)) return "Pandoc was not found. Check the configured executable path."; if (/permission|EACCES/i.test(message)) return "Permission was denied while creating the export. Check the output folder and template permissions."; if (error instanceof PandocError) return `DOCX creation failed: ${error.stderr.trim() || error.message}`; return message; }
  private confirmPreview(preview: CompilePreview): Promise<boolean> { return this.modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings.expandPreviewTree, this.settings.showStatistics, finish)); }
  private confirmOverwrite(path: string): Promise<boolean> { return this.modalPromise((finish) => new ConfirmOverwriteModal(this.app, path, finish)); }
  private modalPromise(factory: (finish: (value: boolean) => void) => { open(): void; onClose(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; const modal = factory(finish); const close = modal.onClose.bind(modal); modal.onClose = (): void => { close(); finish(false); }; modal.open(); }); }
}
