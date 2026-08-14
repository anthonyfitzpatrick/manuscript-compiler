/** Lightweight event-fed invalidation state; it never scans, reconciles, or persists. */
import type { SavedCompilation } from "./saved-compilations";

/** Tracks only potentially affected IDs so vault callbacks remain bounded and cheap. */
export class SavedCompilationStalenessTracker {
  private readonly stale = new Set<string>();
  constructor(private readonly entries: () => SavedCompilation[]) {}
  markPathChanged(path: string): void { for (const entry of this.entries()) if (within(path, entry.root.path)) this.stale.add(entry.id); }
  markRename(path: string, oldPath: string): void { this.markPathChanged(path); this.markPathChanged(oldPath); }
  isPotentiallyStale(id: string): boolean { return this.stale.has(id); }
  clear(id: string): void { this.stale.delete(id); }
}
function within(path: string, root: string): boolean { return path === root || path.startsWith(root + "/"); }
