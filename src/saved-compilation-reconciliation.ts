/** Pure, conservative reconciliation of saved recipe intent with a current ContentPlan. */
import type { ContentPlanItem } from "./content-plan";
import type { SavedCompilation, SavedCompilationFileReference, SavedCompilationObservedSource } from "./saved-compilations";

export type ReconciliationReadiness = "ready" | "review-recommended" | "review-required" | "blocked";
export type ReconciliationStatus = "ready" | "source-content-changed" | "structure-changed" | "new-source-items" | "missing-source-items" | "reconciliation-required" | "unassociated-root";
export type ReconciliationFindingCode = "new-scene" | "new-structure" | "new-unknown" | "missing-reference" | "renamed-reference" | "moved-reference" | "role-changed" | "manual-order-incomplete" | "root-unavailable" | "unresolved-reference" | "detected-not-in-compilation";
/** Presentation is source-derived only: it never becomes persisted Saved intent. */
export type ReconciliationFindingPresentation = "auto-handled" | "detected-not-in-compilation" | "action-required" | "informational";
export interface ReconciliationFinding { code: ReconciliationFindingCode; path: string; relatedPath?: string; resolved: boolean; presentation: ReconciliationFindingPresentation; }
export interface SavedCompilationReconciliationInput {
  compilation: SavedCompilation;
  /** Explicit caller-resolved current root. Undefined means no vault-wide search is permitted. */
  rootPath?: string;
  plan: readonly ContentPlanItem[];
  /** Per-item compact fingerprints, keyed by root-relative current path. */
  fingerprints?: ReadonlyMap<string, string>;
  sourceFingerprint?: string;
}
export interface SavedCompilationReconciliationResult {
  readiness: ReconciliationReadiness;
  statuses: ReconciliationStatus[];
  plan: ContentPlanItem[];
  findings: ReconciliationFinding[];
  observedSource: SavedCompilationObservedSource;
  mayPrepare: boolean;
  requiresReviewBeforeExport: boolean;
}

interface CurrentItem { item: ContentPlanItem; path: string; parentPath: string; fingerprint?: string; }

/**
 * Reconciles only supplied current inference with persisted intent. Exact paths
 * restore immediately; a missing path can move only through one unique matching
 * fingerprint and compatible kind. Similar names are intentionally never used.
 */
export function reconcileSavedCompilation(input: SavedCompilationReconciliationInput): SavedCompilationReconciliationResult {
  if (!input.rootPath) return blockedResult();
  const root = input.rootPath;
  const plan = input.plan.map((item) => ({ ...item }));
  const current = plan.map((item) => currentItem(item, root, input.fingerprints));
  const byPath = new Map(current.map((item) => [item.path, item]));
  const byFingerprint = new Map<string, CurrentItem[]>();
  current.forEach((item) => { if (item.fingerprint) byFingerprint.set(item.fingerprint, [...(byFingerprint.get(item.fingerprint) ?? []), item]); });
  const findings: ReconciliationFinding[] = [];
  const statuses = new Set<ReconciliationStatus>();
  const resolved = new Map<string, CurrentItem>();
  const savedReferences = uniqueReferences(input.compilation);
  const excludedPaths = explicitExcludedPaths(input.compilation);

  for (const reference of savedReferences) {
    const excluded = isSavedPathExcluded(reference.path, excludedPaths);
    const exact = byPath.get(reference.path);
    if (exact && compatible(reference, exact)) { resolved.set(reference.path, exact); continue; }
    const candidates = reference.fingerprint ? (byFingerprint.get(reference.fingerprint) ?? []).filter((item) => compatible(reference, item)) : [];
    if (candidates.length === 1) {
      const candidate = candidates[0]; resolved.set(reference.path, candidate);
      if (!excluded && candidate.parentPath === reference.parentPath) findings.push(finding("renamed-reference", reference.path, true, candidate.path));
      else if (!excluded) { findings.push(finding("moved-reference", reference.path, true, candidate.path)); statuses.add("structure-changed"); }
    } else if (!excluded) {
      findings.push(finding(candidates.length ? "unresolved-reference" : "missing-reference", reference.path, false));
      statuses.add(candidates.length ? "reconciliation-required" : "missing-source-items");
    }
  }

  for (const override of input.compilation.recipe.overrides) {
    const target = resolved.get(override.reference.path); if (!target) continue;
    if (!isSavedPathExcluded(override.reference.path, excludedPaths) && target.item.detectedRole && target.item.detectedRole !== override.reference.expectedRole) {
      findings.push(finding("role-changed", target.path, true, override.reference.path)); statuses.add("structure-changed");
    }
    target.item.included = override.included; target.item.role = override.role; target.item.userOverride = true;
  }

  mergeManualOrders(input.compilation, plan, root, resolved, excludedPaths, findings, statuses);
  const knownCurrent = new Set([...resolved.values()].map((item) => item.path));
  for (const item of current) {
    if (isSavedPathExcluded(item.path, excludedPaths)) { findings.push(finding("detected-not-in-compilation", item.path, true)); continue; }
    if (knownCurrent.has(item.path)) continue;
    if (item.item.role === "ignore") continue;
    if (!item.item.detectedRole) { findings.push(finding("new-unknown", item.path, false)); statuses.add("reconciliation-required"); continue; }
    if (item.item.role === "scene") { findings.push(finding("new-scene", item.path, true)); statuses.add("new-source-items"); }
    else { findings.push(finding("new-structure", item.path, true)); statuses.add("structure-changed"); }
  }
  if (input.compilation.observedSource.sourceFingerprint && input.sourceFingerprint && input.compilation.observedSource.sourceFingerprint !== input.sourceFingerprint) statuses.add("source-content-changed");
  if (!statuses.size) statuses.add("ready");
  const readiness = chooseReadiness(statuses, findings);
  return {
    readiness, statuses: [...statuses].sort(), plan: orderPlan(plan), findings: findings.sort(compareFinding), observedSource: observe(current, input.sourceFingerprint),
    mayPrepare: readiness !== "blocked", requiresReviewBeforeExport: readiness === "review-required" || readiness === "blocked"
  };
}

