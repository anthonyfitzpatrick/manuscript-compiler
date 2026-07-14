/**
 * Manuscript Compiler — three-stage workspace shell.
 *
 * Owns modal lifecycle, step composition, folder selection, and DOM event wiring.
 * CompileWorkspaceController owns state/operations; step modules own controls.
 * Parser, exporter, history, and download logic do not belong here.
 */
import { App, FuzzySuggestModal, Modal, Notice, TFile, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { classifyContentPlan, createContentPlan } from "./content-plan";
import { docxFormattingForPreset, type DocxFormatting, type SimpleCompileRequest } from "./simple-workflow";
import { CompileWorkspaceController } from "./workspace/compile-workspace-controller";
import { WORKSPACE_STEPS, type CompileWorkspaceStep } from "./workspace/workspace-types";
import { renderManuscriptStep } from "./workspace/manuscript-step";
import { renderContentsStep } from "./workspace/contents-step";
import { ContentsTreeViewState } from "./workspace/contents-tree-view-state";
import { renderCreateDocxStep } from "./workspace/create-docx-step";
import { resolveAuthor, resolveBookTitle } from "./workspace/workspace-view-model";
import { EXPORT_FORMAT_DETAILS } from "./export-types";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly selected: (folder: TFolder) => void) { super(app); this.setPlaceholder("Choose a folder…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.selected(item); }
}

const steps: readonly CompileWorkspaceStep[] = WORKSPACE_STEPS;
const labels = ["Manuscript", "Contents", "Create file"];

/** Modal-scoped workspace view; closing delegates cancellation to its controller. */
export class SimpleCompileModal extends Modal {
  private readonly controller: CompileWorkspaceController;
  private readonly contentsViewState = new ContentsTreeViewState();
  private readonly fileExplorerRoot?: TFolder;
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin, selectedFolder?: TFolder) {
    super(app);
    this.fileExplorerRoot = selectedFolder;
    const settings = plugin.settings; const profile = plugin.getActiveProfile();
    const formatting: DocxFormatting = docxFormattingForPreset(settings.defaultDocxStyle, settings.includeTitlePageByDefault);
    formatting.pageSize = settings.defaultDocxPageSize;
    formatting.firstLineIndentCm = settings.defaultDocxFirstLineIndentCm;
    const request: SimpleCompileRequest = { manuscriptRoot: selectedFolder?.path ?? (settings.defaultManuscriptFolder || profile.manuscriptRoot), structurePreset: settings.defaultStructurePreset, includeFrontMatter: true, includeBackMatter: true, exportFolder: "", outputFilename: this.filename(profile.outputFilename || "Manuscript.docx"), outputFormat: "docx", docxPreset: settings.defaultDocxStyle, downloadAfterExport: true, formatting, tableOfContents: settings.includeTableOfContentsByDefault, partDisplay: "word-title", chapterDisplay: "word-title", custom: { variables: { ...profile.variables }, sceneSeparator: profile.sceneSeparator, bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])] } };
    this.controller = new CompileWorkspaceController(request, formatting, { prepare: (next, plan, signal) => this.plugin.prepareCompileRequest(next, plan, signal), sessionIsCurrent: (session) => this.plugin.preparedSessionIsCurrent(session), export: (session, format, filename) => this.plugin.exportPreparedSession(session, format, filename) });
    this.controller.setExportFormat(settings.defaultDownloadFormat);
  }

  onOpen(): void {
    this.modalEl.addClass("manuscript-compile-workspace");
    this.render();
    const initial = this.fileExplorerRoot ?? this.folder();
    if (initial) void this.selectFolder(initial).catch(() => new Notice("The selected folder could not be scanned.", 7000));
  }
  onClose(): void { this.controller.close(); this.contentEl.empty(); }

  private render(): void {
    const state = this.controller.state; const current = steps.indexOf(state.step); this.contentEl.empty(); this.titleEl.setText("Compile Manuscript");
    const nav = this.contentEl.createDiv({ cls: "manuscript-compile-steps", attr: { role: "tablist", "aria-label": "Compile steps" } });
    labels.forEach((label, index) => { const button = nav.createEl("button", { text: `${index + 1}  ${label}`, cls: index === current ? "is-active" : index < current ? "is-complete" : "" }); button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(index === current)); button.disabled = index > current + 1 || index > 0 && !state.contentPlan.length; button.addEventListener("click", () => this.enterStep(steps[index])); });
    const body = this.contentEl.createDiv({ cls: "manuscript-compile-body" });
    if (state.step === "manuscript") renderManuscriptStep(body, this.controller, this.folder(), { selectedFromFileExplorer: this.fileExplorerRoot?.path === state.request.manuscriptRoot, chooseFolder: () => new FolderPicker(this.app, (folder) => { void this.selectFolder(folder); }).open(), useCurrentFolder: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.selectFolder(folder); else new Notice("Open a note inside the manuscript folder first."); }, changed: () => this.contentEl.querySelector(".manuscript-scan-summary")?.remove() });
    else if (state.step === "contents") renderContentsStep(body, this.controller, this.contentsViewState);
    else renderCreateDocxStep(body, this.controller, { refresh: () => { void this.prepare(true); }, changed: () => this.markPreviewInvalidated(), rerender: () => this.render() });
    this.renderFooter();
  }

  private renderFooter(): void {
    const state = this.controller.state; const current = steps.indexOf(state.step); const footer = this.contentEl.createDiv({ cls: "manuscript-compile-footer" }); footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const forward = footer.createDiv({ cls: "manuscript-footer-forward" }); if (current > 0) forward.createEl("button", { text: "Back" }).addEventListener("click", () => this.enterStep(steps[current - 1]));
    const label = EXPORT_FORMAT_DETAILS[state.exportFormat].label; const primary = forward.createEl("button", { text: state.step === "create" && state.preparationStatus === "preparing" ? "Preparing…" : state.step === "create" ? `Create and download ${label}` : state.step === "manuscript" ? "Review Structure" : "Continue", cls: `mod-cta${state.step === "create" ? " manuscript-create-button" : ""}` }); primary.disabled = state.step === "create" && (state.preparationStatus === "preparing" || state.exportStatus === "exporting");
    primary.addEventListener("click", () => { if (state.step === "manuscript") void this.scanAndContinue(); else if (state.step === "create") void this.createFinalDocument(); else { const errors = this.controller.canAdvance(); if (errors.length) new Notice(errors.join(" ")); else this.enterStep(steps[current + 1]); } });
  }

  private async selectFolder(folder: TFolder): Promise<void> {
    if (this.controller.state.scannedRoot === folder.path && this.controller.state.contentPlan.length) return;
    const plan = createContentPlan(folder, this.controller.state.request.structurePreset); this.controller.setDetectedPlan(folder.path, plan); this.applyDocumentIdentity(folder); this.render(); await classifyContentPlan(this.app.vault, plan); if (this.controller.state.scannedRoot === folder.path) this.render();
  }
  private async scanAndContinue(): Promise<void> { const folder = this.folder(); if (!folder) { new Notice("Choose a manuscript folder that exists in this vault.", 7000); return; } const state = this.controller.state; if (state.scannedRoot !== folder.path || !state.contentPlan.length) { const plan = createContentPlan(folder, state.request.structurePreset); await classifyContentPlan(this.app.vault, plan); this.controller.setDetectedPlan(folder.path, plan); } if (!this.controller.state.contentPlan.some((item) => item.kind === "note")) { new Notice("No Markdown notes were found in that folder.", 7000); this.render(); return; } this.enterStep("contents"); }
  private enterStep(step: CompileWorkspaceStep): void { this.controller.setStep(step); this.render(); if (step === "create") void this.prepare(); }
  private async prepare(force = false): Promise<void> { const promise = this.controller.prepare(force); this.render(); await promise; this.render(); }
  private async export(): Promise<void> { const promise = this.controller.export(); this.controller.detachExport(); const success = await promise; if (success) this.close(); else { this.render(); if (this.controller.state.error) new Notice(this.controller.state.error.message, 8000); } }
  private async createFinalDocument(): Promise<void> { if (!this.controller.state.preparedSession) { const session = await this.controller.prepare(); this.render(); if (!session) { if (this.controller.state.error) new Notice(this.controller.state.error.message, 8000); return; } } await this.export(); }
  private folder(): TFolder | null { const item = this.app.vault.getAbstractFileByPath(this.controller.state.request.manuscriptRoot); return item instanceof TFolder ? item : null; }
  private filename(value: string): string { return `${value.replace(/\.(?:docx|odt|pdf|epub|html?|xml|md)$/i, "") || "Manuscript"}.docx`; }
  private updateCreateButton(): void { const button = this.contentEl.querySelector<HTMLButtonElement>(".manuscript-create-button"); if (button) button.disabled = this.controller.state.preparationStatus === "preparing" || this.controller.state.exportStatus === "exporting"; }
  private markPreviewInvalidated(): void {
    const card = this.contentEl.querySelector<HTMLElement>(".manuscript-ready-card"); if (card) { card.empty(); card.createEl("strong", { text: "Preview needs refresh" }); card.createEl("p", { text: "Preview inputs changed. Refresh the preview before creating the file." }); card.createEl("button", { text: "Refresh Preview", cls: "mod-cta" }).addEventListener("click", () => { void this.prepare(true); }); } this.updateCreateButton();
  }
  private applyDocumentIdentity(folder: TFolder): void {
    const notes = folder.children.filter((item): item is TFile => item instanceof TFile && item.extension.toLowerCase() === "md");
    const records = notes.map((file) => ({ file, frontmatter: this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined }));
    const rootRecord = records.find(({ file }) => cleanIdentity(file.basename) === cleanIdentity(folder.name));
    const projectRecord = records.find(({ frontmatter }) => isBookMetadata(frontmatter));
    const title = resolveBookTitle(metadataValue(projectRecord?.frontmatter, ["booktitle", "book title", "project title"]), metadataValue(rootRecord?.frontmatter, ["title", "booktitle", "book title"]), folder.name);
    const currentTitle = this.controller.state.request.custom?.variables?.BookTitle ?? "";
    if (!currentTitle.trim()) this.controller.setVariable("BookTitle", title);
    const author = resolveAuthor(metadataValue(projectRecord?.frontmatter, ["author", "book author"]), metadataValue(rootRecord?.frontmatter, ["author", "book author"]), this.controller.state.request.custom?.variables?.Author);
    if (author && !(this.controller.state.request.custom?.variables?.Author ?? "").trim()) this.controller.setVariable("Author", author);
  }
}

function cleanIdentity(value: string): string { return value.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase(); }
function metadataValue(record: Record<string, unknown> | undefined, keys: string[]): unknown { if (!record) return; const normalized = new Map(Object.entries(record).map(([key, value]) => [key.toLowerCase().replace(/[_-]+/g, " "), value])); for (const key of keys) { const value = normalized.get(key); if (typeof value === "string" && value.trim()) return value; } return; }
function isBookMetadata(record: Record<string, unknown> | undefined): boolean { if (!record) return false; const type = metadataValue(record, ["type", "note type", "category"]); return typeof type === "string" && /^(?:book|project|manuscript)$/i.test(type.trim()) || metadataValue(record, ["booktitle", "book title", "project title"]) !== undefined; }
