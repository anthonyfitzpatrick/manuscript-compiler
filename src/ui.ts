/**
 * Manuscript Compiler — shared legacy/secondary Obsidian UI.
 *
 * Contains folder selection, legacy preview, progress, validation, diagnostics,
 * and settings views still reached outside the three-stage
 * workspace. It calls plugin/service callbacks and must not implement scanning,
 * parsing, safe-write transactions, or platform filesystem bridges.
 */
import { App, ButtonComponent, FuzzySuggestModal, Modal, Notice, PluginSettingTab, Setting, TextAreaComponent, TFolder, type SettingDefinitionItem } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import type { Chapter, CompilePreview, CompileWarning, ManuscriptDocument, Part } from "./model";
import { duplicateProfile, validateProfile } from "./profiles";
import type { CompileProfile, DocxStylePreset, StructurePreset } from "./settings";
import { documentWordCount } from "./statistics";
import { STRUCTURE_PRESET_NAMES } from "./simple-workflow";
import type { ValidationResult } from "./validation";
import { ProfileWizardModal } from "./wizards";
import { redactTechnicalMessage } from "./diagnostics";
import { EXPORT_FORMAT_DETAILS, EXPORT_FORMATS, type ExportFormat } from "./export-types";
import buyMeACoffeeArtwork from "./assets/bmc-button.svg";
import pluginLogo from "../logo.svg";
import { optionalNoArgMethod } from "./type-guards";

const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const buyMeACoffeeArtworkUrl = svgDataUrl(buyMeACoffeeArtwork);
const pluginLogoUrl = svgDataUrl(pluginLogo);

/** Reusable vault-folder picker for compatibility commands/settings. */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly onChoose: (folder: TFolder) => void) { super(app); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder && file.path !== "/"); }
  getItemText(folder: TFolder): string { return folder.path; }
  onChooseItem(folder: TFolder): void { this.onChoose(folder); }
}

