/**
 * Manuscript Compiler — three-stage workspace shell.
 *
 * Owns modal lifecycle, step composition, folder selection, and DOM event wiring.
 * CompileWorkspaceController owns state/operations; step modules own controls.
 * Parser, exporter, history, and download logic do not belong here.
 * main.ts creates one modal per workflow. Obsidian owns attachment/teardown;
 * registered events and controller cancellation are released on close. Rendering
 * errors must not create another compile path. DOM work uses documented APIs and
 * remains focus-visible, narrow-pane safe, and mobile-compatible.
 */
import { App, FuzzySuggestModal, Modal, normalizePath, Notice, TFile, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { classifyContentPlan, createContentPlan } from "./content-plan";
import { docxFormattingForPreset, type DocxFormatting, type SimpleCompileRequest } from "./simple-workflow";
import { CompileWorkspaceController } from "./workspace/compile-workspace-controller";
import { createCompileWorkspaceController } from "./workspace/compile-workspace-factory";
import { WORKSPACE_STEPS, type CompileWorkspaceStep } from "./workspace/workspace-types";
import { renderManuscriptStep } from "./workspace/manuscript-step";
import { renderContentsStep } from "./workspace/contents-step";
import { ContentsTreeViewState } from "./workspace/contents-tree-view-state";
import { renderCreateDocxStep } from "./workspace/create-docx-step";
import { resolveAuthor, resolveBookTitle } from "./workspace/workspace-view-model";
import { EXPORT_FORMAT_DETAILS } from "./export-types";
import { isUnknownRecord } from "./type-guards";
import { SavedCompilationChooserState, savedCompilationChoices, type SavedCompilationChoiceViewModel } from "./saved-compilation-chooser";
import { savedCompilationStatus } from "./saved-compilation-status";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly selected: (folder: TFolder) => void) { super(app); this.setPlaceholder("Choose a folder…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.selected(item); }
}

class SaveCompilationModal extends Modal {
  private input?: HTMLInputElement;
  private error?: HTMLElement;
  private saving = false;
  private saved = false;
  constructor(app: App, private readonly initialName: string, private readonly save: (name: string) => Promise<boolean>, private readonly afterSaved?: () => void, private readonly closed?: (saved: boolean) => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText("Save compilation");
    const field = this.contentEl.createDiv({ cls: "manuscript-save-compilation-field" }); field.createEl("label", { text: "Name", attr: { for: "manuscript-save-compilation-name" } });
    this.input = field.createEl("input", { type: "text", value: this.initialName, attr: { id: "manuscript-save-compilation-name", maxlength: "200" } }); this.input.focus();
    this.error = this.contentEl.createEl("p", { cls: "manuscript-save-compilation-error", attr: { role: "alert" } });
    const actions = this.contentEl.createDiv({ cls: "manuscript-save-compilation-actions" }); const cancel = actions.createEl("button", { text: "Cancel" }); const submit = actions.createEl("button", { text: "Save", cls: "mod-cta" });
    cancel.addEventListener("click", () => this.close()); submit.addEventListener("click", () => { void this.submit(submit, cancel); }); this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); void this.submit(submit, cancel); } });
  }
  private async submit(submit: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> {
    const name = this.input?.value.trim() ?? "";
    if (!name) { if (this.error) this.error.setText("Enter a compilation name."); return; }
    if (this.saving) return; this.saving = true; submit.disabled = true; cancel.disabled = true;
    if (await this.save(name)) { this.saved = true; this.close(); this.afterSaved?.(); } else { this.saving = false; submit.disabled = false; cancel.disabled = false; }
  }
  onClose(): void { this.closed?.(this.saved); this.contentEl.empty(); }
}

