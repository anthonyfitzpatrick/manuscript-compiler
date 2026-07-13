/**
 * Manuscript Compiler — post-export platform actions.
 *
 * Determines and performs open, reveal, and save-copy actions after verified
 * success. Called by ExportCoordinator/result UI; calls platform-compat only.
 * Failed or rolled-back exports must never expose these capabilities.
 */
import { FileSystemAdapter, TFile, type App } from "obsidian";
import { openExternalVaultFile, revealExternalVaultFile } from "./platform-compat";

/** Platform actions that may be offered only for a successfully verified output. */
export interface ResultActionCapabilities { open: boolean; reveal: boolean; saveCopy: boolean; }
/** App-scoped capability service; methods return false instead of fabricating support. */
export class ResultActionService {
  constructor(private readonly app: App) {}
  /** Computes UI actions from output type, platform support, and truthful success state. */
  capabilities(path: string, succeeded: boolean): ResultActionCapabilities {
    if (!succeeded || !path) return { open: false, reveal: false, saveCopy: false };
    const markdown = /\.md$/i.test(path);
    const local = this.app.vault.adapter instanceof FileSystemAdapter;
    return { open: markdown || local, reveal: local, saveCopy: /\.docx$/i.test(path) };
  }
  /** Opens Markdown inside Obsidian and delegates binary files to the isolated platform bridge. */
  async openExport(path: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile && file.extension === "md") { await this.app.workspace.getLeaf(true).openFile(file); return true; }
    return openExternalVaultFile(this.app.vault, path);
  }
  /** Reveals local filesystem output where the adapter exposes that capability. */
  revealExport(path: string): boolean { return revealExternalVaultFile(this.app.vault, path); }
  /** Offers a browser-mediated copy without changing or revalidating the vault output. */
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
