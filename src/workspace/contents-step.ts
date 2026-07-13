import { Setting } from "obsidian";
import type { ContentRole } from "../content-plan";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { includedNoteCount, visibleRows } from "./content-tree";

const roleLabels: Record<ContentRole, string> = { "front-matter": "Front matter", transparent: "Transparent container", part: "Part", chapter: "Chapter", scene: "Scene", "back-matter": "Back matter", ignore: "Exclude" };
export function renderContentsStep(container: HTMLElement, controller: CompileWorkspaceController, changed: () => void): void {
  const { contentPlan: plan, request } = controller.state;
  container.createEl("h2", { text: "Choose and arrange contents" }); container.createEl("p", { text: "Include the notes that belong in the manuscript, identify what each item represents, and use the arrows to set the order." });
  new Setting(container).setName(`${includedNoteCount(plan, request.manuscriptRoot)} of ${plan.filter((item) => item.kind === "note").length} notes included`).addButton((button) => button.setButtonText("Include all").onClick(() => { controller.includeAll(); changed(); })).addButton((button) => button.setButtonText("Exclude all").onClick(() => { controller.excludeAllNotes(); changed(); }));
  const tree = container.createDiv({ cls: "manuscript-content-plan", attr: { role: "tree", "aria-label": "Manuscript contents" } });
  visibleRows(plan, request.manuscriptRoot).forEach(({ item, depth, included }) => {
    const row = tree.createDiv({ cls: `manuscript-content-row ${included ? "" : "is-excluded"}` }); row.setAttribute("role", "treeitem"); row.style.setProperty("--manuscript-depth", String(depth));
    const include = row.createEl("input", { type: "checkbox" }); include.checked = included; include.setAttribute("aria-label", `${included ? "Exclude" : "Include"} ${item.name}`); include.addEventListener("change", () => { controller.setIncluded(item.path, include.checked); changed(); });
    const label = row.createDiv({ cls: "manuscript-content-name" }); label.createSpan({ text: item.kind === "folder" ? "▸" : "•", cls: "manuscript-content-icon" }); label.createSpan({ text: item.name }); label.createEl("small", { text: item.exclusionReason && !included ? item.exclusionReason : item.kind === "folder" ? "Folder" : "Note" });
    const select = row.createEl("select"); select.setAttribute("aria-label", `Role for ${item.name}`); Object.entries(roleLabels).forEach(([value, text]) => select.createEl("option", { value, text })); select.value = item.role; select.addEventListener("change", () => { controller.setRole(item.path, select.value as ContentRole); changed(); });
    const siblings = plan.filter((candidate) => candidate.parentPath === item.parentPath).sort((a, b) => a.order - b.order); const index = siblings.findIndex((candidate) => candidate.path === item.path); const buttons = row.createDiv({ cls: "manuscript-order-buttons" });
    const up = buttons.createEl("button", { text: "↑", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} up` } }); up.disabled = index === 0; up.addEventListener("click", () => { controller.moveItem(item.path, -1); changed(); });
    const down = buttons.createEl("button", { text: "↓", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} down` } }); down.disabled = index === siblings.length - 1; down.addEventListener("click", () => { controller.moveItem(item.path, 1); changed(); });
  });
  if (!plan.length) container.createEl("p", { cls: "manuscript-empty-state", text: "No Markdown notes were found. Go back and choose another folder." });
}
