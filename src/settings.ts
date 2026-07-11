export type OrderingMethod = "filename" | "metadata";
export type WarningLevel = "information" | "warning" | "error";
export type MetadataOperator = "equals" | "not-equals";
export type ExportTarget = "markdown" | "docx" | "markdown-docx";

export interface MetadataFilterRule { id: string; field: string; operator: MetadataOperator; value: string; }
export interface CleaningSettings { stripYamlFrontmatter: boolean; removeObsidianComments: boolean; removeHtmlComments: boolean; removeDataviewBlocks: boolean; removeCallouts: boolean; stripInternalLinks: boolean; }
export interface CompileOptions extends CleaningSettings {
  includeFrontMatter: boolean; includeBackMatter: boolean; includeSceneTitles: boolean; metadataOrdering: boolean;
  partHeadingTemplate: string; chapterHeadingTemplate: string; sceneSeparator: string;
  orderingMethod: OrderingMethod; metadataFilters: MetadataFilterRule[]; blankLinesBetweenSections: number; blankLinesBetweenChapters: number;
}
export interface CompileProfile extends CompileOptions {
  id: string; name: string; manuscriptRoot: string; exportFolder: string; outputFilename: string;
  variables: { BookTitle: string; Series: string; Author: string };
  exportTarget: ExportTarget; referenceDocx: string; pandocMetadataFile: string; additionalPandocArguments: string;
  generateTableOfContents: boolean; keepIntermediateMarkdown: boolean;
}
export interface ExportHistoryEntry { id: string; timestamp: string; profile: string; manuscript: string; outputFiles: string[]; wordCount: number; success: boolean; message?: string; }
export interface CompileLogEntry extends ExportHistoryEntry { exportFormats: ExportTarget; pandocVersion?: string; durationMs: number; warnings: string[]; diagnostics?: string; }
export interface ManuscriptCompilerSettings extends CompileOptions {
  profiles: CompileProfile[]; activeProfileId: string; defaultProfileId: string;
  showPreview: boolean; expandPreviewTree: boolean; showStatistics: boolean; readingWordsPerMinute: number; minimumWarningLevel: WarningLevel;
  pandocExecutablePath: string; automaticallyDetectPandoc: boolean; defaultExportFormat: ExportTarget; defaultReferenceDocx: string;
  keepTemporaryMarkdown: boolean; enableCompileLogs: boolean; maximumExportHistoryEntries: number;
  exportHistory: ExportHistoryEntry[]; compileLogs: CompileLogEntry[];
  /* Stage 1/2 migration fields. */
  defaultManuscriptFolder: string; defaultExportFolder: string; defaultCompilePreset: "default" | "vellum";
}

export const DEFAULT_OPTIONS: CompileOptions = {
  includeFrontMatter: true, includeBackMatter: true, includeSceneTitles: false, metadataOrdering: false, orderingMethod: "filename",
  partHeadingTemplate: "{title}", chapterHeadingTemplate: "{title}", sceneSeparator: "#", metadataFilters: [],
  blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1,
  stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: false, removeDataviewBlocks: false, removeCallouts: false, stripInternalLinks: false
};
export const DEFAULT_SETTINGS: ManuscriptCompilerSettings = {
  ...DEFAULT_OPTIONS, profiles: [], activeProfileId: "", defaultProfileId: "", showPreview: true, expandPreviewTree: true,
  showStatistics: true, readingWordsPerMinute: 250, minimumWarningLevel: "information",
  pandocExecutablePath: "", automaticallyDetectPandoc: true, defaultExportFormat: "markdown", defaultReferenceDocx: "",
  keepTemporaryMarkdown: false, enableCompileLogs: true, maximumExportHistoryEntries: 50, exportHistory: [], compileLogs: [],
  defaultManuscriptFolder: "", defaultExportFolder: "Manuscript Exports", defaultCompilePreset: "default"
};
