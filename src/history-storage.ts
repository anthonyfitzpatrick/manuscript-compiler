/** Repairs untrusted persisted history without retaining malformed entries. */
import type { CompileLogEntry, ExportHistoryEntry } from "./settings";

export function repairExportHistory(entries: unknown): ExportHistoryEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((item): item is ExportHistoryEntry => !!item && typeof item === "object" && typeof (item as ExportHistoryEntry).timestamp === "string" && typeof (item as ExportHistoryEntry).profile === "string")
    .map((item) => ({ ...item, outputFiles: stringArray(item.outputFiles), wordCount: Number.isFinite(item.wordCount) ? item.wordCount : 0, success: item.success === true }));
}

export function repairCompileLogs(entries: unknown): CompileLogEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((item): item is CompileLogEntry => !!item && typeof item === "object" && typeof (item as CompileLogEntry).timestamp === "string" && typeof (item as CompileLogEntry).profile === "string")
    .map((item) => ({ ...item, outputFiles: stringArray(item.outputFiles), warnings: stringArray(item.warnings), diagnostics: typeof item.diagnostics === "string" ? item.diagnostics : undefined }));
}

function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
