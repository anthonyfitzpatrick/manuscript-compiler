/**
 * Manuscript Compiler — DOM-independent workspace state controller.
 *
 * Owns author mutations, session invalidation, duplicate-operation prevention,
 * cancellation, and export dispatch. The modal renders state but does not own
 * compiler logic. Model/output changes invalidate the prepared session once.
 * The modal calls this controller; it calls preparation and ExportCoordinator.
 * It owns the active AbortController but not vault interpretation or generated
 * bytes. Async failures become controller state without losing author choices.
 * Preserve stale checks, Book identity, finalisation locks, and mobile parity.
 */
import type { PreparedCompileSession } from "../compile-preparation";
import { applyMatterRoleInheritance, type ContentPlanItem, type ContentRole } from "../content-plan";
import { OperationStateController } from "../operation-state";
import { docxFormattingForPreset, type DocxFormatting, type SimpleCompileRequest } from "../simple-workflow";
import { validateSimpleCompileRequest } from "../simple-workflow";
import type { StructuralDisplay, StructurePreset } from "../settings";
import type { ExportFormat } from "../export-types";
import type { ExportExecutionResult } from "../export-coordinator";
import type { SavedCompilationExportAuthorization } from "../saved-compilation-orchestrator";
import { buildWorkspaceRecipe, newWorkspaceRecipe, type SavedCompilationWorkspaceSession } from "../saved-compilation-session";
import type { CanonicalWorkspaceRecipe } from "../saved-compilation-session";
import type { SavedCompilation } from "../saved-compilations";
import { includedNoteCount, moveSibling, setItemIncluded, setItemRole } from "./content-tree";
import type { CompileWorkspaceOrigin, CompileWorkspaceState, CompileWorkspaceStep, WorkspaceError } from "./workspace-types";

/** Injected service boundary; implementations retain prepared Book identity. */
export interface CompileWorkspaceServices {
  prepare(request: SimpleCompileRequest, plan: ContentPlanItem[], signal: AbortSignal): Promise<PreparedCompileSession>;
  /** Optional saved-mode adapter; it delegates into the same authoritative preparation route. */
  prepareSaved?(compilation: SavedCompilation, overlay: CanonicalWorkspaceRecipe | undefined, signal: AbortSignal): Promise<PreparedCompileSession>;
  isSavedCompilationPotentiallyStale?(id: string): boolean;
  onSavedCompilationRefreshCommitted?(id: string): void;
  sessionIsCurrent(session: PreparedCompileSession): Promise<boolean>;
  export(session: PreparedCompileSession, format: ExportFormat, filename: string): Promise<ExportExecutionResult | void>;
  authorizeSavedExport?(): SavedCompilationExportAuthorization;
  recordSavedExport?(session: PreparedCompileSession, format: ExportFormat): Promise<void>;
}

/**
 * Modal-scoped state owner. One controller serves one workspace lifetime and one
 * active operation. Closing cancels cancellable work unless export was detached
 * for safe finalisation.
 */
export class CompileWorkspaceController {
  readonly state: CompileWorkspaceState;
  private readonly operations = new OperationStateController();
  private preparationPromise?: Promise<PreparedCompileSession | undefined>;
  private exportPromise?: Promise<boolean>;
  private detachedExport = false;
  private savedCompilationSession?: SavedCompilationWorkspaceSession;
  private readonly childSnapshots = new Map<string, Map<string, { included: boolean; role: ContentRole; userOverride?: boolean }>>();

  constructor(request: SimpleCompileRequest, formatting: DocxFormatting, private readonly services: CompileWorkspaceServices, origin: CompileWorkspaceOrigin = { kind: "new" }) {
    this.state = { step: "manuscript", request, contentPlan: [], formatting, scannedRoot: "", preparationStatus: "idle", exportStatus: "idle", exportFormat: "docx", origin, recipeDirty: false };
  }

