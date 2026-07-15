/** Compact Contents review with an explicit full-control correction mode. */
import { setIcon, Setting } from "obsidian";
import type { ContentPlanItem, ContentRole } from "../content-plan";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { orderedPlan, visibleRows } from "./content-tree";
import { ContentsTreeViewState, type ContentsControl } from "./contents-tree-view-state";
import { ignoredGroups, manuscriptPlanSummary, reviewItems } from "./workspace-view-model";

const roleLabels: Record<ContentRole, string> = { "front-matter": "Front matter", transparent: "Transparent container", part: "Part", chapter: "Chapter", scene: "Scene", "back-matter": "Back matter", ignore: "Exclude" };
interface RowRecord { element: HTMLElement; include: HTMLInputElement; description: HTMLElement; select: HTMLSelectElement; toggle?: HTMLButtonElement; up: HTMLButtonElement; down: HTMLButtonElement; }
interface RowSnapshot { role: ContentRole; included: boolean; effective: boolean; reason?: string; order: number; first: boolean; last: boolean; }

export function renderContentsStep(container: HTMLElement, controller: CompileWorkspaceController, viewState: ContentsTreeViewState): void {
  const { contentPlan: plan, request } = controller.state;
  viewState.prepare(request.manuscriptRoot, plan);
  const counts = manuscriptPlanSummary(plan, request.manuscriptRoot);
  container.createEl("h2", { text: "Review contents" });
  container.createEl("p", { text: "Review the detected structure. Correct anything that is not right." });
  const summary = container.createDiv({ cls: "manuscript-contents-summary", attr: { "aria-label": "Manuscript contents summary" } });
  [[`${counts.includedNotes} of ${counts.totalNotes}`, "notes included"], [String(counts.parts), "Parts"], [String(counts.chapters), "Chapters"], [String(counts.scenes), "Scenes"], [String(counts.frontMatter), "Front Matter"], [String(counts.backMatter), "Back Matter"], [String(counts.ignoredNotes), "Ignored"]].forEach(([value, label]) => { const item = summary.createDiv(); item.createEl("strong", { text: value }); item.createSpan({ text: label }); });
  const toolbar = container.createDiv({ cls: `manuscript-contents-toolbar${viewState.correctionMode ? " is-active" : ""}` });
  const label = viewState.correctionMode ? "Finish correcting structure" : "Correct structure";
  const correction = toolbar.createEl("button", { cls: `mod-cta manuscript-correct-structure${viewState.correctionMode ? " is-active" : ""}`, attr: { type: "button", "aria-label": label } });
  const icon = correction.createSpan({ cls: "manuscript-correct-structure-icon", attr: { "aria-hidden": "true" } }); setIcon(icon, "list-tree"); correction.createSpan({ text: label });
  correction.setAttribute("aria-pressed", String(viewState.correctionMode));
  correction.addEventListener("click", () => { viewState.setCorrectionMode(!viewState.correctionMode); renderAgain(container, controller, viewState, undefined, true); });
  toolbar.createEl("p", { text: "Change folder and note types, inclusion, and order." });
  if (viewState.correctionMode) renderCorrectionMode(container, controller, viewState);
  else renderReviewMode(container, controller, viewState, counts.ignoredNotes, counts.warnings, counts.ambiguous);
}

function renderAgain(container: HTMLElement, controller: CompileWorkspaceController, viewState: ContentsTreeViewState, focusPath?: string, focusToolbar = false, focusReview?: string): void {
  const scrollTop = container.scrollTop; container.empty(); renderContentsStep(container, controller, viewState); container.scrollTop = scrollTop; viewState.setScrollTop(scrollTop);
  const target = focusPath ? Array.from(container.querySelectorAll<HTMLElement>(".manuscript-outline-toggle")).find((item) => item.dataset.path === focusPath) : focusToolbar ? container.querySelector<HTMLElement>(".manuscript-contents-toolbar button") : focusReview ? container.querySelector<HTMLElement>(`[data-review="${focusReview}"]`) : undefined;
  target?.focus({ preventScroll: true });
}

