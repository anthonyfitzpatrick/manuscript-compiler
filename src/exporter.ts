import { normalizePath, TFile, Vault } from "obsidian";

export class MarkdownExporter {
  constructor(private readonly vault: Vault) {}

  getOutputPath(exportFolder: string, bookName: string): string {
    const folder = normalizePath(exportFolder.trim().replace(/^\/+|\/+$/g, ""));
    const safeName = bookName.replace(/[\\/:*?"<>|]/g, "-").trim() || "Manuscript";
    return normalizePath(folder ? `${folder}/${safeName} Manuscript.md` : `${safeName} Manuscript.md`);
  }

  exists(path: string): boolean {
    return this.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  async write(path: string, markdown: string): Promise<TFile> {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash >= 0) await this.ensureFolder(path.slice(0, lastSlash));
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, markdown);
      return existing;
    }
    return this.vault.create(path, markdown);
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = normalizePath(path).split("/");
    for (let index = 1; index <= parts.length; index += 1) {
      const current = parts.slice(0, index).join("/");
      if (!this.vault.getAbstractFileByPath(current)) await this.vault.createFolder(current);
    }
  }
}
