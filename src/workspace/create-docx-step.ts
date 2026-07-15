/** Universal final choices for one prepared Book and one validated download. */
import { Setting } from "obsidian";
import type { DocxStylePreset, StructuralDisplay } from "../settings";
import { EXPORT_FORMAT_DETAILS, EXPORT_FORMATS, type ExportFormat } from "../export-types";
import { exportFilename } from "../export-filename";
import type { CompileWorkspaceController } from "./compile-workspace-controller";
import { buildExportPreviewViewModel } from "./export-preview";
import { attentionWarnings, informationMessages, manuscriptPlanSummary, warningCategories } from "./workspace-view-model";

const sceneBreakValues = new Set(["#", "*", "***", "* * *", ""]);
const paragraphIndentFormats = new Set<ExportFormat>(["docx", "odt", "epub", "html"]);
const formatDescriptions: Record<ExportFormat, string> = { docx: "Microsoft Word document", odt: "OpenDocument Text", epub: "Ebook", html: "Standalone webpage", markdown: "Portable plain-text manuscript", xml: "Structured manuscript" };
export interface CreateDocxStepActions { refresh(): void; changed(): void; rerender(): void; }

export function renderCreateDocxStep(container: HTMLElement, controller: CompileWorkspaceController, actions: CreateDocxStepActions): void {
  const state = controller.state; const request = state.request; const prepared = state.preparedSession ? buildExportPreviewViewModel(state.preparedSession) : undefined; const title = request.custom?.variables?.BookTitle?.trim() || prepared?.title || request.manuscriptRoot.split("/").pop() || "Manuscript"; const counts = manuscriptPlanSummary(state.contentPlan, request.manuscriptRoot); const format = state.exportFormat;
  container.createEl("h2", { text: "Create file" }); container.createEl("p", { cls: "manuscript-compact-note", text: "Your Markdown notes will not be changed." });
  container.createEl("h3", { text: "Book summary" }); container.createEl("strong", { text: title, cls: "manuscript-resolved-title" }); container.createEl("p", { cls: "manuscript-compact-summary", text: prepared ? `${prepared.statistics.totalWordCount.toLocaleString()} words · ${prepared.statistics.chapterCount} chapters · ${counts.includedNotes} included notes` : `${counts.includedNotes} included notes · ${counts.chapters} chapters` });
  if (state.preparationStatus === "preparing") container.createEl("p", { cls: "manuscript-preparation-status", text: "Preparing final manuscript…", attr: { role: "status", "aria-live": "polite" } });
  else if (!prepared) { const status = container.createDiv({ cls: "manuscript-ready-card" }); status.createEl("strong", { text: state.error ? "Preview needs attention" : "Final manuscript needs preparation" }); status.createEl("p", { text: state.error?.message || "Create will prepare and verify the selected manuscript." }); if (state.error?.suggestion) status.createEl("p", { text: state.error.suggestion }); status.createEl("button", { text: "Refresh preview" }).addEventListener("click", () => actions.refresh()); }

  renderFormatSelector(container, controller, actions, title);

  renderFormatting(container, controller, actions, format);
  renderAdvancedFormatting(container, controller, actions, format);
  renderWarnings(container, prepared?.warnings ?? [], counts.ignoredNotes);
  const filename = exportFilename(request.outputFilename, format, title); container.createEl("h3", { text: "Output filename" }); new Setting(container).setName("Filename").setDesc("The selected format extension is corrected when the file is created.").addText((text) => text.setValue(filename).onChange((value) => controller.setDownloadFilename(value)));
}

function renderFormatSelector(container: HTMLElement, controller: CompileWorkspaceController, actions: CreateDocxStepActions, title: string): void {
  container.createEl("h3", { text: "Export format", attr: { id: "manuscript-export-format-heading" } });
  const selected = controller.state.exportFormat;
  const group = container.createDiv({ cls: "manuscript-format-selector", attr: { role: "radiogroup", "aria-labelledby": "manuscript-export-format-heading" } });
  const choose = (format: ExportFormat): void => {
    const workspace = container.closest<HTMLElement>(".manuscript-compile-workspace");
    if (format !== controller.state.exportFormat) {
      controller.setExportFormat(format);
      controller.setDownloadFilename(exportFilename(controller.state.request.outputFilename, format, title));
      actions.rerender();
    }
    (workspace ?? container).querySelector<HTMLButtonElement>(`[data-export-format="${format}"]`)?.focus({ preventScroll: true });
  };
  EXPORT_FORMATS.forEach((format) => {
    const active = format === selected;
    const button = group.createEl("button", { cls: `manuscript-format-option${active ? " is-selected" : ""}`, attr: { type: "button", role: "radio", "aria-checked": String(active), tabindex: active ? "0" : "-1" } });
    button.dataset.exportFormat = format;
    button.createEl("strong", { text: EXPORT_FORMAT_DETAILS[format].label });
    button.createSpan({ text: formatDescriptions[format] });
    button.addEventListener("click", () => choose(format));
    button.addEventListener("keydown", (event) => {
      const next = formatAfterKey(format, event.key);
      if (!next) return;
      event.preventDefault();
      choose(next);
    });
  });
}

