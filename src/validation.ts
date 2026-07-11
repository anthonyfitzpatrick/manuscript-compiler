import { FileSystemAdapter, Vault } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { MarkdownExporter } from "./exporter";
import type { Book, CompileWarning } from "./model";
import { PandocService, pathExists, resolveVaultOrAbsolutePath, type PandocStatus } from "./pandoc";
import { validateProfile } from "./profiles";
import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";
import type { ScannedBook } from "./types";
import { WarningEngine } from "./warnings";

export interface ValidationResult { book: Book; issues: CompileWarning[]; pandoc: PandocStatus; durationMs: number; }
export class ManuscriptValidationService {
  constructor(private readonly vault: Vault, private readonly settings: ManuscriptCompilerSettings) {}
  async validate(scan: ScannedBook, profile: CompileProfile): Promise<ValidationResult> {
    const started = performance.now(); const compiler = new ManuscriptCompiler(this.vault); const book = await compiler.buildModel(scan, profile);
    const exporter = new MarkdownExporter(this.vault); const outputPath = exporter.getOutputPath(profile.exportFolder, profile.outputFilename, { BookTitle: profile.variables.BookTitle || book.title }, profile.exportTarget === "docx" ? ".docx" : ".md");
    const issues = new WarningEngine().analyze(book, profile, outputPath); const profileValidation = validateProfile(profile); profileValidation.errors.forEach((message) => issues.push({ severity: "error", code: "invalid-profile", message }));
    let pandoc: PandocStatus = { available: false, explanation: "Not required for Markdown validation." };
    if (profile.exportTarget !== "markdown") {
      pandoc = await new PandocService(this.settings).detect(); if (!pandoc.available) issues.push({ severity: "error", code: "pandoc-missing", message: pandoc.explanation ?? "Pandoc is unavailable." });
      await this.validateFile(profile.referenceDocx, "Reference DOCX", issues); await this.validateFile(profile.pandocMetadataFile, "Pandoc metadata file", issues);
      if (!(this.vault.adapter instanceof FileSystemAdapter)) issues.push({ severity: "error", code: "filesystem-required", message: "DOCX export requires a local filesystem vault." });
    }
    this.settings.configurationWarnings.forEach((message) => issues.push({ severity: "warning", code: "repaired-setting", message }));
    return { book, issues: this.deduplicate(issues), pandoc, durationMs: performance.now() - started };
  }
  private async validateFile(value: string, label: string, issues: CompileWarning[]): Promise<void> { if (!value) return; try { if (!await pathExists(resolveVaultOrAbsolutePath(this.vault, value))) issues.push({ severity: "error", code: "missing-export-input", message: `${label} is missing: ${value}` }); } catch (error) { issues.push({ severity: "error", code: "invalid-export-path", message: `${label} path is invalid: ${error instanceof Error ? error.message : String(error)}` }); } }
  private deduplicate(issues: CompileWarning[]): CompileWarning[] { const seen = new Set<string>(); return issues.filter((issue) => { const key = `${issue.severity}|${issue.code}|${issue.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
}
