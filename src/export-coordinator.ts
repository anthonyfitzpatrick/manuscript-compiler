import { FileSystemAdapter, Notice, type App } from "obsidian";
import { CompilationCancelledError, throwIfCancelled } from "./cancellation";
import { calculateSourceFingerprint, compileInputSignature, createPreparedExportRequest, type PreparedCompileSession } from "./compile-preparation";
import type { CompileHistoryService } from "./compile-history";
import { DocxExporter, MarkdownExporter, type ExportRequest } from "./exporter";
import { canProceedWithExport } from "./export-safety";
import { pathExists } from "./filesystem";
import type { CompilePreview, CompileResult, CompileWarning } from "./model";
import type { OperationStateController } from "./operation-state";
import type { ResultActionService } from "./result-actions";
import { SafeBinaryWriteError } from "./safe-binary-writer";
import type { ManuscriptCompilerSettings } from "./settings";
import { CompilationProgressModal, CompileReportModal, ConfirmOverwriteModal } from "./ui";
import { WarningEngine } from "./warnings";

export interface ExportExecutionResult { status: "success" | "failed" | "cancelled"; outputFiles: string[]; report?: CompileResult; error?: string; }
export interface ExportExecutionOptions { showResult?: boolean; }

export class ExportCoordinator {
  constructor(private readonly app: App, private readonly settings: () => ManuscriptCompilerSettings, private readonly saveSettings: () => Promise<void>, private readonly operations: OperationStateController, private readonly history: CompileHistoryService, private readonly actions: ResultActionService) {}

