import { Setting, type TFolder } from "obsidian";
import { STRUCTURE_PRESET_NAMES } from "../simple-workflow";
import type { StructurePreset } from "../settings";
import type { CompileWorkspaceController } from "./compile-workspace-controller";

export interface ManuscriptStepActions { selectedFromFileExplorer?: boolean; chooseFolder(): void; useCurrentFolder(): void; changed(): void; }
export function renderManuscriptStep(container: HTMLElement, controller: CompileWorkspaceController, folder: TFolder | null, actions: ManuscriptStepActions): void {
  const state = controller.state;
  container.createEl("h2", { text: "Select your manuscript" });
  container.createEl("p", { text: "Choose the vault folder that contains the notes for this book." });
  if (actions.selectedFromFileExplorer) container.createEl("p", { cls: "manuscript-root-source", text: "Selected from the File Explorer. This folder is the book root." });
  const setting = new Setting(container).setName("Manuscript folder").setDesc("The plugin will scan this folder without changing your notes.");
  setting.addText((text) => { text.setPlaceholder("Books/My Novel").setValue(state.request.manuscriptRoot).onChange((value) => { controller.setRoot(value); actions.changed(); }); text.inputEl.setAttribute("aria-label", "Manuscript folder path"); });
  setting.addButton((button) => button.setButtonText(actions.selectedFromFileExplorer ? "Change folder" : "Choose").setCta().onClick(actions.chooseFolder));
  setting.addButton((button) => button.setButtonText("Use current folder").onClick(actions.useCurrentFolder));
  new Setting(container).setName("Book structure").setDesc("Choose the closest match. You can correct every item on the next step.").addDropdown((dropdown) => { Object.entries(STRUCTURE_PRESET_NAMES).forEach(([value, label]) => dropdown.addOption(value, label)); dropdown.setValue(state.request.structurePreset).onChange((value) => { controller.setPreset(value as StructurePreset); actions.changed(); }); });
  if (folder && state.scannedRoot === folder.path && state.contentPlan.length) { const notes = state.contentPlan.filter((item) => item.kind === "note").length; const folders = state.contentPlan.filter((item) => item.kind === "folder").length; const card = container.createDiv({ cls: "manuscript-found-card" }); card.createEl("h3", { text: "Manuscript found" }); card.createEl("strong", { text: folder.name }); card.createEl("p", { text: `${notes} Markdown note${notes === 1 ? "" : "s"} in ${folders} folder${folders === 1 ? "" : "s"}.` }); card.createEl("p", { text: "Next, check what each folder and note represents." }); }
}
