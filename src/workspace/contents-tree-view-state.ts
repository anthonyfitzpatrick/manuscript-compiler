import type { ContentPlanItem } from "../content-plan";

export type ContentsControl = "include" | "role" | "move-up" | "move-down" | "toggle";

export interface ContentsFocus {
  path: string;
  control: ContentsControl;
}

/** UI-only state that must survive a Contents-step DOM rebuild. */
export class ContentsTreeViewState {
  scrollTop = 0;
  focus?: ContentsFocus;
  private root = "";
  private readonly collapsed = new Set<string>();

  prepare(root: string, plan: ContentPlanItem[]): void {
    if (root !== this.root) {
      this.root = root;
      this.scrollTop = 0;
      this.focus = undefined;
      this.collapsed.clear();
    }
    const folders = new Set(plan.filter((item) => item.kind === "folder").map((item) => item.path));
    for (const path of this.collapsed) if (!folders.has(path)) this.collapsed.delete(path);
    if (this.focus && !plan.some((item) => item.path === this.focus?.path)) this.focus = undefined;
  }

  setScrollTop(value: number): void { this.scrollTop = Math.max(0, value); }
  setFocus(path: string, control: ContentsControl): void { this.focus = { path, control }; }
  isExpanded(path: string): boolean { return !this.collapsed.has(path); }
  collapse(path: string): void { this.collapsed.add(path); }
  toggle(path: string): void { if (this.collapsed.has(path)) this.collapsed.delete(path); else this.collapsed.add(path); }

  isVisible(item: ContentPlanItem, byPath: ReadonlyMap<string, ContentPlanItem>): boolean {
    let parent = item.parentPath;
    while (parent !== this.root) {
      if (this.collapsed.has(parent)) return false;
      const ancestor = byPath.get(parent);
      if (!ancestor) break;
      parent = ancestor.parentPath;
    }
    return true;
  }
}
