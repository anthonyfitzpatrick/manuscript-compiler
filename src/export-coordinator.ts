/** Sole in-memory export coordinator: prepared Book → generator → validator → download. */
import { Notice, type App } from "obsidian";
import { CompilationCancelledError } from "./cancellation";
import { calculateSourceFingerprint, compileInputSignature, type PreparedCompileSession } from "./compile-preparation";
import type { CompileHistoryService } from "./compile-history";
import { BrowserDownloadService } from "./browser-download";
import { exportFilename } from "./export-filename";
import { EXPORT_FORMAT_DETAILS, type ExportFormat } from "./export-types";
import { EXPORT_VALIDATORS } from "./export-validators";
import { EXPORTERS } from "./native-exporters";
import { createSemanticDocument } from "./semantic-document";
import type { CompilePreview, CompileResult } from "./model";
import type { OperationStateController } from "./operation-state";
import type { ManuscriptCompilerSettings } from "./settings";
import { CompilationProgressModal } from "./ui";
import { canProceedWithExport } from "./export-safety";
import { WarningEngine } from "./warnings";

export interface ExportExecutionResult { status: "success" | "failed" | "cancelled"; outputFiles: string[]; report?: CompileResult; error?: string; downloadStarted?: boolean; validationPassed?: boolean; }
export interface ExportExecutionOptions { showResult?: boolean; format?: ExportFormat; filename?: string; }

export class ExportCoordinator {
  constructor(private readonly app: App, private readonly settings: () => ManuscriptCompilerSettings, private readonly saveSettings: () => Promise<void>, private readonly operations: OperationStateController, private readonly history: CompileHistoryService, private readonly downloads = new BrowserDownloadService()) {}

  async exportPreparedSession(session: PreparedCompileSession, options: ExportExecutionOptions = {}): Promise<ExportExecutionResult> {
    const operation = this.operations.begin("exporting"); if (!operation) throw new Error("A manuscript preparation or compilation is already running.");
    const started = Date.now(); const timestamp = new Date(); const format = options.format ?? this.settings().defaultDownloadFormat; const details = EXPORT_FORMAT_DETAILS[format];
    const title = String(session.variables.BookTitle ?? session.book.title ?? "Manuscript"); const filename = exportFilename(options.filename ?? session.request.outputFilename, format, title); const outputFiles = [filename];
    const progress = new CompilationProgressModal(this.app, () => operation.cancel()); progress.open();
    try {
      await this.verifySession(session); let visibleIssues = new WarningEngine().filter(session.warnings, this.settings().minimumWarningLevel); if (!canProceedWithExport(session.warnings)) throw new Error("Export is blocked by an unsafe or invalid configuration. Review the final preview.");
      await this.persistDefaults(session, format); progress.update(`Creating ${details.label}`);
      const formatting = session.request.formatting ?? { font: "Times New Roman", fontSize: 12, lineSpacing: 2, firstLineIndentCm: 1.27, pageSize: "a4" as const, chapterPageBreak: true, titlePage: false };
      const exportOptions = { title, author: String(session.variables.Author ?? ""), language: "en", titlePage: formatting.titlePage, tableOfContents: session.profile.generateTableOfContents, font: formatting.font, fontSize: formatting.fontSize, lineSpacing: formatting.lineSpacing, firstLineIndentCm: formatting.firstLineIndentCm, pageSize: formatting.pageSize, pageMarginCm: formatting.pageMarginCm ?? 2.54, chapterPageBreak: formatting.chapterPageBreak, sceneSeparator: session.profile.sceneSeparator };
      const document = createSemanticDocument(session.book, session.profile, exportOptions, session.statistics.totalWordCount); const exportStarted = performance.now();
      const generated = await EXPORTERS[format].generate({ session, document, options: exportOptions, filename }); visibleIssues = new WarningEngine().filter([...session.warnings, ...generated.warnings], this.settings().minimumWarningLevel); if (operation.signal.aborted) throw new CompilationCancelledError();
      progress.update(`Validating ${details.label}`); const validation = EXPORT_VALIDATORS[format].validate(generated.bytes); if (!validation.valid) throw new Error(`The generated ${details.label} did not pass validation and was not downloaded. ${validation.errors.join(" ")}`);
      operation.finalise(); progress.lock("Starting download…"); const downloaded = await this.downloads.download({ filename: generated.filename, bytes: generated.bytes, mimeType: generated.mimeType }); if (!downloaded.started) throw new Error(downloaded.error || "The host blocked the download. Try again.");
      const exportMs = performance.now() - exportStarted; const timings = session.result.timings ?? { totalMs: 0, scanMs: 0, parseMs: 0, filterMs: 0, generationMs: 0, exportMs: 0 };
      const report: CompileResult = { ...session.result, issues: visibleIssues, warnings: visibleIssues.map((item) => item.message), timings: { ...timings, totalMs: timings.totalMs + Date.now() - started, exportMs } };
      await this.history.recordSuccess({ timestamp, started, profile: "Configured", manuscript: title, format, outputFiles, result: report, generationSucceeded: true, validationPassed: true, downloadStarted: true }); operation.complete(); progress.finish();
      if (options.showResult !== false) new Notice(`The ${details.label} file was created and the download was started. Your computer may ask where to save it or place it in your Downloads folder.`, 10000);
      return { status: "success", outputFiles, report, downloadStarted: true, validationPassed: true };
    } catch (error) {
      progress.finish(); if (operation.signal.aborted || error instanceof CompilationCancelledError) { operation.cancel(); await this.history.recordCancellation({ timestamp, started, profile: "Configured", manuscript: title, format, outputFiles: [], result: session.result }); operation.settle(); new Notice("Compilation cancelled. No download was started."); return { status: "cancelled", outputFiles: [] }; }
      operation.fail(); const message = friendlyExportError(error); await this.history.recordFailure({ timestamp, started, profile: "Configured", manuscript: title, format, outputFiles: [], result: session.result, message, generationSucceeded: false, validationPassed: false, downloadStarted: false }); return { status: "failed", outputFiles: [], error: message, downloadStarted: false, validationPassed: false };
    } finally { operation.settle(); }
  }

