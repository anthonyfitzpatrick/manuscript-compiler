/**
 * Saved Compilation workspace state deliberately has three layers: persisted
 * author intent, source-derived reconciliation state, and unsaved author intent.
 * Source evolution is not an unsaved recipe edit.
 */
import type { ContentPlanItem } from "./content-plan";
import {
  savedCompilationRecipeEquals,
  savedCompilationRecipeSignature,
  type SavedCompilation,
  type SavedCompilationOutputConfiguration,
  type SavedCompilationRecipe
} from "./saved-compilations";
import type { SavedCompilationFileReference, SavedCompilationObservedSource } from "./saved-compilations";
import type { ReconciliationFinding, ReconciliationReadiness, SavedCompilationReconciliationResult } from "./saved-compilation-reconciliation";
import type { DocxFormatting, SimpleCompileRequest } from "./simple-workflow";

/** JSON-safe author intent derived from an active workspace, excluding source and UI state. */
export interface CanonicalWorkspaceRecipe {
  root: { path: string };
  recipe: SavedCompilationRecipe;
  output: SavedCompilationOutputConfiguration;
}

/** Unsaved author intent that is reapplied after current source is reconciled. */
export interface SavedCompilationSessionOverlay {
  recipe: CanonicalWorkspaceRecipe;
  unresolvedPaths: string[];
}

export interface WorkspaceRecipeApplication {
  plan: ContentPlanItem[];
  unresolvedPaths: string[];
}

/** Builds compact author intent for a New workspace before its first Save As. */
export function newWorkspaceRecipe(root: string, plan: readonly ContentPlanItem[], request: SimpleCompileRequest, formatting: DocxFormatting): CanonicalWorkspaceRecipe {
  const custom = request.custom;
  const recipe: SavedCompilationRecipe = {
    overrides: [], manualOrders: [], structurePreset: request.structurePreset, includeFrontMatter: request.includeFrontMatter, includeBackMatter: request.includeBackMatter,
    includeSceneTitles: custom?.includeSceneTitles === true, cleaning: { stripYamlFrontmatter: custom?.stripYamlFrontmatter !== false, removeObsidianComments: custom?.removeObsidianComments !== false, removeHtmlComments: custom?.removeHtmlComments !== false, removeDataviewBlocks: custom?.removeDataviewBlocks !== false, removeCallouts: custom?.removeCallouts !== false, stripInternalLinks: custom?.stripInternalLinks !== false, bodySectionAliases: [...(custom?.bodySectionAliases ?? [])] },
    metadataFilters: [...(custom?.metadataFilters ?? [])], useParts: custom?.useParts !== false, chapterSource: custom?.chapterSource ?? "folders", orderingMethod: custom?.orderingMethod ?? "filename", metadataOrdering: custom?.metadataOrdering === true, partHeadingTemplate: custom?.partHeadingTemplate ?? "", chapterHeadingTemplate: custom?.chapterHeadingTemplate ?? "", blankLinesBetweenSections: custom?.blankLinesBetweenSections ?? 1, blankLinesBetweenChapters: custom?.blankLinesBetweenChapters ?? 1
  };
  const output: SavedCompilationOutputConfiguration = { format: savedFormat(request.outputFormat), filename: request.outputFilename, docxPreset: request.docxPreset, title: custom?.variables?.BookTitle ?? "", author: custom?.variables?.Author ?? "", tableOfContents: request.tableOfContents === true, sceneSeparator: custom?.sceneSeparator ?? "", partDisplay: request.partDisplay ?? "word-title", chapterDisplay: request.chapterDisplay ?? "word-title", titlePage: formatting.titlePage, typography: { ...formatting } };
  return buildWorkspaceRecipe(root, plan, recipe, output, request, formatting);
}

/**
 * Builds the one normalized recipe used for dirty comparison and later saving.
 * Only explicit content-plan corrections become persisted intent; inferred notes
 * and their prose remain source-derived state.
 */
