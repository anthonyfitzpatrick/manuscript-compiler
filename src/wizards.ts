/**
 * Manuscript Compiler — retained onboarding and profile setup UI.
 *
 * Creates compatible saved defaults and profiles for first-run/advanced users.
 * It does not provide an alternative compile path; compilation still flows
 * through CompileCommandService and CompilePreparationService.
 * Obsidian owns modal lifecycle; wizard instances own transient form state and
 * persist only repaired settings through injected callbacks. They perform no note
 * reads, export, or cancellation-sensitive work. Keep controls documented,
 * focus-visible, sentence-case, and usable on narrow/mobile panes.
 */
import { App, FuzzySuggestModal, Modal, Notice, Setting, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { createDefaultProfiles, profileId } from "./profiles";
import type { ChapterSource, CompileProfile } from "./settings";
import type { StructurePreset } from "./settings";
import { STRUCTURE_PRESET_NAMES } from "./simple-workflow";

class WizardFolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly choose: (folder: TFolder) => void) { super(app); this.setPlaceholder("Search vault folders…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.choose(item); }
}

interface WizardChoices { name: string; manuscriptRoot: string; exportFolder: string; chapterSource: ChapterSource; useParts: boolean; sceneSeparators: boolean; includeFrontMatter: boolean; includeBackMatter: boolean; referenceDocx: string; vellum: boolean; structurePreset?: StructurePreset; }
const initialChoices = (): WizardChoices => ({ name: "My Book", manuscriptRoot: "", exportFolder: "", chapterSource: "folders", useParts: true, sceneSeparators: true, includeFrontMatter: true, includeBackMatter: true, referenceDocx: "", vellum: true, structurePreset: "novel-parts" });

/**
 * Converts validated wizard choices into a fresh compatible profile.
 * @returns A new profile with a unique ID and cloned defaults.
 * @remarks Pure apart from ID generation; does not persist or compile the profile.
 */
export function profileFromWizard(choices: WizardChoices): CompileProfile {
  const base = createDefaultProfiles()[choices.vellum ? 1 : 0];
  return { ...base, id: profileId(), name: choices.name.trim() || (choices.vellum ? "Vellum" : "Standard"), manuscriptRoot: choices.manuscriptRoot, exportFolder: choices.exportFolder, chapterSource: choices.chapterSource, useParts: choices.useParts, sceneSeparator: choices.sceneSeparators ? "#" : "", includeFrontMatter: choices.includeFrontMatter, includeBackMatter: choices.includeBackMatter, referenceDocx: choices.referenceDocx, exportTarget: choices.referenceDocx ? "markdown-docx" : base.exportTarget };
}

/** Advanced profile creator; its result is persisted but never compiled directly. */
export class ProfileWizardModal extends Modal {
  protected choices = initialChoices();
  constructor(app: App, protected readonly plugin: ManuscriptCompilerPlugin, private readonly finished?: (profile: CompileProfile) => Promise<void>) { super(app); }
  onOpen(): void { this.modalEl.addClass("manuscript-wizard"); this.titleEl.setText("New compile profile"); this.contentEl.createEl("p", { text: "Answer a few questions. Every generated option remains editable in settings." }); this.renderQuestions(); new Setting(this.contentEl).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close())).addButton((button) => button.setButtonText("Create profile").setCta().onClick(async () => { const profile = profileFromWizard(this.choices); if (this.finished) await this.finished(profile); else { this.plugin.settings.profiles.push(profile); this.plugin.settings.activeProfileId = profile.id; await this.plugin.saveSettings(); } new Notice(`Profile “${profile.name}” created.`); this.close(); })); }
  protected renderQuestions(): void {
    new Setting(this.contentEl).setName("Profile name").addText((text) => { text.setValue(this.choices.name).onChange((value) => { this.choices.name = value; }); text.inputEl.setAttribute("aria-label", "Compile profile name"); });
    new Setting(this.contentEl).setName("Are chapters folders or notes?").addDropdown((dropdown) => dropdown.addOption("folders", "Folders containing scenes").addOption("notes", "Individual chapter notes").setValue(this.choices.chapterSource).onChange((value) => { this.choices.chapterSource = value === "notes" ? "notes" : "folders"; }));
    this.toggle("Do you use Parts?", "Create level-one Part headings.", "useParts"); this.toggle("Insert scene separators?", "Insert the profile separator between scenes.", "sceneSeparators"); this.toggle("Include front matter?", "Include recognised front-matter folders.", "includeFrontMatter"); this.toggle("Include back matter?", "Include recognised back-matter folders.", "includeBackMatter"); this.toggle("Primarily export for Vellum?", "Use Vellum-oriented headings, cleaners, and built-in DOCX output.", "vellum");
    new Setting(this.contentEl).setName("DOCX creation").setDesc("DOCX files are generated locally by Manuscript Compiler.");
  }
  protected toggle(name: string, description: string, key: "useParts" | "sceneSeparators" | "includeFrontMatter" | "includeBackMatter" | "vellum"): void { new Setting(this.contentEl).setName(name).setDesc(description).addToggle((toggle) => toggle.setValue(this.choices[key]).onChange((value) => { this.choices[key] = value; })); }
}

