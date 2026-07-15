/** Repairs untrusted persisted history without retaining malformed entries. */
import type { CompileLogEntry, ExportHistoryEntry } from "./settings";
import { redactTechnicalMessage } from "./diagnostics";

export function repairExportHistory(entries: unknown): ExportHistoryEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(isHistoryCandidate)
    .map((item, index) => historyEntry(item, index));
}

export function repairCompileLogs(entries: unknown): CompileLogEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter(isHistoryCandidate)
    .map((item, index) => {
      const base = historyEntry(item, index);
      return {
        ...base,
        exportFormats: isExportTarget(item.exportFormats) ? item.exportFormats : "docx",
        compilerVersion: safeText(item.compilerVersion, "Unknown", 50),
        pandocVersion: typeof item.pandocVersion === "string" ? safeText(item.pandocVersion, "", 50) : undefined,
        durationMs: safeNumber(item.durationMs),
        scanDurationMs: safeNumber(item.scanDurationMs),
        parseDurationMs: safeNumber(item.parseDurationMs),
        filterDurationMs: safeNumber(item.filterDurationMs),
        generationDurationMs: safeNumber(item.generationDurationMs),
        exportDurationMs: safeNumber(item.exportDurationMs),
        warnings: stringArray(item.warnings).map((warning) => safeText(warning, "", 100)).filter(Boolean).slice(0, 100),
        diagnostics: typeof item.diagnostics === "string" ? redactTechnicalMessage(item.diagnostics) : undefined
      };
    });
}

type HistoryCandidate = Record<string, unknown> & { timestamp: string; profile: string };
function isHistoryCandidate(item: unknown): item is HistoryCandidate { return !!item && typeof item === "object" && !Array.isArray(item) && typeof (item as HistoryCandidate).timestamp === "string" && typeof (item as HistoryCandidate).profile === "string"; }
function historyEntry(item: HistoryCandidate, index: number): ExportHistoryEntry {
  const timestamp = safeText(item.timestamp, "", 100);
  return {
    id: safeText(item.id, `recovered-history-${index}-${timestamp}`, 200),
    timestamp,
    profile: safeText(item.profile, "Recovered profile", 200),
    manuscript: safeStoredPath(item.manuscript),
    format: isExportTarget(item.format) ? item.format : undefined,
    outputFiles: stringArray(item.outputFiles).map((path) => safeStoredPath(path, false)).filter(Boolean).slice(0, 20),
    wordCount: safeNumber(item.wordCount),
    success: item.success === true,
    cancelled: item.cancelled === true || undefined,
    message: typeof item.message === "string" ? redactTechnicalMessage(item.message) : undefined,
    generationSucceeded: typeof item.generationSucceeded === "boolean" ? item.generationSucceeded : undefined,
    validationPassed: typeof item.validationPassed === "boolean" ? item.validationPassed : undefined,
    downloadStarted: typeof item.downloadStarted === "boolean" ? item.downloadStarted : undefined
  };
}
function isExportTarget(value: unknown): value is CompileLogEntry["exportFormats"] { return typeof value === "string" && ["markdown", "docx", "markdown-docx", "odt", "epub", "html", "xml"].includes(value); }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function safeText(value: unknown, fallback: string, maximum: number): string { return typeof value === "string" ? value.slice(0, maximum) : fallback; }
function safeNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0; }
function safeStoredPath(value: unknown, retainRedaction = true): string {
  if (typeof value !== "string") return "";
  const path = value.trim().slice(0, 500);
  if (/^(?:\/|\\|[A-Za-z]:)/.test(path) || path.split(/[\\/]/).some((segment) => segment === ".." || segment === ".")) return retainRedaction ? "<path redacted>" : "";
  return path;
}
