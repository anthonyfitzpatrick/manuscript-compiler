/**
 * Settings-backed lifecycle service for Saved Compilations. It owns normalized
 * in-memory recipes and serializes persistence; it never reads the vault,
 * starts preparation, or exposes mutable persistence objects.
 */
import {
  MAX_SAVED_COMPILATIONS,
  normaliseSavedCompilationRootPath,
  repairSavedCompilation,
  repairSavedCompilationsStorage,
  savedCompilationId,
  savedCompilationRecipeSignature,
  serialiseSavedCompilations,
  type SavedCompilation,
  type SavedCompilationExportFacts,
  type SavedCompilationObservedSource,
  type SavedCompilationOutputConfiguration,
  type SavedCompilationRecipe,
  type SavedCompilationRootReference,
  type SavedCompilationsStorage
} from "./saved-compilations";
import type { ManuscriptCompilerSettings } from "./settings";

export type SavedCompilationOperation =
  | { status: "ok"; compilation: SavedCompilation }
  | { status: "not-found" }
  | { status: "invalid"; reason: "name" | "root" | "recipe" | "export-facts" }
  | { status: "capacity" }
  | { status: "recipe-mismatch" }
  | { status: "unavailable" }
  | { status: "persistence-failed" };

export interface SavedCompilationCreateInput {
  name: string;
  description?: string;
  root: SavedCompilationRootReference;
  recipe: SavedCompilationRecipe;
  output: SavedCompilationOutputConfiguration;
  observedSource?: SavedCompilationObservedSource;
}
export interface SavedCompilationSaveChangesInput {
  /** Explicit reassociation is persisted only through a Save Changes operation. */
  root?: SavedCompilationRootReference;
  recipe: SavedCompilationRecipe;
  output: SavedCompilationOutputConfiguration;
  observedSource?: SavedCompilationObservedSource;
}
export interface SavedCompilationDiagnosticsSummary { available: boolean; count: number; repaired: number; dropped: number; unpersisted: boolean; }

type Persist = () => Promise<void>;
type Clock = () => number;
type Identifier = () => string;

/**
 * The sole runtime owner of Saved Compilation persistence. Mutations replace a
 * normalized snapshot then join an ordered save chain. A failed save leaves the
 * latest state available (and marked unpersisted), so a later successful save
 * can recover it without rolling back newer concurrent mutations.
 */