/** One-time onboarding view that stores defaults and may launch the sample route. */
export class FirstRunWizardModal extends Modal {
  private choices = initialChoices(); private compileSample = false;
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app); }
  onOpen(): void { this.modalEl.addClass("manuscript-wizard"); this.render(); }
  private render(): void {
    this.contentEl.empty(); this.titleEl.setText("Welcome to Manuscript Compiler"); this.contentEl.createEl("p", { text: "Set up your first professional compile profile. You can change every option later." });
    new Setting(this.contentEl).setName("Manuscript folder").setDesc(this.choices.manuscriptRoot || "Not selected").addButton((button) => button.setButtonText("Choose").setCta().onClick(() => new WizardFolderPicker(this.app, (folder) => { this.choices.manuscriptRoot = folder.path; this.render(); }).open()));
    new Setting(this.contentEl).setName("Profile style").addDropdown((dropdown) => dropdown.addOption("standard", "Standard").addOption("vellum", "Vellum").setValue(this.choices.vellum ? "vellum" : "standard").onChange((value) => { this.choices.vellum = value === "vellum"; }));
    new Setting(this.contentEl).setName("Book structure").addDropdown((dropdown) => { for (const [value, label] of Object.entries(STRUCTURE_PRESET_NAMES)) if (value !== "custom") dropdown.addOption(value, label); dropdown.setValue(this.choices.structurePreset ?? "novel-parts").onChange((value) => { this.choices.structurePreset = value as StructurePreset; this.choices.useParts = value === "novel-parts" || value === "anthology"; this.choices.chapterSource = value === "chapter-notes" || value === "short-story" || value === "anthology" ? "notes" : "folders"; }); });
    new Setting(this.contentEl).setName("File downloads").setDesc("DOCX, ODT, EPUB, HTML, Markdown, and XML are generated locally without external converters.");
    new Setting(this.contentEl).setName("Compile sample after setup").setDesc("Available when the bundled sample book exists in this vault.").addToggle((toggle) => toggle.setValue(this.compileSample).onChange((value) => { this.compileSample = value; }));
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Skip for now").onClick(async () => { this.plugin.settings.onboardingCompleted = true; await this.plugin.saveSettings(); this.close(); })).addButton((button) => button.setButtonText("Finish setup").setCta().onClick(async () => { const profile = profileFromWizard({ ...this.choices, name: this.choices.vellum ? "Vellum" : "Standard" }); this.plugin.settings.profiles.push(profile); this.plugin.settings.activeProfileId = profile.id; this.plugin.settings.defaultProfileId = profile.id; this.plugin.settings.defaultManuscriptFolder = this.choices.manuscriptRoot; this.plugin.settings.defaultStructurePreset = this.choices.structurePreset ?? "novel-parts"; this.plugin.settings.defaultDocxStyle = this.choices.vellum ? "vellum" : "standard"; this.plugin.settings.defaultDownloadFormat = "docx"; this.plugin.settings.onboardingCompleted = true; await this.plugin.saveSettings(); this.close(); if (this.compileSample) await this.plugin.compileSampleManuscript(); }));
  }
}
