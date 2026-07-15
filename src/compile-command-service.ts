/**
 * Manuscript Compiler — command orchestration service.
 *
 * Resolves command roots, requests authoritative preparation, presents legacy
 * previews/validation, and delegates export. main.ts routes compile commands here.
 * It calls BookRootResolver, CompilePreparationService, validation, and export.
 */
import { Notice, Platform, TFile, TFolder, type App } from "obsidian";
import { BookRootResolver } from "./book-root-resolver";
import { CompilationCancelledError } from "./cancellation";
import { calculateSourceFingerprint, CompilePreparationService, type CompilePurpose, type CompileRoute, type PreparedCompileSession } from "./compile-preparation";
import type { ContentPlanItem } from "./content-plan";
import { DiagnosticsReportGenerator } from "./diagnostics";
import type { ExportCoordinator, ExportExecutionResult } from "./export-coordinator";
import { getObsidianVersion } from "./platform-compat";
import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";
import { inferStructurePreset, type SimpleCompileRequest } from "./simple-workflow";
import type { OperationStateController } from "./operation-state";
import type { ExportFormat } from "./export-types";
import { CompilationProgressModal, CompilePreviewModal, DiagnosticsReportModal, ValidationReportModal, showError } from "./ui";
import { ManuscriptValidationService } from "./validation";

/** Application-scoped command owner; global operation state prevents overlap. */
export class CompileCommandService {
  private readonly roots: BookRootResolver;
  constructor(private readonly app: App, private readonly settings: () => ManuscriptCompilerSettings, private readonly activeProfile: () => CompileProfile, private readonly operations: OperationStateController, private readonly exporter: ExportCoordinator, private readonly pluginVersion: string) { this.roots = new BookRootResolver(app.vault); }

  /** Prepares an edited workspace plan without replacing explicit author choices. */
  async prepareGuided(request: SimpleCompileRequest, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    const root = this.roots.require(request.manuscriptRoot);
    const normalizedRequest = { ...request, manuscriptRoot: root.path };
    const base = { ...this.activeProfile(), generateTableOfContents: request.outputFormat !== "markdown" && this.settings().includeTableOfContentsByDefault };
    return this.prepare({ manuscriptRoot: root.path, profile: base, structurePreset: normalizedRequest.structurePreset, contentPlan, simpleRequest: normalizedRequest, purpose: "preview", route: "guided" }, signal);
  }
  /** Rechecks source metadata so a preview cannot silently export stale files. */
  async preparedSessionIsCurrent(session: PreparedCompileSession): Promise<boolean> { return await calculateSourceFingerprint(this.app.vault, session.sourcePaths) === session.sourceFingerprint; }
  /** Delegates an already prepared session; this method never scans or rebuilds its Book. */
  async exportPreparedSession(session: PreparedCompileSession, format?: ExportFormat, filename?: string): Promise<ExportExecutionResult> { return this.exporter.exportPreparedSession(session, { format, filename }); }

