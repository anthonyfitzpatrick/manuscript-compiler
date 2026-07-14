/** Pure projections used by the compact three-stage workspace. */
import type { ContentPlanItem, ContentRole } from "../content-plan";
import type { CompileWarning } from "../model";
import { visibleRows } from "./content-tree";

export interface ManuscriptPlanSummary {
  totalNotes: number;
  includedNotes: number;
  ignoredNotes: number;
  parts: number;
  chapters: number;
  scenes: number;
  frontMatter: number;
  backMatter: number;
  warnings: number;
  ambiguous: number;
}

export type ContentsReviewFilter = "outline" | "ignored" | "warnings";

export function manuscriptPlanSummary(plan: ContentPlanItem[], root: string): ManuscriptPlanSummary {
  const notes = plan.filter((item) => item.kind === "note");
  const rows = visibleRows(plan, root); const included = new Set(rows.filter((row) => row.included).map((row) => row.item.path));
  const includedNotes = notes.filter((item) => included.has(item.path)).length;
  const structuralCount = (role: ContentRole): number => plan.filter((item) => item.role === role && included.has(item.path)).length;
  return {
    totalNotes: notes.length,
    includedNotes,
    ignoredNotes: notes.length - includedNotes,
    parts: structuralCount("part"),
    chapters: structuralCount("chapter"),
    scenes: structuralCount("scene"),
    frontMatter: structuralCount("front-matter"),
    backMatter: structuralCount("back-matter"),
    warnings: plan.filter((item) => item.warning).length,
    ambiguous: plan.filter((item) => !item.detectedRole).length
  };
}

export function reviewItems(plan: ContentPlanItem[], root: string, filter: ContentsReviewFilter): ContentPlanItem[] {
  const included = new Set(visibleRows(plan, root).filter((row) => row.included).map((row) => row.item.path));
  if (filter === "ignored") return plan.filter((item) => item.kind === "note" && !included.has(item.path));
  if (filter === "warnings") return plan.filter((item) => item.warning);
  return plan.filter((item) => item.role !== "ignore" && included.has(item.path));
}

export interface IgnoredGroup { path: string; name: string; itemCount: number; reason: string; }
export function ignoredGroups(plan: ContentPlanItem[], root: string): IgnoredGroup[] {
  const ignored = reviewItems(plan, root, "ignored"); const byPath = new Map(plan.map((item) => [item.path, item]));
  const hasIgnoredAncestor = (item: ContentPlanItem): boolean => { let parent = byPath.get(item.parentPath); while (parent && parent.path !== root) { if (parent.kind === "folder" && (parent.role === "ignore" || parent.included === false)) return true; parent = byPath.get(parent.parentPath); } return false; };
  const folders = plan.filter((item) => item.kind === "folder" && (item.role === "ignore" || item.included === false) && !hasIgnoredAncestor(item));
  const covered = new Set<string>(); const groups = folders.map((folder) => {
    const children = ignored.filter((item) => item.path.startsWith(`${folder.path}/`)); children.forEach((item) => covered.add(item.path));
    return { path: folder.path, name: folder.name, itemCount: children.length, reason: folder.exclusionReason || "ignored" };
  }).filter((group) => group.itemCount > 0);
  ignored.filter((item) => !covered.has(item.path)).forEach((item) => groups.push({ path: item.path, name: item.name, itemCount: 1, reason: item.exclusionReason || "ignored" }));
  return groups;
}

export function cleanBookTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^book\s+\d+\s*(?:[-–—:.]\s*)+/i, "").trim() || trimmed;
}

export function resolveBookTitle(metadataTitle: unknown, rootTitle: unknown, folderName: string): string {
  const candidate = firstString(metadataTitle, rootTitle) || folderName;
  return cleanBookTitle(candidate) || "Manuscript";
}

export function resolveAuthor(metadataAuthor: unknown, rootAuthor: unknown, profileAuthor: unknown): string {
  return firstString(metadataAuthor, rootAuthor, profileAuthor);
}

export function showUseCurrentFolder(hasResolvedFolder: boolean, launchedFromFolderContext: boolean): boolean {
  return !hasResolvedFolder && !launchedFromFolderContext;
}

export interface WarningCategory { code: string; label: string; count: number; }
export function warningCategories(warnings: CompileWarning[], severity?: CompileWarning["severity"]): WarningCategory[] {
  const counts = new Map<string, number>();
  warnings.filter((warning) => !severity || warning.severity === severity).forEach((warning) => counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, count]) => ({ code, count, label: code.replace(/-/g, " ") }));
}

export function attentionWarnings(warnings: CompileWarning[]): CompileWarning[] { return warnings.filter((warning) => warning.severity === "warning" || warning.severity === "error"); }
export function informationMessages(warnings: CompileWarning[]): CompileWarning[] { return warnings.filter((warning) => warning.severity === "information"); }

export interface FolderIdentity { name: string; parentPath: string; }
export function folderIdentity(path: string): FolderIdentity {
  const segments = path.split("/").filter(Boolean); return { name: segments.pop() || "Manuscript", parentPath: segments.join(" / ") };
}

function firstString(...values: unknown[]): string {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}
