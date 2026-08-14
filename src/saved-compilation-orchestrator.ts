/**
 * Coordinates Saved Compilation lifecycle state. It deliberately delegates all
 * durable changes to SavedCompilationService and all bytes to ExportCoordinator.
 */
import type { ExportFormat } from "./export-types";
import type { PreparedCompileSession } from "./compile-preparation";
import { reconcileSavedCompilation } from "./saved-compilation-reconciliation";
import type { SavedCompilationOperation, SavedCompilationService } from "./saved-compilation-service";
import { savedCompilationRequest } from "./saved-compilation-integration";
import { savedCompilationRecipeSignature } from "./saved-compilations";
import { type CanonicalWorkspaceRecipe, SavedCompilationWorkspaceSession } from "./saved-compilation-session";
import type { SavedCompilationStalenessTracker } from "./saved-compilation-staleness";
import { createCompileWorkspaceController } from "./workspace/compile-workspace-factory";
import type { CompileWorkspaceController, CompileWorkspaceServices } from "./workspace/compile-workspace-controller";
import type { ContentPlanItem } from "./content-plan";
import type { DocxFormatting, SimpleCompileRequest } from "./simple-workflow";
import type { SavedCompilation } from "./saved-compilations";

export type SavedCompilationTransition =
  | { status: "ready"; session: SavedCompilationWorkspaceSession }
  | { status: "not-found" }
  | { status: "unsaved-changes" }
  | { status: "unavailable" };
export type SavedCompilationWorkflowResult =
  | { status: "ok"; session: SavedCompilationWorkspaceSession }
  | { status: "not-saved" }
  | { status: "persistence-failed" }
  | { status: "invalid" }
  | { status: "unavailable" };
export type SavedCompilationExportAuthorization =
  | { status: "allowed" }
  | { status: "no-prepared-session" }
  | { status: "stale-prepared-session" }
  | { status: "review-acknowledgement-required" }
  | { status: "review-required" }
  | { status: "blocked-reconciliation" };
export type SavedCompilationExportFreshness = "NEVER_EXPORTED" | "CURRENT" | "OUT_OF_DATE" | "UNSAVED_CONFIGURATION" | "UNKNOWN";
export type SavedCompilationOpenResult =
  | { status: "ready"; controller: CompileWorkspaceController; lastOpened: "updated" | "persistence-failed" }
  | { status: "root-unavailable"; controller: CompileWorkspaceController }
  | { status: "not-found" }
  | { status: "unavailable" }
  | { status: "preparation-failed" };
export interface SavedCompilationOpenDependencies {
  resolveRoot(path: string): boolean;
  prepare(compilation: SavedCompilation, overlay: CanonicalWorkspaceRecipe | undefined): Promise<PreparedCompileSession>;
  workspaceServices: CompileWorkspaceServices;
}
export interface NewWorkspaceTransitionTarget { request: SimpleCompileRequest; formatting: DocxFormatting; contentPlan: ContentPlanItem[]; }
export interface NewWorkspaceTransitionDependencies { prepare(target: NewWorkspaceTransitionTarget): Promise<PreparedCompileSession>; workspaceServices: CompileWorkspaceServices; }
export type ActiveWorkspaceTransitionResult =
  | { status: "ready"; controller: CompileWorkspaceController; lastOpened?: "updated" | "persistence-failed" }
  | { status: "root-unavailable"; controller: CompileWorkspaceController }
  | { status: "unsaved-changes" }
  | { status: "not-found" }
  | { status: "unavailable" }
  | { status: "preparation-failed" }
  | { status: "superseded" };

/** UI-neutral Saved Compilation workflow owner; visible controls remain future work. */
export class SavedCompilationOrchestrator {
  private session = new SavedCompilationWorkspaceSession();
  private activeController?: CompileWorkspaceController;
  private transitionGeneration = 0;
  private exportBookkeepingUnknown = false;

  constructor(private readonly service: SavedCompilationService, private readonly staleness?: SavedCompilationStalenessTracker) {}

