/**
 * Manuscript Compiler — semantic domain model.
 *
 * Defines the publishable vocabulary shared by parser, preview, validation,
 * Markdown, DOCX, warnings, and statistics. These types describe manuscript
 * structure rather than vault organisation.
 *
 * Invariant: once a Book enters PreparedCompileSession its object graph is
 * treated as immutable and the same instance reaches preview and export.
 */
import type { TFile, TFolder } from "obsidian";
import type { HierarchyDiagnostic } from "./types";

export type MatterKind = "front" | "back";

export interface DocumentMetadata {
  part?: string | number;
  chapter?: string | number;
  scene?: string | number;
  order?: number;
  editingStatus?: string;
  values: Record<string, unknown>;
}

/** Parsed source note containing cleaned content and exclusion diagnostics. */
export interface ManuscriptDocument {
  file: TFile;
  title: string;
  number?: number;
  metadata: DocumentMetadata;
  rawContent: string;
  content: string;
  excluded: boolean;
  exclusionReason?: string;
  metadataError?: string;
}

export interface MatterSection {
  kind: MatterKind;
  title: string;
  documents: ManuscriptDocument[];
}

export interface Scene extends ManuscriptDocument {}

/** Semantic Chapter. An absent number remains absent rather than becoming zero. */
export interface Chapter {
  title: string;
  name: string;
  number?: number;
  path: string;
  order?: number;
  scenes: Scene[];
  orphan: boolean;
}

/** Semantic Part; `synthetic` represents a partless book wrapper, not a heading. */
export interface Part {
  title: string;
  name: string;
  number?: number;
  path: string;
  order?: number;
  chapters: Chapter[];
  orphanScenes: Scene[];
  synthetic?: boolean;
}

/**
 * Final publishable model owned by PreparedCompileSession. `root` names and bounds
 * the source but is never itself a Part or Chapter. Treat the graph as immutable.
 */
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
  hierarchyDiagnostics?: HierarchyDiagnostic[];
}

export type WarningSeverity = "information" | "warning" | "error";
/** Prose-free issue shared unchanged by preview, validation, and export. */
export interface CompileWarning { severity: WarningSeverity; code: string; message: string; path?: string; suggestion?: string; }
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
  timings?: CompileTimings;
}
export interface CompileTimings { totalMs: number; scanMs: number; parseMs: number; filterMs: number; generationMs: number; exportMs: number; }

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
  docxEngine: "built-in";
  estimatedPages: number;
  canExport: boolean;
}
