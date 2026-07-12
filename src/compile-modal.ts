import { App, FuzzySuggestModal, Modal, Notice, Setting, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { STRUCTURE_PRESET_NAMES, validateSimpleCompileRequest, type SimpleCompileRequest } from "./simple-workflow";
import type { ChapterSource, DocxStylePreset, StructurePreset } from "./settings";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly selected: (folder: TFolder) => void) { super(app); this.setPlaceholder("Choose a folder…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.selected(item); }
}

export class SimpleCompileModal extends Modal {
  private request: SimpleCompileRequest;
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) {
    super(app); const settings = plugin.settings; const profile = plugin.getActiveProfile();
    this.request = { manuscriptRoot: settings.defaultManuscriptFolder || profile.manuscriptRoot, structurePreset: settings.defaultStructurePreset,
      includeFrontMatter: profile.includeFrontMatter, includeBackMatter: profile.includeBackMatter, exportFolder: settings.defaultExportFolder || profile.exportFolder,
      outputFilename: this.filename(profile.outputFilename || "Manuscript.docx", settings.defaultExportFormat), outputFormat: settings.defaultExportFormat === "markdown" ? "markdown" : "docx", docxPreset: settings.defaultDocxStyle,
      custom: { useParts: profile.useParts, chapterSource: profile.chapterSource, partHeadingTemplate: profile.partHeadingTemplate, chapterHeadingTemplate: profile.chapterHeadingTemplate, sceneSeparator: profile.sceneSeparator,
        metadataOrdering: profile.metadataOrdering, orderingMethod: profile.orderingMethod, metadataFilters: profile.metadataFilters, stripYamlFrontmatter: profile.stripYamlFrontmatter, removeObsidianComments: profile.removeObsidianComments, removeHtmlComments: profile.removeHtmlComments, removeDataviewBlocks: profile.removeDataviewBlocks, removeCallouts: profile.removeCallouts, stripInternalLinks: profile.stripInternalLinks }
    };
  }
  onOpen(): void { this.modalEl.addClass("manuscript-simple-compile"); this.render(); }
  private render(): void {
    const c = this.contentEl; c.empty(); this.titleEl.setText("Compile Manuscript");
    c.createEl("h3", { text: "Manuscript" });
    new Setting(c).setName("Manuscript folder").setDesc(this.request.manuscriptRoot || "Choose the folder containing your book.").addButton((button) => button.setButtonText("Choose").setCta().onClick(() => new FolderPicker(this.app, (folder) => { this.request.manuscriptRoot = folder.path; if (/^(?:Manuscript|Untitled)/i.test(this.request.outputFilename)) this.request.outputFilename = `${folder.name}.${this.request.outputFormat === "markdown" ? "md" : "docx"}`; this.render(); }).open()));
    c.createEl("h3", { text: "Book structure" });
    new Setting(c).setName("Structure").addDropdown((dropdown) => { for (const [value, label] of Object.entries(STRUCTURE_PRESET_NAMES)) dropdown.addOption(value, label); dropdown.setValue(this.request.structurePreset).onChange((value) => { this.request.structurePreset = value as StructurePreset; this.render(); }); });
    new Setting(c).setName("Include front matter").setDesc("Title, copyright, dedication, and similar opening pages.").addToggle((toggle) => toggle.setValue(this.request.includeFrontMatter).onChange((value) => { this.request.includeFrontMatter = value; }));
    new Setting(c).setName("Include back matter").setDesc("About the author, also by, and similar closing pages.").addToggle((toggle) => toggle.setValue(this.request.includeBackMatter).onChange((value) => { this.request.includeBackMatter = value; }));
    if (this.request.structurePreset === "custom") this.customStructure(c);
    c.createEl("h3", { text: "Output" });
    new Setting(c).setName("Export folder").setDesc(this.request.exportFolder || "Vault root").addButton((button) => button.setButtonText("Choose").onClick(() => new FolderPicker(this.app, (folder) => { this.request.exportFolder = folder.path; this.render(); }).open()));
    new Setting(c).setName("Filename").addText((text) => { text.setValue(this.request.outputFilename).onChange((value) => { this.request.outputFilename = value; }); text.inputEl.setAttribute("aria-label", "Output filename"); });
    new Setting(c).setName("Format").addDropdown((dropdown) => dropdown.addOption("docx", "DOCX").addOption("markdown", "Markdown").setValue(this.request.outputFormat === "markdown" ? "markdown" : "docx").onChange((value) => { this.request.outputFormat = value === "markdown" ? "markdown" : "docx"; this.request.outputFilename = this.filename(this.request.outputFilename, this.request.outputFormat); this.render(); }));
    const advanced = c.createEl("details"); advanced.open = this.plugin.settings.showAdvancedOptions; advanced.createEl("summary", { text: "Advanced options" }); advanced.createEl("p", { text: "Most authors do not need to change these options." });
    if (this.request.outputFormat === "docx") new Setting(advanced).setName("DOCX preset").addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum DOCX").addOption("standard", "Standard DOCX").setValue(this.request.docxPreset).onChange((value) => { this.request.docxPreset = value as DocxStylePreset; }));
    new Setting(c).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close())).addButton((button) => button.setButtonText(this.request.outputFormat === "docx" ? "Create DOCX" : "Compile").setCta().onClick(async () => { const errors = validateSimpleCompileRequest(this.request); const folder = this.app.vault.getAbstractFileByPath(this.request.manuscriptRoot); if (!(folder instanceof TFolder)) errors.push("The manuscript folder does not exist."); if (errors.length) { new Notice(errors.join(" "), 8000); return; } this.close(); await this.plugin.compileRequest(this.request); }));
  }
  private customStructure(parent: HTMLElement): void { const custom = this.request.custom ??= {}; new Setting(parent).setName("Use Parts").addToggle((toggle) => toggle.setValue(custom.useParts ?? false).onChange((value) => { custom.useParts = value; })); new Setting(parent).setName("Chapter source").addDropdown((dropdown) => dropdown.addOption("folders", "Chapter folders containing scenes").addOption("notes", "Individual chapter notes").setValue(custom.chapterSource ?? "folders").onChange((value) => { custom.chapterSource = value as ChapterSource; })); }
  private filename(value: string, format: "markdown" | "docx" | "markdown-docx"): string { const base = value.replace(/\.(?:docx|md)$/i, "") || "Manuscript"; return `${base}.${format === "markdown" ? "md" : "docx"}`; }
  onClose(): void { this.contentEl.empty(); }
}
