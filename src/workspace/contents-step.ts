import { Setting } from "obsidian";
import type { ContentPlanItem, ContentRole } from "../content-plan";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { includedNoteCount, visibleRows } from "./content-tree";
import { ContentsTreeViewState, type ContentsControl } from "./contents-tree-view-state";

const roleLabels: Record<ContentRole, string> = { "front-matter": "Front matter", transparent: "Transparent container", part: "Part", chapter: "Chapter", scene: "Scene", "back-matter": "Back matter", ignore: "Exclude" };
interface RowRecord {
  element: HTMLElement;
  include: HTMLInputElement;
  description: HTMLElement;
  select: HTMLSelectElement;
  toggle?: HTMLButtonElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
}

interface RowSnapshot {
  role: ContentRole;
  included: boolean;
  effective: boolean;
  reason?: string;
  order: number;
  first: boolean;
  last: boolean;
}

export function renderContentsStep(container: HTMLElement, controller: CompileWorkspaceController, viewState: ContentsTreeViewState): void {
  const { contentPlan: plan, request } = controller.state;
  viewState.prepare(request.manuscriptRoot, plan);
  container.createEl("h2", { text: "Choose and arrange contents" }); container.createEl("p", { text: "Include the notes that belong in the manuscript, identify what each item represents, and use the arrows to set the order." });
  const summary = new Setting(container).setName("");
  const tree = container.createDiv({ cls: "manuscript-content-plan", attr: { role: "tree", "aria-label": "Manuscript contents" } });
  const records = new Map<string, RowRecord>();
  const byPath = (): Map<string, ContentPlanItem> => new Map(controller.state.contentPlan.map((item) => [item.path, item]));
  const snapshots = (): Map<string, RowSnapshot> => snapshotRows(controller.state.contentPlan, request.manuscriptRoot);
  const rememberFocus = (path: string, control: ContentsControl, element: HTMLElement): void => {
    element.addEventListener("focus", () => viewState.setFocus(path, control));
  };

  const updateSummary = (): void => {
    summary.setName(`${includedNoteCount(controller.state.contentPlan, request.manuscriptRoot)} of ${controller.state.contentPlan.filter((item) => item.kind === "note").length} notes included`);
  };
  const updateRow = (path: string, states = snapshotRows(controller.state.contentPlan, request.manuscriptRoot), items = byPath()): void => {
    const item = items.get(path); const record = records.get(path);
    if (!item || !record) return;
    const state = states.get(path);
    if (!state) return;
    record.element.toggleClass("is-excluded", !state.effective);
    record.include.checked = state.effective;
    record.include.setAttribute("aria-label", `${state.effective ? "Exclude" : "Include"} ${item.name}`);
    record.description.setText(item.exclusionReason && !state.effective ? item.exclusionReason : item.kind === "folder" ? "Folder" : "Note");
    record.select.value = item.role;
    record.up.disabled = state.first;
    record.down.disabled = state.last;
    if (record.toggle) {
      const expanded = viewState.isExpanded(path);
      record.toggle.setText(expanded ? "▾" : "▸");
      record.toggle.setAttribute("aria-expanded", String(expanded));
      record.toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${item.name}`);
      record.element.setAttribute("aria-expanded", String(expanded));
    }
  };
  const syncOrderAndVisibility = (): void => {
    const items = byPath();
    visibleRows(controller.state.contentPlan, request.manuscriptRoot).forEach(({ item }) => {
      const record = records.get(item.path);
      if (!record) return;
      record.element.hidden = !viewState.isVisible(item, items);
      tree.appendChild(record.element);
    });
  };
  const refreshChangedRows = (before: Map<string, RowSnapshot>): void => {
    const after = snapshots(); const items = byPath();
    for (const path of changedRowPaths(before, after)) updateRow(path, after, items);
    updateSummary();
  };
  const preserveInteraction = (element: HTMLElement, change: () => void): void => {
    const scrollTop = container.scrollTop;
    change();
    container.scrollTop = scrollTop;
    viewState.setScrollTop(scrollTop);
    if (document.activeElement !== element) element.focus({ preventScroll: true });
  };

  summary.addButton((button) => button.setButtonText("Include all").onClick(() => {
    const before = snapshots(); controller.includeAll(); refreshChangedRows(before);
  })).addButton((button) => button.setButtonText("Exclude all").onClick(() => {
    const before = snapshots(); controller.excludeAllNotes(); refreshChangedRows(before);
  }));
  visibleRows(plan, request.manuscriptRoot).forEach(({ item, depth, included }) => {
    const row = tree.createDiv({ cls: `manuscript-content-row ${included ? "" : "is-excluded"}` }); row.setAttribute("role", "treeitem"); row.style.setProperty("--manuscript-depth", String(depth));
    row.dataset.path = item.path;
    const include = row.createEl("input", { type: "checkbox" }); include.checked = included; include.setAttribute("aria-label", `${included ? "Exclude" : "Include"} ${item.name}`); rememberFocus(item.path, "include", include);
    const label = row.createDiv({ cls: "manuscript-content-name" });
    let toggle: HTMLButtonElement | undefined;
    if (item.kind === "folder") {
      toggle = label.createEl("button", { text: "▾", cls: "manuscript-content-icon clickable-icon" }); rememberFocus(item.path, "toggle", toggle);
    } else label.createSpan({ text: "•", cls: "manuscript-content-icon" });
    label.createSpan({ text: item.name }); const description = label.createEl("small", { text: item.exclusionReason && !included ? item.exclusionReason : item.kind === "folder" ? "Folder" : "Note" });
    const select = row.createEl("select"); select.setAttribute("aria-label", `Role for ${item.name}`); Object.entries(roleLabels).forEach(([value, text]) => select.createEl("option", { value, text })); select.value = item.role; rememberFocus(item.path, "role", select);
    const siblings = plan.filter((candidate) => candidate.parentPath === item.parentPath).sort((a, b) => a.order - b.order); const index = siblings.findIndex((candidate) => candidate.path === item.path); const buttons = row.createDiv({ cls: "manuscript-order-buttons" });
    const up = buttons.createEl("button", { text: "↑", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} up` } }); up.disabled = index === 0; rememberFocus(item.path, "move-up", up);
    const down = buttons.createEl("button", { text: "↓", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} down` } }); down.disabled = index === siblings.length - 1; rememberFocus(item.path, "move-down", down);
    records.set(item.path, { element: row, include, description, select, toggle, up, down });
    include.addEventListener("change", () => preserveInteraction(include, () => { const before = snapshots(); controller.setIncluded(item.path, include.checked); if (item.kind === "folder" && !include.checked) { viewState.collapse(item.path); syncOrderAndVisibility(); } refreshChangedRows(before); updateRow(item.path); }));
    select.addEventListener("change", () => preserveInteraction(select, () => { const before = snapshots(); controller.setRole(item.path, select.value as ContentRole); if (item.kind === "folder" && select.value === "ignore") { viewState.collapse(item.path); syncOrderAndVisibility(); } refreshChangedRows(before); updateRow(item.path); }));
    up.addEventListener("click", () => preserveInteraction(up, () => { const before = snapshots(); controller.moveItem(item.path, -1); syncOrderAndVisibility(); refreshChangedRows(before); }));
    down.addEventListener("click", () => preserveInteraction(down, () => { const before = snapshots(); controller.moveItem(item.path, 1); syncOrderAndVisibility(); refreshChangedRows(before); }));
    toggle?.addEventListener("click", () => preserveInteraction(toggle!, () => { viewState.toggle(item.path); syncOrderAndVisibility(); updateRow(item.path); }));
  });
  updateSummary(); syncOrderAndVisibility(); const initialStates = snapshots(); const initialItems = byPath(); records.forEach((_record, path) => updateRow(path, initialStates, initialItems));
  container.scrollTop = viewState.scrollTop;
  container.addEventListener("scroll", () => viewState.setScrollTop(container.scrollTop), { passive: true });
  if (viewState.focus) {
    const record = records.get(viewState.focus.path); const control = record && controlFor(record, viewState.focus.control);
    if (control && !control.closest<HTMLElement>(".manuscript-content-row")?.hidden) control.focus({ preventScroll: true });
  }
  if (!plan.length) container.createEl("p", { cls: "manuscript-empty-state", text: "No Markdown notes were found. Go back and choose another folder." });
}

export function snapshotRows(plan: ContentPlanItem[], root: string): Map<string, RowSnapshot> {
  const effective = new Map(visibleRows(plan, root).map((row) => [row.item.path, row.included]));
  const siblings = new Map<string, ContentPlanItem[]>();
  plan.forEach((item) => siblings.set(item.parentPath, [...(siblings.get(item.parentPath) ?? []), item]));
  const positions = new Map<string, { first: boolean; last: boolean }>();
  siblings.forEach((items) => items.sort((a, b) => a.order - b.order).forEach((item, index) => positions.set(item.path, { first: index === 0, last: index === items.length - 1 })));
  return new Map(plan.map((item) => {
    const position = positions.get(item.path) ?? { first: true, last: true };
    return [item.path, { role: item.role, included: item.included, effective: effective.get(item.path) === true, reason: item.exclusionReason, order: item.order, ...position }];
  }));
}

export function changedRowPaths(before: ReadonlyMap<string, RowSnapshot>, after: ReadonlyMap<string, RowSnapshot>): string[] {
  const changed: string[] = [];
  for (const [path, state] of after) if (!sameSnapshot(before.get(path), state)) changed.push(path);
  return changed;
}

function sameSnapshot(left: RowSnapshot | undefined, right: RowSnapshot): boolean {
  return left !== undefined && left.role === right.role && left.included === right.included && left.effective === right.effective && left.reason === right.reason && left.order === right.order && left.first === right.first && left.last === right.last;
}

function controlFor(record: RowRecord, control: ContentsControl): HTMLElement | undefined {
  if (control === "include") return record.include;
  if (control === "role") return record.select;
  if (control === "move-up") return record.up;
  if (control === "move-down") return record.down;
  return record.toggle;
}