function blockedResult(): SavedCompilationReconciliationResult {
  return { readiness: "blocked", statuses: ["unassociated-root"], plan: [], findings: [finding("root-unavailable", "", false)], observedSource: { references: [] }, mayPrepare: false, requiresReviewBeforeExport: true };
}
function currentItem(item: ContentPlanItem, root: string, fingerprints?: ReadonlyMap<string, string>): CurrentItem {
  const path = relative(item.path, root); return { item, path, parentPath: relative(item.parentPath, root), fingerprint: fingerprints?.get(path) };
}
function relative(path: string, root: string): string { return path === root ? "" : path.startsWith(root + "/") ? path.slice(root.length + 1) : path; }
function compatible(reference: SavedCompilationFileReference, current: CurrentItem): boolean { return reference.kind === current.item.kind; }
function uniqueReferences(compilation: SavedCompilation): SavedCompilationFileReference[] {
  const all = [...compilation.recipe.overrides.map((item) => item.reference), ...compilation.observedSource.references]; const seen = new Set<string>();
  return all.filter((item) => { if (seen.has(item.path)) return false; seen.add(item.path); return true; });
}
/** Explicit exclusions remain authoritative for their safely resolved descendants. */
function explicitExcludedPaths(compilation: SavedCompilation): ReadonlySet<string> {
  return new Set(compilation.recipe.overrides.filter((override) => !override.included).map((override) => override.reference.path));
}
function isSavedPathExcluded(path: string, excludedPaths: ReadonlySet<string>): boolean {
  for (const excludedPath of excludedPaths) if (path === excludedPath || path.startsWith(`${excludedPath}/`)) return true;
  return false;
}
function observe(current: readonly CurrentItem[], sourceFingerprint?: string): SavedCompilationObservedSource {
  return { sourceFingerprint, references: current.slice().sort((a, b) => a.path.localeCompare(b.path)).map((item) => ({ path: item.path, parentPath: item.parentPath || "_root", name: item.item.name, kind: item.item.kind, expectedRole: item.item.detectedRole ?? item.item.role, fingerprint: item.fingerprint })) };
}
function mergeManualOrders(compilation: SavedCompilation, plan: ContentPlanItem[], root: string, resolved: ReadonlyMap<string, CurrentItem>, excludedPaths: ReadonlySet<string>, findings: ReconciliationFinding[], statuses: Set<ReconciliationStatus>): void {
  const currentByRelative = new Map(plan.map((item) => [relative(item.path, root), item]));
  for (const order of compilation.recipe.manualOrders) {
    const parent = order.parentPath;
    if (isSavedPathExcluded(parent === "_root" ? "" : parent, excludedPaths)) continue;
    const siblings = plan.filter((item) => relative(item.parentPath, root) === parent).sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
    if (!siblings.length) continue;
    const ordered: ContentPlanItem[] = []; let incomplete = false;
    for (const savedPath of order.childPaths) {
      if (isSavedPathExcluded(savedPath, excludedPaths)) continue;
      const mapped = resolved.get(savedPath)?.item ?? currentByRelative.get(savedPath);
      if (!mapped || relative(mapped.parentPath, root) !== parent) { incomplete = true; continue; }
      if (!ordered.includes(mapped)) ordered.push(mapped);
    }
    const merged = [...ordered, ...siblings.filter((item) => !ordered.includes(item))];
    merged.forEach((item, index) => { item.order = index; });
    if (incomplete) { findings.push(finding("manual-order-incomplete", parent, false)); statuses.add("reconciliation-required"); }
  }
}
function orderPlan(plan: ContentPlanItem[]): ContentPlanItem[] { return plan.slice().sort((a, b) => a.parentPath.localeCompare(b.parentPath) || a.order - b.order || a.path.localeCompare(b.path)); }
function chooseReadiness(statuses: ReadonlySet<ReconciliationStatus>, findings: readonly ReconciliationFinding[]): ReconciliationReadiness {
  if (statuses.has("unassociated-root")) return "blocked";
  if (statuses.has("reconciliation-required") || statuses.has("missing-source-items") || findings.some((item) => item.code === "new-structure" || item.code === "moved-reference" || item.code === "role-changed")) return "review-required";
  if (statuses.has("new-source-items") || statuses.has("structure-changed")) return "review-recommended";
  return "ready";
}
function finding(code: ReconciliationFindingCode, path: string, resolved: boolean, relatedPath?: string): ReconciliationFinding {
  const presentation: ReconciliationFindingPresentation = code === "new-scene" ? "auto-handled" : code === "detected-not-in-compilation" ? "detected-not-in-compilation" : code === "renamed-reference" ? "informational" : "action-required";
  return { code, path, relatedPath, resolved, presentation };
}
function compareFinding(left: ReconciliationFinding, right: ReconciliationFinding): number { return left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || (left.relatedPath ?? "").localeCompare(right.relatedPath ?? ""); }
