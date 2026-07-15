/** Shared contracts for validated, in-memory manuscript exports. */
import type { PreparedCompileSession } from "./compile-preparation";
import type { CompileWarning } from "./model";
import type { SemanticDocument } from "./semantic-document";

export const EXPORT_FORMATS = ["docx", "odt", "epub", "html", "markdown", "xml"] as const;
export type ExportFormat = typeof EXPORT_FORMATS[number];

export const EXPORT_FORMAT_DETAILS: Record<ExportFormat, { label: string; extension: string; mimeType: string; description: string }> = {
  docx: { label: "DOCX", extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", description: "Word document suitable for Vellum and editing" },
  odt: { label: "ODT", extension: "odt", mimeType: "application/vnd.oasis.opendocument.text", description: "OpenDocument text for LibreOffice and compatible editors" },
  epub: { label: "EPUB", extension: "epub", mimeType: "application/epub+zip", description: "Reflowable ebook package" },
  html: { label: "HTML", extension: "html", mimeType: "text/html;charset=utf-8", description: "Standalone web document" },
  markdown: { label: "Markdown", extension: "md", mimeType: "text/markdown;charset=utf-8", description: "Portable plain-text manuscript" },
  xml: { label: "XML", extension: "xml", mimeType: "application/xml", description: "Structured manuscript data for interchange and automation" }
};

export interface ExportFormattingOptions {
  title: string; author: string; language: string; titlePage: boolean; tableOfContents: boolean;
  font: string; fontSize: number; lineSpacing: number; indentParagraphs: boolean; firstLineIndentCm: number; pageSize: "a4" | "letter";
  chapterPageBreak: boolean; sceneSeparator: string;
}
export interface GeneratedExport { format: ExportFormat; filename: string; mimeType: string; bytes: Uint8Array; warnings: CompileWarning[]; }
export interface ExportValidationResult { valid: boolean; errors: string[]; }
export interface ManuscriptExportContext { session: PreparedCompileSession; document: SemanticDocument; options: ExportFormattingOptions; filename: string; }
export interface ManuscriptExporter { readonly format: ExportFormat; generate(context: ManuscriptExportContext): Promise<GeneratedExport>; }
export interface ExportValidator { validate(bytes: Uint8Array, context?: ManuscriptExportContext): ExportValidationResult; }
