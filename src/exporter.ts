import { FileSystemAdapter, normalizePath, TFile, Vault } from "obsidian";
import type { Book } from "./model";
import { createDocx } from "./docx";
import { nodeFs, pathExists } from "./filesystem";
import type { CompileProfile } from "./settings";
import { TemplateEngine, type TemplateVariables } from "./template-engine";

export interface ExportRequest { book: Book; profile: CompileProfile; markdown: string; outputPath: string; variables: TemplateVariables; keepTemporaryMarkdown?: boolean; signal?: AbortSignal; onCommit?: () => void; }
export interface ExportResult { format: string; path: string; file?: TFile; stdout?: string; stderr?: string; }
export interface Exporter { readonly format: string; export(request: ExportRequest): Promise<ExportResult>; }

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

export class DocxExporter implements Exporter {
  readonly format = "docx";
  constructor(private readonly vault: Vault, private readonly markdownExporter: MarkdownExporter) {}
  async export(request: ExportRequest): Promise<ExportResult> {
    const slash = request.outputPath.lastIndexOf("/"); if (slash >= 0) await this.markdownExporter.ensureFolder(request.outputPath.slice(0, slash));
    if (request.signal?.aborted) throw new Error("Compilation cancelled.");
    const bytes = createDocx(request.markdown, { title: String(request.variables.BookTitle ?? request.book.title), author: String(request.variables.Author ?? ""), tableOfContents: request.profile.generateTableOfContents });
    request.onCommit?.(); const file = await this.writeBinary(request.outputPath, bytes);
    if (request.keepTemporaryMarkdown) await this.markdownExporter.write(request.outputPath.replace(/\.docx$/i, ".md"), request.markdown);
    return { format: this.format, path: request.outputPath, file };
  }
  private async writeBinary(path: string, bytes: Uint8Array): Promise<TFile | undefined> { const safePath = validateVaultPath(path); const existing = this.vault.getAbstractFileByPath(safePath); const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; if (existing instanceof TFile) { await this.vault.modifyBinary(existing, data); return existing; } return this.vault.createBinary(safePath, data); }
}

async function atomicReplace(source: string, destination: string): Promise<void> { const { fs } = nodeFs(); const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`; const staged = `${destination}.manuscript-compiler-${suffix}.tmp`; const backup = `${destination}.manuscript-compiler-${suffix}.backup`; let backedUp = false; try { await fs.copyFile(source, staged); if (await pathExists(destination)) { await fs.rename(destination, backup); backedUp = true; } await fs.rename(staged, destination); if (backedUp) await fs.rm(backup, { force: true }).catch(() => undefined); } catch (error) { await fs.rm(staged, { force: true }); if (backedUp && !await pathExists(destination)) await fs.rename(backup, destination); throw error; } }
async function atomicWriteText(destination: string, content: string): Promise<void> { const { fs } = nodeFs(); const source = `${destination}.manuscript-compiler-source-${Date.now()}.tmp`; try { await fs.writeFile(source, content, "utf8"); await atomicReplace(source, destination); } finally { await fs.rm(source, { force: true }); } }
export function validateVaultPath(value: string): string { const raw = value.trim(); if (!raw) return ""; if (/^(?:\/|\\|[A-Za-z]:)/.test(raw)) throw new Error("Export paths must be vault-relative, not absolute."); const normalized = normalizePath(raw.replace(/\/+$/g, "")); if (normalized.split("/").some((segment) => segment === ".." || segment === ".")) throw new Error("Export paths may not contain traversal segments."); if (/[\\:*?"<>|]/.test(normalized)) throw new Error("Export path contains characters that are not portable across supported operating systems."); return normalized; }