/** An explicit save decision keeps Create file from silently persisting author intent. */
class CreateFileSaveDecisionModal extends Modal {
  private busy = false;
  constructor(app: App, private readonly saved: boolean, private readonly createWithoutSaving: () => void, private readonly saveAndCreate: () => void, private readonly dismissed: () => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText(this.saved ? "Save changes?" : "Save compilation?");
    this.contentEl.createEl("p", { text: this.saved ? "This saved compilation has unsaved changes. Save them before creating the file?" : "Save this compilation setup so you can use it again later." });
    const actions = this.contentEl.createDiv({ cls: "manuscript-save-compilation-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" }); const without = actions.createEl("button", { text: "Create without saving" }); const save = actions.createEl("button", { text: this.saved ? "Save changes and create" : "Save and create", cls: "mod-cta" });
    cancel.addEventListener("click", () => this.close()); without.addEventListener("click", () => this.choose([cancel, without, save], this.createWithoutSaving)); save.addEventListener("click", () => this.choose([cancel, without, save], this.saveAndCreate));
  }
  onClose(): void { this.dismissed(); this.contentEl.empty(); }
  private choose(buttons: readonly HTMLButtonElement[], action: () => void): void { if (this.busy) return; this.busy = true; buttons.forEach((button) => { button.disabled = true; }); this.close(); action(); }
}

class RenameCompilationModal extends Modal {
  private input?: HTMLInputElement; private error?: HTMLElement; private busy = false;
  constructor(app: App, private readonly currentName: string, private readonly rename: (name: string) => Promise<boolean>) { super(app); }
  onOpen(): void { this.titleEl.setText("Rename compilation"); const field = this.contentEl.createDiv({ cls: "manuscript-save-compilation-field" }); field.createEl("label", { text: "Name", attr: { for: "manuscript-rename-compilation-name" } }); this.input = field.createEl("input", { type: "text", value: this.currentName, attr: { id: "manuscript-rename-compilation-name", maxlength: "200" } }); this.input.focus(); this.input.select(); this.error = this.contentEl.createEl("p", { cls: "manuscript-save-compilation-error", attr: { role: "alert" } }); const actions = this.contentEl.createDiv({ cls: "manuscript-save-compilation-actions" }); const cancel = actions.createEl("button", { text: "Cancel" }); const submit = actions.createEl("button", { text: "Rename", cls: "mod-cta" }); cancel.addEventListener("click", () => this.close()); submit.addEventListener("click", () => { void this.submit(submit, cancel); }); this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); void this.submit(submit, cancel); } }); }
  private async submit(submit: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> { const name = this.input?.value.trim() ?? ""; if (!name) { this.error?.setText("Enter a compilation name."); return; } if (this.busy) return; this.busy = true; submit.disabled = true; cancel.disabled = true; if (await this.rename(name)) this.close(); else { this.busy = false; submit.disabled = false; cancel.disabled = false; } }
}

class DuplicateCompilationModal extends Modal {
  private input?: HTMLInputElement; private error?: HTMLElement; private busy = false;
  constructor(app: App, private readonly currentName: string, private readonly duplicate: (name: string) => Promise<boolean>) { super(app); }
  onOpen(): void { this.titleEl.setText("Duplicate compilation"); this.contentEl.createEl("p", { text: "Creates a copy of the saved compilation without switching to it." }); const field = this.contentEl.createDiv({ cls: "manuscript-save-compilation-field" }); field.createEl("label", { text: "Name", attr: { for: "manuscript-duplicate-compilation-name" } }); this.input = field.createEl("input", { type: "text", value: this.currentName, attr: { id: "manuscript-duplicate-compilation-name", maxlength: "200" } }); this.input.focus(); this.input.select(); this.error = this.contentEl.createEl("p", { cls: "manuscript-save-compilation-error", attr: { role: "alert" } }); const actions = this.contentEl.createDiv({ cls: "manuscript-save-compilation-actions" }); const cancel = actions.createEl("button", { text: "Cancel" }); const submit = actions.createEl("button", { text: "Duplicate", cls: "mod-cta" }); cancel.addEventListener("click", () => this.close()); submit.addEventListener("click", () => { void this.submit(submit, cancel); }); this.input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); void this.submit(submit, cancel); } }); }
  private async submit(submit: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> { const name = this.input?.value.trim() ?? ""; if (!name) { this.error?.setText("Enter a compilation name."); return; } if (this.busy) return; this.busy = true; submit.disabled = true; cancel.disabled = true; if (await this.duplicate(name)) this.close(); else { this.busy = false; submit.disabled = false; cancel.disabled = false; } }
}

