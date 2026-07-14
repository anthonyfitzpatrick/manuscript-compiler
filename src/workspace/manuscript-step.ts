/**
 * Manuscript Compiler — Manuscript root step renderer.
 *
 * Shows the exact root, structure preset, and scan summary. It emits choices to
 * the modal/controller and performs no inference or scanning itself.
 */
import { Setting, type TFolder } from "obsidian";
import { STRUCTURE_PRESET_NAMES } from "../simple-workflow";
import type { StructurePreset } from "../settings";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { folderIdentity, manuscriptPlanSummary, showUseCurrentFolder } from "./workspace-view-model";

export interface ManuscriptStepActions { selectedFromFileExplorer?: boolean; chooseFolder(): void; useCurrentFolder(): void; changed(): void; }
export function renderManuscriptStep(container: HTMLElement, controller: CompileWorkspaceController, folder: TFolder | null, actions: ManuscriptStepActions): void {
  const state = controller.state;
  if (!folder) container.createEl("p", { cls: "manuscript-empty-state", text: "Choose the folder containing this book." });
  else {
    const identity = folderIdentity(folder.path); const title = state.request.custom?.variables?.BookTitle?.trim() || identity.name;
    const book = container.createDiv({ cls: "manuscript-book-identity" }); book.createEl("small", { text: "Book" }); book.createEl("h2", { text: title });
    book.createEl("small", { text: "Folder" }); book.createEl("strong", { text: identity.name });
    if (identity.parentPath) book.createEl("p", { cls: "manuscript-folder-parent", text: identity.parentPath });
    if (actions.selectedFromFileExplorer) book.createEl("p", { cls: "manuscript-selection-source", text: "Selected from File Explorer" });
  }
  const setting = new Setting(container).setName("Folder").setDesc(folder ? "Change the selected manuscript folder." : "No manuscript folder selected");
  setting.addButton((button) => button.setButtonText(folder ? "Change Folder" : "Choose Folder").setCta().onClick(actions.chooseFolder));
  if (showUseCurrentFolder(folder !== null, actions.selectedFromFileExplorer === true)) setting.addButton((button) => button.setButtonText("Use current folder").onClick(actions.useCurrentFolder));
  new Setting(container).setName("Detected structure").addDropdown((dropdown) => { Object.entries(STRUCTURE_PRESET_NAMES).forEach(([value, label]) => dropdown.addOption(value, label)); dropdown.setValue(state.request.structurePreset).onChange((value) => { controller.setPreset(value as StructurePreset); actions.changed(); }); });
  if (folder && state.scannedRoot === folder.path && state.contentPlan.length) {
    const summary = manuscriptPlanSummary(state.contentPlan, folder.path); const compact = container.createDiv({ cls: "manuscript-scan-summary", attr: { "aria-label": "Manuscript scan summary" } });
    compact.createEl("p", { text: `${summary.totalNotes} note${summary.totalNotes === 1 ? "" : "s"}` });
    compact.createEl("p", { text: `${summary.includedNotes} manuscript note${summary.includedNotes === 1 ? "" : "s"}` });
    compact.createEl("p", { text: `${summary.ignoredNotes} project note${summary.ignoredNotes === 1 ? "" : "s"} ignored` });
    container.createEl("p", { cls: "setting-item-description", text: "You can review or correct the structure on the next page." });
  }
}
