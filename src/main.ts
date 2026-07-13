import { FileSystemAdapter, Notice, Plugin, TFile, TFolder } from "obsidian";
import { CompilationCancelledError, throwIfCancelled } from "./cancellation";
import { BookRootResolver } from "./book-root-resolver";
import { COMMAND_IDS } from "./commands";
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
import { WarningEngine } from "./warnings";
import { FirstRunWizardModal } from "./wizards";
import { SimpleCompileModal } from "./compile-modal";
import { inferStructurePreset, type SimpleCompileRequest } from "./simple-workflow";
import type { CompileProfile } from "./settings";
import type { ContentPlanItem } from "./content-plan";
import { calculateSourceFingerprint, compileInputSignature, CompilePreparationService, createPreparedExportRequest, type CompilePurpose, type CompileRoute, type PreparedCompileSession } from "./compile-preparation";
import { SafeBinaryWriteError, SafeBinaryWriter } from "./safe-binary-writer";

export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  private compilationActive = false;
  private preparationActive = false;
  async onload(): Promise<void> { await this.loadSettings(); await this.cleanupStaleOutputFiles(this.settings.defaultExportFolder); this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this)); this.addCommand({ id: COMMAND_IDS.compileManuscript, name: "Compile Manuscript", callback: () => this.openCompiler() }); this.addCommand({ id: COMMAND_IDS.compileCurrentBook, name: "Compile Current Book", callback: () => { void this.compileCurrentBook(); } }); this.addCommand({ id: COMMAND_IDS.compileSelectedFolder, name: "Compile Selected Folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.compileFolder(folder, undefined, [], "selected-folder"); }).open(); } }); this.addCommand({ id: COMMAND_IDS.validateManuscript, name: "Validate Manuscript", callback: () => { void this.validateManuscript(); } }); this.addCommand({ id: COMMAND_IDS.generateDiagnostics, name: "Generate Diagnostics Report", callback: () => { void this.generateDiagnostics(); } }); this.app.workspace.onLayoutReady(() => { if (!this.settings.onboardingCompleted) new FirstRunWizardModal(this.app, this).open(); }); }
  async loadSettings(): Promise<void> { const raw = await this.loadData() as Partial<ManuscriptCompilerSettings> | null; const loaded = Object.assign({}, DEFAULT_SETTINGS, raw); if (raw && raw.onboardingCompleted === undefined) loaded.onboardingCompleted = true; const previousWarnings = Array.isArray(loaded.configurationWarnings) ? loaded.configurationWarnings.length : 0; this.settings = repairSettings(loaded); if (raw && raw.defaultStructurePreset === undefined) this.settings.defaultStructurePreset = inferStructurePreset(this.getActiveProfile()); await this.saveSettings(); if (this.settings.configurationWarnings.length > previousWarnings) new Notice("Manuscript Compiler repaired invalid settings. Run Validate Manuscript for details.", 8000); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  getActiveProfile() { return activeProfile(this.settings); }
  openCompiler(): void { new SimpleCompileModal(this.app, this).open(); }
  async openExport(path: string): Promise<void> { try { const file = this.app.vault.getAbstractFileByPath(path); if (file instanceof TFile && file.extension === "md") { await this.app.workspace.getLeaf(true).openFile(file); return; } if (!await openExternalVaultFile(this.app.vault, path)) throw new Error("Obsidian could not open this non-Markdown export automatically. Open it from your file manager."); } catch (error) { showError(error); } }
  async clearHistory(): Promise<void> { this.settings.exportHistory = []; this.settings.compileLogs = []; await this.saveSettings(); }
  async compileRequest(request: SimpleCompileRequest): Promise<void> { const session = await this.prepareCompileRequest(request, request.contentPlan); const preview = this.previewFromSession(session); if (this.settings.showPreview && !await this.confirmPreview(preview)) { new Notice("Compilation cancelled."); return; } if (!preview.canExport) throw new Error("Export is blocked by an unsafe or invalid configuration. Run Validate Manuscript for details."); await this.exportPreparedSession(session); }
  async prepareCompileRequest(request: SimpleCompileRequest, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    if (this.compilationActive || this.preparationActive) throw new Error("A manuscript preparation or compilation is already running.");
    this.preparationActive = true;
    try {
      const base = { ...this.getActiveProfile(), generateTableOfContents: request.outputFormat !== "markdown" && this.settings.includeTableOfContentsByDefault };
      return await new CompilePreparationService(this.app.vault, base, this.settings.readingWordsPerMinute).prepareAuthoritative({ manuscriptRoot: request.manuscriptRoot, profile: base, structurePreset: request.structurePreset, contentPlan, simpleRequest: request, purpose: "preview", route: "guided" }, signal);
    } finally { this.preparationActive = false; }
  }
  async preparedSessionIsCurrent(session: PreparedCompileSession): Promise<boolean> { return await calculateSourceFingerprint(this.app.vault, session.sourcePaths) === session.sourceFingerprint; }
  async exportPreparedSession(session: PreparedCompileSession): Promise<void> {
    if (this.compilationActive || this.preparationActive) { new Notice("A manuscript preparation or compilation is already running."); return; }
    if (compileInputSignature(session.request, session.contentPlan) !== session.inputSignature) throw new Error("The compile choices changed after the preview was prepared. Refresh the preview before creating the DOCX.");
    if (!await this.preparedSessionIsCurrent(session)) throw new Error("The manuscript changed after the preview was prepared. Refresh the preview before creating the DOCX.");
    this.compilationActive = true;
    const controller = new AbortController(); let progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open();
    const started = Date.now(); const timestamp = new Date(); const { profile } = session; const outputFiles: string[] = [];
    try {
      this.settings.defaultManuscriptFolder = session.request.manuscriptRoot; this.settings.defaultExportFolder = session.request.exportFolder; this.settings.defaultStructurePreset = session.request.structurePreset; this.settings.defaultDocxStyle = session.request.docxPreset; this.settings.defaultExportFormat = session.request.outputFormat; await this.saveSettings();
      const exportIssues = await this.exportIssues(session.outputPaths); const allIssues = [...session.warnings, ...exportIssues]; const visibleIssues = new WarningEngine().filter(allIssues, this.settings.minimumWarningLevel);
      if (!canProceedWithExport(allIssues, profile.exportTarget, true)) throw new Error("Export is blocked by an unsafe or invalid configuration. Review the final preview.");
      progress.finish();
      for (const path of session.outputPaths) if (this.settings.warnBeforeOverwrite && await this.outputExists(path) && !await this.confirmOverwrite(path)) { new Notice("Compilation cancelled."); return; }
      progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open(); const markdownExporter = new MarkdownExporter(this.app.vault);
      const request = (outputPath: string): ExportRequest => createPreparedExportRequest(session, outputPath, profile.keepIntermediateMarkdown || this.settings.keepTemporaryMarkdown, controller.signal, () => progress.lock("Finalising file…"), (stage) => progress.update(stage));
      const exportStarted = performance.now(); const docxPath = session.outputPaths.find((path) => /\.docx$/i.test(path)); const markdownPath = session.outputPaths.find((path) => /\.md$/i.test(path));
      if (docxPath) { await this.progressStage(progress, "Creating DOCX"); const exported = await new DocxExporter(this.app.vault, markdownExporter).export(request(docxPath)); outputFiles.push(exported.path); }
      throwIfCancelled(controller.signal); if (markdownPath) { await this.progressStage(progress, "Writing Markdown export…"); progress.lock("Finalizing export…"); const exported = await markdownExporter.export(request(markdownPath)); outputFiles.push(exported.path); }
      const exportDurationMs = performance.now() - exportStarted; progress.finish(); if (profile.downloadAfterExport && docxPath) await this.downloadExport(docxPath);
      const report: CompileResult = { ...session.result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), timings: { totalMs: Date.now() - started, scanMs: 0, parseMs: 0, filterMs: 0, generationMs: 0, exportMs: exportDurationMs } };
      await this.recordExport(true, timestamp, started, profile.name, session.request.manuscriptRoot, profile.exportTarget, outputFiles, report, "Built-in DOCX", "", { scanDurationMs: 0, parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0, exportDurationMs });
      const open = () => { if (outputFiles[0]) void this.openExport(outputFiles[0]); }; const reveal = () => { if (outputFiles[0] && !revealExternalVaultFile(this.app.vault, outputFiles[0])) new Notice("Show in folder is unavailable on this platform."); }; const saveCopy = () => { if (docxPath) void this.downloadExport(docxPath); };
      new CompileReportModal(this.app, outputFiles.join(", "), report, this.settings.showStatistics, open, reveal, saveCopy).open(); if (this.settings.openAfterCompile && outputFiles[0]) await this.openExport(outputFiles[0]);
    } catch (error) {
      progress.finish(); if (controller.signal.aborted || error instanceof CompilationCancelledError) { await this.recordExport(false, timestamp, started, profile.name, session.request.manuscriptRoot, profile.exportTarget, outputFiles, session.result, "Built-in DOCX", "Cancelled before file finalisation.", undefined, true); new Notice("Compilation cancelled. The previous output was not changed."); return; }
      await this.recordExport(false, timestamp, started, profile.name, session.request.manuscriptRoot, profile.exportTarget, outputFiles, session.result, "Built-in DOCX", error instanceof Error ? error.message : String(error)); throw new Error(this.friendlyError(error));
    } finally { this.compilationActive = false; }
  }
  async compileSampleManuscript(): Promise<void> { try { const sample = new BookRootResolver(this.app.vault).require("samples/Complete Sample Book", "sample manuscript folder"); await this.compileFolder(sample, undefined, [], "sample"); } catch { new Notice("Sample manuscript was not found in this vault. Copy the repository samples folder into the vault to try it.", 8000); } }
  private async compileCurrentBook(): Promise<void> { try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); await this.compileFolder(folder, undefined, [], "current-book"); } catch (error) { showError(error); } }
  private async validateManuscript(): Promise<void> { try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); const session = await this.prepareAutomatic(folder, this.getActiveProfile(), "validation", "validation"); const result = await new ManuscriptValidationService(this.app.vault, this.settings).validate(session); new ValidationReportModal(this.app, folder.path, result).open(); } catch (error) { showError(error); } }
  private async generateDiagnostics(): Promise<void> { try { const report = new DiagnosticsReportGenerator().generate({ pluginVersion: this.manifest.version, obsidianVersion: getObsidianVersion(), operatingSystem: navigator.userAgent, profile: this.getActiveProfile(), settings: this.settings }); new DiagnosticsReportModal(this.app, report, () => this.saveDiagnostics(report)).open(); } catch (error) { showError(error); } }
  private async saveDiagnostics(report: string): Promise<string> { const stamp = new Date().toISOString().replace(/[:.]/g, "-"); const path = `Manuscript Compiler Diagnostics/Diagnostics ${stamp}.md`; await new MarkdownExporter(this.app.vault).write(path, report); return path; }
  private resolveCurrentBook(): TFolder | null { return new BookRootResolver(this.app.vault).configuredOrCurrent(this.getActiveProfile().manuscriptRoot || this.settings.defaultManuscriptFolder, this.app.workspace.getActiveFile()); }

  async compileFolder(folder: TFolder, compileProfile?: CompileProfile, contentPlan: ContentPlanItem[] = [], route: CompileRoute = "legacy-profile"): Promise<void> {
    const profile = compileProfile ?? this.getActiveProfile(); const controller = new AbortController(); const progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open();
    try {
      const root = new BookRootResolver(this.app.vault).selected(folder); new Notice(`Preparing “${root.name}” with profile “${profile.name}”…`);
      const session = await this.prepareAutomatic(root, profile, "compile", route, contentPlan.length ? contentPlan : undefined, controller.signal);
      progress.finish(); const preview = this.previewFromSession(session);
      if (this.settings.showPreview && !await this.confirmPreview(preview)) { new Notice("Compilation cancelled."); return; }
      if (!preview.canExport) throw new Error("Export is blocked by an unsafe or invalid configuration. Run Validate Manuscript for details.");
      await this.exportPreparedSession(session);
    } catch (error) { progress.finish(); if (controller.signal.aborted || error instanceof CompilationCancelledError) { new Notice("Compilation cancelled. No output was changed."); return; } showError(new Error(this.friendlyError(error))); }
  }
  private async prepareAutomatic(folder: TFolder, profile: CompileProfile, purpose: CompilePurpose, route: CompileRoute, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    if (this.compilationActive || this.preparationActive) throw new Error("A manuscript preparation or compilation is already running.");
    this.preparationActive = true;
    try {
      const effective = { ...profile, generateTableOfContents: profile.exportTarget !== "markdown" && this.settings.includeTableOfContentsByDefault };
      return await new CompilePreparationService(this.app.vault, effective, this.settings.readingWordsPerMinute).prepareAuthoritative({ manuscriptRoot: folder.path, profile: effective, structurePreset: inferStructurePreset(effective), contentPlan, purpose, route }, signal);
    } finally { this.preparationActive = false; }
  }
  private previewFromSession(session: PreparedCompileSession): CompilePreview {
    const outputPath = session.outputPaths[0] ?? ""; const slash = outputPath.lastIndexOf("/"); const issues = new WarningEngine().filter(session.warnings, this.settings.minimumWarningLevel);
    return { ...session.result, issues, warnings: issues.map((item) => item.message), book: session.book, outputPath, outputFolder: slash < 0 ? "" : outputPath.slice(0, slash), outputFilename: slash < 0 ? outputPath : outputPath.slice(slash + 1), outputFormats: session.profile.exportTarget === "markdown-docx" ? ["Markdown", "DOCX"] : [session.profile.exportTarget === "docx" ? "DOCX" : "Markdown"], outputPaths: session.outputPaths, docxEngine: "built-in", estimatedPages: Math.max(1, Math.ceil(session.result.wordCount / 300)), canExport: canProceedWithExport(session.warnings, session.profile.exportTarget, true) };
  }
  private async exportIssues(paths: string[]): Promise<CompileWarning[]> {
    const issues: CompileWarning[] = [];
    for (const path of paths) if (await this.outputExists(path)) issues.push({ severity: "warning", code: "output-exists", message: `Output already exists and will require confirmation: ${path}`, path }); return issues;
  }
  private async outputExists(path: string): Promise<boolean> { if (this.app.vault.getAbstractFileByPath(path)) return true; if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return false; return pathExists(this.app.vault.adapter.getFullPath(path)); }
  private async recordExport(success: boolean, timestamp: Date, started: number, profile: string, manuscript: string, format: ExportTarget, outputFiles: string[], result?: CompileResult, pandocVersion?: string, diagnostics?: string, timings = { scanDurationMs: 0, parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0, exportDurationMs: 0 }, cancelled = false): Promise<void> {
    const base: ExportHistoryEntry = { id: profileId(), timestamp: timestamp.toISOString(), profile, manuscript, outputFiles, wordCount: result?.wordCount ?? 0, success, cancelled: cancelled || undefined, message: success ? undefined : cancelled ? "Cancelled" : diagnostics?.split(/\r?\n/)[0] };
    this.settings.exportHistory.unshift(base); this.settings.exportHistory = this.settings.exportHistory.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries));
    if (this.settings.enableCompileLogs) { const log: CompileLogEntry = { ...base, exportFormats: format, compilerVersion: this.manifest.version, pandocVersion, durationMs: Date.now() - started, ...timings, warnings: result?.warnings ?? [], diagnostics }; this.settings.compileLogs.unshift(log); this.settings.compileLogs = this.settings.compileLogs.slice(0, Math.max(1, this.settings.maximumExportHistoryEntries)); }
    await this.saveSettings();
  }
  private friendlyError(error: unknown): string { const message = error instanceof Error ? error.message : String(error); if (/permission|EACCES/i.test(message)) return "Permission was denied while creating the export. Check the output folder permissions."; if (error instanceof SafeBinaryWriteError) { if (error.restoration === "failed") return error.message; if (error.restoration === "restored") return "The DOCX could not be saved. The previous file was restored."; return "The DOCX could not be saved safely. No verified output was kept."; } if (/DOCX.*validation failed|generated DOCX could not be validated/i.test(message)) return "The generated DOCX did not pass its safety check, so the existing file was not changed."; return message; }
  private async cleanupStaleOutputFiles(folder: string): Promise<void> { try { const result = await new SafeBinaryWriter(this.app.vault).cleanupStaleArtifacts(folder); if (result.removed.length) console.info(`Manuscript Compiler removed ${result.removed.length} stale temporary file(s) from “${folder || "/"}”.`); if (result.preservedBackups.length) console.warn(`Manuscript Compiler preserved ${result.preservedBackups.length} recovery backup file(s) in “${folder || "/"}” for manual review.`); } catch (error) { console.warn("Manuscript Compiler could not complete stale temporary-file cleanup.", error); } }
  private async downloadExport(path: string): Promise<void> { const file = this.app.vault.getAbstractFileByPath(path); const data = file instanceof TFile ? await this.app.vault.readBinary(file) : await this.app.vault.adapter.readBinary(path); const name = file instanceof TFile ? file.name : path.split("/").pop() ?? "Manuscript.docx"; const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })); const link = document.createElement("a"); link.href = url; link.download = name; link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  private async progressStage(progress: CompilationProgressModal, message: string): Promise<void> { progress.update(message); await new Promise<void>((resolve) => window.setTimeout(resolve, 0)); }
  private confirmPreview(preview: CompilePreview): Promise<boolean> { return this.modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings.expandPreviewTree, this.settings.showStatistics, finish)); }
  private confirmOverwrite(path: string): Promise<boolean> { return this.modalPromise((finish) => new ConfirmOverwriteModal(this.app, path, finish)); }
  private modalPromise(factory: (finish: (value: boolean) => void) => { open(): void; onClose(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; const modal = factory(finish); const close = modal.onClose.bind(modal); modal.onClose = (): void => { close(); finish(false); }; modal.open(); }); }
}
