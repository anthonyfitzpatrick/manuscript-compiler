/**
 * Manuscript Compiler — plugin composition root.
 *
 * Loads and repairs settings, constructs the application services, registers
 * commands and File Explorer integration, and owns plugin shutdown. Compile
 * logic deliberately lives in CompileCommandService and the workspace
 * controller so entry points cannot acquire different preparation paths.
 *
 * Called by Obsidian. Calls profile repair, UI registration, command/export/
 * history/download services and onboarding.
 * Invariant: application services are composed here once and then delegated to.
 */
import { Notice, Plugin, TFolder } from "obsidian";
import { activeProfile, repairSettings } from "./profiles";
import { DEFAULT_SETTINGS, type CompileProfile, type ManuscriptCompilerSettings } from "./settings";
import { inferStructurePreset, type SimpleCompileRequest } from "./simple-workflow";
import type { ContentPlanItem } from "./content-plan";
import type { CompileRoute, PreparedCompileSession } from "./compile-preparation";
import { COMMAND_IDS } from "./commands";
import { OperationStateController } from "./operation-state";
import { CompileHistoryService } from "./compile-history";
import { ExportCoordinator } from "./export-coordinator";
import { CompileCommandService } from "./compile-command-service";
import { SimpleCompileModal } from "./compile-modal";
import { FirstRunWizardModal } from "./wizards";
import { FolderSuggestModal, ManuscriptCompilerSettingTab } from "./ui";
import { addCompileFolderMenuItem } from "./folder-context-menu";
import type { ExportFormat } from "./export-types";
import { SavedCompilationService } from "./saved-compilation-service";
import { SavedCompilationStalenessTracker } from "./saved-compilation-staleness";
import { SavedCompilationOrchestrator } from "./saved-compilation-orchestrator";
import type { SavedCompilationOpenResult } from "./saved-compilation-orchestrator";
import type { SavedCompilation } from "./saved-compilations";
import type { CanonicalWorkspaceRecipe } from "./saved-compilation-session";
import type { CompileWorkspaceController } from "./workspace/compile-workspace-controller";
import type { SavedCompilationWorkflowResult } from "./saved-compilation-orchestrator";
import type { ActiveWorkspaceTransitionResult, SavedCompilationOpenDependencies } from "./saved-compilation-orchestrator";
import type { CompileWorkspaceServices } from "./workspace/compile-workspace-controller";
import type { SavedCompilationOperation } from "./saved-compilation-service";
import type { SavedCompilationExportFreshness } from "./saved-compilation-orchestrator";