  current(): SavedCompilationWorkspaceSession { return this.session; }
  activeWorkspace(): CompileWorkspaceController | undefined { return this.activeController; }
  beginNew(recipe?: CanonicalWorkspaceRecipe): SavedCompilationWorkspaceSession {
    this.session = new SavedCompilationWorkspaceSession();
    if (recipe) this.session.initializeNew(recipe);
    return this.session;
  }

  /** Loads only validated persisted state; preparation remains the caller's one authoritative route. */
  load(id: string, discardUnsavedChanges = false): SavedCompilationTransition {
    if (this.session.dirty && !discardUnsavedChanges) return { status: "unsaved-changes" };
    const compilation = this.service.getById(id);
    if (!compilation) return this.service.getDiagnosticsSummary().available ? { status: "not-found" } : { status: "unavailable" };
    this.session = new SavedCompilationWorkspaceSession(compilation);
    return { status: "ready", session: this.session };
  }

  /** Prepares a candidate before construction; a missing root is a valid blocked Saved workspace. */
  async openSavedCompilation(id: string, dependencies: SavedCompilationOpenDependencies): Promise<SavedCompilationOpenResult> {
    const generation = ++this.transitionGeneration;
    const compilation = this.service.getById(id);
    if (!compilation) return this.service.getDiagnosticsSummary().available ? { status: "not-found" } : { status: "unavailable" };
    const session = new SavedCompilationWorkspaceSession(compilation);
    const request = savedCompilationRequest(compilation);
    if (!dependencies.resolveRoot(compilation.root.path)) {
      session.setReconciliation(reconcileSavedCompilation({ compilation, plan: [] }));
      const controller = createCompileWorkspaceController({ kind: "saved", compilation, session, request, formatting: request.formatting ?? defaultFormatting() }, dependencies.workspaceServices);
      if (generation !== this.transitionGeneration) return { status: "preparation-failed" };
      this.session = session; this.activeController = controller;
      return { status: "root-unavailable", controller };
    }
    try {
      const prepared = await dependencies.prepare(compilation, session.current);
      if (prepared.savedCompilation) session.setReconciliation(prepared.savedCompilation.reconciliation);
      const controller = createCompileWorkspaceController({ kind: "saved", compilation, session, request: prepared.request, formatting: prepared.request.formatting ?? defaultFormatting(), prepared }, dependencies.workspaceServices);
      if (generation !== this.transitionGeneration) return { status: "preparation-failed" };
      this.session = session; this.activeController = controller;
      const opened = await this.service.markLastOpened(compilation.id);
      return { status: "ready", controller, lastOpened: opened.status === "persistence-failed" ? "persistence-failed" : "updated" };
    } catch { return { status: "preparation-failed" }; }
  }

  /** Prepares a reassociated root with a candidate session, committing neither root nor Book until preparation succeeds. */
  async reassociateRoot(root: { path: string }, dependencies: SavedCompilationOpenDependencies): Promise<ActiveWorkspaceTransitionResult> {
    const compilation = this.session.compilation;
    const current = this.session.current;
    if (!compilation || !current || !this.activeController) return { status: "preparation-failed" };
    const generation = ++this.transitionGeneration;
    const candidate = new SavedCompilationWorkspaceSession(compilation);
    candidate.setAuthorRecipe({ ...current, root: { path: root.path } });
    try {
      const prepared = await dependencies.prepare(compilation, candidate.current);
      if (generation !== this.transitionGeneration) return { status: "superseded" };
      if (prepared.savedCompilation) candidate.setReconciliation(prepared.savedCompilation.reconciliation);
      const controller = createCompileWorkspaceController({ kind: "saved", compilation, session: candidate, request: prepared.request, formatting: prepared.request.formatting ?? defaultFormatting(), prepared }, dependencies.workspaceServices);
      this.session = candidate; this.activeController = controller;
      return { status: "ready", controller };
    } catch { return { status: "preparation-failed" }; }
  }