  previewFromSession(session: PreparedCompileSession): CompilePreview {
    const format = this.settings().defaultDownloadFormat; const filename = exportFilename(session.request.outputFilename, format, String(session.variables.BookTitle ?? session.book.title)); const issues = new WarningEngine().filter(session.warnings, this.settings().minimumWarningLevel);
    return { ...session.result, issues, warnings: issues.map((item) => item.message), book: session.book, outputPath: filename, outputFolder: "", outputFilename: filename, outputFormats: [EXPORT_FORMAT_DETAILS[format].label], outputPaths: [filename], docxEngine: "built-in", estimatedPages: Math.max(1, Math.ceil(session.result.wordCount / 300)), canExport: canProceedWithExport(session.warnings) };
  }

  private async verifySession(session: PreparedCompileSession): Promise<void> { if (compileInputSignature(session.request, session.contentPlan) !== session.inputSignature) throw new Error("The compile choices changed after the preview was prepared. Refresh the preview before creating the file."); if (await calculateSourceFingerprint(this.app.vault, session.sourcePaths) !== session.sourceFingerprint) throw new Error("The manuscript changed after the preview was prepared. Refresh the preview before creating the file."); }
  private async persistDefaults(session: PreparedCompileSession, format: ExportFormat): Promise<void> { const settings = this.settings(); settings.defaultManuscriptFolder = session.request.manuscriptRoot; settings.defaultStructurePreset = session.request.structurePreset; settings.defaultDownloadFormat = format; if (session.request.docxPreset !== "custom") settings.defaultDocxStyle = session.request.docxPreset; if (session.request.formatting) { settings.defaultDocxPageSize = session.request.formatting.pageSize; settings.defaultDocxFirstLineIndentCm = session.request.formatting.firstLineIndentCm; } await this.saveSettings(); }
}

export function friendlyExportError(error: unknown): string { const message = error instanceof Error ? error.message : String(error); if (/validation/i.test(message)) return message; if (/blocked|download/i.test(message)) return message; return `The file could not be created. ${message}`; }