/** Legacy-route semantic preview; receives finished preview data and never scans. */
export class CompilePreviewModal extends Modal {
  constructor(app: App, private readonly preview: CompilePreview, private readonly expanded: boolean, private readonly showStatistics: boolean, private readonly resolve: (compile: boolean) => void) { super(app); }
  onOpen(): void {
    this.modalEl.addClass("manuscript-compiler-preview"); this.titleEl.setText("Compile preview");
    const summary = this.contentEl.createEl("dl", { cls: "manuscript-compiler-report" });
    [["Manuscript folder", this.preview.book.root.path], ["Parts", String(this.preview.parts)], ["Chapters", String(this.preview.chapters)], ["Scenes", String(this.preview.scenes)], ["Front matter", String(this.preview.frontMatter)], ["Back matter", String(this.preview.backMatter)], ["Words", this.preview.wordCount.toLocaleString()], ["Output", this.preview.outputPaths.join(", ")]].forEach(([label, value]) => row(summary, label, value));
    const important = this.preview.issues.filter((issue) => issue.severity !== "information");
    if (important.length) { this.contentEl.createEl("h3", { text: "Important warnings" }); const list = this.contentEl.createEl("ul"); important.forEach((issue) => list.createEl("li", { text: issue.message })); }
    const details = this.contentEl.createEl("details"); details.createEl("summary", { text: "Details" });
    const controls = new Setting(details).setName("Find chapters or scenes"); controls.addSearch((search) => search.setPlaceholder("Search structure…").onChange((value) => this.filterTree(value))); controls.addButton((button) => button.setButtonText("Expand all").onClick(() => this.setTreeExpanded(true))).addButton((button) => button.setButtonText("Collapse all").onClick(() => this.setTreeExpanded(false)));
    const layout = details.createDiv({ cls: "manuscript-compiler-preview-layout" }); const tree = layout.createDiv({ cls: "manuscript-compiler-tree" }); const inspector = layout.createDiv({ cls: "manuscript-compiler-inspector" }); inspector.createEl("p", { text: "Select a scene to inspect its filename, word count, metadata, and compile status." });
    const root = this.branch(tree, this.preview.book.title, true, this.statusForPath(this.preview.book.root.path)); this.documentBranch(root, "📄 Front Matter", this.preview.book.frontMatter.documents, inspector); this.preview.book.parts.forEach((part) => this.partBranch(root, part, inspector)); this.preview.book.orphanScenes.forEach((scene) => this.sceneNode(root, scene, inspector)); this.documentBranch(root, "📄 Back Matter", this.preview.book.backMatter.documents, inspector);
    if (this.showStatistics) { const stats = details.createEl("dl", { cls: "manuscript-compiler-report" }); row(stats, "Average chapter", `${this.preview.statistics.averageChapterLength.toLocaleString()} words`); row(stats, "Average scene", `${this.preview.statistics.averageSceneLength.toLocaleString()} words`); row(stats, "Reading time", `${this.preview.statistics.readingTimeMinutes} min`); }
    this.renderIssues(details, this.preview.issues);
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Cancel").onClick(() => { this.resolve(false); this.close(); })).addButton((button) => button.setButtonText(this.preview.canExport ? "Compile" : "Export unavailable").setCta().setDisabled(!this.preview.canExport).onClick(() => { this.resolve(true); this.close(); }));
  }
  onClose(): void { this.resolve(false); this.contentEl.empty(); }
  private branch(parent: HTMLElement, label: string, root = false, status = "included"): HTMLElement { const details = parent.createEl("details"); details.dataset.search = label.toLowerCase(); details.open = root || this.expanded; const summary = details.createEl("summary"); summary.createSpan({ cls: `manuscript-status manuscript-status-${status}`, text: status === "included" ? "✓" : status === "excluded" ? "−" : "!" }); summary.createSpan({ text: `${label} — ${status}` }); return details.createDiv({ cls: "manuscript-tree-children" }); }
  private documentBranch(parent: HTMLElement, label: string, documents: ManuscriptDocument[], inspector: HTMLElement): void { const branch = this.branch(parent, label, false, documents.some((item) => item.excluded) ? "warning" : "included"); documents.forEach((document) => this.sceneNode(branch, document, inspector)); }
  private partBranch(parent: HTMLElement, part: Part, inspector: HTMLElement): void { if (part.synthetic) { part.orphanScenes.forEach((scene) => this.sceneNode(parent, scene, inspector)); part.chapters.forEach((chapter) => this.chapterBranch(parent, chapter, inspector)); return; } const branch = this.branch(parent, `📚 ${part.title}`, false, this.statusForPath(part.path)); part.orphanScenes.forEach((scene) => this.sceneNode(branch, scene, inspector)); part.chapters.forEach((chapter) => this.chapterBranch(branch, chapter, inspector)); }
  private chapterBranch(parent: HTMLElement, chapter: Chapter, inspector: HTMLElement): void { const branch = this.branch(parent, `📖 ${chapter.title}`, false, this.statusForPath(chapter.path)); chapter.scenes.forEach((scene) => this.sceneNode(branch, scene, inspector)); }
  private sceneNode(parent: HTMLElement, document: ManuscriptDocument, inspector: HTMLElement): void { const status = document.excluded ? "excluded" : this.statusForPath(document.file.path); const row = parent.createDiv({ cls: "manuscript-tree-scene" }); row.dataset.search = document.title.toLowerCase(); row.createSpan({ cls: `manuscript-status manuscript-status-${status}`, text: status === "included" ? "✓" : status === "excluded" ? "−" : "!" }); const button = row.createEl("button", { cls: "clickable-icon manuscript-scene-button", text: `📝 ${document.title} — ${status}` }); button.addEventListener("click", () => this.inspect(document, inspector)); }
  private inspect(document: ManuscriptDocument, inspector: HTMLElement): void { inspector.empty(); inspector.createEl("h3", { text: document.title }); const list = inspector.createEl("dl", { cls: "manuscript-compiler-report" }); row(list, "Filename", document.file.path); row(list, "Word count", documentWordCount(document.content).toLocaleString()); row(list, "Compile status", document.excluded ? `Excluded — ${document.exclusionReason ?? "Profile rule"}` : "Included"); inspector.createEl("h4", { text: "Metadata" }); const values = Object.entries(document.metadata.values); if (!values.length) inspector.createEl("p", { text: "None" }); else { const metadata = inspector.createEl("dl", { cls: "manuscript-compiler-report" }); values.forEach(([key, value]) => row(metadata, key, typeof value === "string" ? value : JSON.stringify(value))); } }
  private statusForPath(path: string): "included" | "warning" { return this.preview.issues.some((issue) => issue.path?.includes(path)) ? "warning" : "included"; }
  private setTreeExpanded(expanded: boolean): void { this.contentEl.querySelectorAll<HTMLDetailsElement>(".manuscript-compiler-tree details").forEach((details) => { details.open = expanded; }); }
  private filterTree(query: string): void { const normalized = query.trim().toLowerCase(); const tree = this.contentEl.querySelector(".manuscript-compiler-tree"); if (!tree) return; tree.querySelectorAll<HTMLElement>("[data-search]").forEach((element) => { element.hidden = normalized.length > 0 && !(element.dataset.search ?? "").includes(normalized); }); if (normalized) tree.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => { if (details.querySelector(":scope [data-search]:not([hidden])")) { details.hidden = false; details.open = true; } }); }
  private renderIssues(parent: HTMLElement, issues: CompileWarning[]): void { const details = parent.createEl("details"); details.createEl("summary", { text: `Issues (${issues.length})` }); const list = details.createEl("ul"); issues.forEach((issue) => list.createEl("li", { text: issue.message })); }
}

