/**
 * Manuscript Compiler — persisted configuration schema and defaults.
 *
 * Shared by migration, workspace resolution, compiler services, and settings
 * UI. Historical fields remain for data compatibility even when inactive. New
 * defaults remain offline, browser-delivered, A4/metric, and author-safe.
 */
export type OrderingMethod = "filename" | "metadata";
export type WarningLevel = "information" | "warning" | "error";
export type MetadataOperator = "equals" | "not-equals";
export type ExportTarget = "markdown" | "docx" | "markdown-docx" | "odt" | "epub" | "html" | "xml";
export type ChapterSource = "folders" | "notes";
export type StructurePreset = "novel-parts" | "novel" | "chapter-notes" | "short-story" | "anthology" | "custom";
export type DocxStylePreset = "vellum" | "standard" | "custom";

/** Persisted legacy-compatible metadata predicate with stable UI identity. */
export interface MetadataFilterRule { id: string; field: string; operator: MetadataOperator; value: string; }
/** Configurable syntax cleaning; mandatory metadata/body safety is not optional. */
export interface CleaningSettings { stripYamlFrontmatter: boolean; removeObsidianComments: boolean; removeHtmlComments: boolean; removeDataviewBlocks: boolean; removeCallouts: boolean; stripInternalLinks: boolean; bodySectionAliases?: string[]; }
/** Parser/generator options after request/profile resolution. */
export interface CompileOptions extends CleaningSettings {
  includeFrontMatter: boolean; includeBackMatter: boolean; includeSceneTitles: boolean; metadataOrdering: boolean;
  partHeadingTemplate: string; chapterHeadingTemplate: string; sceneSeparator: string;
  orderingMethod: OrderingMethod; metadataFilters: MetadataFilterRule[]; blankLinesBetweenSections: number; blankLinesBetweenChapters: number;
  useParts: boolean; chapterSource: ChapterSource;
}
/**
 * Persisted reusable configuration. Profiles are cloned before compilation.
 * Pandoc-named fields are inert compatibility data and must remain non-executable.
 */