/** Returns the radio option reached by standard horizontal or vertical group navigation. */
export function formatAfterKey(current: ExportFormat, key: string): ExportFormat | undefined {
  const index = EXPORT_FORMATS.indexOf(current);
  if (key === "Home") return EXPORT_FORMATS[0];
  if (key === "End") return EXPORT_FORMATS[EXPORT_FORMATS.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") return EXPORT_FORMATS[(index + 1) % EXPORT_FORMATS.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return EXPORT_FORMATS[(index - 1 + EXPORT_FORMATS.length) % EXPORT_FORMATS.length];
  return undefined;
}

export function supportsParagraphIndentation(format: ExportFormat): boolean { return paragraphIndentFormats.has(format); }

function renderFormatting(container: HTMLElement, controller: CompileWorkspaceController, actions: CreateDocxStepActions, format: ExportFormat): void {
  const { request, formatting } = controller.state; container.createEl("h3", { text: "Formatting" });
  if (format === "xml") { new Setting(container).setName("Paragraph indentation").setDesc("Paragraph indentation is controlled by the application that consumes the XML."); return; }
  if (format === "markdown") { new Setting(container).setName("Plain-text structure").setDesc("Parts, chapters, scenes, emphasis, and links are preserved as Markdown."); new Setting(container).setName("Paragraph indentation").setDesc("Markdown does not support portable first-line indentation."); }
  else if (format === "epub" || format === "html") new Setting(container).setName(format === "epub" ? "Reflowable ebook" : "Web-readable").setDesc("Typography and spacing can be adjusted under advanced formatting.");
  else new Setting(container).setName("Document style").addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum").addOption("standard", "Standard manuscript").addOption("custom", "Custom").setValue(request.docxPreset).onChange((value) => invalidate(controller, actions, () => controller.setDocxPreset(value as DocxStylePreset))));
  if (supportsParagraphIndentation(format)) {
    let indentSize: Setting | undefined;
    new Setting(container).setName("Indent first line of paragraphs").setDesc("Indent only the first line of later body paragraphs; first paragraphs after headings and scene breaks stay flush left.").addToggle((toggle) => toggle.setValue(formatting.indentParagraphs).onChange((value) => { invalidate(controller, actions, () => controller.setFormatting({ indentParagraphs: value })); if (indentSize) indentSize.settingEl.hidden = !value; }));
    indentSize = new Setting(container).setName("First-line indent (cm)").addDropdown((dropdown) => dropdown.addOption("0", "None").addOption("0.75", "0.75 cm").addOption("1.27", "1.27 cm").setValue(String(formatting.firstLineIndentCm)).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ firstLineIndentCm: Number(value) }))));
    indentSize.settingEl.hidden = !formatting.indentParagraphs;
  }
  new Setting(container).setName("Scene break").addDropdown((dropdown) => { const separator = effectiveSeparator(controller); return dropdown.addOption("#", "#").addOption("*", "*").addOption("***", "***").addOption("* * *", "* * *").addOption("", "Blank line").addOption("custom", "Custom").setValue(sceneBreakValues.has(separator) ? separator : "custom").onChange((value) => { if (value !== "custom") invalidate(controller, actions, () => controller.setSceneSeparator(value)); }); });
  new Setting(container).setName("Add title page").addToggle((toggle) => toggle.setValue(formatting.titlePage).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ titlePage: value }))));
  if (format !== "markdown") new Setting(container).setName("Add table of contents").addToggle((toggle) => toggle.setValue(request.tableOfContents === true).onChange((value) => invalidate(controller, actions, () => controller.setTableOfContents(value))));
  if (["docx", "odt"].includes(format)) new Setting(container).setName("Start chapters on a new page").addToggle((toggle) => toggle.setValue(formatting.chapterPageBreak).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ chapterPageBreak: value }))));
}

function renderWarnings(container: HTMLElement, warnings: ReturnType<typeof buildExportPreviewViewModel>["warnings"], ignoredNotes: number): void { container.createEl("h3", { text: "Warnings" }); const attention = attentionWarnings(warnings); container.createEl("p", { cls: "manuscript-warning-count", text: attention.length ? `${attention.length} item${attention.length === 1 ? "" : "s"} need attention` : "No issues requiring attention" }); if (attention.length) { const list = container.createEl("ul", { cls: "manuscript-warning-list" }); warningCategories(attention).forEach((category) => list.createEl("li", { text: category.count === 1 ? category.label : `${category.count} × ${category.label}` })); } const information = informationMessages(warnings); const details = container.createEl("details", { cls: "manuscript-information-summary" }); details.createEl("summary", { text: "Details" }); const list = details.createEl("ul"); information.forEach((item) => list.createEl("li", { text: item.message })); if (ignoredNotes) list.createEl("li", { text: `Project notes ignored — ${ignoredNotes.toLocaleString()}` }); if (!information.length && !ignoredNotes) list.createEl("li", { text: "No additional information" }); }

