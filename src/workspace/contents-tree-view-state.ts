/**
 * Manuscript Compiler — persistent Contents presentation state.
 *
 * Stores scroll, focus identity, and collapsed folders independently of compile
 * data. One modal owns one instance; changing roots intentionally resets it.
 */
import type { ContentPlanItem } from "../content-plan";
import type { ContentsReviewFilter } from "./workspace-view-model";

export type ContentsControl = "include" | "role" | "move-up" | "move-down" | "toggle";

export interface ContentsFocus {
  path: string;
  control: ContentsControl;
}

/** Mutable view-only state retained for one modal lifetime. */
export class ContentsTreeViewState {
  scrollTop = 0;
  focus?: ContentsFocus;
  correctionMode = false;
  reviewFilter: ContentsReviewFilter = "outline";
  private root = "";
  private readonly expanded = new Set<string>();
  private readonly manuallyCollapsed = new Set<string>();

  prepare(root: string, plan: ContentPlanItem[]): void {
    if (root !== this.root) {
      this.root = root;
      this.scrollTop = 0;
      this.focus = undefined;
      this.correctionMode = false;
      this.reviewFilter = "outline";
      this.expanded.clear();
      this.manuallyCollapsed.clear();
    }
    const folders = new Set(plan.filter((item) => item.kind === "folder").map((item) => item.path));
    for (const path of this.expanded) if (!folders.has(path)) this.expanded.delete(path);
    for (const path of this.manuallyCollapsed) if (!folders.has(path)) this.manuallyCollapsed.delete(path);
    const byPath = new Map(plan.map((item) => [item.path, item]));
    plan.filter((item) => item.warning || !item.detectedRole).forEach((item) => {
      let parent = item.kind === "folder" ? item.path : item.parentPath;
      while (parent !== root) { if (!this.manuallyCollapsed.has(parent)) this.expanded.add(parent); parent = byPath.get(parent)?.parentPath ?? root; }
    });
    if (this.focus && !plan.some((item) => item.path === this.focus?.path)) this.focus = undefined;
  }

  setScrollTop(value: number): void { this.scrollTop = Math.max(0, value); }
  setFocus(path: string, control: ContentsControl): void { this.focus = { path, control }; }
  setCorrectionMode(value: boolean): void { this.correctionMode = value; this.reviewFilter = "outline"; }
  setReviewFilter(value: ContentsReviewFilter): void { this.reviewFilter = value; }
  isExpanded(path: string): boolean { return this.expanded.has(path); }
  collapse(path: string): void { this.expanded.delete(path); this.manuallyCollapsed.add(path); }
  toggle(path: string): void {
    if (this.expanded.has(path)) { this.expanded.delete(path); this.manuallyCollapsed.add(path); }
    else { this.expanded.add(path); this.manuallyCollapsed.delete(path); }
  }

  isVisible(item: ContentPlanItem, byPath: ReadonlyMap<string, ContentPlanItem>): boolean {
    let parent = item.parentPath;
    while (parent !== this.root) {
      if (!this.expanded.has(parent)) return false;
      const ancestor = byPath.get(parent);
      if (!ancestor) break;
      parent = ancestor.parentPath;
    }
    return true;
  }
}