function renderReviewMode(container: HTMLElement, controller: CompileWorkspaceController, viewState: ContentsTreeViewState, ignored: number, warnings: number, ambiguous: number): void {
  const { contentPlan: plan, request } = controller.state;
  const reviews = container.createDiv({ cls: "manuscript-review-sections" });
  reviewRow(reviews, "ignored", "Ignored project notes", ignored, viewState.reviewFilter === "ignored", () => { viewState.setReviewFilter(viewState.reviewFilter === "ignored" ? "outline" : "ignored"); renderAgain(container, controller, viewState, undefined, false, "ignored"); });
  reviewRow(reviews, "warnings", "Warnings", warnings, viewState.reviewFilter === "warnings", () => { viewState.setReviewFilter(viewState.reviewFilter === "warnings" ? "outline" : "warnings"); renderAgain(container, controller, viewState, undefined, false, "warnings"); });
  if (ambiguous) reviews.createEl("p", { text: `Ambiguous items · ${ambiguous}` });
  if (viewState.reviewFilter !== "outline") {
    const items = reviewItems(plan, request.manuscriptRoot, viewState.reviewFilter);
    const list = container.createEl("ul", { cls: "manuscript-focused-review", attr: { "aria-label": viewState.reviewFilter === "ignored" ? "Ignored notes" : "Warnings" } });
    if (viewState.reviewFilter === "ignored") ignoredGroups(plan, request.manuscriptRoot).forEach((group) => list.createEl("li", { text: `${group.name} — ${group.reason} — ${group.itemCount} item${group.itemCount === 1 ? "" : "s"}` }));
    else items.forEach((item) => list.createEl("li", { text: `${item.name} — ${item.warning ?? item.exclusionReason ?? roleLabels[item.role]}` }));
    if (!items.length) list.createEl("li", { text: "None" });
    return;
  }
  const outline = container.createDiv({ cls: "manuscript-compact-outline", attr: { role: "tree", "aria-label": "Detected manuscript outline" } });
  const children = new Map<string, ContentPlanItem[]>(); orderedPlan(plan, request.manuscriptRoot).forEach((item) => children.set(item.parentPath, [...(children.get(item.parentPath) ?? []), item]));
  const includedPaths = new Set(visibleRows(plan, request.manuscriptRoot).filter((row) => row.included).map((row) => row.item.path));
  renderOutlineChildren(outline, request.manuscriptRoot, controller, viewState, children, includedPaths, 0);
  if (!plan.length) outline.createEl("p", { cls: "manuscript-empty-state", text: "No Markdown notes were found. Go back and choose another folder." });
}

function reviewRow(parent: HTMLElement, key: string, label: string, count: number, active: boolean, action: () => void): void {
  const row = parent.createDiv({ cls: "manuscript-review-row" }); row.createSpan({ text: label }); row.createSpan({ text: `${count} item${count === 1 ? "" : "s"}` });
  const button = row.createEl("button", { text: active ? "Close" : "Review" }); button.dataset.review = key; button.setAttribute("aria-expanded", String(active)); button.addEventListener("click", action);
}

function renderOutlineChildren(parent: HTMLElement, parentPath: string, controller: CompileWorkspaceController, viewState: ContentsTreeViewState, childrenByParent: ReadonlyMap<string, ContentPlanItem[]>, includedPaths: ReadonlySet<string>, depth: number): void {
  const { contentPlan: plan } = controller.state;
  (childrenByParent.get(parentPath) ?? []).forEach((item) => {
    if (!includedPaths.has(item.path) || item.role === "ignore") return;
    const hasChildren = item.kind === "folder" && item.role !== "chapter" && (childrenByParent.get(item.path) ?? []).some((candidate) => candidate.role !== "ignore");
    const row = parent.createDiv({ cls: `manuscript-outline-row manuscript-outline-${item.role}${item.role === "transparent" ? " is-transparent" : ""}`, attr: { role: "treeitem" } }); row.setCssProps({ "--manuscript-depth": String(depth) });
    if (hasChildren) {
      createFolderToggle(row, item, viewState.isExpanded(item.path), () => { viewState.toggle(item.path); viewState.setFocus(item.path, "toggle"); renderAgain(parent.closest(".manuscript-compile-body") as HTMLElement, controller, viewState, item.path); });
    } else row.createSpan({ text: "•", cls: "manuscript-outline-marker", attr: { "aria-hidden": "true" } });
    const label = row.createDiv({ cls: "manuscript-outline-label" }); label.createSpan({ text: item.name }); label.createEl("small", { text: outlineDescription(item, plan, includedPaths) });
    if (item.warning) row.createSpan({ text: "Warning", cls: "manuscript-outline-status" });
    if (hasChildren && viewState.isExpanded(item.path)) { const children = parent.createDiv({ cls: "manuscript-outline-children", attr: { role: "group" } }); renderOutlineChildren(children, item.path, controller, viewState, childrenByParent, includedPaths, depth + 1); }
  });
}

function outlineDescription(item: ContentPlanItem, plan: ContentPlanItem[], includedPaths: ReadonlySet<string>): string {
  const descendants = plan.filter((candidate) => candidate.path.startsWith(`${item.path}/`) && candidate.kind === "note" && includedPaths.has(candidate.path));
  if (item.role === "part") { const chapters = plan.filter((candidate) => candidate.path.startsWith(`${item.path}/`) && candidate.role === "chapter" && includedPaths.has(candidate.path)).length; return `${chapters} chapter${chapters === 1 ? "" : "s"}`; }
  if (item.role === "chapter") return `${descendants.length} scene${descendants.length === 1 ? "" : "s"}`;
  if (item.role === "front-matter" || item.role === "back-matter") return `${descendants.length || (item.kind === "note" ? 1 : 0)} item${descendants.length === 1 ? "" : "s"}`;
  return roleLabels[item.role];
}