  /** Changes visible step and cancels preparation when leaving Create DOCX. */
  setStep(step: CompileWorkspaceStep): void {
    if (step !== "create" && this.state.preparationStatus === "preparing") this.cancelActiveOperation();
    this.state.step = step;
  }
  /** Replaces the authoritative root and discards scan-dependent choices. */
  setRoot(root: string): void { this.update(() => { this.state.request.manuscriptRoot = root.trim(); this.state.contentPlan = []; this.state.scannedRoot = ""; }); }
  /** Changes inference policy; a new scan is required before proceeding. */
  setPreset(preset: StructurePreset): void { this.update(() => { this.state.request.structurePreset = preset; this.state.contentPlan = []; this.state.scannedRoot = ""; }); }
  /** Takes ownership of a freshly detected mutable plan for the exact root. */
  setDetectedPlan(root: string, plan: ContentPlanItem[]): void { this.update(() => { this.state.request.manuscriptRoot = root; this.state.contentPlan = plan; this.state.scannedRoot = root; }); }
  /** Records an explicit role and propagates matter only to untouched children. */
  setRole(path: string, role: ContentRole): void {
    this.update(() => {
      const item = this.state.contentPlan.find((candidate) => candidate.path === path);
      const previousRole = item?.role;
      setItemRole(this.state.contentPlan, this.state.request.manuscriptRoot, path, role);
      if (item?.kind === "folder") applyMatterRoleInheritance(this.state.contentPlan, path, role, previousRole);
    });
  }
  /** Toggles effective inclusion while preserving a folder's child snapshot. */
  setIncluded(path: string, included: boolean): void {
    this.update(() => {
      const item = this.state.contentPlan.find((candidate) => candidate.path === path);
      if (item?.kind === "folder" && !included && item.included) this.snapshotChildren(path);
      setItemIncluded(this.state.contentPlan, this.state.request.manuscriptRoot, path, included);
      if (item?.kind === "folder") this.restoreChildren(path);
    });
  }
  /** Moves one sibling; the resulting order is authoritative for compilation. */
  moveItem(path: string, direction: -1 | 1): void { this.update(() => { this.state.contentPlan = moveSibling(this.state.contentPlan, this.state.request.manuscriptRoot, path, direction); }); }
  /** Explicitly includes all items, converting inferred exclusions to safe roles. */
  includeAll(): void { this.update(() => this.state.contentPlan.forEach((item) => { item.included = true; item.userOverride = true; if (item.role === "ignore") item.role = item.kind === "folder" ? "transparent" : "scene"; })); }
  /** Explicitly excludes notes without altering folder structure or order. */
  excludeAllNotes(): void { this.update(() => this.state.contentPlan.filter((item) => item.kind === "note").forEach((item) => { item.included = false; item.userOverride = true; })); }
  /** Applies supported custom formatting and invalidates the prepared output. */
  setFormatting(change: Partial<DocxFormatting>): void {
    this.update(() => {
      Object.assign(this.state.formatting, change);
      this.state.request.docxPreset = "custom";
    });
  }
  /** Applies deterministic preset values; Custom retains explicit values. */
  setDocxPreset(value: SimpleCompileRequest["docxPreset"]): void {
    this.update(() => {
      this.state.request.docxPreset = value;
      if (value !== "custom") {
        Object.assign(this.state.formatting, docxFormattingForPreset(value, this.state.formatting.titlePage));
        this.state.request.partDisplay = "word-title";
        this.state.request.chapterDisplay = "word-title";
        this.state.request.tableOfContents = false;
      }
    });
  }
  /** Selects literal scene-break text; an empty string means styled blank spacing. */
  setSceneSeparator(value: string): void { this.update(() => { if (this.state.request.custom) this.state.request.custom.sceneSeparator = value; this.state.request.docxPreset = "custom"; }); }
  /** Changes semantic heading display without altering Part/Chapter identity. */
  setDisplay(kind: "part" | "chapter", value: StructuralDisplay): void { this.update(() => { if (kind === "part") this.state.request.partDisplay = value; else this.state.request.chapterDisplay = value; this.state.request.docxPreset = "custom"; }); }
  /** Enables or disables the genuine Word TOC field. */
  setTableOfContents(value: boolean): void { this.update(() => { this.state.request.tableOfContents = value; this.state.request.docxPreset = "custom"; }); }
  /** Replaces body-heading aliases used during note cleaning. */
  setBodyAliases(values: string[]): void { this.update(() => { if (this.state.request.custom) this.state.request.custom.bodySectionAliases = values; }); }
  /** Includes note titles as body headings without changing note order or content. */
  setIncludeSceneTitles(value: boolean): void { this.update(() => { if (this.state.request.custom) this.state.request.custom.includeSceneTitles = value; }); }
  /** Controls final matter-section inclusion without rewriting individual roles. */
  setMatter(kind: "front" | "back", included: boolean): void { this.update(() => { if (kind === "front") this.state.request.includeFrontMatter = included; else this.state.request.includeBackMatter = included; }); }
  /** Updates title-page variables that affect prepared DOCX output. */
  setVariable(kind: "BookTitle" | "Author", value: string): void { this.update(() => { if (this.state.request.custom?.variables) this.state.request.custom.variables[kind] = value; }); }
  setExportFormat(value: ExportFormat): void { this.state.exportFormat = value; this.markRecipeDirty(); }
  setDownloadFilename(value: string): void { this.state.request.outputFilename = value; this.markRecipeDirty(); }

