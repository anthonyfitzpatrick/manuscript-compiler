import type { ContentPlanItem } from "../content-plan";
import type { SavedCompilationWorkspaceSession } from "../saved-compilation-session";

export interface SavedReviewActions {
  acknowledge(): boolean;
  acceptNew(reference: string): boolean;
  acceptDeleted(reference: string): boolean;
  map(reference: string, target: string): boolean;
}

/** Renders backend findings only; all resolution semantics remain in the Saved session. */
export function renderSavedCompilationReview(container: HTMLElement, session: SavedCompilationWorkspaceSession, plan: readonly ContentPlanItem[], actions: SavedReviewActions, changed: () => void): void {
  const result = session.currentReconciliation; const readiness = session.reconciliationReadiness;
  if (!result || readiness === "ready") return;
  const panel = container.createDiv({ cls: `manuscript-saved-review manuscript-saved-review-${readiness}` });
  const required = readiness === "review-required" || readiness === "blocked";
  panel.createEl("h3", { text: required ? "Changes need attention" : "Review changes" });
  panel.createEl("p", { text: readiness === "blocked" ? "This saved compilation cannot be reviewed until its manuscript folder is available." : required ? "Some saved compilation choices no longer match the current manuscript. Resolve them before creating a file." : "The manuscript has changed since this compilation was saved. Review the changes before creating a file." });
  const groups = new Map<string, typeof result.findings>();
  for (const finding of result.findings.filter((item) => !item.resolved || item.code === "new-scene")) {
    const key = finding.code === "new-scene" ? "New content" : finding.code === "missing-reference" || finding.code === "manual-order-incomplete" ? "Missing content" : finding.code === "unresolved-reference" ? "Needs matching" : "Unresolved session changes";
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  if (groups.size) panel.createEl("p", { text: [...groups.values()].map((items) => `${items.length} ${items.length === 1 ? "item" : "items"}`).join(" · "), cls: "manuscript-saved-review-summary" });
  for (const [title, findings] of groups) {
    const section = panel.createDiv({ cls: "manuscript-saved-review-group" }); section.createEl("h4", { text: title });
    findings.forEach((finding) => renderFinding(section, finding.path, finding.code, plan, actions, changed));
  }
  if (readiness === "review-recommended" && !session.reviewAcknowledged) {
    const acknowledge = panel.createEl("button", { text: "I’ve reviewed these changes" });
    acknowledge.addEventListener("click", () => { if (actions.acknowledge()) changed(); });
  } else if (readiness === "review-recommended") panel.createEl("p", { text: "Changes reviewed.", cls: "manuscript-saved-review-acknowledged", attr: { role: "status" } });
}

function renderFinding(parent: HTMLElement, path: string, code: string, plan: readonly ContentPlanItem[], actions: SavedReviewActions, changed: () => void): void {
  const row = parent.createDiv({ cls: "manuscript-saved-review-row" }); const pathParts = path.split("/").filter(Boolean); const name = pathParts[pathParts.length - 1] || "This item";
  row.createEl("strong", { text: name });
  if (code === "new-scene") { row.createSpan({ text: "New since this compilation was saved." }); const accept = row.createEl("button", { text: "Accept" }); accept.addEventListener("click", () => { if (actions.acceptNew(path)) changed(); }); return; }
  if (code === "missing-reference" || code === "manual-order-incomplete") { row.createSpan({ text: "This saved choice no longer matches the manuscript." }); const accept = row.createEl("button", { text: "Remove saved reference" }); accept.addEventListener("click", () => { if (actions.acceptDeleted(path)) changed(); }); return; }
  if (code === "unresolved-reference") {
    row.createSpan({ text: "This saved item could not be matched automatically." }); const label = row.createEl("label", { text: "Use current item" }); const select = row.createEl("select", { attr: { id: `manuscript-saved-review-${path.replace(/[^a-z0-9]+/gi, "-")}` } }); select.setAttribute("aria-label", `Choose current item for ${name}`); label.htmlFor = select.id; plan.filter((item) => item.kind === "note").forEach((item) => select.createEl("option", { value: item.path, text: item.name })); const use = row.createEl("button", { text: "Use this item" }); use.addEventListener("click", () => { if (actions.map(path, select.value)) changed(); else row.createSpan({ text: "That item cannot be used.", cls: "manuscript-saved-review-error", attr: { role: "alert" } }); }); return;
  }
  row.createSpan({ text: "This unsaved change needs attention." });
}