function renderCorrectionMode(container: HTMLElement, controller: CompileWorkspaceController, viewState: ContentsTreeViewState): void {
  const { contentPlan: plan, request } = controller.state;
  const summary = new Setting(container).setName(`${manuscriptPlanSummary(plan, request.manuscriptRoot).includedNotes} of ${plan.filter((item) => item.kind === "note").length} notes included`);
  const tree = container.createDiv({ cls: "manuscript-content-plan is-correction-mode", attr: { role: "tree", "aria-label": "Correct manuscript contents" } });
  const records = new Map<string, RowRecord>();
  const byPath = (): Map<string, ContentPlanItem> => new Map(controller.state.contentPlan.map((item) => [item.path, item]));
  const snapshots = (): Map<string, RowSnapshot> => snapshotRows(controller.state.contentPlan, request.manuscriptRoot);
  const rememberFocus = (path: string, control: ContentsControl, element: HTMLElement): void => { element.addEventListener("focus", () => viewState.setFocus(path, control)); };
  const updateSummary = (): void => { const counts = manuscriptPlanSummary(controller.state.contentPlan, request.manuscriptRoot); summary.setName(`${counts.includedNotes} of ${counts.totalNotes} notes included`); };
  const updateRow = (path: string, states = snapshots(), items = byPath()): void => {
    const item = items.get(path); const record = records.get(path); const state = states.get(path); if (!item || !record || !state) return;
    record.element.toggleClass("is-excluded", !state.effective); record.include.checked = state.effective; record.include.setAttribute("aria-label", `${state.effective ? "Exclude" : "Include"} ${item.name}`);
    record.description.setText(item.exclusionReason && !state.effective ? item.exclusionReason : roleLabels[item.role]); record.select.value = item.role; record.up.disabled = state.first; record.down.disabled = state.last;
    if (record.toggle) { const expanded = viewState.isExpanded(path); record.toggle.toggleClass("is-expanded", expanded); record.toggle.disabled = !state.effective || item.role === "ignore"; record.toggle.setAttribute("aria-expanded", String(expanded)); record.toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${item.name}`); }
  };
  const syncOrderAndVisibility = (): void => { const items = byPath(); visibleRows(controller.state.contentPlan, request.manuscriptRoot).forEach(({ item }) => { const record = records.get(item.path); if (!record) return; record.element.hidden = !viewState.isVisible(item, items); tree.appendChild(record.element); }); };
  const refreshChangedRows = (before: Map<string, RowSnapshot>): void => { const after = snapshots(); const items = byPath(); changedRowPaths(before, after).forEach((path) => updateRow(path, after, items)); updateSummary(); };
  const preserveInteraction = (element: HTMLElement, change: () => void): void => { const scrollTop = container.scrollTop; change(); container.scrollTop = scrollTop; viewState.setScrollTop(scrollTop); if (element.doc.activeElement !== element) element.focus({ preventScroll: true }); };
  summary.addButton((button) => button.setButtonText("Include all").onClick(() => { const before = snapshots(); controller.includeAll(); refreshChangedRows(before); })).addButton((button) => button.setButtonText("Exclude all").onClick(() => { const before = snapshots(); controller.excludeAllNotes(); refreshChangedRows(before); }));
  const initialItems = byPath();
  visibleRows(plan, request.manuscriptRoot).filter(({ item }) => viewState.isVisible(item, initialItems)).forEach(({ item, depth, included }) => {
    const row = tree.createDiv({ cls: `manuscript-content-row ${included ? "" : "is-excluded"}`, attr: { role: "treeitem" } }); row.setCssProps({ "--manuscript-depth": String(depth) }); row.dataset.path = item.path;
    const include = row.createEl("input", { type: "checkbox" }); include.checked = included; include.setAttribute("aria-label", `${included ? "Exclude" : "Include"} ${item.name}`); rememberFocus(item.path, "include", include);
    const label = row.createDiv({ cls: "manuscript-content-name" }); let toggle: HTMLButtonElement | undefined;
    if (item.kind === "folder") { toggle = createFolderToggle(label, item, viewState.isExpanded(item.path)); rememberFocus(item.path, "toggle", toggle); } else label.createSpan({ text: "•", cls: "manuscript-content-icon" });
    label.createSpan({ text: item.name }); const description = label.createEl("small", { text: item.exclusionReason && !included ? item.exclusionReason : roleLabels[item.role] });
    const select = row.createEl("select"); select.setAttribute("aria-label", `Type for ${item.name}`); Object.entries(roleLabels).forEach(([value, text]) => select.createEl("option", { value, text })); select.value = item.role; rememberFocus(item.path, "role", select);
    const siblings = plan.filter((candidate) => candidate.parentPath === item.parentPath).sort((a, b) => a.order - b.order); const index = siblings.findIndex((candidate) => candidate.path === item.path); const buttons = row.createDiv({ cls: "manuscript-order-buttons" });
    const up = buttons.createEl("button", { text: "↑", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} up` } }); up.disabled = index === 0; rememberFocus(item.path, "move-up", up);
    const down = buttons.createEl("button", { text: "↓", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} down` } }); down.disabled = index === siblings.length - 1; rememberFocus(item.path, "move-down", down);
    records.set(item.path, { element: row, include, description, select, toggle, up, down });
    include.addEventListener("change", () => { controller.setIncluded(item.path, include.checked); if (item.kind === "folder" && !include.checked) viewState.collapse(item.path); renderAgain(container, controller, viewState); });
    select.addEventListener("change", () => { controller.setRole(item.path, select.value as ContentRole); if (item.kind === "folder" && select.value === "ignore") viewState.collapse(item.path); renderAgain(container, controller, viewState); });
    up.addEventListener("click", () => preserveInteraction(up, () => { const before = snapshots(); controller.moveItem(item.path, -1); syncOrderAndVisibility(); refreshChangedRows(before); })); down.addEventListener("click", () => preserveInteraction(down, () => { const before = snapshots(); controller.moveItem(item.path, 1); syncOrderAndVisibility(); refreshChangedRows(before); }));
    toggle?.addEventListener("click", () => { if (!include.checked || select.value === "ignore") return; viewState.toggle(item.path); renderAgain(container, controller, viewState); });
  });
  updateSummary(); syncOrderAndVisibility(); const initialStates = snapshots(); records.forEach((_record, path) => updateRow(path, initialStates, initialItems));
  container.scrollTop = viewState.scrollTop; container.addEventListener("scroll", () => viewState.setScrollTop(container.scrollTop), { passive: true });
  if (viewState.focus) { const record = records.get(viewState.focus.path); const control = record && controlFor(record, viewState.focus.control); if (control && !control.closest<HTMLElement>(".manuscript-content-row")?.hidden) control.focus({ preventScroll: true }); }
}

export function snapshotRows(plan: ContentPlanItem[], root: string): Map<string, RowSnapshot> {
  const effective = new Map(visibleRows(plan, root).map((row) => [row.item.path, row.included])); const siblings = new Map<string, ContentPlanItem[]>();
  plan.forEach((item) => siblings.set(item.parentPath, [...(siblings.get(item.parentPath) ?? []), item])); const positions = new Map<string, { first: boolean; last: boolean }>();
  siblings.forEach((items) => items.sort((a, b) => a.order - b.order).forEach((item, index) => positions.set(item.path, { first: index === 0, last: index === items.length - 1 })));
  return new Map(plan.map((item) => { const position = positions.get(item.path) ?? { first: true, last: true }; return [item.path, { role: item.role, included: item.included, effective: effective.get(item.path) === true, reason: item.exclusionReason, order: item.order, ...position }]; }));
}
export function changedRowPaths(before: ReadonlyMap<string, RowSnapshot>, after: ReadonlyMap<string, RowSnapshot>): string[] { const changed: string[] = []; for (const [path, state] of after) if (!sameSnapshot(before.get(path), state)) changed.push(path); return changed; }
function sameSnapshot(left: RowSnapshot | undefined, right: RowSnapshot): boolean { return left !== undefined && left.role === right.role && left.included === right.included && left.effective === right.effective && left.reason === right.reason && left.order === right.order && left.first === right.first && left.last === right.last; }
function controlFor(record: RowRecord, control: ContentsControl): HTMLElement | undefined { if (control === "include") return record.include; if (control === "role") return record.select; if (control === "move-up") return record.up; if (control === "move-down") return record.down; return record.toggle; }

/** One native-button disclosure control for every rendered folder row. */
function createFolderToggle(parent: HTMLElement, item: ContentPlanItem, expanded: boolean, action?: () => void): HTMLButtonElement {
  const toggle = parent.createEl("button", { text: "›", cls: `clickable-icon manuscript-folder-toggle${expanded ? " is-expanded" : ""}` });
  toggle.dataset.path = item.path;
  toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${item.name}`);
  toggle.setAttribute("aria-expanded", String(expanded));
  if (action) toggle.addEventListener("click", action);
  return toggle;
}
