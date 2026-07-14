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

/** Obsidian-owned plugin instance and composition root for one enabled lifecycle. */
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  private readonly operations = new OperationStateController();
  private history!: CompileHistoryService;
  private exporter!: ExportCoordinator;
  private commands!: CompileCommandService;

  /** Loads durable state, composes services once, and registers all Obsidian entry points. */
  async onload(): Promise<void> {
    await this.loadSettings();
    this.composeServices();
    this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this));
    this.registerCommands();
    this.registerFolderContextMenu();
    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.onboardingCompleted) new FirstRunWizardModal(this.app, this).open();
    });
  }

  /** Cancels work that has not crossed its non-cancellable file-finalisation boundary. */
  onunload(): void { this.operations.cancel(); }

  /** Repairs persisted data idempotently before any service is allowed to read it. */
  async loadSettings(): Promise<void> {
    const raw = await this.loadData() as Partial<ManuscriptCompilerSettings> | null;
    const loaded = Object.assign({}, DEFAULT_SETTINGS, raw);
    if (raw && raw.onboardingCompleted === undefined) loaded.onboardingCompleted = true;
    const previousWarnings = Array.isArray(loaded.configurationWarnings) ? loaded.configurationWarnings.length : 0;
    this.settings = repairSettings(loaded);
    if (raw && raw.defaultStructurePreset === undefined) this.settings.defaultStructurePreset = inferStructurePreset(this.getActiveProfile());
    await this.saveSettings();
    if (this.settings.configurationWarnings.length > previousWarnings) new Notice("Manuscript Compiler repaired invalid settings. Run Validate Manuscript for details.", 8000);
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
  /** Rechecks a session's source fingerprint without mutating or rebuilding it. */
  async preparedSessionIsCurrent(session: PreparedCompileSession): Promise<boolean> { return this.commands.preparedSessionIsCurrent(session); }
  /** Exports the exact prepared session and converts coordinator failure into a UI-safe exception. */
  async exportPreparedSession(session: PreparedCompileSession, format?: ExportFormat, filename?: string): Promise<void> { const result = await this.commands.exportPreparedSession(session, format, filename); if (result.status === "failed") throw new Error(result.error); }
  /** Routes onboarding/sample compilation through the production command service. */
  async compileSampleManuscript(): Promise<void> { await this.commands.compileSampleManuscript(); }
  /** Retains the historical plugin facade while enforcing the unified explicit-root route. */
  async compileFolder(folder: TFolder, profile?: CompileProfile, contentPlan: ContentPlanItem[] = [], route: CompileRoute = "legacy-profile"): Promise<void> { await this.commands.compileFolder(folder, profile, contentPlan, route); }

  private composeServices(): void {
    this.history = new CompileHistoryService(() => this.settings, () => this.saveSettings(), this.manifest.version);
    this.exporter = new ExportCoordinator(this.app, () => this.settings, () => this.saveSettings(), this.operations, this.history);
    this.commands = new CompileCommandService(this.app, () => this.settings, () => this.getActiveProfile(), this.operations, this.exporter, this.manifest.version);
  }

  private registerCommands(): void {
    this.addCommand({ id: COMMAND_IDS.compileManuscript, name: "Compile Manuscript", callback: () => this.openCompiler() });
    this.addCommand({ id: COMMAND_IDS.compileCurrentBook, name: "Compile Current Book", callback: () => { void this.commands.compileCurrentBook(); } });
    this.addCommand({ id: COMMAND_IDS.compileSelectedFolder, name: "Compile Selected Folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.commands.compileFolder(folder, undefined, [], "selected-folder"); }).open(); } });
    this.addCommand({ id: COMMAND_IDS.validateManuscript, name: "Validate Manuscript", callback: () => { void this.commands.validateManuscript(); } });
    this.addCommand({ id: COMMAND_IDS.generateDiagnostics, name: "Generate Diagnostics Report", callback: () => { void this.commands.generateDiagnostics(); } });
  }

  private registerFolderContextMenu(): void {
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      addCompileFolderMenuItem(menu, file, (folder) => { void this.openCompilerForFolder(folder); });
    }));
  }
}