/** Progress/cancel view whose cancel callback is owned by orchestration. */
export class CompilationProgressModal extends Modal {
  private statusEl?: HTMLElement; private cancelButton?: HTMLButtonElement; private cancelled = false; private completed = false;
  constructor(app: App, private readonly cancel: () => void) { super(app); }
  onOpen(): void { this.titleEl.setText("Compiling manuscript"); this.statusEl = this.contentEl.createEl("p", { text: "Preparing…" }); this.statusEl.setAttribute("role", "status"); this.statusEl.setAttribute("aria-live", "polite"); new Setting(this.contentEl).addButton((button) => { this.cancelButton = button.buttonEl; destructive(button.setButtonText("Cancel compilation")).onClick(() => { if (this.cancelled) return; this.cancelled = true; button.setDisabled(true).setButtonText("Cancelling…"); this.cancel(); }); }); }
  update(stage: string): void { if (!this.cancelled) this.statusEl?.setText(stage); }
  lock(stage: string): void { this.completed = true; this.statusEl?.setText(stage); if (this.cancelButton) { this.cancelButton.disabled = true; this.cancelButton.setText("Finalising file…"); } }
  finish(): void { this.completed = true; this.close(); }
  onClose(): void { if (!this.completed && !this.cancelled) { this.cancelled = true; this.cancel(); } this.contentEl.empty(); }
}

/** Read-only presentation of ManuscriptValidationService output. */
export class ValidationReportModal extends Modal {
  constructor(app: App, private readonly root: string, private readonly report: ValidationResult) { super(app); }
  onOpen(): void { this.titleEl.setText("Manuscript validation report"); const counts = { information: 0, warning: 0, error: 0 }; this.report.issues.forEach((issue) => { counts[issue.severity] += 1; }); const summary = this.contentEl.createEl("dl", { cls: "manuscript-compiler-report" }); [["Manuscript", this.root], ["Front matter", String(this.report.book.frontMatter.documents.filter((item) => !item.excluded && item.content.trim()).length)], ["Parts", String(this.report.statistics.partCount)], ["Chapters", String(this.report.statistics.chapterCount)], ["Scenes", String(this.report.statistics.sceneCount)], ["Back matter", String(this.report.book.backMatter.documents.filter((item) => !item.excluded && item.content.trim()).length)], ["Excluded items", String(this.report.exclusions.length)], ["Errors", String(counts.error)], ["Warnings", String(counts.warning)], ["Information", String(counts.information)]].forEach(([label, value]) => row(summary, label, value)); if (this.report.exclusions.length) { const excluded = this.contentEl.createEl("details"); excluded.createEl("summary", { text: `Excluded content (${this.report.exclusions.length})` }); const list = excluded.createEl("ul"); this.report.exclusions.forEach((item) => list.createEl("li", { text: `${item.name}: ${item.reason}` })); } const issues = this.contentEl.createEl("ul"); this.report.issues.forEach((issue) => issues.createEl("li", { text: `${issue.message}${issue.suggestion ? ` Suggested fix: ${issue.suggestion}` : ""}` })); new Setting(this.contentEl).addButton((button) => button.setButtonText("Close").setCta().onClick(() => this.close())); }
}