  /** Switches only after the target candidate is prepared; stale generations never mutate the active workspace. */
  async switchToSavedCompilation(id: string, discardUnsavedChanges: boolean, dependencies: SavedCompilationOpenDependencies): Promise<ActiveWorkspaceTransitionResult> {
    if (this.session.dirty && !discardUnsavedChanges) return { status: "unsaved-changes" };
    const generation = ++this.transitionGeneration;
    const compilation = this.service.getById(id);
    if (!compilation) return this.service.getDiagnosticsSummary().available ? { status: "not-found" } : { status: "unavailable" };
    const session = new SavedCompilationWorkspaceSession(compilation);
    const request = savedCompilationRequest(compilation);
    if (!dependencies.resolveRoot(compilation.root.path)) {
      session.setReconciliation(reconcileSavedCompilation({ compilation, plan: [] }));
      if (generation !== this.transitionGeneration) return { status: "superseded" };
      const controller = createCompileWorkspaceController({ kind: "saved", compilation, session, request, formatting: request.formatting ?? defaultFormatting() }, dependencies.workspaceServices);
      this.session = session; this.activeController = controller;
      return { status: "root-unavailable", controller };
    }
    try {
      const prepared = await dependencies.prepare(compilation, session.current);
      if (generation !== this.transitionGeneration) return { status: "superseded" };
      if (prepared.savedCompilation) session.setReconciliation(prepared.savedCompilation.reconciliation);
      const controller = createCompileWorkspaceController({ kind: "saved", compilation, session, request: prepared.request, formatting: prepared.request.formatting ?? defaultFormatting(), prepared }, dependencies.workspaceServices);
      this.session = session; this.activeController = controller;
      const opened = await this.service.markLastOpened(compilation.id);
      return { status: "ready", controller, lastOpened: opened.status === "persistence-failed" ? "persistence-failed" : "updated" };
    } catch { return { status: "preparation-failed" }; }
  }

  /** A New target is prepared before it replaces a Saved workspace; dirty Saved intent requires explicit discard. */
  async switchToNewCompilation(target: NewWorkspaceTransitionTarget, discardUnsavedChanges: boolean, dependencies: NewWorkspaceTransitionDependencies): Promise<ActiveWorkspaceTransitionResult> {
    if (this.session.dirty && !discardUnsavedChanges) return { status: "unsaved-changes" };
    const generation = ++this.transitionGeneration;
    try {
      const prepared = await dependencies.prepare(target);
      if (generation !== this.transitionGeneration) return { status: "superseded" };
      const controller = createCompileWorkspaceController({ kind: "new", request: prepared.request, formatting: prepared.request.formatting ?? target.formatting }, dependencies.workspaceServices);
      controller.initializePreparedWorkspace(prepared);
      this.session = new SavedCompilationWorkspaceSession(); this.activeController = controller;
      return { status: "ready", controller };
    } catch { return { status: "preparation-failed" }; }
  }

  /** Persists explicit intent and only evidence supplied after a caller verified source freshness. */
  async saveChanges(sourceEvidenceCurrent: boolean): Promise<SavedCompilationWorkflowResult> {
    const compilation = this.session.compilation;
    const recipe = this.session.current;
    if (!compilation || !recipe) return { status: "not-saved" };
    const observedSource = sourceEvidenceCurrent ? this.session.currentObservedSource : undefined;
    const result = await this.service.saveChanges(compilation.id, { root: recipe.root, recipe: recipe.recipe, output: recipe.output, observedSource });
    return this.applyPersistResult(result);
  }

  /** Creates a fresh Saved Compilation from current workspace intent; it never copies export facts. */
  async saveAsNew(name: string, sourceEvidenceCurrent: boolean): Promise<SavedCompilationWorkflowResult> {
    const recipe = this.session.current;
    if (!recipe) return { status: "invalid" };
    const result = await this.service.create({ name, root: recipe.root, recipe: recipe.recipe, output: recipe.output, observedSource: sourceEvidenceCurrent ? this.session.currentObservedSource : undefined });
    return this.applyPersistResult(result);
  }

