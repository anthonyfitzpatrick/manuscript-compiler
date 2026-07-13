import { FileSystemAdapter, TFile, type App } from "obsidian";
import { openExternalVaultFile, revealExternalVaultFile } from "./platform-compat";

export interface ResultActionCapabilities { open: boolean; reveal: boolean; saveCopy: boolean; }
export class ResultActionService {
  constructor(private readonly app: App) {}
  capabilities(path: string, succeeded: boolean): ResultActionCapabilities {
    if (!succeeded || !path) return { open: false, reveal: false, saveCopy: false };
    const markdown = /\.md$/i.test(path);
    const local = this.app.vault.adapter instanceof FileSystemAdapter;
    return { open: markdown || local, reveal: local, saveCopy: /\.docx$/i.test(path) };
  }
  async openExport(path: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile && file.extension === "md") { await this.app.workspace.getLeaf(true).openFile(file); return true; }
    return openExternalVaultFile(this.app.vault, path);
  }
  revealExport(path: string): boolean { return revealExternalVaultFile(this.app.vault, path); }
  async saveCopyToComputer(path: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      const data = file instanceof TFile ? await this.app.vault.readBinary(file) : await this.app.vault.adapter.readBinary(path);
      const name = file instanceof TFile ? file.name : path.split("/").pop() ?? "Manuscript.docx";
      const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const link = document.createElement("a");
      link.href = url; link.download = name; link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch { return false; }
  }
}
