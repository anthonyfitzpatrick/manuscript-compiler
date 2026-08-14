import type { SavedCompilationExportFreshness } from "./saved-compilation-orchestrator";

export interface SavedCompilationStatusInput { saved: boolean; dirty: boolean; potentiallyStale: boolean; freshness?: SavedCompilationExportFreshness; }
export interface SavedCompilationStatusViewModel { text?: string; tone: "quiet" | "attention"; }

/** Presentation-only projection: dirty intent takes priority over export facts. */
export function savedCompilationStatus(input: SavedCompilationStatusInput): SavedCompilationStatusViewModel {
  if (!input.saved) return { tone: "quiet" };
  if (input.dirty) return { text: "Export not current", tone: "attention" };
  if (input.potentiallyStale) return { text: "Manuscript changed", tone: "attention" };
  if (input.freshness === "NEVER_EXPORTED") return { text: "Not exported yet", tone: "quiet" };
  if (input.freshness === "CURRENT") return { text: "Export up to date", tone: "quiet" };
  if (input.freshness === "OUT_OF_DATE") return { text: "Export out of date", tone: "attention" };
  if (input.freshness === "UNKNOWN") return { text: "Export status unknown", tone: "attention" };
  return { tone: "quiet" };
}
