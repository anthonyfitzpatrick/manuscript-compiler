/**
 * Manuscript Compiler — format-specific exporters.
 *
 * MarkdownExporter writes prepared Markdown through vault APIs. DocxExporter
 * generates semantic DOCX bytes and delegates destination mutation to
 * SafeBinaryWriter. Called only by ExportCoordinator. Exporters never scan,
 * build Books, update history, or open result UI.
 */
import { FileSystemAdapter, normalizePath, TFile, Vault } from "obsidian";
import type { Book } from "./model";
import { createManuscriptDocx } from "./docx";
import { nodeFs, pathExists } from "./filesystem";
import type { CompileProfile } from "./settings";
import { TemplateEngine, type TemplateVariables } from "./template-engine";
import { validateDocxBytes } from "./docx-validator";
import { SafeBinaryWriter, type SafeSaveStage } from "./safe-binary-writer";
import { validateVaultPath } from "./output-path";

export type ExportProgressStage = "Creating DOCX" | "Checking DOCX" | SafeSaveStage;
/**
 * Immutable-in-practice exporter input built from PreparedCompileSession. `book`
 * must be retained by identity; exporters may read it but must not mutate it.
 */
export interface ExportRequest { book: Book; profile: CompileProfile; markdown: string; outputPath: string; variables: TemplateVariables; keepTemporaryMarkdown?: boolean; signal?: AbortSignal; onProgress?: (stage: ExportProgressStage) => void; onCommit?: () => void; }
/** Verified per-format outcome consumed by ExportCoordinator. */
export interface ExportResult { format: string; path: string; file?: TFile; stdout?: string; stderr?: string; }
/** Format adapter contract; implementations perform output only, never orchestration. */
export interface Exporter { readonly format: string; export(request: ExportRequest): Promise<ExportResult>; }

/** Vault-API Markdown writer used for final output and diagnostic reports. */
export class MarkdownExporter implements Exporter {
  readonly format = "markdown"; private readonly templates = new TemplateEngine();
  constructor(private readonly vault: Vault) {}
  getOutputPath(exportFolder: string, filenameTemplate: string, variables: TemplateVariables, extension = ".md"): string {
    const folder = validateVaultPath(exportFolder); const rendered = this.templates.render(filenameTemplate, variables) || `Manuscript${extension}`;
    const withoutKnownExtension = rendered.replace(/\.(?:md|docx)$/i, ""); const safeName = withoutKnownExtension.replace(/[\\/:*?"<>|]/g, "-").trim() || "Manuscript";
    return normalizePath(folder ? `${folder}/${safeName}${extension}` : `${safeName}${extension}`);
  }
  async export(request: ExportRequest): Promise<ExportResult> { const file = await this.write(request.outputPath, request.markdown); return { format: this.format, path: request.outputPath, file }; }
  async write(path: string, markdown: string): Promise<TFile | undefined> { const safePath = validateVaultPath(path); const slash = safePath.lastIndexOf("/"); if (slash >= 0) await this.ensureFolder(safePath.slice(0, slash)); const existing = this.vault.getAbstractFileByPath(safePath); if (this.vault.adapter instanceof FileSystemAdapter) { const absolute = this.vault.adapter.getFullPath(safePath); await atomicWriteText(absolute, markdown); return this.vault.getAbstractFileByPath(safePath) instanceof TFile ? this.vault.getAbstractFileByPath(safePath) as TFile : undefined; } if (existing instanceof TFile) { await this.vault.modify(existing, markdown); return existing; } return this.vault.create(safePath, markdown); }
  async ensureFolder(path: string): Promise<void> { const parts = normalizePath(path).split("/"); for (let index = 1; index <= parts.length; index += 1) { const current = parts.slice(0, index).join("/"); if (!this.vault.getAbstractFileByPath(current)) await this.vault.createFolder(current); } }
}

/** Semantic DOCX generator whose only save path is SafeBinaryWriter. */
export class DocxExporter implements Exporter {
  readonly format = "docx";
  constructor(private readonly vault: Vault, private readonly markdownExporter: MarkdownExporter, private readonly binaryWriter = new SafeBinaryWriter(vault)) {}
  async export(request: ExportRequest): Promise<ExportResult> {
    if (request.signal?.aborted) throw new Error("Compilation cancelled.");
    request.onProgress?.("Creating DOCX");
    const bytes = createManuscriptDocx(request.book, request.profile, { title: String(request.variables.BookTitle ?? request.book.title), author: String(request.variables.Author ?? ""), tableOfContents: request.profile.generateTableOfContents, font: request.profile.docxFont, fontSize: request.profile.docxFontSize, lineSpacing: request.profile.docxLineSpacing, firstLineIndentCm: request.profile.docxFirstLineIndentCm, pageSize: request.profile.docxPageSize, chapterPageBreak: request.profile.docxChapterPageBreak, titlePage: request.profile.docxTitlePage, sceneSeparator: request.profile.sceneSeparator, partDisplay: request.profile.partDisplay, chapterDisplay: request.profile.chapterDisplay });
    request.onProgress?.("Checking DOCX"); const validation = validateDocxBytes(bytes); if (!validation.valid) throw new Error(`The generated DOCX could not be validated and was not saved. ${validation.errors.join(" ")}`);
    if (request.signal?.aborted) throw new Error("Compilation cancelled."); const slash = request.outputPath.lastIndexOf("/"); if (slash >= 0) await this.markdownExporter.ensureFolder(request.outputPath.slice(0, slash));
    const cleanup = await this.binaryWriter.cleanupStaleArtifacts(slash < 0 ? "" : request.outputPath.slice(0, slash)); if (cleanup.removed.length) console.info(`Manuscript Compiler removed ${cleanup.removed.length} stale temporary file(s) before saving.`); if (cleanup.preservedBackups.length) console.warn(`Manuscript Compiler preserved ${cleanup.preservedBackups.length} recovery backup file(s) for manual review.`);
    await this.binaryWriter.writeValidated(request.outputPath, bytes, { signal: request.signal, onProgress: request.onProgress, onCommit: request.onCommit }); const file = this.vault.getAbstractFileByPath(request.outputPath);
    if (request.keepTemporaryMarkdown) await this.markdownExporter.write(request.outputPath.replace(/\.docx$/i, ".md"), request.markdown);
    return { format: this.format, path: request.outputPath, file: file instanceof TFile ? file : undefined };
  }
}

async function atomicReplace(source: string, destination: string): Promise<void> { const { fs } = nodeFs(); const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`; const staged = `${destination}.manuscript-compiler-${suffix}.tmp`; const backup = `${destination}.manuscript-compiler-${suffix}.backup`; let backedUp = false; try { await fs.copyFile(source, staged); if (await pathExists(destination)) { await fs.rename(destination, backup); backedUp = true; } await fs.rename(staged, destination); if (backedUp) await fs.rm(backup, { force: true }).catch(() => undefined); } catch (error) { await fs.rm(staged, { force: true }); if (backedUp && !await pathExists(destination)) await fs.rename(backup, destination); throw error; } }
async function atomicWriteText(destination: string, content: string): Promise<void> { const { fs } = nodeFs(); const source = `${destination}.manuscript-compiler-source-${Date.now()}.tmp`; try { await fs.writeFile(source, content, "utf8"); await atomicReplace(source, destination); } finally { await fs.rm(source, { force: true }); } }
export { validateVaultPath } from "./output-path";
