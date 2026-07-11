import { FileSystemAdapter, normalizePath, TFile, Vault } from "obsidian";
import type { Book } from "./model";
import { nodeFs, PandocError, PandocService, pathExists, resolveVaultOrAbsolutePath, type PandocStatus } from "./pandoc";
import type { CompileProfile } from "./settings";
import { TemplateEngine, type TemplateVariables } from "./template-engine";

export interface ExportRequest { book: Book; profile: CompileProfile; markdown: string; outputPath: string; variables: TemplateVariables; pandoc?: PandocStatus; keepTemporaryMarkdown?: boolean; }
export interface ExportResult { format: string; path: string; file?: TFile; stdout?: string; stderr?: string; }
export interface Exporter { readonly format: string; export(request: ExportRequest): Promise<ExportResult>; }

export class MarkdownExporter implements Exporter {
  readonly format = "markdown"; private readonly templates = new TemplateEngine();
  constructor(private readonly vault: Vault) {}
  getOutputPath(exportFolder: string, filenameTemplate: string, variables: TemplateVariables, extension = ".md"): string {
    const folder = normalizePath(exportFolder.trim().replace(/^\/+|\/+$/g, "")); const rendered = this.templates.render(filenameTemplate, variables) || `Manuscript${extension}`;
    const withoutKnownExtension = rendered.replace(/\.(?:md|docx)$/i, ""); const safeName = withoutKnownExtension.replace(/[\\/:*?"<>|]/g, "-").trim() || "Manuscript";
    return normalizePath(folder ? `${folder}/${safeName}${extension}` : `${safeName}${extension}`);
  }
  async export(request: ExportRequest): Promise<ExportResult> { const file = await this.write(request.outputPath, request.markdown); return { format: this.format, path: file.path, file }; }
  async write(path: string, markdown: string): Promise<TFile> { const slash = path.lastIndexOf("/"); if (slash >= 0) await this.ensureFolder(path.slice(0, slash)); const existing = this.vault.getAbstractFileByPath(path); if (existing instanceof TFile) { await this.vault.modify(existing, markdown); return existing; } return this.vault.create(path, markdown); }
  async ensureFolder(path: string): Promise<void> { const parts = normalizePath(path).split("/"); for (let index = 1; index <= parts.length; index += 1) { const current = parts.slice(0, index).join("/"); if (!this.vault.getAbstractFileByPath(current)) await this.vault.createFolder(current); } }
}

export class DocxExporter implements Exporter {
  readonly format = "docx";
  constructor(private readonly vault: Vault, private readonly pandocService: PandocService, private readonly markdownExporter: MarkdownExporter) {}
  async export(request: ExportRequest): Promise<ExportResult> {
    if (!request.pandoc?.available || !request.pandoc.executable) throw new Error(request.pandoc?.explanation ?? "Pandoc is unavailable.");
    if (!(this.vault.adapter instanceof FileSystemAdapter)) throw new Error("DOCX export requires a local filesystem vault.");
    const slash = request.outputPath.lastIndexOf("/"); if (slash >= 0) await this.markdownExporter.ensureFolder(request.outputPath.slice(0, slash));
    const referenceDocx = resolveVaultOrAbsolutePath(this.vault, request.profile.referenceDocx); const metadataFile = resolveVaultOrAbsolutePath(this.vault, request.profile.pandocMetadataFile);
    if (referenceDocx && !await pathExists(referenceDocx)) throw new Error(`Reference DOCX does not exist: ${request.profile.referenceDocx}`);
    if (metadataFile && !await pathExists(metadataFile)) throw new Error(`Pandoc metadata file does not exist: ${request.profile.pandocMetadataFile}`);
    const { fs, os, path } = nodeFs(); const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "manuscript-compiler-")); const temporaryMarkdown = path.join(temporaryDirectory, "manuscript.md");
    const outputAbsolute = this.vault.adapter.getFullPath(request.outputPath); const profile = { ...request.profile, referenceDocx, pandocMetadataFile: metadataFile };
    try {
      await fs.writeFile(temporaryMarkdown, request.markdown, "utf8");
      const result = await this.pandocService.convert(request.pandoc.executable, temporaryMarkdown, outputAbsolute, profile, String(request.variables.BookTitle ?? request.book.title), String(request.variables.Author ?? ""));
      if (!await pathExists(outputAbsolute)) throw new PandocError("Pandoc completed without creating the DOCX output.", result.stdout, result.stderr);
      if (request.keepTemporaryMarkdown) await this.markdownExporter.write(request.outputPath.replace(/\.docx$/i, ".md"), request.markdown);
      return { format: this.format, path: request.outputPath, stdout: result.stdout, stderr: result.stderr };
    } finally { await fs.rm(temporaryDirectory, { recursive: true, force: true }); }
  }
}
