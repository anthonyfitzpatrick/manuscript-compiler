import type { ContentPlanItem, ContentRole } from "../content-plan";

export function isEffectivelyIncluded(item: ContentPlanItem, plan: ContentPlanItem[], root: string): boolean {
  if (!item.included || item.role === "ignore") return false;
  const byPath = new Map(plan.map((candidate) => [candidate.path, candidate]));
  return effectivelyIncluded(item, byPath, root);
}

function effectivelyIncluded(item: ContentPlanItem, byPath: ReadonlyMap<string, ContentPlanItem>, root: string): boolean {
  if (!item.included || item.role === "ignore") return false;
  let parent = item.parentPath;
  while (parent !== root) {
    const ancestor = byPath.get(parent);
    if (ancestor && (!ancestor.included || ancestor.role === "ignore")) return false;
    const slash = parent.lastIndexOf("/");
    if (slash < 0) break;
    parent = parent.slice(0, slash);
  }
  return true;
}

export function setItemIncluded(plan: ContentPlanItem[], root: string, path: string, included: boolean): void {
  const item = plan.find((candidate) => candidate.path === path);
  if (!item) return;
  item.included = included;
  item.userOverride = true;
  if (included && item.role === "ignore") item.role = item.kind === "folder" ? "transparent" : "scene";
  if (item.kind === "folder") {
    plan.filter((candidate) => candidate.path.startsWith(`${item.path}/`)).forEach((child) => {
      child.included = included;
      child.userOverride = true;
      if (included && child.role === "ignore") child.role = child.kind === "folder" ? "transparent" : "scene";
    });
  }
  if (included) enableAncestors(plan, root, item.parentPath);
}

export function setItemRole(plan: ContentPlanItem[], root: string, path: string, role: ContentRole): void {
  const item = plan.find((candidate) => candidate.path === path);
  if (!item) return;
  item.role = role;
  item.userOverride = true;
  item.included = role !== "ignore";
  item.exclusionReason = role === "ignore" ? "Excluded by user." : undefined;
  if (item.included) enableAncestors(plan, root, item.parentPath);
}

export function moveSibling(plan: ContentPlanItem[], root: string, path: string, direction: -1 | 1): ContentPlanItem[] {
  const item = plan.find((candidate) => candidate.path === path);
  if (!item) return plan;
  const siblings = plan.filter((candidate) => candidate.parentPath === item.parentPath).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((candidate) => candidate.path === path);
  const target = siblings[index + direction];
  if (!target) return plan;
  [item.order, target.order] = [target.order, item.order];
  item.userOverride = true;
  target.userOverride = true;
  return orderedPlan(plan, root);
}

export function orderedPlan(plan: ContentPlanItem[], root: string): ContentPlanItem[] {
  const children = new Map<string, ContentPlanItem[]>();
  plan.forEach((item) => children.set(item.parentPath, [...(children.get(item.parentPath) ?? []), item]));
  const result: ContentPlanItem[] = [];
  const visit = (parent: string): void => {
    (children.get(parent) ?? []).sort((a, b) => a.order - b.order).forEach((item) => {
      result.push(item);
      if (item.kind === "folder") visit(item.path);
    });
  };
  visit(root);
  return result;
}

export function includedNoteCount(plan: ContentPlanItem[], root: string): number {
  const byPath = new Map(plan.map((item) => [item.path, item]));
  return plan.filter((item) => item.kind === "note" && effectivelyIncluded(item, byPath, root)).length;
}

export function visibleRows(plan: ContentPlanItem[], root: string): Array<{ item: ContentPlanItem; depth: number; included: boolean }> {
  const byPath = new Map(plan.map((item) => [item.path, item]));
  return orderedPlan(plan, root).map((item) => ({ item, depth: Math.max(0, item.path.slice(root.length + 1).split("/").length - 1), included: effectivelyIncluded(item, byPath, root) }));
}

function enableAncestors(plan: ContentPlanItem[], root: string, initial: string): void {
  let parent = initial;
  while (parent !== root) {
    const ancestor = plan.find((candidate) => candidate.path === parent);
    if (ancestor) {
      ancestor.included = true;
      if (ancestor.role === "ignore") ancestor.role = "transparent";
    }
    const slash = parent.lastIndexOf("/");
    if (slash < 0) break;
    parent = parent.slice(0, slash);
  }
}
