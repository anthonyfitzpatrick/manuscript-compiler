import type { SavedCompilation } from "./saved-compilations";

/** The deliberately small, presentation-safe data needed by the entry chooser. */
export interface SavedCompilationChoiceViewModel {
  id: string;
  name: string;
  format: string;
}

/** Keeps a repeated click from starting a second backend open transition. */
export class SavedCompilationChooserState {
  private opening = false;

  get busy(): boolean { return this.opening; }
  beginOpen(): boolean { if (this.opening) return false; this.opening = true; return true; }
  finishOpen(): void { this.opening = false; }
}

/** Maps service-ordered entries without exposing paths, signatures, or recipes to the UI. */
export function savedCompilationChoices(entries: readonly SavedCompilation[]): SavedCompilationChoiceViewModel[] {
  return entries.map((entry) => ({ id: entry.id, name: entry.name, format: entry.output.format.toUpperCase() }));
}
