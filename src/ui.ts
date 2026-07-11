import { App, FuzzySuggestModal, Modal, Notice, PluginSettingTab, Setting, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly onChoose: (folder: TFolder) => void) { super(app); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder && file.path !== "/"); }
  getItemText(folder: TFolder): string { return folder.path; }
  onChooseItem(folder: TFolder): void { this.onChoose(folder); }
}

export class ConfirmOverwriteModal extends Modal {
  constructor(app: App, private readonly path: string, private readonly resolve: (confirmed: boolean) => void) { super(app); }
  onOpen(): void {
    this.titleEl.setText("Overwrite manuscript?");
    this.contentEl.createEl("p", { text: `The file “${this.path}” already exists. Replace it?` });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => { this.resolve(false); this.close(); }))
      .addButton((button) => button.setButtonText("Overwrite").setWarning().onClick(() => { this.resolve(true); this.close(); }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class CompileReportModal extends Modal {
  constructor(app: App, private readonly report: { output: string; parts: number; chapters: number; scenes: number; wordCount: number; warnings: string[] }) { super(app); }
  onOpen(): void {
    this.titleEl.setText("Compilation complete");
    const list = this.contentEl.createEl("dl", { cls: "manuscript-compiler-report" });
    this.addRow(list, "Output file", this.report.output);
    this.addRow(list, "Parts", String(this.report.parts));
    this.addRow(list, "Chapters", String(this.report.chapters));
    this.addRow(list, "Scenes", String(this.report.scenes));
    this.addRow(list, "Word count", this.report.wordCount.toLocaleString());
    this.contentEl.createEl("h3", { text: "Warnings" });
    if (this.report.warnings.length === 0) this.contentEl.createEl("p", { text: "None" });
    else {
      const warnings = this.contentEl.createEl("ul");
      this.report.warnings.forEach((warning) => warnings.createEl("li", { text: warning }));
    }
  }
  private addRow(list: HTMLElement, label: string, value: string): void { list.createEl("dt", { text: label }); list.createEl("dd", { text: value }); }
}

export class ManuscriptCompilerSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Default manuscript folder").setDesc("Vault-relative path to the book folder used by Compile Current Book.").addText((text) => text.setPlaceholder("Books/My Book").setValue(this.plugin.settings.defaultManuscriptFolder).onChange(async (value) => { this.plugin.settings.defaultManuscriptFolder = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Default export folder").setDesc("Vault-relative folder where compiled manuscripts are written.").addText((text) => text.setPlaceholder("Manuscript Exports").setValue(this.plugin.settings.defaultExportFolder).onChange(async (value) => { this.plugin.settings.defaultExportFolder = value.trim(); await this.plugin.saveSettings(); }));
    this.addToggle(containerEl, "Include front matter", "Include Markdown files under Ebook Front Matter.", "includeFrontMatter");
    this.addToggle(containerEl, "Include back matter", "Include Markdown files under Ebook Back Matter.", "includeBackMatter");
    this.addToggle(containerEl, "Strip YAML frontmatter", "Remove leading YAML frontmatter from every source note.", "stripYamlFrontmatter");
    this.addToggle(containerEl, "Include scene titles", "Add each scene filename as a level-three heading.", "includeSceneTitles");
    new Setting(containerEl).setName("Scene separator").setDesc("Markdown inserted between consecutive scenes. The default is #.").addText((text) => text.setValue(this.plugin.settings.sceneSeparator).onChange(async (value) => { this.plugin.settings.sceneSeparator = value; await this.plugin.saveSettings(); }));
  }
  private addToggle(container: HTMLElement, name: string, description: string, key: "includeFrontMatter" | "includeBackMatter" | "stripYamlFrontmatter" | "includeSceneTitles"): void {
    new Setting(container).setName(name).setDesc(description).addToggle((toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => { this.plugin.settings[key] = value; await this.plugin.saveSettings(); }));
  }
}

export function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  new Notice(`Manuscript Compiler: ${message}`, 8000);
  console.error("Manuscript Compiler", error);
}
