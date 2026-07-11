import { Notice, Plugin, TFolder } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { MarkdownExporter } from "./exporter";
import type { CompilePreview, CompileResult } from "./model";
import { activeProfile, migrateSettings } from "./profiles";
import { DEFAULT_SETTINGS, ManuscriptCompilerSettings } from "./settings";
import { CompilePreviewModal, CompileReportModal, ConfirmOverwriteModal, FolderSuggestModal, ManuscriptCompilerSettingTab, showError } from "./ui";
import { VaultScanner } from "./vault-scanner";
import { WarningEngine } from "./warnings";

const BOOK_FOLDER_PATTERN = /^(?:part\b|(?:ebook |print )?(?:front|back) matter$)/i;
export default class ManuscriptCompilerPlugin extends Plugin {
  settings: ManuscriptCompilerSettings = { ...DEFAULT_SETTINGS };
  async onload(): Promise<void> {
    await this.loadSettings(); this.addSettingTab(new ManuscriptCompilerSettingTab(this.app, this));
    this.addCommand({ id: "compile-current-book", name: "Compile Current Book", callback: () => { void this.compileCurrentBook(); } });
    this.addCommand({ id: "compile-selected-folder", name: "Compile Selected Folder", callback: () => { new FolderSuggestModal(this.app, (folder) => { void this.compileFolder(folder); }).open(); } });
  }
  async loadSettings(): Promise<void> { const loaded = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ManuscriptCompilerSettings> | null); this.settings = migrateSettings(loaded); await this.saveSettings(); }
  async saveSettings(): Promise<void> { await this.saveData(this.settings); }
  getActiveProfile() { return activeProfile(this.settings); }
  private async compileCurrentBook(): Promise<void> {
    try { const folder = this.resolveCurrentBook(); if (!folder) throw new Error("Set a manuscript root in the active compile profile, or open a note inside a recognisable book folder."); await this.compileFolder(folder); } catch (error) { showError(error); }
  }
  private resolveCurrentBook(): TFolder | null {
    const configuredPath = this.getActiveProfile().manuscriptRoot || this.settings.defaultManuscriptFolder;
    if (configuredPath) { const configured = this.app.vault.getAbstractFileByPath(configuredPath); if (configured instanceof TFolder) return configured; }
    let folder = this.app.workspace.getActiveFile()?.parent ?? null;
    while (folder && folder.path !== "/") { if (folder.children.some((child) => child instanceof TFolder && BOOK_FOLDER_PATTERN.test(child.name))) return folder; folder = folder.parent; }
    return null;
  }
  private async compileFolder(folder: TFolder): Promise<void> {
    try {
      const profile = this.getActiveProfile(); new Notice(`Preparing “${folder.name}” with profile “${profile.name}”…`);
      const compileDate = new Date();
      const book = await new ManuscriptCompiler(this.app.vault).buildModel(new VaultScanner().scan(folder), profile);
      const compiler = new ManuscriptCompiler(this.app.vault); const exporter = new MarkdownExporter(this.app.vault);
      const preliminary = compiler.compile(book, profile, "", this.settings.readingWordsPerMinute, compileDate);
      const variables = { ...profile.variables, BookTitle: profile.variables.BookTitle || book.title, Date: compileDate.toISOString().slice(0, 10), Year: compileDate.getFullYear(), WordCount: preliminary.statistics.totalWordCount, ChapterCount: preliminary.statistics.chapterCount };
      const outputPath = exporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables);
      const result = compiler.compile(book, profile, outputPath, this.settings.readingWordsPerMinute, compileDate);
      const visibleIssues = new WarningEngine().filter(result.issues, this.settings.minimumWarningLevel);
      const slash = outputPath.lastIndexOf("/");
      const preview: CompilePreview = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message), book, outputPath, outputFolder: slash < 0 ? "" : outputPath.slice(0, slash), outputFilename: slash < 0 ? outputPath : outputPath.slice(slash + 1) };
      if (this.settings.showPreview && !await this.confirmPreview(preview)) { new Notice("Compilation cancelled."); return; }
      if (exporter.exists(outputPath) && !await this.confirmOverwrite(outputPath)) { new Notice("Compilation cancelled."); return; }
      const output = await exporter.export(outputPath, result.markdown);
      const report: CompileResult = { ...result, issues: visibleIssues, warnings: visibleIssues.map((issue) => issue.message) };
      new CompileReportModal(this.app, output.path, report, this.settings.showStatistics).open();
    } catch (error) { showError(error); }
  }
  private confirmPreview(preview: CompilePreview): Promise<boolean> { return this.modalPromise((finish) => new CompilePreviewModal(this.app, preview, this.settings.expandPreviewTree, this.settings.showStatistics, finish)); }
  private confirmOverwrite(path: string): Promise<boolean> { return this.modalPromise((finish) => new ConfirmOverwriteModal(this.app, path, finish)); }
  private modalPromise(factory: (finish: (value: boolean) => void) => { open(): void; onClose(): void }): Promise<boolean> { return new Promise((resolve) => { let settled = false; const finish = (value: boolean): void => { if (!settled) { settled = true; resolve(value); } }; const modal = factory(finish); const close = modal.onClose.bind(modal); modal.onClose = (): void => { close(); finish(false); }; modal.open(); }); }
}
