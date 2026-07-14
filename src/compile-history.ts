/**
 * Manuscript Compiler — export history and diagnostic-log persistence.
 *
 * Centralises bounded history repair and outcome recording. ExportCoordinator
 * calls it only after a truthful terminal state. Exporters never mutate settings
 * directly, and records contain no manuscript prose.
 */
import type { CompileResult } from "./model";
import { redactTechnicalMessage } from "./diagnostics";
import { profileId } from "./profiles";
import { repairCompileLogs, repairExportHistory } from "./history-storage";
import type { CompileLogEntry, ExportHistoryEntry, ExportTarget, ManuscriptCompilerSettings } from "./settings";

/** Ephemeral terminal-operation data converted to persisted history/log entries. */
export interface HistoryRecord {
  timestamp: Date;
  started: number;
  profile: string;
  manuscript: string;
  format: ExportTarget;
  outputFiles: string[];
  result?: CompileResult;
  message?: string;
  generationSucceeded?: boolean; validationPassed?: boolean; downloadStarted?: boolean;
  timings?: Partial<Pick<CompileLogEntry, "scanDurationMs" | "parseDurationMs" | "filterDurationMs" | "generationDurationMs" | "exportDurationMs">>;
}

/** Settings-backed application service; every mutation persists through its callback. */
export class CompileHistoryService {
  constructor(private readonly settings: () => ManuscriptCompilerSettings, private readonly save: () => Promise<void>, private readonly compilerVersion: string) {}

  /** Persists success only after the coordinator has verified every final output. */
  async recordSuccess(record: HistoryRecord): Promise<void> { await this.record(record, true, false); }
  /** Records a terminal failure without presenting partial outputs as successful. */
  async recordFailure(record: HistoryRecord): Promise<void> { await this.record(record, false, false); }
  /** Records user cancellation distinctly from a compiler or storage failure. */
  async recordCancellation(record: HistoryRecord): Promise<void> { await this.record({ ...record, message: record.message ?? "Cancelled" }, false, true); }
  /** Clears both bounded stores as one persisted settings mutation. */
  async clearHistory(): Promise<void> { const settings = this.settings(); settings.exportHistory = []; settings.compileLogs = []; await this.save(); }
  /** Returns repaired copies suitable for UI rendering; malformed old entries are discarded. */
  getHistory(): ExportHistoryEntry[] { return repairExportHistory(this.settings().exportHistory); }
  /** Returns structural diagnostics only; compile logs must never contain manuscript prose. */
  getLogs(): CompileLogEntry[] { return repairCompileLogs(this.settings().compileLogs); }

  private async record(record: HistoryRecord, success: boolean, cancelled: boolean): Promise<void> {
    const settings = this.settings();
    const base: ExportHistoryEntry = {
      id: profileId(), timestamp: record.timestamp.toISOString(), profile: record.profile, manuscript: record.manuscript,
      format: record.format, outputFiles: [...record.outputFiles], wordCount: record.result?.wordCount ?? 0, success,
      cancelled: cancelled || undefined, message: success ? undefined : cancelled ? "Cancelled" : redactDiagnostic(record.message),
      generationSucceeded: record.generationSucceeded, validationPassed: record.validationPassed, downloadStarted: record.downloadStarted
    };
    settings.exportHistory = [base, ...repairExportHistory(settings.exportHistory)].slice(0, Math.max(1, settings.maximumExportHistoryEntries));
    if (settings.enableCompileLogs) {
      const timings = { scanDurationMs: 0, parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0, exportDurationMs: 0, ...record.timings };
      const log: CompileLogEntry = { ...base, exportFormats: record.format, compilerVersion: this.compilerVersion, durationMs: Date.now() - record.started, ...timings, warnings: warningSummary(record.result), diagnostics: redactDiagnostic(record.message) };
      settings.compileLogs = [log, ...this.getLogs()].slice(0, Math.max(1, settings.maximumExportHistoryEntries));
    }
    await this.save();
  }
}

function warningSummary(result?: CompileResult): string[] {
  const counts = new Map<string, number>();
  for (const issue of result?.issues ?? []) if (issue.severity !== "information") counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, count]) => `${count} × ${code}`);
}

function redactDiagnostic(message?: string): string | undefined {
  if (!message) return;
  return redactTechnicalMessage(message);
}
