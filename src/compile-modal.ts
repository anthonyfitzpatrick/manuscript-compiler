import { App, FuzzySuggestModal, Modal, Notice, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { classifyContentPlan, createContentPlan } from "./content-plan";
import { docxFormattingForPreset, type DocxFormatting, type SimpleCompileRequest } from "./simple-workflow";
import { CompileWorkspaceController } from "./workspace/compile-workspace-controller";
import type { CompileWorkspaceStep } from "./workspace/workspace-types";
import { renderManuscriptStep } from "./workspace/manuscript-step";
import { renderContentsStep } from "./workspace/contents-step";
import { renderFormattingStep } from "./workspace/formatting-step";
import { renderExportStep } from "./workspace/export-step";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly selected: (folder: TFolder) => void) { super(app); this.setPlaceholder("Choose a folder…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.selected(item); }
}

const steps: CompileWorkspaceStep[] = ["manuscript", "contents", "formatting", "export"];
const labels = ["Manuscript", "Contents", "Formatting", "Export"];

export class SimpleCompileModal extends Modal {
  private readonly controller: CompileWorkspaceController;
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) {
    super(app);
    const settings = plugin.settings; const profile = plugin.getActiveProfile();
    const formatting: DocxFormatting = docxFormattingForPreset(settings.defaultDocxStyle, settings.includeTitlePageByDefault);
    const request: SimpleCompileRequest = { manuscriptRoot: settings.defaultManuscriptFolder || profile.manuscriptRoot, structurePreset: settings.defaultStructurePreset, includeFrontMatter: true, includeBackMatter: true, exportFolder: settings.defaultExportFolder || profile.exportFolder, outputFilename: this.filename(profile.outputFilename || "Manuscript.docx"), outputFormat: "docx", docxPreset: settings.defaultDocxStyle, downloadAfterExport: true, formatting, tableOfContents: settings.includeTableOfContentsByDefault, partDisplay: "word-title", chapterDisplay: "word-title", custom: { variables: { ...profile.variables }, bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])] } };
    this.controller = new CompileWorkspaceController(request, formatting, { prepare: (next, plan, signal) => this.plugin.prepareCompileRequest(next, plan, signal), sessionIsCurrent: (session) => this.plugin.preparedSessionIsCurrent(session), export: (session) => this.plugin.exportPreparedSession(session) });
  }

  onOpen(): void { this.modalEl.addClass("manuscript-compile-workspace"); this.render(); }
  onClose(): void { this.controller.close(); this.contentEl.empty(); }

  private render(): void {
    const state = this.controller.state; const current = steps.indexOf(state.step); this.contentEl.empty(); this.titleEl.setText("Compile Manuscript");
    const nav = this.contentEl.createDiv({ cls: "manuscript-compile-steps", attr: { role: "tablist", "aria-label": "Compile steps" } });
    labels.forEach((label, index) => { const button = nav.createEl("button", { text: `${index + 1}  ${label}`, cls: index === current ? "is-active" : index < current ? "is-complete" : "" }); button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(index === current)); button.disabled = index > current + 1 || index > 0 && !state.contentPlan.length; button.addEventListener("click", () => this.enterStep(steps[index])); });
    const body = this.contentEl.createDiv({ cls: "manuscript-compile-body" });
    if (state.step === "manuscript") renderManuscriptStep(body, this.controller, this.folder(), { chooseFolder: () => new FolderPicker(this.app, (folder) => { void this.selectFolder(folder); }).open(), useCurrentFolder: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.selectFolder(folder); else new Notice("Open a note inside the manuscript folder first."); }, changed: () => this.updateCreateButton() });
    else if (state.step === "contents") renderContentsStep(body, this.controller, () => this.render());
    else if (state.step === "formatting") renderFormattingStep(body, this.controller);
    else renderExportStep(body, this.controller, { refresh: () => { void this.prepare(true); }, filename: (value) => this.filename(value), changed: () => this.markPreviewInvalidated() });
    this.renderFooter();
  }

  private renderFooter(): void {
    const state = this.controller.state; const current = steps.indexOf(state.step); const footer = this.contentEl.createDiv({ cls: "manuscript-compile-footer" }); footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const forward = footer.createDiv({ cls: "manuscript-footer-forward" }); if (current > 0) forward.createEl("button", { text: "Back" }).addEventListener("click", () => this.enterStep(steps[current - 1]));
    const primary = forward.createEl("button", { text: state.step === "export" ? state.preparationStatus === "preparing" ? "Preparing…" : "Create DOCX" : state.step === "manuscript" ? "Scan manuscript" : "Continue", cls: `mod-cta${state.step === "export" ? " manuscript-create-button" : ""}` }); primary.disabled = state.step === "export" && (!state.preparedSession || state.preparationStatus === "preparing" || state.exportStatus === "exporting");
    primary.addEventListener("click", () => { if (state.step === "manuscript") void this.scanAndContinue(); else if (state.step === "export") void this.export(); else { const errors = this.controller.canAdvance(); if (errors.length) new Notice(errors.join(" ")); else this.enterStep(steps[current + 1]); } });
  }

  private async selectFolder(folder: TFolder): Promise<void> { const plan = createContentPlan(folder, this.controller.state.request.structurePreset); this.controller.setDetectedPlan(folder.path, plan); if (/^(?:Manuscript|Untitled)/i.test(this.controller.state.request.outputFilename)) this.controller.setOutput(this.controller.state.request.exportFolder, `${folder.name}.docx`); this.render(); await classifyContentPlan(this.app.vault, plan); if (this.controller.state.scannedRoot === folder.path) this.render(); }
  private async scanAndContinue(): Promise<void> { const folder = this.folder(); if (!folder) { new Notice("Choose a manuscript folder that exists in this vault.", 7000); return; } const state = this.controller.state; if (state.scannedRoot !== folder.path || !state.contentPlan.length) { const plan = createContentPlan(folder, state.request.structurePreset); await classifyContentPlan(this.app.vault, plan); this.controller.setDetectedPlan(folder.path, plan); } if (!this.controller.state.contentPlan.some((item) => item.kind === "note")) { new Notice("No Markdown notes were found in that folder.", 7000); this.render(); return; } this.enterStep("contents"); }
  private enterStep(step: CompileWorkspaceStep): void { this.controller.setStep(step); this.render(); if (step === "export") void this.prepare(); }
  private async prepare(force = false): Promise<void> { const promise = this.controller.prepare(force); this.render(); await promise; this.render(); }
  private async export(): Promise<void> { const promise = this.controller.export(); this.controller.detachExport(); const success = await promise; if (success) this.close(); else { this.render(); if (this.controller.state.error) new Notice(this.controller.state.error.message, 8000); } }
  private folder(): TFolder | null { const item = this.app.vault.getAbstractFileByPath(this.controller.state.request.manuscriptRoot); return item instanceof TFolder ? item : null; }
  private filename(value: string): string { return `${value.replace(/\.(?:docx|md)$/i, "") || "Manuscript"}.docx`; }
  private updateCreateButton(): void { const button = this.contentEl.querySelector<HTMLButtonElement>(".manuscript-create-button"); if (button) button.disabled = !this.controller.state.preparedSession; }
  private markPreviewInvalidated(): void { const card = this.contentEl.querySelector<HTMLElement>(".manuscript-ready-card"); if (card) { card.empty(); card.createEl("strong", { text: "Preview needs refresh" }); card.createEl("p", { text: "Preview inputs changed. Refresh the preview before creating the DOCX." }); card.createEl("button", { text: "Refresh Preview", cls: "mod-cta" }).addEventListener("click", () => { void this.prepare(true); }); } this.updateCreateButton(); }
}
