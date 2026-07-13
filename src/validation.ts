import { TFolder, Vault } from "obsidian";
import type { PreparedCompileSession, PreparedExclusion } from "./compile-preparation";
import type { Book, CompileWarning, ManuscriptStatistics } from "./model";
import { validateProfile } from "./profiles";
import type { ManuscriptCompilerSettings } from "./settings";

export interface ValidationResult { book: Book; statistics: ManuscriptStatistics & { partCount: number }; exclusions: PreparedExclusion[]; issues: CompileWarning[]; docxEngine: "built-in"; durationMs: number; }
export class ManuscriptValidationService {
  constructor(private readonly vault: Vault, private readonly settings: ManuscriptCompilerSettings) {}
  async validate(session: PreparedCompileSession): Promise<ValidationResult> {
    const started = performance.now(); const { book, profile } = session; const issues = [...session.warnings];
    const profileValidation = validateProfile(profile); profileValidation.errors.forEach((message) => issues.push({ severity: "error", code: "invalid-profile", message }));
    const outputFolder = this.vault.getAbstractFileByPath(profile.exportFolder); if (!outputFolder) issues.push({ severity: "information", code: "missing-output-folder", message: `Output folder does not exist yet: ${profile.exportFolder}`, suggestion: "It will be created automatically on the first export." }); else if (!(outputFolder instanceof TFolder)) issues.push({ severity: "error", code: "invalid-output-folder", message: `Export folder points to a file: ${profile.exportFolder}`, suggestion: "Choose a folder path that is outside the manuscript root." });
    this.settings.configurationWarnings.forEach((message) => issues.push({ severity: "warning", code: "repaired-setting", message }));
    return { book, statistics: { ...session.statistics, partCount: book.parts.length }, exclusions: session.exclusions, issues: this.deduplicate(issues), docxEngine: "built-in", durationMs: performance.now() - started };
  }
  private deduplicate(issues: CompileWarning[]): CompileWarning[] { const seen = new Set<string>(); return issues.filter((issue) => { const key = `${issue.severity}|${issue.code}|${issue.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
}