  /** Attaches runtime-only Saved Compilation intent; persistence remains outside this controller. */
  attachSavedCompilationSession(session: SavedCompilationWorkspaceSession): void {
    this.savedCompilationSession = session;
    this.state.recipeDirty = session.dirty;
  }

  /** Provides the orchestrator a cohesive session boundary without exposing persistence internals. */
  workspaceSession(): SavedCompilationWorkspaceSession | undefined { return this.savedCompilationSession; }
  /** Captures current author choices for Save As without preparing or persisting. */
  workspaceRecipeForSave(): CanonicalWorkspaceRecipe { return this.savedCompilationSession?.current ?? newWorkspaceRecipe(this.state.request.manuscriptRoot, this.state.contentPlan, this.state.request, this.state.formatting); }
  /** Promotes this same controller after Save As so its current stage and Book remain intact. */
  activateSavedCompilation(session: SavedCompilationWorkspaceSession): void {
    const compilation = session.compilation;
    if (!compilation) return;
    this.state.origin = { kind: "saved", compilationId: compilation.id, name: compilation.name, persistedRecipeSignature: session.persistedSignature ?? "" };
    this.attachSavedCompilationSession(session);
  }
  /** Updates display metadata only; a rename never changes author recipe dirtiness. */
  renameSavedCompilation(name: string): void { if (this.state.origin.kind === "saved") this.state.origin.name = name; }
  /** Deleting Saved state never deletes manuscript data; retain this usable workspace as New without rebuilding its Book. */
  detachSavedCompilation(): void {
    if (this.state.origin.kind !== "saved") return;
    this.savedCompilationSession = undefined;
    this.state.origin = { kind: "new" };
    this.state.recipeDirty = false;
  }
  /** Reapplies session-only review intent to the active plan and invalidates a Book affected by that intent. */
  applySavedSessionOverlay(): void {
    const applied = this.savedCompilationSession?.reapplyTo(this.state.contentPlan);
    if (!applied) return;
    this.state.contentPlan = applied.plan;
    this.synchronizeSavedCompilationRecipe();
    this.invalidatePreparedSession();
  }
  /** Reads the event-fed marker without conflating it with recipe dirtiness. */
  isPotentiallyStale(): boolean { const id = this.savedCompilationSession?.compilation?.id; return id ? this.services.isSavedCompilationPotentiallyStale?.(id) === true : false; }
  /** Commits a fully prepared candidate supplied by the shared workspace factory. */
  initializePreparedWorkspace(prepared: PreparedCompileSession): void {
    this.state.request = prepared.request;
    this.state.contentPlan = prepared.contentPlan.map((item) => ({ ...item }));
    this.state.scannedRoot = prepared.request.manuscriptRoot;
    this.state.preparedSession = prepared;
    this.state.preparationStatus = "ready";
  }

