import { Notice, Plugin, TFolder } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { MarkdownExporter } from "./exporter";
import { DEFAULT_SETTINGS, ManuscriptCompilerSettings } from "./settings";
import { CompileReportModal, ConfirmOverwriteModal, FolderSuggestModal, ManuscriptCompilerSettingTab, showError } from "./ui";
import { VaultScanner } from "./vault-scanner";

export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this));
    this.addCommand({ id: "compile-current-book", name: "Compile Current Book", callback: () => { void this.compileCurrentBook(); } });
    this.addCommand({ id: "compile-selected-folder", name: "Compile Selected Folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.compileFolder(folder); }).open(); } });
  }

  async loadSettings(): Promise<void> { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ManuscriptCompilerSettings> | null); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }

  private async compileCurrentBook(): Promise<void> {
    try {
      const folder = this.resolveCurrentBook();
      if (!folder) throw new Error("Set a default manuscript folder, or open a note inside a book folder containing Part folders.");
      await this.compileFolder(folder);
    } catch (error) { showError(error); }
  }

  private resolveCurrentBook(): TFolder | null {
    if (this.settings.defaultManuscriptFolder) {
      const configured = this.app.vault.getAbstractFileByPath(this.settings.defaultManuscriptFolder);
      if (configured instanceof TFolder) return configured;
    }
    const active = this.app.workspace.getActiveFile();
    let folder = active?.parent ?? null;
    while (folder && folder.path !== "/") {
      const hasBookStructure = folder.children.some((child) => child instanceof TFolder && (/^part\b/i.test(child.name) || /^ebook (front|back) matter$/i.test(child.name)));
      if (hasBookStructure) return folder;
      folder = folder.parent;
    }
    return null;
  }

  private async compileFolder(folder: TFolder): Promise<void> {
    try {
      new Notice(`Compiling “${folder.name}”…`);
      const scan = new VaultScanner().scan(folder);
      const result = await new ManuscriptCompiler(this.app.vault).compile(scan, this.settings);
      const exporter = new MarkdownExporter(this.app.vault);
      const outputPath = exporter.getOutputPath(this.settings.defaultExportFolder, folder.name);
      if (exporter.exists(outputPath) && !await this.confirmOverwrite(outputPath)) { new Notice("Compilation cancelled."); return; }
      const output = await exporter.write(outputPath, result.markdown);
      new CompileReportModal(this.app, { output: output.path, parts: result.parts, chapters: result.chapters, scenes: result.scenes, wordCount: result.wordCount, warnings: result.warnings }).open();
    } catch (error) { showError(error); }
  }

  private confirmOverwrite(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } };
      const modal = new ConfirmOverwriteModal(this.app, path, finish);
      const originalClose = modal.onClose.bind(modal);
      modal.onClose = (): void => { originalClose(); finish(false); };
      modal.open();
    });
  }
}