export interface CompileProfile extends CompileOptions {
  id: string; name: string; manuscriptRoot: string; exportFolder: string; outputFilename: string;
  variables: { BookTitle: string; Series: string; Author: string };
  exportTarget: ExportTarget; referenceDocx: string; pandocMetadataFile: string; additionalPandocArguments: string;
  generateTableOfContents: boolean; keepIntermediateMarkdown: boolean;
  /** Session-level Compile Manuscript choices. These are not profile settings. */
  contentOrder?: string[]; docxFont?: string; docxFontSize?: number; docxLineSpacing?: number;
  /** Canonical first-line indentation unit for current settings. */
  docxFirstLineIndentCm?: number;
  /** Applies the configured first-line indentation to later body paragraphs. */
  docxIndentParagraphs?: boolean;
  /** Legacy pre-metric value in inches. Retained only for migration compatibility. */
  docxFirstLineIndent?: number;
  docxPageSize?: "letter" | "a4"; docxChapterPageBreak?: boolean; docxTitlePage?: boolean; downloadAfterExport?: boolean;
  skipLegacyPreview?: boolean;
  partDisplay?: StructuralDisplay; chapterDisplay?: StructuralDisplay; explicitlyIncludedPaths?: string[];
}
export type StructuralDisplay = "word" | "numeric" | "word-title" | "numeric-title" | "title" | "custom";
/** Repaired, bounded persisted summary; never contains manuscript prose. */
export interface ExportHistoryEntry { id: string; timestamp: string; profile: string; manuscript: string; format?: ExportTarget; outputFiles: string[]; wordCount: number; success: boolean; cancelled?: boolean; message?: string; generationSucceeded?: boolean; validationPassed?: boolean; downloadStarted?: boolean; }
export interface CompileLogEntry extends ExportHistoryEntry { exportFormats: ExportTarget; compilerVersion: string; pandocVersion?: string; durationMs: number; scanDurationMs: number; parseDurationMs: number; filterDurationMs: number; generationDurationMs: number; exportDurationMs: number; warnings: string[]; diagnostics?: string; }
/** Plugin-owned persisted state loaded and saved only through the plugin lifecycle. */
export interface ManuscriptCompilerSettings extends CompileOptions {
  profiles: CompileProfile[]; activeProfileId: string; defaultProfileId: string;
  showPreview: boolean; expandPreviewTree: boolean; showStatistics: boolean; readingWordsPerMinute: number; minimumWarningLevel: WarningLevel;
  pandocExecutablePath: string; automaticallyDetectPandoc: boolean; defaultExportFormat: ExportTarget; defaultReferenceDocx: string;
  keepTemporaryMarkdown: boolean; enableCompileLogs: boolean; maximumExportHistoryEntries: number;
  exportHistory: ExportHistoryEntry[]; compileLogs: CompileLogEntry[];
  configurationWarnings: string[];
  onboardingCompleted: boolean;
  defaultStructurePreset: StructurePreset; defaultDocxStyle: DocxStylePreset; warnBeforeOverwrite: boolean;
  defaultDocxPageSize: "letter" | "a4"; defaultIndentParagraphs: boolean; defaultDocxFirstLineIndentCm: number;
  openAfterCompile: boolean; includeTitlePageByDefault: boolean; includeTableOfContentsByDefault: boolean; showAdvancedOptions: boolean;
  saveToVaultByDefault: boolean; rememberExternalSaveFolder: boolean; lastExternalSaveFolder: string; revealAfterCompile: boolean;
  defaultDownloadFormat: "docx" | "odt" | "epub" | "html" | "markdown" | "xml";
  /* Stage 1/2 migration fields. */
  defaultManuscriptFolder: string; defaultExportFolder: string; defaultCompilePreset: "default" | "vellum";
}

export const DEFAULT_OPTIONS: CompileOptions = {
  includeFrontMatter: true, includeBackMatter: true, includeSceneTitles: false, metadataOrdering: false, orderingMethod: "filename",
  partHeadingTemplate: "{title}", chapterHeadingTemplate: "{title}", sceneSeparator: "#", metadataFilters: [],
  blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1,
  useParts: true, chapterSource: "folders",
  stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: false, removeDataviewBlocks: false, removeCallouts: false, stripInternalLinks: false
  , bodySectionAliases: ["Scene", "Manuscript", "Text", "Draft", "Body"]
};
export const DEFAULT_SETTINGS: ManuscriptCompilerSettings = {
  ...DEFAULT_OPTIONS, profiles: [], activeProfileId: "", defaultProfileId: "", showPreview: true, expandPreviewTree: false,
  showStatistics: true, readingWordsPerMinute: 250, minimumWarningLevel: "information",
  pandocExecutablePath: "", automaticallyDetectPandoc: false, defaultExportFormat: "docx", defaultReferenceDocx: "",
  keepTemporaryMarkdown: false, enableCompileLogs: true, maximumExportHistoryEntries: 50, exportHistory: [], compileLogs: [], configurationWarnings: [], onboardingCompleted: false,
  defaultManuscriptFolder: "", defaultExportFolder: "", defaultCompilePreset: "default",
  defaultStructurePreset: "novel-parts", defaultDocxStyle: "vellum", warnBeforeOverwrite: true, openAfterCompile: false,
  defaultDocxPageSize: "a4", defaultIndentParagraphs: true, defaultDocxFirstLineIndentCm: 0.75,
  includeTitlePageByDefault: false, includeTableOfContentsByDefault: false, showAdvancedOptions: false
  , saveToVaultByDefault: false, rememberExternalSaveFolder: false, lastExternalSaveFolder: "", revealAfterCompile: false, defaultDownloadFormat: "docx"
};