  /** Acknowledgement is session-only and never affects recipe dirty state. */
  acknowledgeReview(): boolean { return this.session.acknowledgeReview(); }
  /** Removes a caller-selected deleted reference from session intent; persistence remains Save Changes. */
  acceptDeletedReference(reference: string): boolean {
    const changed = this.session.acceptDeletedReference(reference);
    if (changed) this.activeController?.applySavedSessionOverlay();
    return changed;
  }
  /** Maps only the exact caller-selected current plan item; no heuristic matching is performed. */
  mapSavedReference(oldReference: string, currentReference: string): boolean {
    const controller = this.activeController; const root = this.session.current?.root.path;
    const target = controller?.state.contentPlan.find((item) => item.path === currentReference);
    if (!controller || !root || !target) return false;
    const changed = this.session.mapReference(oldReference, target, root);
    if (changed) controller.applySavedSessionOverlay();
    return changed;
  }
  /** Marks an automatically inferred new item reviewed without manufacturing explicit recipe intent. */
  acceptNewSource(reference: string): boolean { return this.session.acceptNewSource(reference); }
  isPotentiallyStale(): boolean { return this.session.compilation ? this.staleness?.isPotentiallyStale(this.session.compilation.id) === true : false; }
  clearPotentialStalenessAfterRefresh(): void { if (this.session.compilation) this.staleness?.clear(this.session.compilation.id); }

  /** Session gating supplements, but never replaces, ExportCoordinator's validation and delivery checks. */
  authorizeExport(hasPreparedSession: boolean, preparedSessionCurrent: boolean): SavedCompilationExportAuthorization {
    if (!hasPreparedSession) return { status: "no-prepared-session" };
    if (!preparedSessionCurrent) return { status: "stale-prepared-session" };
    if (!this.session.isSaved) return { status: "allowed" };
    if (this.session.reconciliationReadiness === "blocked") return { status: "blocked-reconciliation" };
    if (this.session.reconciliationReadiness === "review-required") return { status: "review-required" };
    if (this.session.reconciliationReadiness === "review-recommended" && !this.session.reviewAcknowledged) return { status: "review-acknowledgement-required" };
    return { status: "allowed" };
  }

  /** Records a factual export only when the exported session still equals persisted Saved intent. */
  async recordSuccessfulCleanExport(format: ExportFormat, sourceFingerprint: string, inputSignature: string, timestamp: number): Promise<"recorded" | "skipped" | "persistence-failed"> {
    const compilation = this.session.compilation;
    if (!compilation || this.session.dirty || !this.session.persistedRecipe) return "skipped";
    const recipeSignature = savedCompilationRecipeSignature(this.session.persistedRecipe);
    const result = await this.service.recordSuccessfulExport(compilation.id, { timestamp, format, sourceFingerprint, inputSignature, recipeSignature });
    if (result.status === "ok") { this.exportBookkeepingUnknown = false; this.session.updateCompilationFacts(result.compilation); return "recorded"; }
    if (result.status === "persistence-failed") this.exportBookkeepingUnknown = true;
    return result.status === "persistence-failed" ? "persistence-failed" : "skipped";
  }

  /** Derives conservative Saved freshness from persisted facts, session intent, and the current prepared source. */
  exportFreshness(prepared?: Pick<PreparedCompileSession, "sourceFingerprint" | "inputSignature">): SavedCompilationExportFreshness {
    const compilation = this.session.compilation;
    if (!compilation || !this.session.isSaved) return "UNKNOWN";
    if (this.exportBookkeepingUnknown) return "UNKNOWN";
    if (this.session.dirty) return "UNSAVED_CONFIGURATION";
    const fact = compilation.lastSuccessfulExport;
    if (!fact) return "NEVER_EXPORTED";
    if (!prepared) return "UNKNOWN";
    const signature = this.session.persistedSignature;
    return signature === fact.recipeSignature && compilation.output.format === fact.format && fact.sourceFingerprint === prepared.sourceFingerprint && fact.inputSignature === prepared.inputSignature ? "CURRENT" : "OUT_OF_DATE";
  }

  private applyPersistResult(result: SavedCompilationOperation): SavedCompilationWorkflowResult {
    if (result.status === "ok") {
      this.session.markPersisted(result.compilation);
      return { status: "ok", session: this.session };
    }
    if (result.status === "persistence-failed") return { status: "persistence-failed" };
    if (result.status === "unavailable") return { status: "unavailable" };
    return { status: "invalid" };
  }
}

function defaultFormatting() { return { font: "Times New Roman", fontSize: 12, lineSpacing: 2, indentParagraphs: true, firstLineIndentCm: 1.27, pageSize: "a4" as const, chapterPageBreak: true, titlePage: false }; }
