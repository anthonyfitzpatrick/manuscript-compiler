/**
 * Manuscript Compiler — Export step renderer.
 *
 * Displays preparation status, semantic outline, warnings, exclusions, and output.
 * It emits actions to the controller and never builds a Book or accesses files.
 */
import { Setting } from "obsidian";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { buildExportPreviewViewModel } from "./export-preview";

export interface ExportStepActions { refresh(): void; filename(value: string): string; changed(): void; }
export function renderExportStep(container: HTMLElement, controller: CompileWorkspaceController, actions: ExportStepActions): void {
  const state = controller.state;
  container.createEl("h2", { text: "Create your manuscript" });
  const status = container.createDiv({ cls: "manuscript-ready-card" });
  if (state.preparationStatus === "preparing") { status.createEl("strong", { text: "Preparing final manuscript…" }); status.createEl("p", { text: "Parsing and cleaning the selected notes so this preview exactly matches the export." }); return; }
  if (!state.preparedSession) { status.createEl("strong", { text: state.error ? "Preview needs attention" : "Final preview is not prepared" }); status.createEl("p", { text: state.error?.message || "Refresh the preview before creating the DOCX." }); if (state.error?.suggestion) status.createEl("p", { text: state.error.suggestion }); status.createEl("button", { text: "Refresh Preview", cls: "mod-cta" }).addEventListener("click", actions.refresh); return; }
  const preview = buildExportPreviewViewModel(state.preparedSession);
  status.createEl("strong", { text: "Final manuscript prepared" }); status.createEl("p", { text: "This preview and the export use the same parsed manuscript model." });
  const summary = container.createEl("dl", { cls: "manuscript-export-summary" }); summaryRow(summary, "Book title", preview.title); summaryRow(summary, "Total words", preview.statistics.totalWordCount.toLocaleString()); summaryRow(summary, "Output filename", state.request.outputFilename); summaryRow(summary, "Format", `${state.formatting.font}, ${state.formatting.fontSize} pt, ${state.formatting.lineSpacing === 2 ? "double" : state.formatting.lineSpacing} spacing`);
  container.createEl("h3", { text: "Output outline" }); renderOutline(container, preview);
  if (preview.exclusions.length) { const details = container.createEl("details"); details.createEl("summary", { text: `Excluded notes (${preview.exclusions.length})` }); const list = details.createEl("ul"); preview.exclusions.forEach((item) => list.createEl("li", { text: `${item.name} — ${item.reason}` })); }
  if (preview.warnings.length) { const details = container.createEl("details"); details.open = true; details.createEl("summary", { text: `Final warnings (${preview.warnings.length})` }); const list = details.createEl("ul"); preview.warnings.forEach((warning) => list.createEl("li", { text: warning.message })); }
  new Setting(container).setName("Filename").addText((text) => { text.setValue(state.request.outputFilename).onChange((value) => { controller.setOutput(state.request.exportFolder, actions.filename(value)); actions.changed(); }); text.inputEl.setAttribute("aria-label", "DOCX filename"); });
  new Setting(container).setName("Save to vault").setDesc("The DOCX is saved here so it remains available with your project.").addText((text) => text.setValue(state.request.exportFolder).setPlaceholder("Manuscript Exports").onChange((value) => { controller.setOutput(value, state.request.outputFilename); actions.changed(); }));
  new Setting(container).setName("Save a copy to computer").setDesc("Also save the finished DOCX using your platform's normal download or share action.").addToggle((toggle) => toggle.setValue(state.request.downloadAfterExport === true).onChange((value) => controller.setDownloadAfterExport(value)));
  const ready = container.createDiv({ cls: "manuscript-ready-card" }); ready.createEl("strong", { text: "Ready to compile" }); ready.createEl("p", { text: "Press Create DOCX to export exactly the manuscript shown above." });
}

function renderOutline(container: HTMLElement, preview: ReturnType<typeof buildExportPreviewViewModel>): void {
  const list = container.createEl("ul", { cls: "manuscript-output-outline" }); if (preview.titlePage) list.createEl("li", { text: "Title Page" });
  matter(list, "Front Matter", preview.frontMatter);
  preview.parts.forEach((part) => { const row = list.createEl("li", { text: part.title }); const children = row.createEl("ul"); part.chapters.forEach((chapter) => chapterRow(children, chapter)); });
  preview.looseChapters.forEach((chapter) => chapterRow(list, chapter)); matter(list, "Back Matter", preview.backMatter);
}
function matter(parent: HTMLElement, label: string, items: Array<{ title: string }>): void { if (!items.length) return; const row = parent.createEl("li", { text: label }); const children = row.createEl("ul"); items.forEach((item) => children.createEl("li", { text: item.title })); }
function chapterRow(parent: HTMLElement, chapter: { title: string; sceneCount: number }): void { const row = parent.createEl("li", { text: chapter.title }); row.createEl("small", { text: ` — ${chapter.sceneCount} scene${chapter.sceneCount === 1 ? "" : "s"}` }); }
function summaryRow(list: HTMLElement, label: string, value: string): void { list.createEl("dt", { text: label }); list.createEl("dd", { text: value }); }