/** Displays and optionally saves an already-redacted diagnostics report. */
export class DiagnosticsReportModal extends Modal {
  constructor(app: App, private readonly report: string, private readonly save: () => Promise<string>) { super(app); }
  onOpen(): void { this.titleEl.setText("Diagnostics report"); this.contentEl.createEl("p", { text: "This report contains configuration and environment information, but no manuscript contents." }); const area = new TextAreaComponent(this.contentEl); area.setValue(this.report); area.inputEl.readOnly = true; area.inputEl.addClass("manuscript-profile-json"); new Setting(this.contentEl).addButton((button) => button.setButtonText("Copy").onClick(async () => { try { await area.inputEl.win.navigator.clipboard.writeText(this.report); new Notice("Diagnostics report copied."); } catch { area.inputEl.focus(); area.inputEl.select(); } })).addButton((button) => button.setButtonText("Save diagnostics note").setCta().onClick(async () => { new Notice(`Diagnostics saved to ${await this.save()}`, 6000); this.close(); })).addButton((button) => button.setButtonText("Close").onClick(() => this.close())); }
}

class ProfileJsonModal extends Modal {
  private value: string;
  constructor(app: App, private readonly mode: "import" | "export", profile: CompileProfile, private readonly done: (value?: string) => void | Promise<void>) { super(app); this.value = mode === "export" ? JSON.stringify(profile, null, 2) : ""; }
  onOpen(): void { this.titleEl.setText(`${this.mode === "import" ? "Import" : "Export"} compile profile`); const area = new TextAreaComponent(this.contentEl); area.setValue(this.value).onChange((value) => { this.value = value; }); area.inputEl.addClass("manuscript-profile-json"); new Setting(this.contentEl).addButton((button) => button.setButtonText("Close").onClick(() => this.close())); if (this.mode === "import") new Setting(this.contentEl).addButton((button) => button.setButtonText("Import").setCta().onClick(() => { void this.done(this.value); this.close(); })); }
}
class ExportHistoryModal extends Modal { constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app); } onOpen(): void { this.titleEl.setText("Export history"); this.plugin.settings.exportHistory.forEach((entry) => { const details = this.contentEl.createEl("details"); details.createEl("summary", { text: `${entry.cancelled ? "—" : entry.success ? "✓" : "✗"} ${new Date(entry.timestamp).toLocaleString()} — ${(entry.format ?? "docx").toUpperCase()}` }); details.createEl("p", { text: `${entry.manuscript} · ${entry.wordCount.toLocaleString()} words` }); entry.outputFiles.forEach((filename) => details.createEl("p", { text: filename })); }); new Setting(this.contentEl).addButton((button) => destructive(button.setButtonText("Clear history and logs")).onClick(async () => { await this.plugin.clearHistory(); this.close(); })).addButton((button) => button.setButtonText("Close").onClick(() => this.close())); } }
class CompileLogsModal extends Modal { constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app); } onOpen(): void { this.titleEl.setText("Compile logs"); this.plugin.settings.compileLogs.forEach((log) => { const details = this.contentEl.createEl("details"); details.createEl("summary", { text: `${log.cancelled ? "Cancelled" : log.success ? "Success" : "Failure"} — ${new Date(log.timestamp).toLocaleString()} — ${log.profile}` }); const pre = details.createEl("pre"); pre.setText([`Compiler: ${log.compilerVersion}`, `Manuscript: ${log.manuscript}`, `Formats: ${log.exportFormats}`, `Outputs: ${log.outputFiles.join(", ") || "None"}`, `Duration: ${log.durationMs} ms`, `Warnings: ${log.warnings.join(" | ") || "None"}`, log.diagnostics ? `Diagnostics:\n${log.diagnostics}` : ""].filter(Boolean).join("\n")); }); new Setting(this.contentEl).addButton((button) => button.setButtonText("Close").onClick(() => this.close())); } }

const SUPPORT_ACTIONS = [
  { label: "Report a bug", icon: "bug", url: "https://github.com/anthonyfitzpatrick/manuscript-compiler/issues/new?template=bug_report.yml" },
  { label: "Feature request", icon: "lightbulb", url: "https://github.com/anthonyfitzpatrick/manuscript-compiler/issues/new?template=feature_request.yml" },
  { label: "wolf359.app", icon: "globe", url: "https://wolf359.app" },
  { label: "Wolf 359 Press", icon: "book-open", url: "https://wolf359.press" },
  { label: "Buy me a coffee", icon: "coffee", url: "https://buymeacoffee.com/wolf359pressab" }
] as const;
const SUPPORT_CREATOR = "Anthony Fitzpatrick";
const SUPPORT_COMPANY = "Wolf 359 Press AB";
const SUPPORT_SECTION_TITLE = "Support & Links";