/** Obsidian-owned plugin instance and composition root for one enabled lifecycle. */
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  private readonly operations = new OperationStateController();
  private history!: CompileHistoryService;
  private exporter!: ExportCoordinator;
  private commands!: CompileCommandService;
  /** Internal persistence owner for future Saved Compilation consumers. */
  savedCompilations!: SavedCompilationService;
  /** Internal workflow coordinator; it does not render UI or own persistence. */
  savedCompilationOrchestrator!: SavedCompilationOrchestrator;
  private savedCompilationStaleness!: SavedCompilationStalenessTracker;
  private active = false;

  /** Loads durable state, composes services once, and registers all Obsidian entry points. */
  async onload(): Promise<void> {
    await this.loadSettings();
    this.active = true;
    this.composeServices();
    this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this));
    this.registerCommands();
    this.registerFolderContextMenu();
    this.app.workspace.onLayoutReady(() => {
      this.registerSavedCompilationStalenessEvents();
      if (this.active && !this.settings.onboardingCompleted) new FirstRunWizardModal(this.app, this).open();
    });
  }

  /** Cancels work that has not crossed its non-cancellable file-finalisation boundary. */
  onunload(): void { this.active = false; this.operations.cancel(); }

  /** Repairs persisted data idempotently before any service is allowed to read it. */
  async loadSettings(): Promise<void> {
    const raw = await this.loadData() as Partial<ManuscriptCompilerSettings> | null;
    const stored = raw ? JSON.stringify(raw) : null;
    const loaded = Object.assign({}, DEFAULT_SETTINGS, raw);
    if (raw && raw.onboardingCompleted === undefined) loaded.onboardingCompleted = true;
    const previousWarnings = Array.isArray(loaded.configurationWarnings) ? loaded.configurationWarnings.length : 0;
    this.settings = repairSettings(loaded);
    if (raw && raw.defaultStructurePreset === undefined) this.settings.defaultStructurePreset = inferStructurePreset(this.getActiveProfile());
    if (stored !== null && JSON.stringify(this.settings) !== stored) await this.saveSettings();
    if (this.settings.configurationWarnings.length > previousWarnings) new Notice("Manuscript Compiler repaired invalid settings. Run validate manuscript for details.", 8000);
  }

  /** Persists the complete repaired settings object through Obsidian's plugin storage. */
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  /** Returns the repaired active profile, including compatibility fallback rules. */
  getActiveProfile(): CompileProfile { return activeProfile(this.settings); }
  /** Opens a new guided workspace without choosing a root on the user's behalf. */
  openCompiler(): void { new SimpleCompileModal(this.app, this).open(); }
  /** Opens the same workspace with the exact File Explorer folder selected as root. */
  async openCompilerForFolder(folder: TFolder): Promise<void> { new SimpleCompileModal(this.app, this, folder).open(); }
  /** Clears both history and associated compile logs through their persistence service. */
  async clearHistory(): Promise<void> { await this.history.clearHistory(); }
  /** Compatibility facade retained for callers; all work is delegated to CompileCommandService. */
  async compileRequest(request: SimpleCompileRequest): Promise<void> { await this.commands.compileRequest(request); }
  /** Supplies the workspace with an authoritative prepared semantic session. */
  async prepareCompileRequest(request: SimpleCompileRequest, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> { return this.commands.prepareGuided(request, contentPlan, signal); }
  /** Internal Part-6 entry point; no chooser or visible workflow is introduced here. */
  async prepareSavedCompilation(compilation: SavedCompilation, overlay?: CanonicalWorkspaceRecipe, signal?: AbortSignal): Promise<PreparedCompileSession> { return this.commands.prepareSavedCompilation(compilation, overlay, signal); }
  /** Internal Part-6 opening seam; UI selection remains a later concern. */
  async openSavedCompilation(id: string): Promise<SavedCompilationOpenResult> {
    return await this.savedCompilationOrchestrator.openSavedCompilation(id, {
      resolveRoot: (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFolder,
      prepare: async (compilation, overlay) => await this.prepareSavedCompilation(compilation, overlay),
      workspaceServices: {
        prepare: async (request, plan, signal) => await this.prepareCompileRequest(request, plan, signal),
        prepareSaved: async (compilation, overlay, signal) => await this.prepareSavedCompilation(compilation, overlay, signal),
        sessionIsCurrent: async (session) => await this.preparedSessionIsCurrent(session),
        export: async (session, format, filename) => await this.commands.exportPreparedSession(session, format, filename),
        authorizeSavedExport: () => this.savedCompilationOrchestrator.authorizeExport(true, true),
        recordSavedExport: async (session, format) => {
          const recorded = await this.savedCompilationOrchestrator.recordSuccessfulCleanExport(format, session.sourceFingerprint, session.inputSignature, Date.now());
          if (recorded === "persistence-failed") throw new Error("Saved export bookkeeping could not be persisted.");
        },
        isSavedCompilationPotentiallyStale: (compilationId) => this.savedCompilationStaleness.isPotentiallyStale(compilationId),
        onSavedCompilationRefreshCommitted: (compilationId) => this.savedCompilationStaleness.clear(compilationId)
      }
    });
  }
  /** Presents a controller returned by the authoritative Saved-open transaction. */
  presentSavedCompilation(controller: CompileWorkspaceController): void { new SimpleCompileModal(this.app, this, undefined, controller).open(); }
  /** UI facade: persistence stays with the Saved Compilation orchestrator. */
  async saveActiveSavedCompilation(controller: CompileWorkspaceController): Promise<SavedCompilationWorkflowResult> {
    if (controller.state.origin.kind !== "saved") return { status: "not-saved" };
    return await this.savedCompilationOrchestrator.saveChanges(controller.state.preparedSession !== undefined);
  }
  /** Creates a new Saved identity from the current controller without a rescan. */
  async saveActiveCompilationAs(controller: CompileWorkspaceController, name: string): Promise<SavedCompilationWorkflowResult> {
    if (controller.state.origin.kind === "new") this.savedCompilationOrchestrator.beginNew(controller.workspaceRecipeForSave());
    const result = await this.savedCompilationOrchestrator.saveAsNew(name, controller.state.preparedSession !== undefined);
    if (result.status === "ok") controller.activateSavedCompilation(result.session);
    return result;
  }
  acknowledgeActiveSavedReview(): boolean { return this.savedCompilationOrchestrator.acknowledgeReview(); }
  acceptActiveSavedNewSource(reference: string): boolean { return this.savedCompilationOrchestrator.acceptNewSource(reference); }
  acceptActiveSavedDeletedReference(reference: string): boolean { return this.savedCompilationOrchestrator.acceptDeletedReference(reference); }
  mapActiveSavedReference(reference: string, target: string): boolean { return this.savedCompilationOrchestrator.mapSavedReference(reference, target); }
  savedCompilationExportFreshness(controller: CompileWorkspaceController): SavedCompilationExportFreshness | undefined { return controller.state.origin.kind === "saved" ? this.savedCompilationOrchestrator.exportFreshness(controller.state.preparedSession) : undefined; }
  /** Renames display metadata without rebuilding the active Saved workspace. */
  async renameSavedCompilation(controller: CompileWorkspaceController, id: string, name: string): Promise<SavedCompilationOperation | "unchanged"> {
    const existing = this.savedCompilations.getById(id); if (!existing) return { status: "not-found" };
    if (existing.name === name.trim()) return "unchanged";
    const result = await this.savedCompilations.rename(id, name.trim());
    if (result.status === "ok" && controller.state.origin.kind === "saved" && controller.state.origin.compilationId === id) { controller.renameSavedCompilation(result.compilation.name); controller.workspaceSession()?.updateCompilationFacts(result.compilation); }
    return result;
  }
  /** Duplicates persisted Saved state only; it neither opens nor promotes the copy. */
  async duplicateSavedCompilation(id: string, name: string): Promise<SavedCompilationOperation> {
    return await this.savedCompilations.duplicate(id, name.trim());
  }
  /** Deletes only Saved persistence; an active Saved controller becomes New after a successful delete. */
  async deleteSavedCompilation(controller: CompileWorkspaceController, id: string): Promise<SavedCompilationOperation> {
    const result = await this.savedCompilations.delete(id);
    if (result.status === "ok" && controller.state.origin.kind === "saved" && controller.state.origin.compilationId === id) controller.detachSavedCompilation();
    return result;
  }
  /** Settings discovery deletes through the same persistence owner without touching vault files. */
  async deleteSavedCompilationGlobally(id: string): Promise<SavedCompilationOperation> {
    const result = await this.savedCompilations.delete(id);
    const active = this.savedCompilationOrchestrator.activeWorkspace();
    if (result.status === "ok" && active?.state.origin.kind === "saved" && active.state.origin.compilationId === id) active.detachSavedCompilation();
    return result;
  }
  async reassociateActiveSavedCompilation(root: TFolder): Promise<ActiveWorkspaceTransitionResult> { return await this.savedCompilationOrchestrator.reassociateRoot(root, this.savedOpenDependencies()); }
  async switchActiveToSavedCompilation(id: string, discardUnsavedChanges: boolean): Promise<ActiveWorkspaceTransitionResult> { return await this.savedCompilationOrchestrator.switchToSavedCompilation(id, discardUnsavedChanges, this.savedOpenDependencies()); }
  async switchActiveToNewCompilation(controller: CompileWorkspaceController, discardUnsavedChanges: boolean): Promise<ActiveWorkspaceTransitionResult> {
    const target = { request: controller.state.request, formatting: controller.state.formatting, contentPlan: controller.state.contentPlan };
    return await this.savedCompilationOrchestrator.switchToNewCompilation(target, discardUnsavedChanges, { prepare: async (candidate) => await this.prepareCompileRequest(candidate.request, candidate.contentPlan), workspaceServices: this.savedWorkspaceServices() });
  }
  /** Rechecks a session's source fingerprint without mutating or rebuilding it. */
  async preparedSessionIsCurrent(session: PreparedCompileSession): Promise<boolean> { return this.commands.preparedSessionIsCurrent(session); }
  /** Exports the exact prepared session and converts coordinator failure into a UI-safe exception. */
  async exportPreparedSession(session: PreparedCompileSession, format?: ExportFormat, filename?: string): Promise<void> { const result = await this.commands.exportPreparedSession(session, format, filename); if (result.status === "failed") throw new Error(result.error); }
  /** Routes onboarding/sample compilation through the production command service. */
  async compileSampleManuscript(): Promise<void> { await this.commands.compileSampleManuscript(); }
  /** Retains the historical plugin facade while enforcing the unified explicit-root route. */
  async compileFolder(folder: TFolder, profile?: CompileProfile, contentPlan: ContentPlanItem[] = [], route: CompileRoute = "legacy-profile"): Promise<void> { await this.commands.compileFolder(folder, profile, contentPlan, route); }

  private composeServices(): void {
    this.savedCompilations = new SavedCompilationService(() => this.settings, () => this.saveSettings());
    this.savedCompilations.initialize();
    this.savedCompilationStaleness = new SavedCompilationStalenessTracker(() => this.savedCompilations.listAll());
    this.savedCompilationOrchestrator = new SavedCompilationOrchestrator(this.savedCompilations, this.savedCompilationStaleness);
    this.history = new CompileHistoryService(() => this.settings, () => this.saveSettings(), this.manifest.version);
    this.exporter = new ExportCoordinator(this.app, () => this.settings, () => this.saveSettings(), this.operations, this.history);
    this.commands = new CompileCommandService(this.app, () => this.settings, () => this.getActiveProfile(), this.operations, this.exporter, this.manifest.version);
  }
  private savedWorkspaceServices(): CompileWorkspaceServices {
    return { prepare: async (request, plan, signal) => await this.prepareCompileRequest(request, plan, signal), prepareSaved: async (compilation, overlay, signal) => await this.prepareSavedCompilation(compilation, overlay, signal), sessionIsCurrent: async (session) => await this.preparedSessionIsCurrent(session), export: async (session, format, filename) => await this.commands.exportPreparedSession(session, format, filename), authorizeSavedExport: () => this.savedCompilationOrchestrator.authorizeExport(true, true), recordSavedExport: async (session, format) => { if (await this.savedCompilationOrchestrator.recordSuccessfulCleanExport(format, session.sourceFingerprint, session.inputSignature, Date.now()) === "persistence-failed") throw new Error("Saved export bookkeeping could not be persisted."); }, isSavedCompilationPotentiallyStale: (id) => this.savedCompilationStaleness.isPotentiallyStale(id), onSavedCompilationRefreshCommitted: (id) => this.savedCompilationStaleness.clear(id) };
  }
  private savedOpenDependencies(): SavedCompilationOpenDependencies { return { resolveRoot: (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFolder, prepare: async (compilation, overlay) => await this.prepareSavedCompilation(compilation, overlay), workspaceServices: this.savedWorkspaceServices() }; }

  private registerCommands(): void {
    this.addCommand({ id: COMMAND_IDS.compileManuscript, name: "Compile manuscript", callback: () => this.openCompiler() });
    this.addCommand({ id: COMMAND_IDS.compileCurrentBook, name: "Compile current book", callback: async () => { await this.commands.compileCurrentBook(); } });
    this.addCommand({ id: COMMAND_IDS.compileSelectedFolder, name: "Compile selected folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.commands.compileFolder(folder, undefined, [], "selected-folder"); }).open(); } });
    this.addCommand({ id: COMMAND_IDS.validateManuscript, name: "Validate manuscript", callback: async () => { await this.commands.validateManuscript(); } });
    this.addCommand({ id: COMMAND_IDS.generateDiagnostics, name: "Generate diagnostics report", callback: async () => { await this.commands.generateDiagnostics(); } });
  }

  private registerFolderContextMenu(): void {
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      addCompileFolderMenuItem(menu, file, (folder) => { void this.openCompilerForFolder(folder); });
    }));
  }

  /** Event callbacks only mark affected roots; reconciliation remains an explicit later workflow. */
  private registerSavedCompilationStalenessEvents(): void {
    this.registerEvent(this.app.vault.on("create", (file) => this.savedCompilationStaleness.markPathChanged(file.path)));
    this.registerEvent(this.app.vault.on("modify", (file) => this.savedCompilationStaleness.markPathChanged(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.savedCompilationStaleness.markPathChanged(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.savedCompilationStaleness.markRename(file.path, oldPath)));
  }
}
