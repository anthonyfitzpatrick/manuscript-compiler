import { Notice, Plugin, TFolder } from "obsidian";
import { activeProfile, repairSettings } from "./profiles";
import { DEFAULT_SETTINGS, type CompileProfile, type ManuscriptCompilerSettings } from "./settings";
import { inferStructurePreset, type SimpleCompileRequest } from "./simple-workflow";
import type { ContentPlanItem } from "./content-plan";
import type { CompileRoute, PreparedCompileSession } from "./compile-preparation";
import { COMMAND_IDS } from "./commands";
import { OperationStateController } from "./operation-state";
import { CompileHistoryService } from "./compile-history";
import { ResultActionService } from "./result-actions";
import { ExportCoordinator } from "./export-coordinator";
import { CompileCommandService } from "./compile-command-service";
import { SafeBinaryWriter } from "./safe-binary-writer";
import { SimpleCompileModal } from "./compile-modal";
import { FirstRunWizardModal } from "./wizards";
import { FolderSuggestModal, ManuscriptCompilerSettingTab, showError } from "./ui";
import { addCompileFolderMenuItem } from "./folder-context-menu";

/** Plugin composition root: lifecycle, settings persistence, service construction, and command registration. */
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  private readonly operations = new OperationStateController();
  private history!: CompileHistoryService;
  private actions!: ResultActionService;
  private exporter!: ExportCoordinator;
  private commands!: CompileCommandService;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.composeServices();
    await this.cleanupStaleOutputFiles();
    this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this));
    this.registerCommands();
    this.registerFolderContextMenu();
    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.onboardingCompleted) new FirstRunWizardModal(this.app, this).open();
    });
  }

  onunload(): void { this.operations.cancel(); }

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

  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  getActiveProfile(): CompileProfile { return activeProfile(this.settings); }
  openCompiler(): void { new SimpleCompileModal(this.app, this).open(); }
  async openCompilerForFolder(folder: TFolder): Promise<void> { new SimpleCompileModal(this.app, this, folder).open(); }
  async openExport(path: string): Promise<void> { if (!await this.actions.openExport(path)) showError(new Error("Obsidian could not open this export automatically. Open it from your file manager.")); }
  async clearHistory(): Promise<void> { await this.history.clearHistory(); }
  async compileRequest(request: SimpleCompileRequest): Promise<void> { await this.commands.compileRequest(request); }
  async prepareCompileRequest(request: SimpleCompileRequest, contentPlan?: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> { return this.commands.prepareGuided(request, contentPlan, signal); }
  async preparedSessionIsCurrent(session: PreparedCompileSession): Promise<boolean> { return this.commands.preparedSessionIsCurrent(session); }
  async exportPreparedSession(session: PreparedCompileSession): Promise<void> { const result = await this.commands.exportPreparedSession(session); if (result.status === "failed") throw new Error(result.error); }
  async compileSampleManuscript(): Promise<void> { await this.commands.compileSampleManuscript(); }
  async compileFolder(folder: TFolder, profile?: CompileProfile, contentPlan: ContentPlanItem[] = [], route: CompileRoute = "legacy-profile"): Promise<void> { await this.commands.compileFolder(folder, profile, contentPlan, route); }

  private composeServices(): void {
    this.history = new CompileHistoryService(() => this.settings, () => this.saveSettings(), this.manifest.version);
    this.actions = new ResultActionService(this.app);
    this.exporter = new ExportCoordinator(this.app, () => this.settings, () => this.saveSettings(), this.operations, this.history, this.actions);
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

  private async cleanupStaleOutputFiles(): Promise<void> {
    try {
      const result = await new SafeBinaryWriter(this.app.vault).cleanupStaleArtifacts(this.settings.defaultExportFolder);
      if (result.removed.length) console.info(`Manuscript Compiler removed ${result.removed.length} stale temporary file(s).`);
      if (result.preservedBackups.length) console.warn(`Manuscript Compiler preserved ${result.preservedBackups.length} recovery backup file(s) for manual review.`);
    } catch (error) { console.warn("Manuscript Compiler could not complete stale temporary-file cleanup.", error); }
  }
}