  /** Returns author-facing blockers for the current step without side effects. */
  canAdvance(): string[] {
    if (this.state.step === "manuscript" && !this.state.request.manuscriptRoot) return ["Choose a manuscript folder."];
    if (this.state.step === "contents" && includedNoteCount(this.state.contentPlan, this.state.request.manuscriptRoot) === 0) return ["Include at least one manuscript note."];
    return [];
  }

  /**
   * Deduplicates preparation clicks and caches a successful session. `force`
   * rebuilds stale preview state; failures leave the workspace usable.
   */
  prepare(force = false): Promise<PreparedCompileSession | undefined> {
    if (this.preparationPromise) return this.preparationPromise;
    if (!force && this.state.preparedSession) return Promise.resolve(this.state.preparedSession);
    const errors = validateSimpleCompileRequest(this.state.request);
    if (!includedNoteCount(this.state.contentPlan, this.state.request.manuscriptRoot)) errors.push("Include at least one manuscript note.");
    if (errors.length) { this.state.error = workspaceError(errors.join(" ")); return Promise.resolve(undefined); }
    const operation = this.operations.begin("preparing");
    if (!operation) return Promise.resolve(undefined);
    this.state.preparationStatus = "preparing";
    this.state.error = undefined;
    this.state.request.contentPlan = this.state.contentPlan;
    this.state.request.formatting = this.state.formatting;
    const saved = this.savedCompilationSession;
    const overlay = saved?.current;
    const savedInput = saved?.compilation && overlay ? { ...saved.compilation, root: overlay.root } : saved?.compilation;
    const prepared = savedInput && this.services.prepareSaved
      ? this.services.prepareSaved(savedInput, overlay, operation.signal)
      : this.services.prepare(this.state.request, this.state.contentPlan, operation.signal);
    this.preparationPromise = prepared.then((session) => {
      if (operation.signal.aborted) return undefined;
      if (session.savedCompilation) saved?.setReconciliation(session.savedCompilation.reconciliation);
      if (saved && session.savedCompilation) {
        this.state.contentPlan = session.contentPlan.map((item) => ({ ...item }));
        this.state.scannedRoot = session.request.manuscriptRoot;
        this.synchronizeSavedCompilationRecipe();
        if (saved.compilation) this.services.onSavedCompilationRefreshCommitted?.(saved.compilation.id);
      }
      this.state.preparedSession = session;
      this.state.preparationStatus = "ready";
      operation.complete();
      return session;
    }).catch((error: unknown) => {
      if (!operation.signal.aborted) {
        this.state.preparationStatus = "failed";
        this.state.error = workspaceError("The final manuscript could not be prepared.", error);
        operation.fail();
      }
      return undefined;
    }).finally(() => { operation.settle(); this.preparationPromise = undefined; });
    return this.preparationPromise;
  }

  /**
   * Verifies source freshness then delegates the exact prepared session. Duplicate
   * clicks share one promise. False means the modal should remain open.
   */
  export(): Promise<boolean> {
    if (this.exportPromise) return this.exportPromise;
    const session = this.state.preparedSession;
    if (!session) { this.state.error = workspaceError("Refresh the final preview before creating the DOCX."); return Promise.resolve(false); }
    const authorization = this.savedCompilationSession ? this.services.authorizeSavedExport?.() : undefined;
    if (authorization && authorization.status !== "allowed") { this.state.error = workspaceError("Review the Saved Compilation before creating the file."); return Promise.resolve(false); }
    const operation = this.operations.begin("exporting");
    if (!operation) return Promise.resolve(false);
    this.state.exportStatus = "exporting";
    this.exportPromise = this.services.sessionIsCurrent(session).then(async (current) => {
      if (!current) { this.invalidatePreparedSession("The manuscript changed after the preview was prepared. Refresh the preview before creating the DOCX."); operation.fail(); return false; }
      const result = await this.services.export(session, this.state.exportFormat, this.state.request.outputFilename);
      if (result?.status === "failed" || result?.status === "cancelled") { operation.fail(); return false; }
      if (this.savedCompilationSession && result?.status === "success") { try { await this.services.recordSavedExport?.(session, this.state.exportFormat); } catch { /* A dispatched export remains successful if secondary Saved bookkeeping fails. */ } }
      this.state.exportStatus = "complete";
      operation.complete();
      return true;
    }).catch((error: unknown) => {
      this.state.exportStatus = "failed";
      this.state.error = workspaceError("The DOCX could not be created.", error);
      operation.fail();
      return false;
    }).finally(() => { operation.settle(); this.exportPromise = undefined; });
    return this.exportPromise;
  }