function renderAdvancedFormatting(container: HTMLElement, controller: CompileWorkspaceController, actions: CreateDocxStepActions, format: ExportFormat): void {
  const { request, formatting } = controller.state; const contentOnly = format === "xml" || format === "markdown"; const details = container.createEl("details", { cls: "manuscript-advanced-section" }); details.createEl("summary", { text: contentOnly ? "Advanced content options" : "Advanced formatting" });
  new Setting(details).setName("Book title override").addText((text) => text.setValue(request.custom?.variables?.BookTitle ?? "").onChange((value) => invalidate(controller, actions, () => controller.setVariable("BookTitle", value)))); new Setting(details).setName("Author override").addText((text) => text.setValue(request.custom?.variables?.Author ?? "").onChange((value) => invalidate(controller, actions, () => controller.setVariable("Author", value))));
  if (format === "xml") new Setting(details).setName("Include title page document").addToggle((toggle) => toggle.setValue(formatting.titlePage).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ titlePage: value }))));
  if (!contentOnly) { new Setting(details).setName("Font").addDropdown((dropdown) => dropdown.addOption("Times New Roman", "Times New Roman").addOption("Garamond", "Garamond").addOption("Georgia", "Georgia").addOption("Arial", "Arial").setValue(formatting.font).onChange((font) => invalidate(controller, actions, () => controller.setFormatting({ font })))); new Setting(details).setName("Font size").addDropdown((dropdown) => dropdown.addOption("11", "11-point").addOption("12", "12-point").addOption("13", "13-point").setValue(String(formatting.fontSize)).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ fontSize: Number(value) })))); new Setting(details).setName("Line spacing").addDropdown((dropdown) => dropdown.addOption("1", "Single").addOption("1.15", "1.15").addOption("1.5", "1.5 lines").addOption("2", "Double").setValue(String(formatting.lineSpacing)).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ lineSpacing: Number(value) })))); }
  if (["docx", "odt"].includes(format)) new Setting(details).setName("Page size").addDropdown((dropdown) => dropdown.addOption("a4", "A4").addOption("letter", "Letter").setValue(formatting.pageSize).onChange((value) => invalidate(controller, actions, () => controller.setFormatting({ pageSize: value === "letter" ? "letter" : "a4" }))));
  if (format !== "xml") { const separator = effectiveSeparator(controller); new Setting(details).setName("Custom scene break").addText((text) => text.setValue(sceneBreakValues.has(separator) ? "" : separator).onChange((value) => invalidate(controller, actions, () => controller.setSceneSeparator(value)))); }
  displayChoice(details, "Part heading style", request.partDisplay ?? "word-title", (value) => invalidate(controller, actions, () => controller.setDisplay("part", value))); displayChoice(details, "Chapter heading style", request.chapterDisplay ?? "word-title", (value) => invalidate(controller, actions, () => controller.setDisplay("chapter", value)));
  new Setting(details).setName("Manuscript body headings").setDesc("Include each manuscript note title as a body heading.").addToggle((toggle) => toggle.setValue(request.custom?.includeSceneTitles === true).onChange((value) => invalidate(controller, actions, () => controller.setIncludeSceneTitles(value))));
  new Setting(details).setName("Filename template").setDesc("Use {BookTitle} if you want the resolved book title in the filename.").addText((text) => text.setValue(request.outputFilename).onChange((value) => controller.setDownloadFilename(value)));
}

function effectiveSeparator(controller: CompileWorkspaceController): string { const { request } = controller.state; return request.docxPreset === "vellum" ? "#" : request.docxPreset === "standard" ? "* * *" : request.custom?.sceneSeparator ?? "#"; }
function invalidate(controller: CompileWorkspaceController, actions: CreateDocxStepActions, change: () => void): void { change(); actions.changed(); }
function displayChoice(container: HTMLElement, name: string, current: StructuralDisplay, change: (value: StructuralDisplay) => void): void { const kind = name.startsWith("Part") ? "Part" : "Chapter"; new Setting(container).setName(name).addDropdown((dropdown) => dropdown.addOption("word", `${kind} One`).addOption("numeric", `${kind} 1`).addOption("word-title", `${kind} One — Title`).addOption("numeric-title", `${kind} 1 — Title`).addOption("title", "Title only").addOption("custom", "Legacy profile template").setValue(current).onChange((value) => change(value as StructuralDisplay))); }
