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
    const warningCount = settings.compileLogs.reduce((total, log) => total + (Array.isArray(log.warnings) ? log.warnings.length : 0), 0);
    const lines = ["# Manuscript Compiler Diagnostics", "", `Generated: ${(context.generatedAt ?? new Date()).toISOString()}`, "", "## Environment", "", `- Plugin version: ${context.pluginVersion}`, `- Obsidian version: ${context.obsidianVersion}`, `- Operating system: ${redactEnvironment(context.operatingSystem)}`, "- Export engines: Built in", "", "## Active compile profile", "", "- Name: Configured (name redacted)", `- Manuscript root: ${profile.manuscriptRoot ? "Configured (path redacted)" : "Not configured"}`, `- Default download format: ${settings.defaultDownloadFormat}`, `- Chapter source: ${profile.chapterSource}`, `- Uses Parts: ${profile.useParts}`, `- Front matter: ${profile.includeFrontMatter}`, `- Back matter: ${profile.includeBackMatter}`, `- Ordering: ${profile.orderingMethod}`, `- Metadata filters: ${profile.metadataFilters.length} (values redacted)`, "", "## Settings summary", "", `- Profiles: ${settings.profiles.length}`, `- Preview enabled: ${settings.showPreview}`, `- Compile logs enabled: ${settings.enableCompileLogs}`, `- History limit: ${settings.maximumExportHistoryEntries}`, `- Configuration repairs: ${settings.configurationWarnings.length}`, "", "## Latest compile timings", ""];
    if (lastLog) lines.push(`- Total: ${lastLog.durationMs} ms`, `- Scan: ${lastLog.scanDurationMs ?? 0} ms`, `- Parse: ${lastLog.parseDurationMs ?? 0} ms`, `- Filter: ${lastLog.filterDurationMs ?? 0} ms`, `- Generation: ${lastLog.generationDurationMs ?? 0} ms`, `- Export: ${lastLog.exportDurationMs ?? 0} ms`); else lines.push("No compile logs recorded.");
    lines.push("", "## Warning summary", ""); if (!warningCount) lines.push("No logged warnings."); else lines.push(`- Logged warning summaries: ${warningCount} (details omitted for privacy)`);
    lines.push("", "## Export history summary", "", `- Entries: ${settings.exportHistory.length}`, `- Successful: ${historySuccesses}`, `- Failed or partial: ${settings.exportHistory.length - historySuccesses}`, "", "> This report intentionally excludes manuscript contents and note text.", ""); return lines.join("\n");
  }
}
function redactEnvironment(value: string): string { return value.replace(/\([^)]*\)/g, "(details redacted)").replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s;]+/g, "<path redacted>"); }

/** Redacts technical errors before they enter user notices, console output, or persisted logs. */
export function redactTechnicalMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message.split(/\r?\n/)[0]
    .replace(/\b[A-Za-z]:[\\/][^\s"'“”<>]*/g, "<path redacted>")
    .replace(/(^|[\s("'“])\/(?:[^/\s"'“”<>]+\/)*[^/\s"'“”<>]*/g, (_match, prefix: string) => `${prefix}<path redacted>`)
    .slice(0, 500);
}