export class DeleteCompilationModal extends Modal {
  private busy = false;
  constructor(app: App, private readonly name: string, private readonly remove: () => Promise<boolean>) { super(app); }
  onOpen(): void { this.titleEl.setText("Delete saved compilation?"); this.contentEl.createEl("p", { text: `Delete “${this.name}”?` }); this.contentEl.createEl("p", { text: "This removes the saved compilation setup only. It does not delete manuscript files or exported files." }); const actions = this.contentEl.createDiv({ cls: "manuscript-save-compilation-actions" }); const cancel = actions.createEl("button", { text: "Cancel" }); const submit = actions.createEl("button", { text: "Delete", cls: "mod-warning" }); cancel.addEventListener("click", () => this.close()); submit.addEventListener("click", () => { void this.submit(submit, cancel); }); }
  private async submit(submit: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> { if (this.busy) return; this.busy = true; submit.disabled = true; cancel.disabled = true; if (await this.remove()) this.close(); else { this.busy = false; submit.disabled = false; cancel.disabled = false; } }
}

const steps: readonly CompileWorkspaceStep[] = WORKSPACE_STEPS;
const labels = ["Manuscript", "Contents", "Create file"];

/** Modal-scoped workspace view; closing delegates cancellation to its controller. */
export class SimpleCompileModal extends Modal {
  private controller: CompileWorkspaceController;
  private readonly contentsViewState = new ContentsTreeViewState();
  private readonly fileExplorerRoot?: TFolder;
  private readonly chooser = new SavedCompilationChooserState();
  private readonly managementActionTargets = new Map<string, HTMLButtonElement>();
  private createDecisionOpen = false;
  private createOperationPending = false;
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin, selectedFolder?: TFolder, private readonly openedController?: CompileWorkspaceController) {
    super(app);
    this.fileExplorerRoot = selectedFolder;
    if (openedController) { this.controller = openedController; return; }
    const settings = plugin.settings; const profile = plugin.getActiveProfile();
    const formatting: DocxFormatting = docxFormattingForPreset(settings.defaultDocxStyle, settings.includeTitlePageByDefault);
    formatting.pageSize = settings.defaultDocxPageSize;
    formatting.indentParagraphs = settings.defaultIndentParagraphs;
    formatting.firstLineIndentCm = settings.defaultDocxFirstLineIndentCm;
    const request: SimpleCompileRequest = { manuscriptRoot: selectedFolder?.path ?? (settings.defaultManuscriptFolder || profile.manuscriptRoot), structurePreset: settings.defaultStructurePreset, includeFrontMatter: true, includeBackMatter: true, exportFolder: "", outputFilename: this.filename(profile.outputFilename || "Manuscript.docx"), outputFormat: "docx", docxPreset: settings.defaultDocxStyle, downloadAfterExport: true, formatting, tableOfContents: settings.includeTableOfContentsByDefault, partDisplay: "word-title", chapterDisplay: "word-title", custom: { variables: { ...profile.variables }, sceneSeparator: profile.sceneSeparator, bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])] } };
    this.controller = createCompileWorkspaceController({ kind: "new", request, formatting }, { prepare: (next, plan, signal) => this.plugin.prepareCompileRequest(next, plan, signal), sessionIsCurrent: (session) => this.plugin.preparedSessionIsCurrent(session), export: (session, format, filename) => this.plugin.exportPreparedSession(session, format, filename) });
    this.controller.setExportFormat(settings.defaultDownloadFormat);
  }

  onOpen(): void {
    this.modalEl.addClass("manuscript-compile-workspace");
    this.contentsViewState.resetDetectedDisclosure();
    if (this.openedController) { this.render(); return; }
    if (this.fileExplorerRoot) {
      const choices = savedCompilationChoices(this.plugin.savedCompilations.listForRoot(this.fileExplorerRoot.path));
      if (choices.length) { this.renderChooser(choices); return; }
    }
    this.openNewWorkspace();
  }

  /** A chooser is skipped for first-time roots so the existing New workflow has no extra click. */
  private openNewWorkspace(): void {
    this.render();
    const initial = this.fileExplorerRoot ?? this.folder();
    if (initial) void this.selectFolder(initial).catch(() => new Notice("The selected folder could not be scanned.", 7000));
  }

  /** Delegates Saved opening to the production lifecycle owner; the UI never reconstructs Saved state. */
  private renderChooser(choices: readonly SavedCompilationChoiceViewModel[], message?: string): void {
    this.contentEl.empty(); this.titleEl.setText("Choose compilation");
    const body = this.contentEl.createDiv({ cls: "manuscript-compile-chooser" });
    body.createEl("h2", { text: "Choose compilation" });
    body.createEl("p", { text: "Start a new compilation or continue with a saved setup for this manuscript.", cls: "manuscript-compile-chooser-copy" });
    if (message) body.createEl("p", { text: message, cls: "manuscript-compile-chooser-message", attr: { role: "status" } });
    const newButton = body.createEl("button", { text: "New compilation", cls: "manuscript-compile-choice manuscript-compile-choice-new" });
    newButton.disabled = this.chooser.busy;
    newButton.addEventListener("click", () => this.openNewWorkspace());
    body.createEl("h3", { text: "Saved compilations" });
    const list = body.createDiv({ cls: "manuscript-compile-chooser-list", attr: { "aria-label": "Saved compilations" } });
    choices.forEach((choice) => {
      const button = list.createEl("button", { cls: "manuscript-compile-choice manuscript-compile-choice-saved", attr: { "aria-label": `Open ${choice.name}` } });
      button.disabled = this.chooser.busy;
      button.createEl("strong", { text: choice.name }); button.createSpan({ text: choice.format });
      button.addEventListener("click", () => { void this.openSavedChoice(choice, choices); });
    });
  }

  /** Guards repeated activation while a real Saved preparation is in flight. */
  private async openSavedChoice(choice: SavedCompilationChoiceViewModel, choices: readonly SavedCompilationChoiceViewModel[]): Promise<void> {
    if (!this.chooser.beginOpen()) return;
    this.renderChooser(choices, "Opening saved compilation…");
    try {
      const opened = await this.plugin.openSavedCompilation(choice.id);
      if (opened.status === "ready") { this.controller.close(); this.controller = opened.controller; this.render(); return; }
      if (opened.status === "root-unavailable") { this.controller.close(); this.controller = opened.controller; this.render(); new Notice("Manuscript folder unavailable.", 7000); return; }
      const message = opened.status === "not-found" ? "That saved compilation is no longer available." : opened.status === "unavailable" ? "Saved compilations are unavailable right now." : "The saved compilation could not be opened.";
      this.renderChooser(choices, message);
    } finally { this.chooser.finishOpen(); }
  }
  onClose(): void { this.controller.close(); this.contentEl.empty(); }

  private render(): void {
    const state = this.controller.state; const current = steps.indexOf(state.step); this.contentEl.empty(); this.titleEl.setText("Compile manuscript");
    this.renderSavedIdentity();
    const nav = this.contentEl.createDiv({ cls: "manuscript-compile-steps", attr: { role: "tablist", "aria-label": "Compile steps" } });
    labels.forEach((label, index) => { const button = nav.createEl("button", { text: `${index + 1}  ${label}`, cls: index === current ? "is-active" : index < current ? "is-complete" : "" }); button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(index === current)); button.disabled = index > current + 1 || index > 0 && !state.contentPlan.length; button.addEventListener("click", () => this.enterStep(steps[index])); });
    const body = this.contentEl.createDiv({ cls: "manuscript-compile-body" });
    if (state.step === "manuscript" && state.origin.kind === "saved" && this.controller.workspaceSession()?.reconciliationReadiness === "blocked") this.renderRootRecovery(body);
    else if (state.step === "manuscript") renderManuscriptStep(body, this.controller, this.folder(), { selectedFromFileExplorer: this.fileExplorerRoot?.path === state.request.manuscriptRoot, chooseFolder: () => new FolderPicker(this.app, (folder) => { void this.selectFolder(folder); }).open(), useCurrentFolder: () => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.selectFolder(folder); else new Notice("Open a note inside the manuscript folder first."); }, changed: () => this.contentEl.querySelector(".manuscript-scan-summary")?.remove() });
    else if (state.step === "contents") {
      if (state.origin.kind === "saved") renderContentsStep(body, this.controller, this.contentsViewState, { acknowledge: () => this.plugin.acknowledgeActiveSavedReview(), addDetected: (reference) => this.controller.includeSavedDetectedContent(reference) }, () => this.render());
      else renderContentsStep(body, this.controller, this.contentsViewState);
    }
    else renderCreateDocxStep(body, this.controller, { refresh: () => { void this.prepare(true); }, changed: () => this.markPreviewInvalidated(), rerender: () => this.render() });
    this.renderFooter();
  }

  /** Shows Saved identity and derived session dirtiness without duplicating state in the view. */
  private renderSavedIdentity(): void {
    const origin = this.controller.state.origin;
    const identity = this.contentEl.createDiv({ cls: "manuscript-saved-identity" });
    if (origin.kind === "new") { identity.createSpan({ text: "New compilation", cls: "manuscript-saved-identity-kind" }); const saveAs = identity.createEl("button", { text: "Save as…" }); saveAs.addEventListener("click", () => this.openSaveAs()); const switcher = identity.createEl("button", { text: "Switch…" }); switcher.addEventListener("click", () => this.renderSwitchChooser()); const manage = identity.createEl("button", { text: "Manage…" }); manage.addEventListener("click", () => this.renderManagement()); return; }
    const text = identity.createDiv(); text.createEl("strong", { text: origin.name }); text.createSpan({ text: "Saved compilation", cls: "manuscript-saved-identity-kind" });
    if (this.controller.state.recipeDirty) identity.createSpan({ text: "Unsaved changes", cls: "manuscript-saved-dirty", attr: { role: "status" } });
    const status = savedCompilationStatus({ saved: true, dirty: this.controller.state.recipeDirty, potentiallyStale: this.controller.isPotentiallyStale(), freshness: this.plugin.savedCompilationExportFreshness(this.controller) });
    if (status.text) identity.createSpan({ text: status.text, cls: `manuscript-saved-status is-${status.tone}`, attr: { role: "status" } });
    const actions = identity.createDiv({ cls: "manuscript-saved-actions" }); const save = actions.createEl("button", { text: "Save changes" }); save.disabled = !this.controller.state.recipeDirty; save.addEventListener("click", () => { void this.saveChanges(); }); const saveAs = actions.createEl("button", { text: "Save as…" }); saveAs.addEventListener("click", () => this.openSaveAs()); const switcher = actions.createEl("button", { text: "Switch…" }); switcher.addEventListener("click", () => this.renderSwitchChooser()); const manage = actions.createEl("button", { text: "Manage…" }); manage.addEventListener("click", () => this.renderManagement());
  }

  /** Root-scoped browsing is read-only; switching remains the existing Part 7D transaction. */
  private renderManagement(message?: string, focus?: { id?: string; action?: "rename" | "duplicate" | "delete" | "list" }): void {
    const root = this.controller.state.request.manuscriptRoot; const choices = savedCompilationChoices(this.plugin.savedCompilations.listForRoot(root)); const activeId = this.controller.state.origin.kind === "saved" ? this.controller.state.origin.compilationId : undefined;
    this.managementActionTargets.clear();
    this.contentEl.empty(); this.titleEl.setText("Saved compilations"); const body = this.contentEl.createDiv({ cls: "manuscript-compilation-management" }); body.createEl("h2", { text: "Saved compilations", attr: { "data-management-focus": "list", tabindex: "-1" } }); body.createEl("p", { text: "Manage saved compilation setups for this manuscript." }); if (message) body.createEl("p", { text: message, cls: "manuscript-compile-chooser-message", attr: { role: "status" } });
    const newer = body.createEl("button", { text: "New compilation", cls: "manuscript-compile-choice manuscript-compile-choice-new" }); newer.addEventListener("click", () => { void this.switchToNew(false); });
    if (!choices.length) { body.createEl("p", { text: "No saved compilations yet.", cls: "manuscript-empty-state" }); const close = body.createEl("button", { text: "Close" }); close.addEventListener("click", () => this.render()); this.focusManagement(body, newer, focus); return; }
    const list = body.createDiv({ cls: "manuscript-compilation-management-list", attr: { "aria-label": "Saved compilations" } }); choices.forEach((choice) => { const row = list.createDiv({ cls: "manuscript-compilation-management-row" }); const open = row.createEl("button", { cls: "manuscript-compile-choice", attr: { "aria-label": activeId === choice.id ? `${choice.name}, ${choice.format}, Current` : `Open ${choice.name}, ${choice.format}` } }); open.createEl("strong", { text: choice.name }); open.createSpan({ text: choice.format }); if (activeId === choice.id) open.createSpan({ text: "Current", cls: "manuscript-compilation-current" }); open.addEventListener("click", () => { if (activeId === choice.id) this.render(); else void this.switchToSaved(choice.id, false); }); const rename = row.createEl("button", { text: "Rename", attr: { "aria-label": `Rename ${choice.name}` } }); this.managementActionTargets.set(this.managementActionKey(choice.id, "rename"), rename); rename.addEventListener("click", () => this.openRename(choice.id, choice.name)); const duplicate = row.createEl("button", { text: "Duplicate", attr: { "aria-label": `Duplicate ${choice.name}` } }); this.managementActionTargets.set(this.managementActionKey(choice.id, "duplicate"), duplicate); duplicate.addEventListener("click", () => this.openDuplicate(choice.id, choice.name)); const remove = row.createEl("button", { text: "Delete", cls: "mod-warning", attr: { "aria-label": `Delete ${choice.name}` } }); this.managementActionTargets.set(this.managementActionKey(choice.id, "delete"), remove); remove.addEventListener("click", () => this.openDelete(choice.id, choice.name)); });
    const close = body.createEl("button", { text: "Close" }); close.addEventListener("click", () => this.render()); this.focusManagement(body, newer, focus);
  }
  /** Keeps post-mutation keyboard focus in management without inferring row identity from a display name. */
  private focusManagement(body: HTMLElement, fallback: HTMLButtonElement, focus?: { id?: string; action?: "rename" | "duplicate" | "delete" | "list" }): void {
    const target = focus?.action === "list" ? body.querySelector<HTMLElement>("[data-management-focus='list']") : focus?.id && focus.action ? this.managementActionTargets.get(this.managementActionKey(focus.id, focus.action)) ?? fallback : fallback;
    target?.focus({ preventScroll: true });
  }
  private managementActionKey(id: string, action: "rename" | "duplicate" | "delete"): string { return `${id}\u0000${action}`; }
  /** Rename changes only display metadata and refreshes the service-ordered management list. */
  private openRename(id: string, name: string): void { new RenameCompilationModal(this.app, name, async (next) => { const result = await this.plugin.renameSavedCompilation(this.controller, id, next); if (result === "unchanged" || result.status === "ok") { this.renderManagement(undefined, { id, action: "rename" }); return true; } new Notice(result.status === "invalid" ? "Enter a valid compilation name." : "Couldn’t rename the saved compilation. Try again.", 7000); return false; }).open(); }
  /** Duplicate copies persisted state, unlike Save as, and never activates the new identity. */
  private openDuplicate(id: string, name: string): void { new DuplicateCompilationModal(this.app, name, async (next) => { const result = await this.plugin.duplicateSavedCompilation(id, next); if (result.status === "ok") { this.renderManagement(undefined, { id, action: "duplicate" }); return true; } const message = result.status === "capacity" ? "Too many saved compilations. Remove one before creating another." : result.status === "invalid" ? "Enter a valid compilation name." : "Couldn’t duplicate the saved compilation. Try again."; new Notice(message, 7000); return false; }).open(); }
  /** Delete targets immutable Saved state only; deleting Current preserves its usable in-memory workspace as New. */
  private openDelete(id: string, name: string): void { const deletingCurrent = this.controller.state.origin.kind === "saved" && this.controller.state.origin.compilationId === id; new DeleteCompilationModal(this.app, name, async () => { const result = await this.plugin.deleteSavedCompilation(this.controller, id); if (result.status === "ok") { if (deletingCurrent) this.render(); else this.renderManagement(undefined, { action: "list" }); return true; } new Notice("Couldn’t delete the saved compilation. Try again.", 7000); return false; }).open(); }

  /** Folder choice is explicit; preparation and root commit remain backend-owned. */
  private renderRootRecovery(body: HTMLElement): void {
    const card = body.createDiv({ cls: "manuscript-root-recovery" }); card.createEl("h2", { text: "Manuscript folder unavailable" }); card.createEl("p", { text: "This saved compilation is still available, but its manuscript folder could not be found." }); const locate = card.createEl("button", { text: "Locate manuscript…", cls: "mod-cta" }); locate.addEventListener("click", () => new FolderPicker(this.app, (folder) => { void this.reassociateRoot(folder); }).open());
  }
  private async reassociateRoot(folder: TFolder): Promise<void> {
    const result = await this.plugin.reassociateActiveSavedCompilation(folder);
    if (result.status === "ready") { this.controller.close(); this.controller = result.controller; this.render(); new Notice("Manuscript folder updated. Save changes to keep this association."); return; }
    new Notice("This folder couldn’t be used with the saved compilation.", 7000);
  }
  private renderSwitchChooser(message?: string, pending?: { id?: string; newWorkspace?: boolean }): void {
    const root = this.controller.state.request.manuscriptRoot; const choices = savedCompilationChoices(this.plugin.savedCompilations.listForRoot(root)); this.contentEl.empty(); this.titleEl.setText("Switch compilation"); const body = this.contentEl.createDiv({ cls: "manuscript-compile-chooser" }); body.createEl("h2", { text: pending ? "Discard unsaved changes?" : "Switch compilation" });
    if (pending) { body.createEl("p", { text: "You have unsaved changes to this compilation. Switching will discard those changes." }); const cancel = body.createEl("button", { text: "Cancel" }); cancel.addEventListener("click", () => this.render()); const discard = body.createEl("button", { text: "Discard and switch", cls: "mod-warning" }); discard.addEventListener("click", () => { if (pending.newWorkspace) void this.switchToNew(true); else if (pending.id) void this.switchToSaved(pending.id, true); }); return; }
    if (message) body.createEl("p", { text: message, cls: "manuscript-compile-chooser-message", attr: { role: "status" } }); const newer = body.createEl("button", { text: "New compilation", cls: "manuscript-compile-choice" }); newer.addEventListener("click", () => { void this.switchToNew(false); }); body.createEl("h3", { text: "Saved compilations" }); choices.forEach((choice) => { const button = body.createEl("button", { text: choice.name, cls: "manuscript-compile-choice", attr: { "aria-label": `Switch to ${choice.name}` } }); button.addEventListener("click", () => { void this.switchToSaved(choice.id, false); }); });
  }
  private async switchToSaved(id: string, discard: boolean): Promise<void> { const result = await this.plugin.switchActiveToSavedCompilation(id, discard); if (result.status === "unsaved-changes") { this.renderSwitchChooser(undefined, { id }); return; } if (result.status === "ready" || result.status === "root-unavailable") { this.controller.close(); this.controller = result.controller; this.render(); return; } this.renderSwitchChooser("Couldn’t open that compilation. Your current workspace is unchanged."); }
  private async switchToNew(discard: boolean): Promise<void> { const result = await this.plugin.switchActiveToNewCompilation(this.controller, discard); if (result.status === "unsaved-changes") { this.renderSwitchChooser(undefined, { newWorkspace: true }); return; } if (result.status === "ready") { this.controller.close(); this.controller = result.controller; this.render(); return; } this.renderSwitchChooser("Couldn’t start a new compilation. Your current workspace is unchanged."); }

  /** Save Changes updates this identity; Save As preserves the same controller and current stage. */
  private async saveChanges(): Promise<boolean> {
    const result = await this.plugin.saveActiveSavedCompilation(this.controller);
    if (result.status === "ok") { this.controller.markSavedRecipePersisted(); this.render(); return true; }
    new Notice("Couldn’t save compilation changes. Your current changes are still available.", 7000); this.render();
    return false;
  }
  private openSaveAs(afterSaved?: () => void, closed?: (saved: boolean) => void): void {
    const initialName = this.controller.state.origin.kind === "saved" ? this.controller.state.origin.name : this.controller.state.request.custom?.variables?.BookTitle ?? "";
    new SaveCompilationModal(this.app, initialName, async (name) => {
      const result = await this.plugin.saveActiveCompilationAs(this.controller, name);
      if (result.status === "ok") { this.render(); return true; }
      new Notice(result.status === "invalid" ? "Enter a valid compilation name." : "Couldn’t save this compilation. Your current changes are still available.", 7000); return false;
    }, afterSaved, closed).open();
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
  /** Export is an in-workspace operation: successful delivery leaves Create file available for the next author action. */
  private async export(): Promise<void> {
    const success = await this.controller.export();
    if (!this.contentEl.isConnected) return;
    this.render();
    if (!success && this.controller.state.error) new Notice(this.controller.state.error.message, 8000);
  }
  private async createFinalDocument(): Promise<void> {
    if (this.createDecisionOpen || this.createOperationPending) return;
    const state = this.controller.state;
    if (state.origin.kind === "new" || state.recipeDirty) { this.openCreateSaveDecision(state.origin.kind === "saved"); return; }
    this.continueCreateAfterDecision();
  }
  /** Uses the already-current workspace after an explicit save decision; no second preparation route exists. */
  private async createAfterSaveDecision(): Promise<void> { if (!this.controller.state.preparedSession) { const session = await this.controller.prepare(); this.render(); if (!session) { if (this.controller.state.error) new Notice(this.controller.state.error.message, 8000); return; } } await this.export(); }
  private continueCreateAfterDecision(): void { if (this.createOperationPending) return; this.createOperationPending = true; void this.createAfterSaveDecision().finally(() => { this.createOperationPending = false; }); }
  private openCreateSaveDecision(saved: boolean): void {
    if (this.createDecisionOpen) return;
    this.createDecisionOpen = true;
    new CreateFileSaveDecisionModal(this.app, saved, () => { this.continueCreateAfterDecision(); }, () => {
      if (!saved) { this.createOperationPending = true; this.openSaveAs(() => { void this.createAfterSaveDecision().finally(() => { this.createOperationPending = false; }); }, (wasSaved) => { if (!wasSaved) this.createOperationPending = false; }); return; }
      void this.saveChangesAndCreate();
    }, () => { this.createDecisionOpen = false; }).open();
  }
  private async saveChangesAndCreate(): Promise<void> { if (this.createOperationPending) return; this.createOperationPending = true; try { if (await this.saveChanges()) await this.createAfterSaveDecision(); } finally { this.createOperationPending = false; } }
  private folder(): TFolder | null { const path = this.controller.state.request.manuscriptRoot; if (!path.trim()) return null; const item = this.app.vault.getAbstractFileByPath(normalizePath(path)); return item instanceof TFolder ? item : null; }
  private filename(value: string): string { return `${value.replace(/\.(?:docx|odt|epub|html?|markdown|xml|md)$/i, "") || "Manuscript"}.docx`; }
  private updateCreateButton(): void { const button = this.contentEl.querySelector<HTMLButtonElement>(".manuscript-create-button"); if (button) button.disabled = this.controller.state.preparationStatus === "preparing" || this.controller.state.exportStatus === "exporting"; }
  private markPreviewInvalidated(): void {
    const card = this.contentEl.querySelector<HTMLElement>(".manuscript-ready-card"); if (card) { card.empty(); card.createEl("strong", { text: "Preview needs refresh" }); card.createEl("p", { text: "Preview inputs changed. Refresh the preview before creating the file." }); card.createEl("button", { text: "Refresh preview", cls: "mod-cta" }).addEventListener("click", () => { void this.prepare(true); }); } this.updateCreateButton();
  }
  private applyDocumentIdentity(folder: TFolder): void {
    const notes = folder.children.filter((item): item is TFile => item instanceof TFile && item.extension.toLowerCase() === "md");
    const records = notes.map((file) => ({ file, frontmatter: recordValue(this.app.metadataCache.getFileCache(file)?.frontmatter) }));
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
function metadataValue(record: Record<string, unknown> | undefined, keys: string[]): unknown {
  if (!record) return;
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) normalized.set(key.toLowerCase().replace(/[_-]+/g, " "), value);
  for (const key of keys) { const value = normalized.get(key); if (typeof value === "string" && value.trim()) return value; }
  return;
}
function isBookMetadata(record: Record<string, unknown> | undefined): boolean { if (!record) return false; const type = metadataValue(record, ["type", "note type", "category"]); return typeof type === "string" && /^(?:book|project|manuscript)$/i.test(type.trim()) || metadataValue(record, ["booktitle", "book title", "project title"]) !== undefined; }
function recordValue(value: unknown): Record<string, unknown> | undefined {
  if (!isUnknownRecord(value)) return;
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) record[key] = item;
  return record;
}
