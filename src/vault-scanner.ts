/**
 * Manuscript Compiler — mechanical vault discovery.
 *
 * Walks one exact TFolder boundary and records Markdown files. It intentionally
 * does not infer author intent; content-plan.ts owns classification. Called only
 * by CompilePreparationService.
 *
 * Invariant: production code must apply an authoritative ContentPlan before
 * scanner output reaches ManuscriptParser or any exporter.
 */
import { TAbstractFile, TFile, TFolder } from "obsidian";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";

const FRONT_NAMES = new Set(["front matter", "ebook front matter", "print front matter"]);
const BACK_NAMES = new Set(["back matter", "ebook back matter", "print back matter"]);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Stateless synchronous scanner; it never reads file bodies or mutates vault data. */
export class VaultScanner {
  /**
   * Discovers Markdown below exactly `root` and returns a provisional mechanical
   * shape. The result is intentionally permissive and is unsafe for export until
   * content-plan classification and authoritative reconstruction have run.
   */
  scan(root: TFolder): ScannedBook {
    const warnings: string[] = [];
    const children = this.visibleChildren(root);
    const frontFolders = children.filter((item): item is TFolder => item instanceof TFolder && FRONT_NAMES.has(item.name.toLowerCase()));
    const backFolders = children.filter((item): item is TFolder => item instanceof TFolder && BACK_NAMES.has(item.name.toLowerCase()));
    const structuralFolders = children.filter((item): item is TFolder => item instanceof TFolder && !frontFolders.includes(item) && !backFolders.includes(item));
    const looseScenes = children.filter((item): item is TFile => item instanceof TFile && this.isMarkdown(item));
    if (frontFolders.length === 0) warnings.push("No recognised front matter folder found.");
    if (backFolders.length === 0) warnings.push("No recognised back matter folder found.");
    if (frontFolders.length > 1) warnings.push(`Multiple front matter folders found (${frontFolders.map((folder) => folder.name).join(", ")}); all will be included.`);
    if (backFolders.length > 1) warnings.push(`Multiple back matter folders found (${backFolders.map((folder) => folder.name).join(", ")}); all will be included.`);
    if (looseScenes.length > 0) warnings.push(`${looseScenes.length} orphan scene(s) found directly in the manuscript root.`);
    const frontMatter: TFile[] = [];
    for (const folder of frontFolders) frontMatter.push(...this.collectMarkdown(folder));
    const backMatter: TFile[] = [];
    for (const folder of backFolders) backMatter.push(...this.collectMarkdown(folder));
    const parts = structuralFolders.map((folder) => this.scanPart(folder, warnings));
    const allMarkdown: TFile[] = [...frontMatter];
    for (const part of parts) {
      allMarkdown.push(...part.looseScenes);
      for (const chapter of part.chapters) allMarkdown.push(...chapter.scenes);
    }
    allMarkdown.push(...looseScenes, ...backMatter);
    return { root, frontMatter, parts, looseScenes, backMatter, allMarkdown, warnings };
  }
  private scanPart(folder: TFolder, warnings: string[]): ScannedPart {
    const children = this.visibleChildren(folder);
    const looseScenes = children.filter((item): item is TFile => item instanceof TFile && this.isMarkdown(item));
    const subfolders = children.filter((item): item is TFolder => item instanceof TFolder);
    if (looseScenes.length > 0) warnings.push(`${looseScenes.length} orphan scene(s) found directly in “${folder.name}”.`);
    return { folder, looseScenes, chapters: subfolders.map((chapter) => this.scanChapter(chapter)) };
  }
  private scanChapter(folder: TFolder): ScannedChapter { return { folder, scenes: this.collectMarkdown(folder) }; }
  private collectMarkdown(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    for (const child of this.visibleChildren(folder)) {
      if (child instanceof TFile && this.isMarkdown(child)) files.push(child);
      else if (child instanceof TFolder) files.push(...this.collectMarkdown(child));
    }
    return files;
  }
  private visibleChildren(folder: TFolder): TAbstractFile[] { return folder.children.filter((item) => !this.isHidden(item.path)).sort((a, b) => collator.compare(a.name, b.name)); }
  private isHidden(path: string): boolean { return path.split("/").some((segment) => segment.startsWith(".")); }
  private isMarkdown(file: TFile): boolean { return file.extension.toLowerCase() === "md" && !this.isHidden(file.path); }
}
