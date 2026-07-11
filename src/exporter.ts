import { normalizePath, TFile, Vault } from "obsidian";
import { TemplateEngine, type TemplateVariables } from "./template-engine";

export interface ExportResult { path: string; file: TFile; }
export interface Exporter { readonly format: string; getOutputPath(folder: string, filenameTemplate: string, variables: TemplateVariables): string; exists(path: string): boolean; export(path: string, content: string): Promise<ExportResult>; }
export class MarkdownExporter implements Exporter {
  readonly format = "markdown"; private readonly templates = new TemplateEngine();
  constructor(private readonly vault: Vault) {}
  getOutputPath(exportFolder: string, filenameTemplate: string, variables: TemplateVariables): string {
    const folder = normalizePath(exportFolder.trim().replace(/^\/+|\/+$/g, ""));
    const rendered = this.templates.render(filenameTemplate, variables) || "Manuscript.md";
    const safeName = rendered.replace(/[\\/:*?"<>|]/g, "-").trim(); const filename = safeName.toLowerCase().endsWith(".md") ? safeName : `${safeName}.md`;
    return normalizePath(folder ? `${folder}/${filename}` : filename);
  }
  exists(path: string): boolean { return this.vault.getAbstractFileByPath(path) instanceof TFile; }
  async export(path: string, content: string): Promise<ExportResult> {
    const slash = path.lastIndexOf("/"); if (slash >= 0) await this.ensureFolder(path.slice(0, slash));
    const existing = this.vault.getAbstractFileByPath(path); let file: TFile;
    if (existing instanceof TFile) { await this.vault.modify(existing, content); file = existing; } else file = await this.vault.create(path, content);
    return { path: file.path, file };
  }
  async write(path: string, markdown: string): Promise<TFile> { return (await this.export(path, markdown)).file; }
  private async ensureFolder(path: string): Promise<void> { const parts = normalizePath(path).split("/"); for (let index = 1; index <= parts.length; index += 1) { const current = parts.slice(0, index).join("/"); if (!this.vault.getAbstractFileByPath(current)) await this.vault.createFolder(current); } }
}
