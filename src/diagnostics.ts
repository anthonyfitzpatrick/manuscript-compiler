/**
 * Manuscript Compiler — privacy-safe support diagnostics.
 *
 * Produces configuration/platform summaries without reading manuscript notes.
 * Called by CompileCommandService and diagnostics UI. Absolute paths, metadata
 * filter values, and manuscript prose must never enter the report.
 */
import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";

export interface DiagnosticsContext { pluginVersion: string; obsidianVersion: string; operatingSystem: string; profile: CompileProfile; settings: ManuscriptCompilerSettings; generatedAt?: Date; }
/** Stateless redacted report builder; generated output is safe to share for support. */
export class DiagnosticsReportGenerator {
  generate(context: DiagnosticsContext): string {
    const { profile, settings } = context; const lastLog = settings.compileLogs[0]; const historySuccesses = settings.exportHistory.filter((entry) => entry.success).length;
    const warningCounts = new Map<string, number>(); settings.compileLogs.flatMap((log) => log.warnings).forEach((warning) => warningCounts.set(warning, (warningCounts.get(warning) ?? 0) + 1));
    const lines = ["# Manuscript Compiler Diagnostics", "", `Generated: ${(context.generatedAt ?? new Date()).toISOString()}`, "", "## Environment", "", `- Plugin version: ${context.pluginVersion}`, `- Obsidian version: ${context.obsidianVersion}`, `- Operating system: ${redactEnvironment(context.operatingSystem)}`, "- DOCX engine: Built in", "", "## Active compile profile", "", `- Name: ${profile.name}`, `- Manuscript root: ${profile.manuscriptRoot ? "Configured (path redacted)" : "Not configured"}`, `- Export folder: ${profile.exportFolder ? "Configured (path redacted)" : "Vault root"}`, `- Export target: ${profile.exportTarget}`, `- Chapter source: ${profile.chapterSource}`, `- Uses Parts: ${profile.useParts}`, `- Front matter: ${profile.includeFrontMatter}`, `- Back matter: ${profile.includeBackMatter}`, `- Ordering: ${profile.orderingMethod}`, `- Metadata filters: ${profile.metadataFilters.length} (values redacted)`, "", "## Settings summary", "", `- Profiles: ${settings.profiles.length}`, `- Preview enabled: ${settings.showPreview}`, `- Compile logs enabled: ${settings.enableCompileLogs}`, `- History limit: ${settings.maximumExportHistoryEntries}`, `- Configuration repairs: ${settings.configurationWarnings.length}`, "", "## Latest compile timings", ""];
    if (lastLog) lines.push(`- Total: ${lastLog.durationMs} ms`, `- Scan: ${lastLog.scanDurationMs ?? 0} ms`, `- Parse: ${lastLog.parseDurationMs ?? 0} ms`, `- Filter: ${lastLog.filterDurationMs ?? 0} ms`, `- Generation: ${lastLog.generationDurationMs ?? 0} ms`, `- Export: ${lastLog.exportDurationMs ?? 0} ms`); else lines.push("No compile logs recorded.");
    lines.push("", "## Warning summary", ""); if (!warningCounts.size) lines.push("No logged warnings."); else [...warningCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 25).forEach(([warning, count]) => lines.push(`- ${count}× ${redactSensitiveText(warning, profile)}`));
    lines.push("", "## Export history summary", "", `- Entries: ${settings.exportHistory.length}`, `- Successful: ${historySuccesses}`, `- Failed or partial: ${settings.exportHistory.length - historySuccesses}`, "", "> This report intentionally excludes manuscript contents and note text.", ""); return lines.join("\n");
  }
}
function redactEnvironment(value: string): string { return value.replace(/\([^)]*\)/g, "(details redacted)").replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s;]+/g, "<path redacted>"); }
function redactSensitiveText(value: string, profile: CompileProfile): string { let redacted = value; for (const sensitive of [profile.referenceDocx, profile.pandocMetadataFile, profile.manuscriptRoot, profile.exportFolder]) if (sensitive) redacted = redacted.split(sensitive).join("<path redacted>"); return redacted.replace(/(?:[A-Za-z]:\\[^\s]+|\/(?:Users|home|private|tmp)\/[^\s]+)/g, "<path redacted>"); }
