import type { TFile, TFolder } from "obsidian";

export interface ScannedBook {
  root: TFolder;
  frontMatter: TFile[];
  parts: ScannedPart[];
  looseScenes: TFile[];
  backMatter: TFile[];
  warnings: string[];
}

export interface ScannedPart {
  folder: TFolder;
  chapters: ScannedChapter[];
  looseScenes: TFile[];
}

export interface ScannedChapter {
  folder: TFolder;
  scenes: TFile[];
}

export interface CompileResult {
  markdown: string;
  parts: number;
  chapters: number;
  scenes: number;
  wordCount: number;
  warnings: string[];
}