export function buildWorkspaceRecipe(
  root: string,
  plan: readonly ContentPlanItem[],
  baseRecipe: SavedCompilationRecipe,
  baseOutput: SavedCompilationOutputConfiguration,
  request: SimpleCompileRequest,
  formatting: DocxFormatting
): CanonicalWorkspaceRecipe {
  const baselineOverrideByPath = new Map(baseRecipe.overrides.map((override) => [override.reference.path, override]));
  const baselineOverrides = new Set(baselineOverrideByPath.keys());
  const overrides = plan.filter((item) => item.userOverride && (baselineOverrides.has(relativePath(item.path, root)) || item.role !== item.detectedRole || !item.included)).map((item) => ({
    reference: {
      path: relativePath(item.path, root), parentPath: relativePath(item.parentPath, root) || "_root",
      name: baselineOverrideByPath.get(relativePath(item.path, root))?.reference.name ?? item.name, kind: item.kind, expectedRole: item.detectedRole ?? item.role,
      fingerprint: baselineOverrideByPath.get(relativePath(item.path, root))?.reference.fingerprint
    },
    included: item.included,
    role: item.role
  }));
  const baselineOrders = new Map(baseRecipe.manualOrders.map((order) => [order.parentPath, new Set(order.childPaths)]));
  const manualOrders = siblingGroups(plan, root).filter((group) => group.explicit).map((group) => {
    const parentPath = group.parentPath || "_root";
    const known = baselineOrders.get(parentPath) ?? new Set<string>();
    return { parentPath, childPaths: group.children.filter((item) => item.userOverride || known.has(relativePath(item.path, root))).map((item) => relativePath(item.path, root)) };
  });
  const custom = request.custom;
  const cleaning = {
    stripYamlFrontmatter: custom?.stripYamlFrontmatter ?? baseRecipe.cleaning.stripYamlFrontmatter,
    removeObsidianComments: custom?.removeObsidianComments ?? baseRecipe.cleaning.removeObsidianComments,
    removeHtmlComments: custom?.removeHtmlComments ?? baseRecipe.cleaning.removeHtmlComments,
    removeDataviewBlocks: custom?.removeDataviewBlocks ?? baseRecipe.cleaning.removeDataviewBlocks,
    removeCallouts: custom?.removeCallouts ?? baseRecipe.cleaning.removeCallouts,
    stripInternalLinks: custom?.stripInternalLinks ?? baseRecipe.cleaning.stripInternalLinks,
    bodySectionAliases: (custom?.bodySectionAliases ?? baseRecipe.cleaning.bodySectionAliases ?? []).slice()
  };
  return {
    root: { path: root },
    recipe: {
      ...baseRecipe,
      overrides,
      manualOrders,
      includeFrontMatter: request.includeFrontMatter,
      includeBackMatter: request.includeBackMatter,
      includeSceneTitles: custom?.includeSceneTitles ?? baseRecipe.includeSceneTitles,
      cleaning,
      metadataFilters: (custom?.metadataFilters ?? baseRecipe.metadataFilters).map((filter) => ({ ...filter })),
      structurePreset: request.structurePreset,
      useParts: custom?.useParts ?? baseRecipe.useParts,
      chapterSource: custom?.chapterSource ?? baseRecipe.chapterSource,
      orderingMethod: custom?.orderingMethod ?? baseRecipe.orderingMethod,
      metadataOrdering: custom?.metadataOrdering ?? baseRecipe.metadataOrdering,
      partHeadingTemplate: custom?.partHeadingTemplate ?? baseRecipe.partHeadingTemplate,
      chapterHeadingTemplate: custom?.chapterHeadingTemplate ?? baseRecipe.chapterHeadingTemplate,
      blankLinesBetweenSections: custom?.blankLinesBetweenSections ?? baseRecipe.blankLinesBetweenSections,
      blankLinesBetweenChapters: custom?.blankLinesBetweenChapters ?? baseRecipe.blankLinesBetweenChapters
    },
    output: {
      ...baseOutput,
      format: savedFormat(request.outputFormat),
      filename: request.outputFilename,
      docxPreset: request.docxPreset,
      title: custom?.variables?.BookTitle ?? baseOutput.title,
      author: custom?.variables?.Author ?? baseOutput.author,
      tableOfContents: request.tableOfContents ?? false,
      sceneSeparator: custom?.sceneSeparator ?? baseOutput.sceneSeparator,
      partDisplay: request.partDisplay ?? baseOutput.partDisplay,
      chapterDisplay: request.chapterDisplay ?? baseOutput.chapterDisplay,
      typography: { ...formatting }
    }
  };
}

