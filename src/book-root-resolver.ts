/**
 * Manuscript Compiler — central book-root policy.
 *
 * Explicit roots are returned exactly and never replaced by ancestors or
 * children. Legacy commands may infer from configuration or active-note ancestry.
 * The root names the Book but is never emitted as a structural node.
 */
import { normalizePath, TFile, TFolder, type Vault } from "obsidian";

const BOOK_STRUCTURE_PATTERN = /^(?:part\b|(?:ebook |print )?(?:front|back) matter$|manuscript$|drafts?$|chapters$)/i;

/** The single policy boundary for resolving a selected vault item to a book root. */
export class BookRootResolver {
  constructor(private readonly vault: Vault) {}

  require(path: string, label = "manuscript folder"): TFolder {
    const folder = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(folder instanceof TFolder)) throw new Error(`The ${label} does not exist.`);
    return folder;
  }

  /** Explicit selections are authoritative and are never replaced by an ancestor or descendant. */
  selected(folder: TFolder): TFolder { return this.require(folder.path, "selected manuscript folder"); }

  /** Legacy commands may infer a root from saved configuration or current-file ancestry. */
  configuredOrCurrent(configuredPath: string, activeFile: TFile | null): TFolder | null {
    if (configuredPath.trim()) {
      const configured = this.vault.getAbstractFileByPath(normalizePath(configuredPath.trim()));
      if (configured instanceof TFolder) return configured;
    }
    let folder = activeFile?.parent ?? null;
    while (folder && folder.path !== "/") {
      if (folder.children.some((child) => child instanceof TFolder && BOOK_STRUCTURE_PATTERN.test(child.name))) return folder;
      folder = folder.parent;
    }
    return null;
  }
}
