import { setIcon } from "obsidian";
import type { ContentPlanItem } from "../content-plan";
import type { ReconciliationFinding } from "../saved-compilation-reconciliation";
import type { SavedCompilationWorkspaceSession } from "../saved-compilation-session";

export interface SavedReviewActions {
  acknowledge(): boolean;
  addDetected(reference: string): boolean;
}
export interface SavedReviewPresentationState {
  detectedExpanded(): boolean;
  toggleDetected(): boolean;
  setDetectedFocus(reference?: string): void;
  takeDetectedFocus(): string | undefined;
}

/** Renders backend findings only; all resolution semantics remain in the Saved session. */
export function renderSavedCompilationReview(container: HTMLElement, session: SavedCompilationWorkspaceSession, plan: readonly ContentPlanItem[], actions: SavedReviewActions, changed: () => void, presentation: SavedReviewPresentationState): void {
  const result = session.currentReconciliation; const readiness = session.reconciliationReadiness;
  if (!result) return;
  const automatic = result.findings.filter((finding) => finding.presentation === "auto-handled");
  const detected = result.findings.filter((finding) => finding.presentation === "detected-not-in-compilation");
  if (readiness === "review-recommended") renderRecommendedChanges(container, session, automatic, actions, changed);
  else if (automatic.length) renderAutomaticChanges(container, automatic);
  renderDetectedContent(container, detected, plan, actions, changed, presentation);
}

/** Safe inferred additions are source facts, not per-item author decisions. */
function renderAutomaticSummary(parent: HTMLElement, findings: readonly ReconciliationFinding[]): void {
  const scenes = findings.filter((finding) => finding.code === "new-scene").length;
  if (scenes) parent.createEl("p", { text: `${scenes} new scene${scenes === 1 ? "" : "s"} included automatically.`, cls: "manuscript-saved-review-auto-summary" });
}

/** Keep harmless inferred additions distinct from decisions that still block export. */
function renderAutomaticChanges(container: HTMLElement, findings: readonly ReconciliationFinding[]): void {
  const panel = container.createDiv({ cls: "manuscript-saved-review manuscript-saved-review-review-recommended" });
  panel.createEl("h3", { text: "Review changes" });
  panel.createEl("p", { text: "The manuscript has changed since this compilation was saved." });
  renderAutomaticSummary(panel, findings);
}

/** Advisory source changes retain their single acknowledgement without showing action-required rows. */
function renderRecommendedChanges(container: HTMLElement, session: SavedCompilationWorkspaceSession, findings: readonly ReconciliationFinding[], actions: SavedReviewActions, changed: () => void): void {
  const panel = container.createDiv({ cls: "manuscript-saved-review manuscript-saved-review-review-recommended" });
  panel.createEl("h3", { text: "Review changes" });
  panel.createEl("p", { text: "The manuscript has changed since this compilation was saved." });
  renderAutomaticSummary(panel, findings);
  if (!session.reviewAcknowledged) {
    const acknowledge = panel.createEl("button", { text: "I’ve reviewed these changes" });
    acknowledge.addEventListener("click", () => { if (actions.acknowledge()) changed(); });
  } else panel.createEl("p", { text: "Changes reviewed.", cls: "manuscript-saved-review-acknowledged", attr: { role: "status" } });
}

/** Neutral current-source choices: the author may add them, but may also leave them out. */
function renderDetectedContent(container: HTMLElement, findings: readonly ReconciliationFinding[], plan: readonly ContentPlanItem[], actions: SavedReviewActions, changed: () => void, presentation: SavedReviewPresentationState): void {
  if (!findings.length) return;
  const section = container.createDiv({ cls: "manuscript-saved-detected" }); const expanded = presentation.detectedExpanded(); const id = "manuscript-saved-detected-content";
  const toggle = section.createEl("button", { cls: "manuscript-saved-detected-toggle", attr: { type: "button", "aria-expanded": String(expanded), "aria-controls": id } });
  const icon = toggle.createSpan({ cls: "manuscript-saved-detected-icon", attr: { "aria-hidden": "true" } }); setIcon(icon, expanded ? "chevron-down" : "chevron-right");
  toggle.createSpan({ text: `Files detected in this folder that are not part of this compilation (${findings.length})` });
  const list = section.createDiv({ cls: "manuscript-saved-detected-list", attr: { id } }); list.hidden = !expanded;
  const addButtons = new Map<string, HTMLButtonElement>();
  findings.forEach((finding, index) => {
    const row = list.createDiv({ cls: "manuscript-saved-detected-row" }); const item = plan.find((candidate) => candidate.path.endsWith(`/${finding.path}`));
    row.createSpan({ text: item?.name ?? finding.path.split("/").pop() ?? "Detected item" }); const add = row.createEl("button", { text: "Add", attr: { type: "button", "aria-label": `Add ${item?.name ?? finding.path} to this compilation` } });
    addButtons.set(finding.path, add);
    add.addEventListener("click", () => {
      const next = findings[index + 1]?.path ?? findings[index - 1]?.path;
      presentation.setDetectedFocus(next);
      if (actions.addDetected(finding.path)) changed();
    });
  });
  toggle.addEventListener("click", () => { const open = presentation.toggleDetected(); toggle.setAttribute("aria-expanded", String(open)); list.hidden = !open; icon.empty(); setIcon(icon, open ? "chevron-down" : "chevron-right"); });
  if (expanded) {
    const focusReference = presentation.takeDetectedFocus();
    if (focusReference) addButtons.get(focusReference)?.focus();
  }
}