/** Applies exact references only; missing or incompatible paths are never rebound. */
export function applyWorkspaceRecipe(
  recipe: CanonicalWorkspaceRecipe,
  root: string,
  plan: readonly ContentPlanItem[]
): WorkspaceRecipeApplication {
  const result = plan.map((item) => ({ ...item }));
  const byPath = new Map(result.map((item) => [relativePath(item.path, root), item]));
  const unresolvedPaths: string[] = [];
  for (const override of recipe.recipe.overrides) {
    const item = byPath.get(override.reference.path);
    if (!item || item.kind !== override.reference.kind) {
      unresolvedPaths.push(override.reference.path);
      continue;
    }
    item.included = override.included;
    item.role = override.role;
    item.userOverride = true;
  }
  for (const order of recipe.recipe.manualOrders) {
    const siblings = result.filter((item) => (relativePath(item.parentPath, root) || "_root") === order.parentPath);
    const ranks = new Map(order.childPaths.map((path, index) => [path, index]));
    if (siblings.length > 0 && order.childPaths.some((path) => !byPath.has(path))) unresolvedPaths.push(...order.childPaths.filter((path) => !byPath.has(path)));
    siblings.sort((left, right) => (ranks.get(relativePath(left.path, root)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(relativePath(right.path, root)) ?? Number.MAX_SAFE_INTEGER) || left.order - right.order).forEach((item, index) => { item.order = index; });
  }
  return { plan: result, unresolvedPaths: [...new Set(unresolvedPaths)].sort() };
}

/**
 * Runtime-only session state. The overlay is author intent after loading; it is
 * intentionally separate from reconciliation findings and source fingerprints.
 */
export class SavedCompilationWorkspaceSession {
  private baseline?: CanonicalWorkspaceRecipe;
  private currentRecipe?: CanonicalWorkspaceRecipe;
  private overlay?: SavedCompilationSessionOverlay;
  private observedSource?: SavedCompilationObservedSource;
  private readiness: ReconciliationReadiness = "ready";
  private reconciliation?: SavedCompilationReconciliationResult;
  private readonly acceptedNewSource = new Set<string>();
  private recommendedFindingKey = "";
  private acknowledged = false;

  constructor(public compilation?: SavedCompilation) {
    this.baseline = compilation ? cloneRecipe({ root: compilation.root, recipe: compilation.recipe, output: compilation.output }) : undefined;
    this.currentRecipe = this.baseline ? cloneRecipe(this.baseline) : undefined;
  }

  get isSaved(): boolean { return this.baseline !== undefined; }
  get dirty(): boolean { return this.baseline !== undefined && this.currentRecipe !== undefined && !savedCompilationRecipeEquals(this.currentRecipe, this.baseline); }
  get persistedSignature(): string | undefined { return this.baseline ? savedCompilationRecipeSignature(this.baseline) : undefined; }
  get persistedRecipe(): CanonicalWorkspaceRecipe | undefined { return this.baseline ? cloneRecipe(this.baseline) : undefined; }
  get current(): CanonicalWorkspaceRecipe | undefined { return this.currentRecipe ? cloneRecipe(this.currentRecipe) : undefined; }
  get sessionOverlay(): SavedCompilationSessionOverlay | undefined { return this.overlay ? { recipe: cloneRecipe(this.overlay.recipe), unresolvedPaths: this.overlay.unresolvedPaths.slice() } : undefined; }
  get currentObservedSource(): SavedCompilationObservedSource | undefined { return this.observedSource ? cloneObservedSource(this.observedSource) : undefined; }
  get reconciliationReadiness(): ReconciliationReadiness { return this.readiness; }
  get reviewAcknowledged(): boolean { return this.acknowledged; }
  get currentReconciliation(): SavedCompilationReconciliationResult | undefined { return this.reconciliation ? cloneReconciliation(this.reconciliation) : undefined; }

  /** Establishes current intent for a new workspace, without creating persistence. */
  initializeNew(recipe: CanonicalWorkspaceRecipe): void { this.currentRecipe = cloneRecipe(recipe); }

  /** Replaces author intent and removes a redundant overlay when it equals the persisted baseline. */
  setAuthorRecipe(recipe: CanonicalWorkspaceRecipe, unresolvedPaths: readonly string[] = []): void {
    this.currentRecipe = cloneRecipe(recipe);
    if (this.baseline && savedCompilationRecipeEquals(recipe, this.baseline)) {
      this.overlay = undefined;
      return;
    }
    this.overlay = { recipe: cloneRecipe(recipe), unresolvedPaths: [...new Set(unresolvedPaths)].sort() };
  }

  /** Records current reconciliation facts without confusing source evolution with author dirtiness. */
  setReconciliation(result: SavedCompilationReconciliationResult): void {
    this.reconciliation = cloneReconciliation(result);
    this.observedSource = cloneObservedSource(result.observedSource);
    this.updateReadiness(result.findings.filter((finding) => !this.acceptedNewSource.has(finding.path)));
  }

  /** Removes only explicit intent for a deleted reference and retains unrelated session choices. */
  acceptDeletedReference(reference: string): boolean {
    const current = this.currentRecipe;
    if (!current || !this.hasUnresolved(reference)) return false;
    const recipe = cloneRecipe(current);
    recipe.recipe.overrides = recipe.recipe.overrides.filter((override) => override.reference.path !== reference);
    recipe.recipe.manualOrders = recipe.recipe.manualOrders.map((order) => ({ ...order, childPaths: order.childPaths.filter((path) => path !== reference) })).filter((order) => order.childPaths.length > 0);
    this.setAuthorRecipe(recipe, (this.overlay?.unresolvedPaths ?? []).filter((path) => path !== reference));
    const parent = reference.includes("/") ? reference.slice(0, reference.lastIndexOf("/")) : "_root";
    this.resolveFindings((finding) => finding.path === reference || (finding.code === "manual-order-incomplete" && finding.path === parent));
    return true;
  }

  /** Transfers a caller-selected unresolved reference exactly; it never searches for a target. */
  mapReference(oldReference: string, target: ContentPlanItem, root: string): boolean {
    const current = this.currentRecipe;
    const source = this.referenceFor(oldReference);
    if (!current || !source || !this.hasUnresolved(oldReference) || target.kind !== source.kind || !target.path.startsWith(`${root}/`)) return false;
    const relative = relativePath(target.path, root); const parentPath = relativePath(target.parentPath, root) || "_root";
    const recipe = cloneRecipe(current); const oldOverride = recipe.recipe.overrides.find((override) => override.reference.path === oldReference);
    if (oldOverride) {
      recipe.recipe.overrides = recipe.recipe.overrides.filter((override) => override.reference.path !== oldReference);
      recipe.recipe.overrides.push({ ...oldOverride, reference: { ...oldOverride.reference, path: relative, parentPath, name: target.name, kind: target.kind, expectedRole: target.detectedRole ?? target.role } });
    }
    recipe.recipe.manualOrders = recipe.recipe.manualOrders.map((order) => ({ ...order, childPaths: order.childPaths.map((path) => path === oldReference ? relative : path) }));
    this.setAuthorRecipe(recipe, (this.overlay?.unresolvedPaths ?? []).map((path) => path === oldReference ? relative : path));
    this.resolveFindings((finding) => finding.path === oldReference);
    return true;
  }

  /** Accepts current automatic inference without turning it into explicit author intent. */
  acceptNewSource(reference: string): boolean {
    if (!this.reconciliation?.findings.some((finding) => finding.path === reference && finding.code === "new-scene")) return false;
    this.acceptedNewSource.add(reference); this.updateReadiness(this.reconciliation.findings.filter((finding) => !this.acceptedNewSource.has(finding.path))); return true;
  }

  /** Promotes one neutral detected item into current unsaved author intent. */
  acceptDetectedContent(reference: string): boolean {
    if (!this.reconciliation?.findings.some((finding) => finding.path === reference && finding.presentation === "detected-not-in-compilation")) return false;
    this.resolveFindings((finding) => finding.path === reference && finding.presentation === "detected-not-in-compilation");
    return true;
  }

  private referenceFor(path: string): SavedCompilationFileReference | undefined { return this.currentRecipe?.recipe.overrides.find((override) => override.reference.path === path)?.reference ?? this.compilation?.observedSource.references.find((reference) => reference.path === path); }
  private hasUnresolved(path: string): boolean { return this.reconciliation?.findings.some((finding) => finding.path === path && !finding.resolved) === true || this.overlay?.unresolvedPaths.includes(path) === true; }
  private resolveFindings(matches: (finding: ReconciliationFinding) => boolean): void {
    if (!this.reconciliation) return;
    this.reconciliation.findings = this.reconciliation.findings.filter((finding) => !matches(finding)); this.updateReadiness(this.reconciliation.findings.filter((finding) => !this.acceptedNewSource.has(finding.path)));
  }
  private updateReadiness(findings: readonly ReconciliationFinding[]): void {
    const key = findings.filter((finding) => finding.code === "new-scene" || finding.code === "new-structure").map((finding) => `${finding.code}:${finding.path}`).join("|");
    if (key !== this.recommendedFindingKey) this.acknowledged = false;
    this.recommendedFindingKey = key;
    this.readiness = this.reconciliation?.readiness === "blocked" ? "blocked" : findings.some((finding) => !finding.resolved && (finding.code === "missing-reference" || finding.code === "unresolved-reference" || finding.code === "manual-order-incomplete" || finding.code === "new-unknown" || finding.code === "root-unavailable")) || findings.some((finding) => finding.code === "new-structure") ? "review-required" : findings.some((finding) => finding.code === "new-scene") ? "review-recommended" : "ready";
  }

  /** Session-local acknowledgement is meaningful only for a recommended review. */
  acknowledgeReview(): boolean {
    if (this.readiness !== "review-recommended") return false;
    this.acknowledged = true;
    return true;
  }

  /** Replaces the persisted baseline only after the service confirms a durable save. */
  markPersisted(compilation: SavedCompilation): void {
    this.compilation = compilation;
    this.baseline = cloneRecipe({ root: compilation.root, recipe: compilation.recipe, output: compilation.output });
    this.currentRecipe = cloneRecipe(this.baseline);
    this.overlay = undefined;
  }

  /** Refreshes persisted export facts after a durable bookkeeping write without altering author intent. */
  updateCompilationFacts(compilation: SavedCompilation): void { this.compilation = compilation; }

  /** Reapplies current unsaved author intent to newly reconciled source without I/O. */
  reapplyTo(plan: readonly ContentPlanItem[]): WorkspaceRecipeApplication | undefined {
    const recipe = this.overlay?.recipe ?? this.currentRecipe;
    return recipe ? applyWorkspaceRecipe(recipe, recipe.root.path, plan) : undefined;
  }
}

function cloneObservedSource(source: SavedCompilationObservedSource): SavedCompilationObservedSource {
  return { sourceFingerprint: source.sourceFingerprint, inputSignature: source.inputSignature, references: source.references.map((reference) => ({ ...reference })) };
}
function cloneReconciliation(result: SavedCompilationReconciliationResult): SavedCompilationReconciliationResult {
  return { ...result, statuses: result.statuses.slice(), plan: result.plan.map((item) => ({ ...item })), findings: result.findings.map((finding) => ({ ...finding })), observedSource: cloneObservedSource(result.observedSource) };
}

function relativePath(path: string, root: string): string {
  return path === root ? "" : path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

/** Saved schema deliberately has no legacy markdown-docx target; it resolves to DOCX. */
function savedFormat(format: SimpleCompileRequest["outputFormat"]): SavedCompilationOutputConfiguration["format"] {
  return format === "markdown-docx" ? "docx" : format;
}

function siblingGroups(plan: readonly ContentPlanItem[], root: string): Array<{ parentPath: string; children: ContentPlanItem[]; explicit: boolean }> {
  const byParent = new Map<string, ContentPlanItem[]>();
  for (const item of plan) {
    const parentPath = relativePath(item.parentPath, root);
    byParent.set(parentPath, [...(byParent.get(parentPath) ?? []), item]);
  }
  return [...byParent.entries()].map(([parentPath, children]) => {
    const ordered = children.slice().sort((left, right) => left.order - right.order);
    return { parentPath, children: ordered, explicit: ordered.some((item) => item.userOverride) };
  });
}

function cloneRecipe(recipe: CanonicalWorkspaceRecipe): CanonicalWorkspaceRecipe {
  return {
    root: { ...recipe.root },
    recipe: {
      ...recipe.recipe,
      overrides: recipe.recipe.overrides.map((override) => ({ ...override, reference: { ...override.reference } })),
      manualOrders: recipe.recipe.manualOrders.map((order) => ({ ...order, childPaths: order.childPaths.slice() })),
      cleaning: { ...recipe.recipe.cleaning, bodySectionAliases: recipe.recipe.cleaning.bodySectionAliases?.slice() },
      metadataFilters: recipe.recipe.metadataFilters.map((filter) => ({ ...filter }))
    },
    output: { ...recipe.output, typography: recipe.output.typography ? { ...recipe.output.typography } : undefined }
  };
}
