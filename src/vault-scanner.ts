import { TAbstractFile, TFile, TFolder } from "obsidian";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";

const FRONT_MATTER = "ebook front matter";
const BACK_MATTER = "ebook back matter";
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export class VaultScanner {
  scan(root: TFolder): ScannedBook {
    const warnings: string[] = [];
    const visibleChildren = this.sortedVisibleChildren(root);
    const frontFolder = visibleChildren.find((item): item is TFolder => item instanceof TFolder && item.name.toLowerCase() === FRONT_MATTER);
    const backFolder = visibleChildren.find((item): item is TFolder => item instanceof TFolder && item.name.toLowerCase() === BACK_MATTER);
    const partFolders = visibleChildren.filter((item): item is TFolder => item instanceof TFolder && item !== frontFolder && item !== backFolder);
    const looseScenes = visibleChildren.filter((item): item is TFile => item instanceof TFile && this.isMarkdown(item));

    if (looseScenes.length > 0) warnings.push(`${looseScenes.length} Markdown file(s) found directly in the book folder; included after parts.`);
    if (!frontFolder) warnings.push("No Ebook Front Matter folder found.");
    if (!backFolder) warnings.push("No Ebook Back Matter folder found.");

    return {
      root,
      frontMatter: frontFolder ? this.collectMarkdown(frontFolder) : [],
      parts: partFolders.map((folder) => this.scanPart(folder, warnings)),
      looseScenes,
      backMatter: backFolder ? this.collectMarkdown(backFolder) : [],
      warnings
    };
  }

  private scanPart(folder: TFolder, warnings: string[]): ScannedPart {
    const children = this.sortedVisibleChildren(folder);
    const chapterFolders = children.filter((item): item is TFolder => item instanceof TFolder);
    const looseScenes = children.filter((item): item is TFile => item instanceof TFile && this.isMarkdown(item));
    if (looseScenes.length > 0) warnings.push(`${looseScenes.length} Markdown file(s) found directly in “${folder.name}”; included before its chapters.`);
    return { folder, chapters: chapterFolders.map((chapter) => this.scanChapter(chapter)), looseScenes };
  }

  private scanChapter(folder: TFolder): ScannedChapter {
    return { folder, scenes: this.collectMarkdown(folder) };
  }

  private collectMarkdown(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    for (const child of this.sortedVisibleChildren(folder)) {
      if (child instanceof TFile && this.isMarkdown(child)) files.push(child);
      if (child instanceof TFolder) files.push(...this.collectMarkdown(child));
    }
    return files;
  }

  private sortedVisibleChildren(folder: TFolder): TAbstractFile[] {
    return folder.children
      .filter((item) => !this.isHidden(item.path))
      .sort((a, b) => collator.compare(a.name, b.name));
  }

  private isHidden(path: string): boolean {
    return path.split("/").some((segment) => segment.startsWith("."));
  }

  private isMarkdown(file: TFile): boolean {
    return file.extension.toLowerCase() === "md" && !this.isHidden(file.path);
  }
}
