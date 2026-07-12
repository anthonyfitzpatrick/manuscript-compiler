export type OrderingMethod = "filename" | "metadata";
export type WarningLevel = "information" | "warning" | "error";
export type MetadataOperator = "equals" | "not-equals";
export type ExportTarget = "markdown" | "docx" | "markdown-docx";
export type ChapterSource = "folders" | "notes";
export type StructurePreset = "novel-parts" | "novel" | "chapter-notes" | "short-story" | "anthology" | "custom";
export type DocxStylePreset = "vellum" | "standard";

export interface MetadataFilterRule { id: string; field: string; operator: MetadataOperator; value: string; }
export interface CleaningSettings { stripYamlFrontmatter: boolean; removeObsidianComments: boolean; removeHtmlComments: boolean; removeDataviewBlocks: boolean; removeCallouts: boolean; stripInternalLinks: boolean; }
export interface CompileOptions extends CleaningSettings {
  includeFrontMatter: boolean; includeBackMatter: boolean; includeSceneTitles: boolean; metadataOrdering: boolean;
  partHeadingTemplate: string; chapterHeadingTemplate: string; sceneSeparator: string;
  orderingMethod: OrderingMethod; metadataFilters: MetadataFilterRule[]; blankLinesBetweenSections: number; blankLinesBetweenChapters: number;
  useParts: boolean; chapterSource: ChapterSource;
}
export interface CompileProfile extends CompileOptions {
  id: string; name: string; manuscriptRoot: string; exportFolder: string; outputFilename: string;
  variables: { BookTitle: string; Series: string; Author: string };
  exportTarget: ExportTarget; referenceDocx: string; pandocMetadataFile: string; additionalPandocArguments: string;
  generateTableOfContents: boolean; keepIntermediateMarkdown: boolean;
}
export interface ExportHistoryEntry { id: string; timestamp: string; profile: string; manuscript: string; outputFiles: string[]; wordCount: number; success: boolean; message?: string; }
export interface CompileLogEntry extends ExportHistoryEntry { exportFormats: ExportTarget; compilerVersion: string; pandocVersion?: string; durationMs: number; scanDurationMs: number; parseDurationMs: number; filterDurationMs: number; generationDurationMs: number; exportDurationMs: number; warnings: string[]; diagnostics?: string; }
export interface ManuscriptCompilerSettings extends CompileOptions {
  profiles: CompileProfile[]; activeProfileId: string; defaultProfileId: string;
  showPreview: boolean; expandPreviewTree: boolean; showStatistics: boolean; readingWordsPerMinute: number; minimumWarningLevel: WarningLevel;
  pandocExecutablePath: string; automaticallyDetectPandoc: boolean; defaultExportFormat: ExportTarget; defaultReferenceDocx: string;
  keepTemporaryMarkdown: boolean; enableCompileLogs: boolean; maximumExportHistoryEntries: number;
  exportHistory: ExportHistoryEntry[]; compileLogs: CompileLogEntry[];
  configurationWarnings: string[];
  onboardingCompleted: boolean;
  defaultStructurePreset: StructurePreset; defaultDocxStyle: DocxStylePreset; warnBeforeOverwrite: boolean;
  openAfterCompile: boolean; includeTitlePageByDefault: boolean; includeTableOfContentsByDefault: boolean; showAdvancedOptions: boolean;
  /* Stage 1/2 migration fields. */
  defaultManuscriptFolder: string; defaultExportFolder: string; defaultCompilePreset: "default" | "vellum";
}

export const DEFAULT_OPTIONS: CompileOptions = {
  includeFrontMatter: true, includeBackMatter: true, includeSceneTitles: false, metadataOrdering: false, orderingMethod: "filename",
  partHeadingTemplate: "{title}", chapterHeadingTemplate: "{title}", sceneSeparator: "#", metadataFilters: [],
  blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1,
  useParts: true, chapterSource: "folders",
  stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: false, removeDataviewBlocks: false, removeCallouts: false, stripInternalLinks: false
};
export const DEFAULT_SETTINGS: ManuscriptCompilerSettings = {
  ...DEFAULT_OPTIONS, profiles: [], activeProfileId: "", defaultProfileId: "", showPreview: true, expandPreviewTree: false,
  showStatistics: true, readingWordsPerMinute: 250, minimumWarningLevel: "information",
  pandocExecutablePath: "", automaticallyDetectPandoc: false, defaultExportFormat: "docx", defaultReferenceDocx: "",
  keepTemporaryMarkdown: false, enableCompileLogs: true, maximumExportHistoryEntries: 50, exportHistory: [], compileLogs: [], configurationWarnings: [], onboardingCompleted: false,
  defaultManuscriptFolder: "", defaultExportFolder: "Manuscript Exports", defaultCompilePreset: "default",
  defaultStructurePreset: "novel-parts", defaultDocxStyle: "vellum", warnBeforeOverwrite: true, openAfterCompile: false,
  includeTitlePageByDefault: false, includeTableOfContentsByDefault: false, showAdvancedOptions: false
};