  async exportPreparedSession(session: PreparedCompileSession, options: ExportExecutionOptions = {}): Promise<ExportExecutionResult> {
    const operation = this.operations.begin("exporting");
    if (!operation) throw new Error("A manuscript preparation or compilation is already running.");
    const started = Date.now(); const timestamp = new Date(); const outputFiles: string[] = [];
    let progress = new CompilationProgressModal(this.app, () => operation.cancel()); progress.open();
    try {
      await this.verifySession(session);
      await this.persistDefaults(session);
      const exportIssues = await this.exportIssues(session.outputPaths); const allIssues = [...session.warnings, ...exportIssues];
      const visibleIssues = new WarningEngine().filter(allIssues, this.settings().minimumWarningLevel);
      if (!canProceedWithExport(allIssues, session.profile.exportTarget, true)) throw new Error("Export is blocked by an unsafe or invalid configuration. Review the final preview.");
      progress.finish();
      for (const path of session.outputPaths) if (this.settings().warnBeforeOverwrite && await this.outputExists(path) && !await this.confirmOverwrite(path)) throw new CompilationCancelledError();
      progress = new CompilationProgressModal(this.app, () => operation.cancel()); progress.open();
      const markdownExporter = new MarkdownExporter(this.app.vault);
      const request = (outputPath: string): ExportRequest => createPreparedExportRequest(session, outputPath, session.profile.keepIntermediateMarkdown || this.settings().keepTemporaryMarkdown, operation.signal, () => { operation.finalise(); progress.lock("Finalising file…"); }, (stage) => progress.update(stage));
      const exportStarted = performance.now(); const docxPath = session.outputPaths.find((path) => /\.docx$/i.test(path)); const markdownPath = session.outputPaths.find((path) => /\.md$/i.test(path));
      if (docxPath) { progress.update("Creating DOCX"); outputFiles.push((await new DocxExporter(this.app.vault, markdownExporter).export(request(docxPath))).path); }
      throwIfCancelled(operation.signal);
      if (markdownPath) { progress.update("Writing Markdown export…"); outputFiles.push((await markdownExporter.export(request(markdownPath))).path); }
      const report: CompileResult = { ...session.result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), timings: { totalMs: Date.now() - started, scanMs: 0, parseMs: 0, filterMs: 0, generationMs: 0, exportMs: performance.now() - exportStarted } };
      progress.finish();
      await this.history.recordSuccess({ timestamp, started, profile: session.profile.name, manuscript: session.request.manuscriptRoot, format: session.profile.exportTarget, outputFiles, result: report, timings: { exportDurationMs: report.timings?.exportMs ?? 0 } });
      operation.complete();
      if (session.profile.downloadAfterExport && docxPath) await this.actions.saveCopyToComputer(docxPath);
      if (options.showResult !== false) this.showResult(outputFiles, docxPath, report);
      if (this.settings().openAfterCompile && outputFiles[0]) await this.actions.openExport(outputFiles[0]);
      return { status: "success", outputFiles, report };
    } catch (error) {
      progress.finish();
      if (operation.signal.aborted || error instanceof CompilationCancelledError) {
        operation.cancel();
        await this.history.recordCancellation({ timestamp, started, profile: session.profile.name, manuscript: session.request.manuscriptRoot, format: session.profile.exportTarget, outputFiles, result: session.result });
        operation.settle();
        new Notice("Compilation cancelled. The previous output was not changed.");
        return { status: "cancelled", outputFiles };
      }
      operation.fail(); const message = friendlyExportError(error);
      await this.history.recordFailure({ timestamp, started, profile: session.profile.name, manuscript: session.request.manuscriptRoot, format: session.profile.exportTarget, outputFiles, result: session.result, message: error instanceof Error ? error.message : String(error) });
      return { status: "failed", outputFiles, error: message };
    }
  }

  previewFromSession(session: PreparedCompileSession): CompilePreview {
    const outputPath = session.outputPaths[0] ?? ""; const slash = outputPath.lastIndexOf("/"); const issues = new WarningEngine().filter(session.warnings, this.settings().minimumWarningLevel);
    return { ...session.result, issues, warnings: issues.map((item) => item.message), book: session.book, outputPath, outputFolder: slash < 0 ? "" : outputPath.slice(0, slash), outputFilename: slash < 0 ? outputPath : outputPath.slice(slash + 1), outputFormats: session.profile.exportTarget === "markdown-docx" ? ["Markdown", "DOCX"] : [session.profile.exportTarget === "docx" ? "DOCX" : "Markdown"], outputPaths: session.outputPaths, docxEngine: "built-in", estimatedPages: Math.max(1, Math.ceil(session.result.wordCount / 300)), canExport: canProceedWithExport(session.warnings, session.profile.exportTarget, true) };
  }

  private async verifySession(session: PreparedCompileSession): Promise<void> {
    if (compileInputSignature(session.request, session.contentPlan) !== session.inputSignature) throw new Error("The compile choices changed after the preview was prepared. Refresh the preview before creating the DOCX.");
    if (await calculateSourceFingerprint(this.app.vault, session.sourcePaths) !== session.sourceFingerprint) throw new Error("The manuscript changed after the preview was prepared. Refresh the preview before creating the DOCX.");
  }
  private async persistDefaults(session: PreparedCompileSession): Promise<void> {
    const settings = this.settings(); settings.defaultManuscriptFolder = session.request.manuscriptRoot; settings.defaultExportFolder = session.request.exportFolder; settings.defaultStructurePreset = session.request.structurePreset; if (session.request.docxPreset !== "custom") settings.defaultDocxStyle = session.request.docxPreset; settings.defaultExportFormat = session.request.outputFormat;
    if (session.request.formatting) {
      settings.defaultDocxPageSize = session.request.formatting.pageSize;
      settings.defaultDocxFirstLineIndentCm = session.request.formatting.firstLineIndentCm;
      const profile = settings.profiles.find((item) => item.id === session.profile.id);
      if (profile) { profile.docxPageSize = session.request.formatting.pageSize; profile.docxFirstLineIndentCm = session.request.formatting.firstLineIndentCm; profile.sceneSeparator = session.profile.sceneSeparator; }
    }
    await this.saveSettings();
  }
  private async exportIssues(paths: string[]): Promise<CompileWarning[]> { const issues: CompileWarning[] = []; for (const path of paths) if (await this.outputExists(path)) issues.push({ severity: "warning", code: "output-exists", message: `Output already exists and will require confirmation: ${path}`, path }); return issues; }
  private async outputExists(path: string): Promise<boolean> { if (this.app.vault.getAbstractFileByPath(path)) return true; return this.app.vault.adapter instanceof FileSystemAdapter && await pathExists(this.app.vault.adapter.getFullPath(path)); }
  private confirmOverwrite(path: string): Promise<boolean> { return modalPromise((finish) => new ConfirmOverwriteModal(this.app, path, finish)); }
  private showResult(outputFiles: string[], docxPath: string | undefined, report: CompileResult): void {
    const primary = outputFiles[0] ?? ""; const capabilities = this.actions.capabilities(primary, true);
    new CompileReportModal(this.app, outputFiles.join(", "), report, this.settings().showStatistics, capabilities.open ? () => { void this.actions.openExport(primary); } : undefined, capabilities.reveal ? () => { if (!this.actions.revealExport(primary)) new Notice("Show in folder is unavailable on this platform."); } : undefined, capabilities.saveCopy && docxPath ? () => { void this.actions.saveCopyToComputer(docxPath); } : undefined).open();
  }
}

export function friendlyExportError(error: unknown): string { const message = error instanceof Error ? error.message : String(error); if (/permission|EACCES/i.test(message)) return "Permission was denied while creating the export. Check the output folder permissions."; if (error instanceof SafeBinaryWriteError) { if (error.restoration === "failed") return error.message; if (error.restoration === "restored") return "The DOCX could not be saved. The previous file was restored."; return "The DOCX could not be saved safely. No verified output was kept."; } if (/DOCX.*validation failed|generated DOCX could not be validated/i.test(message)) return "The generated DOCX did not pass its safety check, so the existing file was not changed."; return message; }
function modalPromise(factory: (finish: (value: boolean) => void) => { open(): void; onClose(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; const modal = factory(finish); const close = modal.onClose.bind(modal); modal.onClose = (): void => { close(); finish(false); }; modal.open(); }); }
