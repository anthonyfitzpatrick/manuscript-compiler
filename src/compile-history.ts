import type { CompileResult } from "./model";
import { profileId } from "./profiles";
import type { CompileLogEntry, ExportHistoryEntry, ExportTarget, ManuscriptCompilerSettings } from "./settings";

export interface HistoryRecord {
  timestamp: Date;
  started: number;
  profile: string;
  manuscript: string;
  format: ExportTarget;
  outputFiles: string[];
  result?: CompileResult;
  message?: string;
  timings?: Partial<Pick<CompileLogEntry, "scanDurationMs" | "parseDurationMs" | "filterDurationMs" | "generationDurationMs" | "exportDurationMs">>;
}

export class CompileHistoryService {
  constructor(private readonly settings: () => ManuscriptCompilerSettings, private readonly save: () => Promise<void>, private readonly compilerVersion: string) {}

  async recordSuccess(record: HistoryRecord): Promise<void> { await this.record(record, true, false); }
  async recordFailure(record: HistoryRecord): Promise<void> { await this.record(record, false, false); }
  async recordCancellation(record: HistoryRecord): Promise<void> { await this.record({ ...record, message: record.message ?? "Cancelled" }, false, true); }
  async clearHistory(): Promise<void> { const settings = this.settings(); settings.exportHistory = []; settings.compileLogs = []; await this.save(); }
  getHistory(): ExportHistoryEntry[] { return this.repairHistory(this.settings().exportHistory); }
  getLogs(): CompileLogEntry[] { return this.settings().compileLogs.filter((item) => item && typeof item === "object" && typeof item.timestamp === "string"); }

  private async record(record: HistoryRecord, success: boolean, cancelled: boolean): Promise<void> {
    const settings = this.settings();
    const base: ExportHistoryEntry = {
      id: profileId(), timestamp: record.timestamp.toISOString(), profile: record.profile, manuscript: record.manuscript,
      outputFiles: [...record.outputFiles], wordCount: record.result?.wordCount ?? 0, success,
      cancelled: cancelled || undefined, message: success ? undefined : cancelled ? "Cancelled" : record.message?.split(/\r?\n/)[0]
    };
    settings.exportHistory = [base, ...this.repairHistory(settings.exportHistory)].slice(0, Math.max(1, settings.maximumExportHistoryEntries));
    if (settings.enableCompileLogs) {
      const timings = { scanDurationMs: 0, parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0, exportDurationMs: 0, ...record.timings };
      const log: CompileLogEntry = { ...base, exportFormats: record.format, compilerVersion: this.compilerVersion, pandocVersion: "Built-in DOCX", durationMs: Date.now() - record.started, ...timings, warnings: record.result?.warnings ?? [], diagnostics: record.message };
      settings.compileLogs = [log, ...this.getLogs()].slice(0, Math.max(1, settings.maximumExportHistoryEntries));
    }
    await this.save();
  }

  private repairHistory(entries: unknown): ExportHistoryEntry[] {
    if (!Array.isArray(entries)) return [];
    return entries.filter((item): item is ExportHistoryEntry => !!item && typeof item === "object" && typeof (item as ExportHistoryEntry).timestamp === "string" && typeof (item as ExportHistoryEntry).profile === "string").map((item) => ({ ...item, outputFiles: Array.isArray(item.outputFiles) ? item.outputFiles.filter((path): path is string => typeof path === "string") : [], wordCount: Number.isFinite(item.wordCount) ? item.wordCount : 0, success: item.success === true }));
  }
}