  /** Runs the compatibility request flow through the same preparation and preview used by the workspace. */
  async compileRequest(request: SimpleCompileRequest): Promise<void> {
    const session = await this.prepareGuided(request, request.contentPlan);
    const preview = this.exporter.previewFromSession(session);
    if (this.settings().showPreview && !await modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings().expandPreviewTree, this.settings().showStatistics, finish))) { new Notice("Compilation cancelled."); return; }
    if (!preview.canExport) throw new Error("Export is blocked by an unsafe or invalid configuration. Run Validate Manuscript for details.");
    const result = await this.exportPreparedSession(session); if (result.status === "failed") throw new Error(result.error);
  }

  /** Compiles an explicit folder while preserving its identity as the authoritative book root. */
  async compileFolder(folder: TFolder, compileProfile?: CompileProfile, contentPlan: ContentPlanItem[] = [], route: CompileRoute = "legacy-profile"): Promise<void> {
    const profile = compileProfile ?? this.activeProfile(); const controller = new AbortController(); const progress = new CompilationProgressModal(this.app, () => controller.abort()); progress.open();
    try {
      const root = this.roots.selected(folder); new Notice(`Preparing “${root.name}” with profile “${profile.name}”…`);
      const session = await this.prepareAutomatic(root, profile, "compile", route, contentPlan.length ? contentPlan : undefined, controller.signal);
      progress.finish(); const preview = this.exporter.previewFromSession(session);
      if (this.settings().showPreview && !await modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings().expandPreviewTree, this.settings().showStatistics, finish))) { new Notice("Compilation cancelled."); return; }
      if (!preview.canExport) throw new Error("Export is blocked by an unsafe or invalid configuration. Run Validate Manuscript for details.");
      const result = await this.exportPreparedSession(session); if (result.status === "failed") throw new Error(result.error);
    } catch (error) { progress.finish(); if (controller.signal.aborted || error instanceof CompilationCancelledError) { new Notice("Compilation cancelled. No output was changed."); return; } showError(error); }
  }

  /** Resolves the current configured/active-file root, then enters the unified folder route. */
  async compileCurrentBook(): Promise<void> { try { const folder = this.currentRoot(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); await this.compileFolder(folder, undefined, [], "current-book"); } catch (error) { showError(error); } }
  /** Compiles the bundled sample through production preparation; absence is reported without creating it. */
  async compileSampleManuscript(): Promise<void> { try { await this.compileFolder(this.roots.require("samples/Complete Sample Book", "sample manuscript folder"), undefined, [], "sample"); } catch { new Notice("Sample manuscript was not found in this vault. Copy the repository samples folder into the vault to try it.", 8000); } }
  /** Validates the exact semantic model export would consume and never writes output. */
  async validateManuscript(): Promise<void> { try { const folder = this.currentRoot(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); const session = await this.prepareAutomatic(folder, this.activeProfile(), "validation", "validation"); const result = await new ManuscriptValidationService(this.app.vault, this.settings()).validate(session); new ValidationReportModal(this.app, folder.path, result).open(); } catch (error) { showError(error); } }
  /** Builds a privacy-limited configuration report; manuscript prose is never included. */
  async generateDiagnostics(): Promise<void> { try { const report = new DiagnosticsReportGenerator().generate({ pluginVersion: this.pluginVersion, obsidianVersion: getObsidianVersion(), operatingSystem: platformName(), profile: this.activeProfile(), settings: this.settings() }); new DiagnosticsReportModal(this.app, report, () => this.saveDiagnostics(report)).open(); } catch (error) { showError(error); } }

  private currentRoot(): TFolder | null { return this.roots.configuredOrCurrent(this.activeProfile().manuscriptRoot || this.settings().defaultManuscriptFolder, this.app.workspace.getActiveFile()); }
  private prepareAutomatic(folder: TFolder, profile: CompileProfile, purpose: CompilePurpose, route: CompileRoute, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    const effective = { ...profile, generateTableOfContents: profile.exportTarget !== "markdown" && this.settings().includeTableOfContentsByDefault };
    return this.prepare({ manuscriptRoot: folder.path, profile: effective, structurePreset: inferStructurePreset(effective), contentPlan, purpose, route }, signal);
  }
  private async prepare(request: Parameters<CompilePreparationService["prepareAuthoritative"]>[0], externalSignal?: AbortSignal): Promise<PreparedCompileSession> {
    const operation = this.operations.begin("preparing"); if (!operation) throw new Error("A manuscript preparation or compilation is already running.");
    const cancel = (): void => { operation.cancel(); }; externalSignal?.addEventListener("abort", cancel, { once: true });
    try { const session = await new CompilePreparationService(this.app.vault, request.profile, this.settings().readingWordsPerMinute).prepareAuthoritative(request, operation.signal); operation.complete(); return session; }
    catch (error) { if (operation.signal.aborted) operation.cancel(); else operation.fail(); throw error; }
    finally { operation.settle(); externalSignal?.removeEventListener("abort", cancel); }
  }
  private async saveDiagnostics(report: string): Promise<string> { const folder = "Manuscript Compiler Diagnostics"; if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder); const stamp = new Date().toISOString().replace(/[:.]/g, "-"); const path = `${folder}/Diagnostics ${stamp}.md`; const existing = this.app.vault.getAbstractFileByPath(path); if (existing instanceof TFile) await this.app.vault.process(existing, () => report); else await this.app.vault.create(path, report); return path; }
}

function modalPromise(factory: (finish: (value: boolean) => void) => { open(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; factory(finish).open(); }); }
function platformName(): string { if (Platform.isIosApp) return "iOS"; if (Platform.isAndroidApp) return "Android"; if (Platform.isWin) return "Windows"; if (Platform.isLinux) return "Linux"; if (Platform.isMacOS) return "macOS"; return Platform.isMobileApp ? "Mobile" : "Unknown"; }
