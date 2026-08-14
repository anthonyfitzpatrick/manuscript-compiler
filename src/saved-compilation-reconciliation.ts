/** Pure, conservative reconciliation of saved recipe intent with a current ContentPlan. */
import type { ContentPlanItem } from "./content-plan";
import { isPlanItemIncluded } from "./content-plan";
import type { SavedCompilation, SavedCompilationFileReference, SavedCompilationObservedSource } from "./saved-compilations";

export type ReconciliationReadiness = "ready" | "review-recommended" | "review-required" | "blocked";
export type ReconciliationStatus = "ready" | "source-content-changed" | "structure-changed" | "new-source-items" | "missing-source-items" | "reconciliation-required" | "unassociated-root";
export type ReconciliationFindingCode = "new-scene" | "new-structure" | "new-unknown" | "missing-reference" | "renamed-reference" | "moved-reference" | "role-changed" | "manual-order-incomplete" | "root-unavailable" | "unresolved-reference";
export interface ReconciliationFinding { code: ReconciliationFindingCode; path: string; relatedPath?: string; resolved: boolean; }
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

  for (const reference of savedReferences) {
    const exact = byPath.get(reference.path);
    if (exact && compatible(reference, exact)) { resolved.set(reference.path, exact); continue; }
    const candidates = reference.fingerprint ? (byFingerprint.get(reference.fingerprint) ?? []).filter((item) => compatible(reference, item)) : [];
    if (candidates.length === 1) {
      const candidate = candidates[0]; resolved.set(reference.path, candidate);
      if (candidate.parentPath === reference.parentPath) findings.push({ code: "renamed-reference", path: reference.path, relatedPath: candidate.path, resolved: true });
      else { findings.push({ code: "moved-reference", path: reference.path, relatedPath: candidate.path, resolved: true }); statuses.add("structure-changed"); }
    } else {
      findings.push({ code: candidates.length ? "unresolved-reference" : "missing-reference", path: reference.path, resolved: false });
      statuses.add(candidates.length ? "reconciliation-required" : "missing-source-items");
    }
  }

  for (const override of input.compilation.recipe.overrides) {
    const target = resolved.get(override.reference.path); if (!target) continue;
    if (target.item.detectedRole && target.item.detectedRole !== override.reference.expectedRole) {
      findings.push({ code: "role-changed", path: target.path, relatedPath: override.reference.path, resolved: true }); statuses.add("structure-changed");
    }
    target.item.included = override.included; target.item.role = override.role; target.item.userOverride = true;
  }

  mergeManualOrders(input.compilation, plan, root, resolved, findings, statuses);
  const knownCurrent = new Set([...resolved.values()].map((item) => item.path));
  for (const item of current) {
    if (knownCurrent.has(item.path)) continue;
    if (item.item.role === "ignore" || !isPlanItemIncluded(item.item, plan, root)) continue;
    if (!item.item.detectedRole) { findings.push({ code: "new-unknown", path: item.path, resolved: false }); statuses.add("reconciliation-required"); continue; }
    if (item.item.role === "scene") { findings.push({ code: "new-scene", path: item.path, resolved: true }); statuses.add("new-source-items"); }
    else { findings.push({ code: "new-structure", path: item.path, resolved: true }); statuses.add("structure-changed"); }
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
  return { readiness: "blocked", statuses: ["unassociated-root"], plan: [], findings: [{ code: "root-unavailable", path: "", resolved: false }], observedSource: { references: [] }, mayPrepare: false, requiresReviewBeforeExport: true };
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
function observe(current: readonly CurrentItem[], sourceFingerprint?: string): SavedCompilationObservedSource {
  return { sourceFingerprint, references: current.slice().sort((a, b) => a.path.localeCompare(b.path)).map((item) => ({ path: item.path, parentPath: item.parentPath || "_root", name: item.item.name, kind: item.item.kind, expectedRole: item.item.detectedRole ?? item.item.role, fingerprint: item.fingerprint })) };
}
function mergeManualOrders(compilation: SavedCompilation, plan: ContentPlanItem[], root: string, resolved: ReadonlyMap<string, CurrentItem>, findings: ReconciliationFinding[], statuses: Set<ReconciliationStatus>): void {
  const currentByRelative = new Map(plan.map((item) => [relative(item.path, root), item]));
  for (const order of compilation.recipe.manualOrders) {
    const parent = order.parentPath; const siblings = plan.filter((item) => relative(item.parentPath, root) === parent).sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
    if (!siblings.length) continue;
    const ordered: ContentPlanItem[] = []; let incomplete = false;
    for (const savedPath of order.childPaths) {
      const mapped = resolved.get(savedPath)?.item ?? currentByRelative.get(savedPath);
      if (!mapped || relative(mapped.parentPath, root) !== parent) { incomplete = true; continue; }
      if (!ordered.includes(mapped)) ordered.push(mapped);
    }
    const merged = [...ordered, ...siblings.filter((item) => !ordered.includes(item))];
    merged.forEach((item, index) => { item.order = index; });
    if (incomplete) { findings.push({ code: "manual-order-incomplete", path: parent, resolved: false }); statuses.add("reconciliation-required"); }
  }
}
function orderPlan(plan: ContentPlanItem[]): ContentPlanItem[] { return plan.slice().sort((a, b) => a.parentPath.localeCompare(b.parentPath) || a.order - b.order || a.path.localeCompare(b.path)); }
function chooseReadiness(statuses: ReadonlySet<ReconciliationStatus>, findings: readonly ReconciliationFinding[]): ReconciliationReadiness {
  if (statuses.has("unassociated-root")) return "blocked";
  if (statuses.has("reconciliation-required") || statuses.has("missing-source-items") || findings.some((item) => item.code === "new-structure" || item.code === "moved-reference" || item.code === "role-changed")) return "review-required";
  if (statuses.has("new-source-items") || statuses.has("structure-changed")) return "review-recommended";
  return "ready";
}
function compareFinding(left: ReconciliationFinding, right: ReconciliationFinding): number { return left.code.localeCompare(right.code) || left.path.localeCompare(right.path) || (left.relatedPath ?? "").localeCompare(right.relatedPath ?? ""); }
