import { FileSystemAdapter, Notice, Plugin, TFile, TFolder } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { CompilationCancelledError, throwIfCancelled } from "./cancellation";
import { DiagnosticsReportGenerator } from "./diagnostics";
import { DocxExporter, MarkdownExporter, type ExportRequest } from "./exporter";
import { canProceedWithExport } from "./export-safety";
import type { CompilePreview, CompileResult, CompileWarning } from "./model";
import { pathExists } from "./filesystem";
import { getObsidianVersion, openExternalVaultFile, revealExternalVaultFile } from "./platform-compat";
import { activeProfile, profileId, repairSettings } from "./profiles";
import { DEFAULT_SETTINGS, type CompileLogEntry, type ExportHistoryEntry, type ExportTarget, ManuscriptCompilerSettings } from "./settings";
import { CompilationProgressModal, CompilePreviewModal, CompileReportModal, ConfirmOverwriteModal, DiagnosticsReportModal, FolderSuggestModal, ManuscriptCompilerSettingTab, showError, ValidationReportModal } from "./ui";
import { ManuscriptValidationService } from "./validation";
import { VaultScanner } from "./vault-scanner";
import { WarningEngine } from "./warnings";
import { FirstRunWizardModal } from "./wizards";
import { SimpleCompileModal } from "./compile-modal";
import { inferStructurePreset, resolveSimpleCompileRequest, type SimpleCompileRequest } from "./simple-workflow";
import type { CompileProfile } from "./settings";