export class SavedCompilationService {
  private storage: SavedCompilationsStorage = { schemaVersion: 1, entries: [] };
  private available = true;
  private repaired = 0;
  private dropped = 0;
  private unpersisted = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly settings: () => ManuscriptCompilerSettings, private readonly saveSettings: Persist, private readonly clock: Clock = Date.now, private readonly createId: Identifier = savedCompilationId) {}

  /** Initializes from repaired settings without scanning a manuscript or touching storage. */
  initialize(): void {
    const repaired = repairSavedCompilationsStorage(this.settings().savedCompilations);
    this.available = !repaired.unsupportedSchema;
    this.repaired = repaired.repaired;
    this.dropped = repaired.dropped;
    if (this.available) {
      this.storage = serialiseSavedCompilations(repaired.storage);
      this.settings().savedCompilations = this.storage;
    }
  }

  listAll(): SavedCompilation[] { return this.list(this.storage.entries); }
  listForRoot(rootPath: string): SavedCompilation[] {
    const root = normaliseSavedCompilationRootPath(rootPath);
    return root ? this.list(this.storage.entries.filter((entry) => entry.root.path === root)) : [];
  }
  getById(id: string): SavedCompilation | undefined { return this.copy(this.storage.entries.find((entry) => entry.id === id)); }
  getDiagnosticsSummary(): SavedCompilationDiagnosticsSummary { return { available: this.available, count: this.available ? this.storage.entries.length : 0, repaired: this.repaired, dropped: this.dropped, unpersisted: this.unpersisted }; }

  /** Explicit first-save creation; exports never call this implicitly. */
  async create(input: SavedCompilationCreateInput): Promise<SavedCompilationOperation> {
    if (!this.available) return { status: "unavailable" };
    if (this.storage.entries.length >= MAX_SAVED_COMPILATIONS) return { status: "capacity" };
    const candidate = this.candidate(input, this.uniqueId(), this.clock());
    if (!candidate) return this.invalidInput(input);
    return this.commit([...this.storage.entries, candidate], candidate);
  }

  /** Future Save Changes replaces only recipe/output/current observed evidence. */
  async saveChanges(id: string, input: SavedCompilationSaveChangesInput): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    const { root, ...changes } = input;
    const candidate = this.candidate({ name: existing.name, description: existing.description, root: root ?? existing.root, ...changes }, existing.id, existing.createdAt, existing.lastOpenedAt, existing.lastSuccessfulExport);
    if (!candidate) return { status: "invalid", reason: "recipe" };
    return this.replace(existing.id, candidate);
  }

  async rename(id: string, name: string): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    const candidate = this.candidate({ name, description: existing.description, root: existing.root, recipe: existing.recipe, output: existing.output, observedSource: existing.observedSource }, existing.id, existing.createdAt, existing.lastOpenedAt, existing.lastSuccessfulExport);
    if (!candidate) return { status: "invalid", reason: "name" };
    return this.replace(id, candidate);
  }

  /** Save As and Duplicate share the same primitive: a fresh identity and no export fact. */
  async duplicate(id: string, name: string): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    if (this.storage.entries.length >= MAX_SAVED_COMPILATIONS) return { status: "capacity" };
    const candidate = this.candidate({ name, description: existing.description, root: existing.root, recipe: existing.recipe, output: existing.output, observedSource: existing.observedSource }, this.uniqueId(), this.clock());
    if (!candidate) return { status: "invalid", reason: "name" };
    return this.commit([...this.storage.entries, candidate], candidate);
  }
  async saveAs(id: string, name: string): Promise<SavedCompilationOperation> { return this.duplicate(id, name); }

  /** Deletion is persistence-only: it never has vault, profile, history, or download side effects. */
  async delete(id: string): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    return this.commit(this.storage.entries.filter((entry) => entry.id !== id), existing);
  }

  async reassociateRoot(id: string, rootPath: string): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    const root = normaliseSavedCompilationRootPath(rootPath); if (!root) return { status: "invalid", reason: "root" };
    const candidate = this.candidate({ name: existing.name, description: existing.description, root: { path: root }, recipe: existing.recipe, output: existing.output, observedSource: existing.observedSource }, existing.id, existing.createdAt, existing.lastOpenedAt, existing.lastSuccessfulExport);
    return candidate ? this.replace(id, candidate) : { status: "invalid", reason: "root" };
  }

  /** Persists last-opened immediately through the queue; it is a small factual MRU update. */
  async markLastOpened(id: string): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    const candidate = this.candidate({ name: existing.name, description: existing.description, root: existing.root, recipe: existing.recipe, output: existing.output, observedSource: existing.observedSource }, existing.id, existing.createdAt, this.clock(), existing.lastSuccessfulExport);
    return candidate ? this.replace(id, candidate) : { status: "invalid", reason: "recipe" };
  }

  async updateObservedSource(id: string, observedSource: SavedCompilationObservedSource): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    const candidate = this.candidate({ name: existing.name, description: existing.description, root: existing.root, recipe: existing.recipe, output: existing.output, observedSource }, existing.id, existing.createdAt, existing.lastOpenedAt, existing.lastSuccessfulExport);
    return candidate ? this.replace(id, candidate) : { status: "invalid", reason: "recipe" };
  }

  /** Records export facts only when the persisted recipe signature exactly matches the exported recipe. */
  async recordSuccessfulExport(id: string, facts: SavedCompilationExportFacts): Promise<SavedCompilationOperation> {
    const existing = this.find(id); if (!existing) return this.notFoundOrUnavailable();
    if (facts.recipeSignature !== savedCompilationRecipeSignature(existing)) return { status: "recipe-mismatch" };
    const candidate = this.candidate({ name: existing.name, description: existing.description, root: existing.root, recipe: existing.recipe, output: existing.output, observedSource: existing.observedSource }, existing.id, existing.createdAt, existing.lastOpenedAt, facts);
    return candidate ? this.replace(id, candidate) : { status: "invalid", reason: "export-facts" };
  }

  /** No timers/events are owned. Pending writes are intentionally observable to callers, not abandoned on unload. */
  shutdown(): void {}

  private candidate(input: SavedCompilationCreateInput, id: string, createdAt: number, lastOpenedAt?: number, exportFacts?: SavedCompilationExportFacts): SavedCompilation | undefined {
    const now = this.clock();
    return repairSavedCompilation({ id, name: input.name, description: input.description, createdAt, modifiedAt: now, lastOpenedAt, root: input.root, recipe: input.recipe, output: input.output, observedSource: input.observedSource ?? { references: [] }, lastSuccessfulExport: exportFacts });
  }
  private async replace(id: string, replacement: SavedCompilation): Promise<SavedCompilationOperation> { return this.commit(this.storage.entries.map((entry) => entry.id === id ? replacement : entry), replacement); }
  private async commit(entries: SavedCompilation[], result: SavedCompilation): Promise<SavedCompilationOperation> {
    if (!this.available) return { status: "unavailable" };
    this.storage = serialiseSavedCompilations({ schemaVersion: 1, entries });
    this.settings().savedCompilations = this.storage;
    const persisted = await this.enqueuePersist();
    return persisted ? { status: "ok", compilation: this.copy(result)! } : { status: "persistence-failed" };
  }
  /** Serializes full-settings writes so an earlier save cannot overwrite a later recipe mutation. */
  private async enqueuePersist(): Promise<boolean> {
    const next = this.writeChain.catch(() => undefined).then(() => this.saveSettings());
    this.writeChain = next;
    try { await next; this.unpersisted = false; return true; } catch { this.unpersisted = true; return false; }
  }
  private find(id: string): SavedCompilation | undefined { return this.available ? this.storage.entries.find((entry) => entry.id === id) : undefined; }
  private uniqueId(): string {
    const base = this.createId(); let candidate = base; let suffix = 2;
    while (this.storage.entries.some((entry) => entry.id === candidate)) { candidate = base + "-" + suffix; suffix += 1; }
    return candidate;
  }
  private notFoundOrUnavailable(): SavedCompilationOperation { return this.available ? { status: "not-found" } : { status: "unavailable" }; }
  private invalidInput(input: SavedCompilationCreateInput): SavedCompilationOperation { return { status: "invalid", reason: !normaliseSavedCompilationRootPath(input.root.path) ? "root" : "name" }; }
  private list(entries: readonly SavedCompilation[]): SavedCompilation[] { return entries.slice().sort(compare).map((entry) => this.copy(entry)!); }
  private copy(entry: SavedCompilation | undefined): SavedCompilation | undefined { return entry ? repairSavedCompilation(entry) : undefined; }
}

function compare(left: SavedCompilation, right: SavedCompilation): number {
  const opened = (right.lastOpenedAt ?? -1) - (left.lastOpenedAt ?? -1); if (opened) return opened;
  const modified = right.modifiedAt - left.modifiedAt; if (modified) return modified;
  return left.name < right.name ? -1 : left.name > right.name ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
