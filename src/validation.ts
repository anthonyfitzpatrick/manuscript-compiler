/**
 * Manuscript Compiler — read-only prepared-manuscript validation.
 *
 * Reports the exact Book, counts, exclusions, and issues that export would use.
 * Called by CompileCommandService. It consumes PreparedCompileSession and never
 * scans, rebuilds the Book, or writes output.
 * It owns report projection, not format-byte validation, UI, delivery, or history.
 * Validation is synchronous over immutable prepared data, deterministic,
 * non-cancellable, and platform-neutral. Findings must remain structural and must
 * not include manuscript prose, absolute paths, or private metadata.
 */
import type { Vault } from "obsidian";
import type { PreparedCompileSession, PreparedExclusion } from "./compile-preparation";
import type { Book, CompileWarning, ManuscriptStatistics } from "./model";
import { validateProfile } from "./profiles";
import type { ManuscriptCompilerSettings } from "./settings";

/** Immutable report view over the prepared Book; ownership remains with the session. */
export interface ValidationResult { book: Book; statistics: ManuscriptStatistics & { partCount: number }; exclusions: PreparedExclusion[]; issues: CompileWarning[]; docxEngine: "built-in"; durationMs: number; }
/** Vault/settings-bound read-only validator over PreparedCompileSession. */
export class ManuscriptValidationService {
  constructor(_vault: Vault, private readonly settings: ManuscriptCompilerSettings) {}
  /** Adds configuration/output-safety issues to session warnings without writing or rebuilding. */
  async validate(session: PreparedCompileSession): Promise<ValidationResult> {
    const started = performance.now(); const { book, profile } = session; const issues = [...session.warnings];
    const profileValidation = validateProfile(profile); profileValidation.errors.forEach((message) => issues.push({ severity: "error", code: "invalid-profile", message }));
    this.settings.configurationWarnings.forEach((message) => issues.push({ severity: "warning", code: "repaired-setting", message }));
    return { book, statistics: { ...session.statistics, partCount: book.parts.length }, exclusions: session.exclusions, issues: this.deduplicate(issues), docxEngine: "built-in", durationMs: performance.now() - started };
  }
  private deduplicate(issues: CompileWarning[]): CompileWarning[] { const seen = new Set<string>(); return issues.filter((issue) => { const key = `${issue.severity}|${issue.code}|${issue.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
}