const BOOK_FOLDER_PATTERN = /^(?:part\b|(?:ebook |print )?(?:front|back) matter$)/i;
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  private compilationActive = false;
  async onload(): Promise<void> { await this.loadSettings(); this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this)); this.addCommand({ id: "compile-manuscript", name: "Compile Manuscript", callback: () => new SimpleCompileModal(this.app, this).open() }); this.addCommand({ id: "compile-current-book", name: "Compile Current Book (legacy)", callback: () => { void this.compileCurrentBook(); } }); this.addCommand({ id: "compile-selected-folder", name: "Compile Selected Folder (legacy)", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.compileFolder(folder); }).open(); } }); this.addCommand({ id: "validate-manuscript", name: "Validate Manuscript", callback: () => { void this.validateManuscript(); } }); this.addCommand({ id: "generate-diagnostics-report", name: "Generate Diagnostics Report", callback: () => { void this.generateDiagnostics(); } }); this.app.workspace.onLayoutReady(() => { if (!this.settings.onboardingCompleted) new FirstRunWizardModal(this.app, this).open(); }); }
  async loadSettings(): Promise<void> { const raw = await this.loadData() as Partial<ManuscriptCompilerSettings> | null; const loaded = Object.assign({}, DEFAULT_SETTINGS, raw); if (raw && raw.onboardingCompleted === undefined) loaded.onboardingCompleted = true; const previousWarnings = Array.isArray(loaded.configurationWarnings) ? loaded.configurationWarnings.length : 0; this.settings = repairSettings(loaded); if (raw && raw.defaultStructurePreset === undefined) this.settings.defaultStructurePreset = inferStructurePreset(this.getActiveProfile()); await this.saveSettings(); if (this.settings.configurationWarnings.length > previousWarnings) new Notice("Manuscript Compiler repaired invalid settings. Run Validate Manuscript for details.", 8000); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  getActiveProfile() { return activeProfile(this.settings); }
  async openExport(path: string): Promise<void> { try { const file = this.app.vault.getAbstractFileByPath(path); if (file instanceof TFile && file.extension === "md") { await this.app.workspace.getLeaf(true).openFile(file); return; } if (!await openExternalVaultFile(this.app.vault, path)) throw new Error("Obsidian could not open this non-Markdown export automatically. Open it from your file manager."); } catch (error) { showError(error); } }
  async clearHistory(): Promise<void> { this.settings.exportHistory = []; this.settings.compileLogs = []; await this.saveSettings(); }
  async compileRequest(request: SimpleCompileRequest): Promise<void> { const folder = this.app.vault.getAbstractFileByPath(request.manuscriptRoot); if (!(folder instanceof TFolder)) throw new Error("The manuscript folder does not exist."); const profile = resolveSimpleCompileRequest(request, this.getActiveProfile()); profile.generateTableOfContents = request.outputFormat !== "markdown" && this.settings.includeTableOfContentsByDefault; this.settings.defaultManuscriptFolder = request.manuscriptRoot; this.settings.defaultExportFolder = request.exportFolder; this.settings.defaultStructurePreset = request.structurePreset; this.settings.defaultDocxStyle = request.docxPreset; this.settings.defaultExportFormat = request.outputFormat; await this.saveSettings(); await this.compileFolder(folder, profile); }
  async compileSampleManuscript(): Promise<void> { const sample = this.app.vault.getAbstractFileByPath("samples/Complete Sample Book"); if (sample instanceof TFolder) await this.compileFolder(sample); else new Notice("Sample manuscript was not found in this vault. Copy the repository samples folder into the vault to try it.", 8000); }
  private async compileCurrentBook(): Promise<void> { try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); await this.compileFolder(folder); } catch (error) { showError(error); } }
  private async validateManuscript(): Promise<void> { try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); const result = await new ManuscriptValidationService(this.app.vault, this.settings).validate(new VaultScanner().scan(folder), this.getActiveProfile()); new ValidationReportModal(this.app, folder.path, result).open(); } catch (error) { showError(error); } }
  private async generateDiagnostics(): Promise<void> { try { const report = new DiagnosticsReportGenerator().generate({ pluginVersion: this.manifest.version, obsidianVersion: getObsidianVersion(), operatingSystem: navigator.userAgent, profile: this.getActiveProfile(), settings: this.settings }); new DiagnosticsReportModal(this.app, report, () => this.saveDiagnostics(report)).open(); } catch (error) { showError(error); } }
  private async saveDiagnostics(report: string): Promise<string> { const stamp = new Date().toISOString().replace(/[:.]/g, "-"); const path = `Manuscript Compiler Diagnostics/Diagnostics ${stamp}.md`; await new MarkdownExporter(this.app.vault).write(path, report); return path; }
  private resolveCurrentBook(): TFolder | null { const configuredPath = this.getActiveProfile().manuscriptRoot || this.settings.defaultManuscriptFolder; if (configuredPath) { const configured = this.app.vault.getAbstractFileByPath(configuredPath); if (configured instanceof TFolder) return configured; } let folder = this.app.workspace.getActiveFile()?.parent ?? null; while (folder && folder.path !== "/") { if (folder.children.some((child) => child instanceof TFolder && BOOK_FOLDER_PATTERN.test(child.name))) return folder; folder = folder.parent; } return null; }

  async compileFolder(folder: TFolder, compileProfile?: CompileProfile): Promise<void> {
    if (this.compilationActive) { new Notice("A manuscript compilation is already running."); return; } this.compilationActive = true;
    const controller = new AbortController(); let progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open();
    const started = Date.now(); const timestamp = new Date(); const profile = compileProfile ?? this.getActiveProfile(); const outputFiles: string[] = []; let result: CompileResult | undefined; let pandocVersion: string | undefined; let diagnostics = ""; let scanDurationMs = 0; let parseDurationMs = 0; let filterDurationMs = 0; let generationDurationMs = 0; let exportDurationMs = 0;
    try {
      new Notice(`Preparing “${folder.name}” with profile “${profile.name}”…`);
      await this.progressStage(progress, "Scanning manuscript…"); const scanStarted = performance.now(); const scan = new VaultScanner().scan(folder); scanDurationMs = performance.now() - scanStarted; throwIfCancelled(controller.signal);
      await this.progressStage(progress, "Parsing files and applying metadata filters…"); const compiler = new ManuscriptCompiler(this.app.vault); const book = await compiler.buildModel(scan, profile, controller.signal); parseDurationMs = compiler.timings.parseDurationMs; filterDurationMs = compiler.timings.filterDurationMs; const markdownExporter = new MarkdownExporter(this.app.vault);
      await this.progressStage(progress, "Generating canonical Markdown…"); const preliminary = compiler.compile(book, profile, "", this.settings.readingWordsPerMinute, timestamp, controller.signal);
      const variables = { ...profile.variables, BookTitle: profile.variables.BookTitle || book.title, Date: timestamp.toISOString().slice(0, 10), Year: timestamp.getFullYear(), WordCount: preliminary.statistics.totalWordCount, ChapterCount: preliminary.statistics.chapterCount };
      const markdownPath = markdownExporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".md"); const docxPath = markdownExporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".docx");
      const paths = this.targetPaths(profile.exportTarget, markdownPath, docxPath); const primaryPath = paths[0] ?? markdownPath; result = compiler.compile(book, profile, primaryPath, this.settings.readingWordsPerMinute, timestamp, controller.signal); generationDurationMs = compiler.timings.generationDurationMs;
      pandocVersion = "Built-in DOCX";
      const exportIssues = await this.exportIssues(paths);
      const allIssues = [...result.issues, ...exportIssues]; const visibleIssues = new WarningEngine().filter(allIssues, this.settings.minimumWarningLevel);
      const docxReady = true; const canExport = canProceedWithExport(allIssues, profile.exportTarget, docxReady);
      const slash = primaryPath.lastIndexOf("/"); const preview: CompilePreview = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), book, outputPath: primaryPath, outputFolder: slash < 0 ? "" : primaryPath.slice(0, slash), outputFilename: slash < 0 ? primaryPath : primaryPath.slice(slash + 1), outputFormats: this.targetFormats(profile.exportTarget), outputPaths: paths, docxEngine: "built-in", estimatedPages: Math.max(1, Math.ceil(result.wordCount / 300)), canExport };
      progress.finish();
      if (this.settings.showPreview && !await this.confirmPreview(preview)) { new Notice("Compilation cancelled."); return; }
      if (!canExport) throw new Error("Export is blocked by an unsafe or invalid configuration. Run Validate Manuscript for details.");
      const effectivePaths = paths;
      for (const path of effectivePaths) if (this.settings.warnBeforeOverwrite && await this.outputExists(path) && !await this.confirmOverwrite(path)) { new Notice("Compilation cancelled."); return; }
      progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open(); const request = (outputPath: string): ExportRequest => ({ book, profile, markdown: result!.markdown, outputPath, variables, keepTemporaryMarkdown: profile.keepIntermediateMarkdown || this.settings.keepTemporaryMarkdown, signal: controller.signal, onCommit: () => progress.lock("Finalizing export atomically…") });
      const exportStarted = performance.now(); if (profile.exportTarget !== "markdown") { await this.progressStage(progress, "Generating DOCX locally…"); const exported = await new DocxExporter(this.app.vault, markdownExporter).export(request(docxPath)); outputFiles.push(exported.path); }
      throwIfCancelled(controller.signal); if (profile.exportTarget !== "docx") { await this.progressStage(progress, "Writing Markdown export…"); progress.lock("Finalizing export atomically…"); const exported = await markdownExporter.export(request(markdownPath)); outputFiles.push(exported.path); }
      exportDurationMs = performance.now() - exportStarted; progress.finish(); const report: CompileResult = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), timings: { totalMs: Date.now() - started, scanMs: scanDurationMs, parseMs: parseDurationMs, filterMs: filterDurationMs, generationMs: generationDurationMs, exportMs: exportDurationMs } }; await this.recordExport(true, timestamp, started, profile.name, folder.path, profile.exportTarget, outputFiles, report, pandocVersion, diagnostics, { scanDurationMs, parseDurationMs, filterDurationMs, generationDurationMs, exportDurationMs }); const open = () => { if (outputFiles[0]) void this.openExport(outputFiles[0]); }; const reveal = () => { if (outputFiles[0] && !revealExternalVaultFile(this.app.vault, outputFiles[0])) new Notice("Show in folder is unavailable on this platform."); }; new CompileReportModal(this.app, outputFiles.join(", "), report, this.settings.showStatistics, open, reveal).open(); if (this.settings.openAfterCompile && outputFiles[0]) await this.openExport(outputFiles[0]);
    } catch (error) {
      progress.finish(); if (controller.signal.aborted || error instanceof CompilationCancelledError || (error instanceof Error && error.message === "Compilation cancelled.")) { new Notice("Compilation cancelled. No history entry was created."); return; }
      const detail = error instanceof Error ? error.message : String(error); diagnostics = detail; console.error("Manuscript Compiler export failure", error);
      await this.recordExport(false, timestamp, started, profile.name, folder.path, profile.exportTarget, outputFiles, result, pandocVersion, diagnostics, { scanDurationMs, parseDurationMs, filterDurationMs, generationDurationMs, exportDurationMs }); showError(new Error(this.friendlyError(error)));
    } finally { this.compilationActive = false; }
  }
  private targetFormats(target: ExportTarget): string[] { return target === "markdown-docx" ? ["Markdown", "DOCX"] : [target === "docx" ? "DOCX" : "Markdown"]; }
  private targetPaths(target: ExportTarget, markdown: string, docx: string): string[] { return target === "markdown-docx" ? [markdown, docx] : [target === "docx" ? docx : markdown]; }
  private async exportIssues(paths: string[]): Promise<CompileWarning[]> {
    const issues: CompileWarning[] = [];
    for (const path of paths) if (await this.outputExists(path)) issues.push({ severity: "warning", code: "output-exists", message: `Output already exists and will require confirmation: ${path}`, path }); return issues;
  }
  private async outputExists(path: string): Promise<boolean> { if (this.app.vault.getAbstractFileByPath(path)) return true; if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return false; return pathExists(this.app.vault.adapter.getFullPath(path)); }
  private async recordExport(success: boolean, timestamp: Date, started: number, profile: string, manuscript: string, format: ExportTarget, outputFiles: string[], result?: CompileResult, pandocVersion?: string, diagnostics?: string, timings = { scanDurationMs: 0, parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0, exportDurationMs: 0 }): Promise<void> {
    const base: ExportHistoryEntry = { id: profileId(), timestamp: timestamp.toISOString(), profile, manuscript, outputFiles, wordCount: result?.wordCount ?? 0, success, message: success ? undefined : diagnostics?.split(/\r?\n/)[0] };
    this.settings.exportHistory.unshift(base); this.settings.exportHistory = this.settings.exportHistory.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries));
    if (this.settings.enableCompileLogs) { const log: CompileLogEntry = { ...base, exportFormats: format, compilerVersion: this.manifest.version, pandocVersion, durationMs: Date.now() - started, ...timings, warnings: result?.warnings ?? [], diagnostics }; this.settings.compileLogs.unshift(log); this.settings.compileLogs = this.settings.compileLogs.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries)); }
    await this.saveSettings();
  }
  private friendlyError(error: unknown): string { const message = error instanceof Error ? error.message : String(error); if (/permission|EACCES/i.test(message)) return "Permission was denied while creating the export. Check the output folder permissions."; return message; }
  private async progressStage(progress: CompilationProgressModal, message: string): Promise<void> { progress.update(message); await new Promise<void>((resolve) => window.setTimeout(resolve, 0)); }
  private confirmPreview(preview: CompilePreview): Promise<boolean> { return this.modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings.expandPreviewTree, this.settings.showStatistics, finish)); }
  private confirmOverwrite(path: string): Promise<boolean> { return this.modalPromise((finish) => new ConfirmOverwriteModal(this.app, path, finish)); }
  private modalPromise(factory: (finish: (value: boolean) => void) => { open(): void; onClose(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; const modal = factory(finish); const close = modal.onClose.bind(modal); modal.onClose = (): void => { close(); finish(false); }; modal.open(); }); }
}
