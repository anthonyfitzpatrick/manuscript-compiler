import type { TFile, TFolder } from "obsidian";

export type MatterKind = "front" | "back";

export interface DocumentMetadata {
  part?: string | number;
  chapter?: string | number;
  scene?: string | number;
  order?: number;
  editingStatus?: string;
  values: Record<string, unknown>;
}

export interface ManuscriptDocument {
  file: TFile;
  title: string;
  number?: number;
  metadata: DocumentMetadata;
  rawContent: string;
  content: string;
  excluded: boolean;
  exclusionReason?: string;
}

export interface MatterSection {
  kind: MatterKind;
  title: string;
  documents: ManuscriptDocument[];
}

export interface Scene extends ManuscriptDocument {}

export interface Chapter {
  title: string;
  name: string;
  number?: number;
  path: string;
  order?: number;
  scenes: Scene[];
  orphan: boolean;
}

export interface Part {
  title: string;
  name: string;
  number?: number;
  path: string;
  order?: number;
  chapters: Chapter[];
  orphanScenes: Scene[];
}

export interface Book {
  root: TFolder;
  title: string;
  frontMatter: MatterSection;
  parts: Part[];
  orphanScenes: Scene[];
  backMatter: MatterSection;
  includedFiles: TFile[];
  excludedFiles: Array<{ file: TFile; reason: string }>;
  warnings: string[];
  issues: CompileWarning[];
}

export type WarningSeverity = "information" | "warning" | "error";
export interface CompileWarning { severity: WarningSeverity; code: string; message: string; path?: string; }
export interface NamedStatistic { name: string; words: number; }
export interface ManuscriptStatistics {
  totalWordCount: number; chapterCount: number; sceneCount: number; averageChapterLength: number; averageSceneLength: number;
  longestChapter?: NamedStatistic; shortestChapter?: NamedStatistic; longestScene?: NamedStatistic; shortestScene?: NamedStatistic; readingTimeMinutes: number;
}

export interface CompileStatistics {
  parts: number;
  chapters: number;
  scenes: number;
  frontMatter: number;
  backMatter: number;
  wordCount: number;
  readingTimeMinutes: number;
}

export interface CompileResult extends CompileStatistics {
  markdown: string;
  warnings: string[];
  issues: CompileWarning[];
  statistics: ManuscriptStatistics;
}

export interface CompilePreview extends CompileStatistics {
  book: Book;
  outputPath: string;
  outputFolder: string;
  outputFilename: string;
  warnings: string[];
  issues: CompileWarning[];
  statistics: ManuscriptStatistics;
  outputFormats: string[];
  outputPaths: string[];
  pandocAvailable: boolean;
  pandocVersion?: string;
  pandocExplanation?: string;
  referenceDocx?: string;
  estimatedPages: number;
  canExport: boolean;
}