  /** Cancels cancellable work and removes all derived preview state. */
  invalidatePreparedSession(message = ""): void {
    this.cancelActiveOperation();
    this.state.preparedSession = undefined;
    this.state.preparationStatus = "idle";
    this.state.error = message ? workspaceError(message) : undefined;
  }
  /** Requests cancellation if the active operation has not begun finalisation. */
  cancelActiveOperation(): boolean { return this.operations.cancel(); }
  /** Transfers finalising export ownership beyond modal close. */
  detachExport(): void { this.detachedExport = true; }
  /** Releases modal ownership and cancels work that remains safely cancellable. */
  close(): void { if (!this.detachedExport) this.cancelActiveOperation(); }
  private snapshotChildren(path: string): void { this.childSnapshots.set(path, new Map(this.state.contentPlan.filter((candidate) => candidate.path.startsWith(`${path}/`)).map((child) => [child.path, { included: child.included, role: child.role, userOverride: child.userOverride }]))); }
  private restoreChildren(path: string): void { this.childSnapshots.get(path)?.forEach((snapshot, childPath) => { const child = this.state.contentPlan.find((candidate) => candidate.path === childPath); if (child) { child.included = snapshot.included; child.role = snapshot.role; child.userOverride = snapshot.userOverride; } }); }
  /** Future Save Changes callers reset this only after service persistence succeeds. */
  markSavedRecipePersisted(): void { this.state.recipeDirty = false; }
  private markRecipeDirty(): void {
    if (this.savedCompilationSession) {
      this.synchronizeSavedCompilationRecipe();
      return;
    }
    if (this.state.origin.kind === "saved") this.state.recipeDirty = true;
  }
  private synchronizeSavedCompilationRecipe(): void {
    const saved = this.savedCompilationSession;
    const baseline = saved?.persistedRecipe;
    const current = saved?.current;
    if (!saved || !baseline || !current) return;
    const unresolvedPaths = new Set(saved.reapplyTo(this.state.contentPlan)?.unresolvedPaths ?? []);
    const recipe = buildWorkspaceRecipe(this.state.request.manuscriptRoot, this.state.contentPlan, baseline.recipe, baseline.output, this.state.request, this.state.formatting);
    if (unresolvedPaths.size > 0) {
      const overrides = current.recipe.overrides.filter((override) => unresolvedPaths.has(override.reference.path));
      recipe.recipe.overrides = [...recipe.recipe.overrides, ...overrides.filter((override) => !recipe.recipe.overrides.some((candidate) => candidate.reference.path === override.reference.path))];
      const orders = current.recipe.manualOrders.filter((order) => order.childPaths.some((path) => unresolvedPaths.has(path)));
      recipe.recipe.manualOrders = [...recipe.recipe.manualOrders, ...orders.filter((order) => !recipe.recipe.manualOrders.some((candidate) => candidate.parentPath === order.parentPath))];
    }
    saved.setAuthorRecipe(recipe, [...unresolvedPaths]);
    this.state.recipeDirty = this.savedCompilationSession?.dirty === true;
  }
  private update(change: () => void): void { change(); this.markRecipeDirty(); this.invalidatePreparedSession(); }
}

function workspaceError(message: string, detail?: unknown): WorkspaceError {
  return { message, suggestion: "Review the manuscript choices and refresh the preview.", technicalDetail: detail instanceof Error ? detail.message : typeof detail === "string" ? detail : undefined, severity: "error", recoverable: true };
}