/** Defaults/advanced compatibility settings; not the primary compile workspace. */
export class ManuscriptCompilerSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app, plugin); }
  /** Provides searchable settings on Obsidian 1.13+ while display() remains the pre-1.13 fallback. */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.plugin.settings; const profile = this.plugin.getActiveProfile();
    return [
      { name: "Compiler", desc: "Open the guided manuscript compiler.", render: (setting) => { setting.addButton((button) => button.setButtonText("Open compiler").setCta().onClick(() => this.plugin.openCompiler())); } },
      { type: "group", heading: "Defaults", items: [
        { name: "Default manuscript folder", aliases: ["Manuscript root", "Book folder"], render: (setting) => { setting.addText((text) => text.setValue(settings.defaultManuscriptFolder).onChange(async (value) => { settings.defaultManuscriptFolder = value.trim(); await this.plugin.saveSettings(); })); } },
        { name: "Default structure", render: (setting) => { setting.addDropdown((dropdown) => { Object.entries(STRUCTURE_PRESET_NAMES).forEach(([value, label]) => { dropdown.addOption(value, label); }); dropdown.setValue(settings.defaultStructurePreset).onChange(async (value) => { settings.defaultStructurePreset = value as StructurePreset; await this.plugin.saveSettings(); }); }); } },
        { name: "Default format", render: (setting) => { setting.addDropdown((dropdown) => { EXPORT_FORMATS.forEach((format) => { dropdown.addOption(format, EXPORT_FORMAT_DETAILS[format].label); }); dropdown.setValue(settings.defaultDownloadFormat).onChange(async (value) => { settings.defaultDownloadFormat = value as ExportFormat; await this.plugin.saveSettings(); }); }); } },
        { name: "Default document style", render: (setting) => { setting.addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum-ready").addOption("standard", "Standard manuscript").setValue(settings.defaultDocxStyle === "custom" ? "standard" : settings.defaultDocxStyle).onChange(async (value) => { settings.defaultDocxStyle = value as DocxStylePreset; await this.plugin.saveSettings(); })); } },
        { name: "Include title page", render: (setting) => { setting.addToggle((toggle) => toggle.setValue(settings.includeTitlePageByDefault).onChange(async (value) => { settings.includeTitlePageByDefault = value; await this.plugin.saveSettings(); })); } },
        { name: "Include table of contents", render: (setting) => { setting.addToggle((toggle) => toggle.setValue(settings.includeTableOfContentsByDefault).onChange(async (value) => { settings.includeTableOfContentsByDefault = value; await this.plugin.saveSettings(); })); } }
      ] },
      { type: "group", heading: "Advanced profiles, records, and compatibility", items: [
        { name: "Advanced profile", desc: "Used for customised or older workflows.", render: (setting) => { setting.addDropdown((dropdown) => { settings.profiles.forEach((item) => { dropdown.addOption(item.id, item.name); }); dropdown.setValue(profile.id).onChange(async (id) => { settings.activeProfileId = id; await this.saveAndRender(); }); }); } },
        { name: "Profile actions", render: (setting) => { setting.addButton((button) => button.setButtonText("New").onClick(() => new ProfileWizardModal(this.app, this.plugin, async (created) => { settings.profiles.push(created); settings.activeProfileId = created.id; await this.saveAndRender(); }).open())).addButton((button) => button.setButtonText("Duplicate").onClick(async () => { const copy = duplicateProfile(profile); settings.profiles.push(copy); settings.activeProfileId = copy.id; await this.saveAndRender(); })).addButton((button) => destructive(button.setButtonText("Delete")).setDisabled(settings.profiles.length < 2).onClick(async () => { settings.profiles = settings.profiles.filter((item) => item.id !== profile.id); settings.activeProfileId = settings.profiles[0].id; await this.saveAndRender(); })); } },
        { name: "Profile JSON", aliases: ["Import profile", "Export profile"], render: (setting) => { setting.addButton((button) => button.setButtonText("Export").onClick(() => new ProfileJsonModal(this.app, "export", profile, () => undefined).open())).addButton((button) => button.setButtonText("Import").onClick(() => new ProfileJsonModal(this.app, "import", profile, (json) => this.importProfileJson(json)).open())); } },
        { name: "Export records", aliases: ["History", "Logs"], render: (setting) => { setting.addButton((button) => button.setButtonText(`History (${settings.exportHistory.length})`).onClick(() => new ExportHistoryModal(this.app, this.plugin).open())).addButton((button) => button.setButtonText(`Logs (${settings.compileLogs.length})`).onClick(() => new CompileLogsModal(this.app, this.plugin).open())); } }
      ] },
      { type: "group", heading: SUPPORT_SECTION_TITLE, items: [
        { name: "About and support", desc: "Version, creator, support, website, and optional funding links.", render: (setting) => { setting.settingEl.addClass("manuscript-support-panel"); this.renderSupportContent(setting.settingEl); } }
      ] }
    ];
  }
  display(): void { this.renderSettings(); }
  private renderSettings(): void {
    const container = this.containerEl; const settings = this.plugin.settings; const profile = this.plugin.getActiveProfile(); container.empty(); container.addClass("manuscript-compiler-settings");
    new Setting(container).setName("Compiler").addButton((button) => button.setButtonText("Open compiler").setCta().onClick(() => this.plugin.openCompiler()));
    new Setting(container).setName("Defaults").setHeading(); this.text(container, "Default manuscript folder", settings.defaultManuscriptFolder, (value) => { settings.defaultManuscriptFolder = value; });
    new Setting(container).setName("Default structure").addDropdown((dropdown) => { Object.entries(STRUCTURE_PRESET_NAMES).forEach(([value, label]) => { dropdown.addOption(value, label); }); dropdown.setValue(settings.defaultStructurePreset).onChange((value) => { settings.defaultStructurePreset = value as StructurePreset; void this.plugin.saveSettings(); }); });
    new Setting(container).setName("Default format").addDropdown((dropdown) => { EXPORT_FORMATS.forEach((format) => { dropdown.addOption(format, EXPORT_FORMAT_DETAILS[format].label); }); dropdown.setValue(settings.defaultDownloadFormat).onChange((value) => { settings.defaultDownloadFormat = value as ExportFormat; void this.plugin.saveSettings(); }); });
    new Setting(container).setName("Default document style").addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum-ready").addOption("standard", "Standard manuscript").setValue(settings.defaultDocxStyle === "custom" ? "standard" : settings.defaultDocxStyle).onChange((value) => { settings.defaultDocxStyle = value as DocxStylePreset; void this.plugin.saveSettings(); }));
    this.toggle(container, "Include title page", settings.includeTitlePageByDefault, (value) => { settings.includeTitlePageByDefault = value; }); this.toggle(container, "Include table of contents", settings.includeTableOfContentsByDefault, (value) => { settings.includeTableOfContentsByDefault = value; });
    const advanced = container.createEl("details"); advanced.createEl("summary", { text: "Advanced profiles, records, and compatibility" });
    new Setting(advanced).setName("Advanced profile").setDesc("Used for customised or older workflows.").addDropdown((dropdown) => { settings.profiles.forEach((item) => { dropdown.addOption(item.id, item.name); }); dropdown.setValue(profile.id).onChange((id) => { settings.activeProfileId = id; void this.saveAndRender(); }); });
    new Setting(advanced).setName("Profile actions").addButton((button) => button.setButtonText("New").onClick(() => new ProfileWizardModal(this.app, this.plugin, async (created) => { settings.profiles.push(created); settings.activeProfileId = created.id; await this.saveAndRender(); }).open())).addButton((button) => button.setButtonText("Duplicate").onClick(() => { const copy = duplicateProfile(profile); settings.profiles.push(copy); settings.activeProfileId = copy.id; void this.saveAndRender(); })).addButton((button) => destructive(button.setButtonText("Delete")).setDisabled(settings.profiles.length < 2).onClick(() => { settings.profiles = settings.profiles.filter((item) => item.id !== profile.id); settings.activeProfileId = settings.profiles[0].id; void this.saveAndRender(); }));
    new Setting(advanced).setName("Profile JSON").addButton((button) => button.setButtonText("Export").onClick(() => new ProfileJsonModal(this.app, "export", profile, () => undefined).open())).addButton((button) => button.setButtonText("Import").onClick(() => new ProfileJsonModal(this.app, "import", profile, (json) => this.importProfileJson(json)).open()));
    new Setting(advanced).setName("Export records").addButton((button) => button.setButtonText(`History (${settings.exportHistory.length})`).onClick(() => new ExportHistoryModal(this.app, this.plugin).open())).addButton((button) => button.setButtonText(`Logs (${settings.compileLogs.length})`).onClick(() => new CompileLogsModal(this.app, this.plugin).open()));
    this.renderSupportPanel(container);
  }
  /** Renders the non-configuring support footer after every persisted setting. */
  private renderSupportPanel(parent: HTMLElement): void {
    const panel = parent.createDiv({ cls: "manuscript-support-panel" });
    new Setting(panel).setName(SUPPORT_SECTION_TITLE).setHeading();
    this.renderSupportContent(panel);
  }
  private renderSupportContent(panel: HTMLElement): void {
    const identity = panel.createDiv({ cls: "manuscript-support-identity" });
    identity.createEl("img", { cls: "manuscript-support-logo", attr: { src: pluginLogoUrl, alt: "", "aria-hidden": "true" } });
    const identityText = identity.createDiv({ cls: "manuscript-support-identity-text" });
    identityText.createEl("strong", { cls: "manuscript-support-name", text: "Manuscript Compiler" });
    identityText.createEl("p", { text: `Version ${this.plugin.manifest.version}` });
    identityText.createEl("p", { text: `Created by ${SUPPORT_CREATOR}` });
    identityText.createEl("p", { text: SUPPORT_COMPANY });
    const actions = panel.createDiv({ cls: "manuscript-support-actions" });
    for (const action of SUPPORT_ACTIONS) {
      const button = new ButtonComponent(actions).setTooltip(action.label).setClass("manuscript-support-button");
      if (action.label === "Buy me a coffee") {
        const icon = button.buttonEl.createSpan({ cls: "manuscript-support-bmc-icon", attr: { "aria-hidden": "true" } });
        icon.createEl("img", { attr: { src: buyMeACoffeeArtworkUrl, alt: "" } });
      } else {
        button.setIcon(action.icon);
      }
      button.buttonEl.createSpan({ cls: "manuscript-support-button-label", text: action.label });
      button.buttonEl.setAttribute("aria-label", action.label);
      button.onClick(() => {
        button.buttonEl.win.open(action.url, "_blank", "noopener,noreferrer");
      });
    }
  }
  private text(parent: HTMLElement, name: string, value: string, change: (value: string) => void): void { new Setting(parent).setName(name).addText((text) => text.setValue(value).onChange(async (next) => { change(next.trim()); await this.plugin.saveSettings(); })); }
  private toggle(parent: HTMLElement, name: string, value: boolean, change: (value: boolean) => void): void { new Setting(parent).setName(name).addToggle((toggle) => toggle.setValue(value).onChange(async (next) => { change(next); await this.plugin.saveSettings(); })); }
  private async importProfileJson(json?: string): Promise<void> { if (!json) return; if (new TextEncoder().encode(json).length > 262_144) { new Notice("Profile JSON is too large. Profiles must be smaller than 256 kb.", 8000); return; } let parsed: unknown; try { parsed = JSON.parse(json); } catch { new Notice("Profile JSON is invalid. Correct the JSON syntax and try again.", 8000); return; } const validation = validateProfile(parsed); if (!validation.profile) { new Notice(validation.errors.join(" "), 8000); return; } this.plugin.settings.profiles.push(validation.profile); this.plugin.settings.activeProfileId = validation.profile.id; await this.saveAndRender(); }
  private async saveAndRender(): Promise<void> { await this.plugin.saveSettings(); const update = optionalNoArgMethod(this, "update"); if (update) update(); else this.renderSettings(); }
}

function row(list: HTMLElement, label: string, value: string): void { list.createEl("dt", { text: label }); list.createEl("dd", { text: value }); }
/**
 * Presents an unknown failure through a redacted Notice and console message.
 * Side effects are intentionally limited to author-visible diagnostics; raw
 * errors that might contain private paths or metadata are never emitted.
 */
export function showError(error: unknown): void { const message = redactTechnicalMessage(error); new Notice(`Manuscript Compiler: ${message}`, 8000); console.error(`Manuscript Compiler: ${message}`); }

/** Uses the current destructive API while retaining compatibility with Obsidian before 1.13. */
function destructive(button: ButtonComponent): ButtonComponent { const method = optionalNoArgMethod(button, "setDestructive"); if (method) { method(); return button; } button.buttonEl.addClass("mod-warning"); return button; }
