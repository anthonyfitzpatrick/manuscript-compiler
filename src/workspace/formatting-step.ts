/**
 * Manuscript Compiler — Formatting step renderer.
 *
 * Exposes only native-DOCX options implemented by the generator. Author input is
 * delegated to the controller; metric-to-OOXML conversion stays elsewhere.
 */
import { Setting, type DropdownComponent, type ToggleComponent } from "obsidian";
import type { DocxStylePreset, StructuralDisplay } from "../settings";
import type { CompileWorkspaceController } from "./compile-workspace-controller";

const sceneBreakValues = new Set(["#", "*", "***", "* * *", ""]);

export function renderFormattingStep(container: HTMLElement, controller: CompileWorkspaceController): void {
  const { formatting, request } = controller.state;
  let fontControl: DropdownComponent | undefined; let sizeControl: DropdownComponent | undefined; let spacingControl: DropdownComponent | undefined; let indentControl: DropdownComponent | undefined; let pageControl: DropdownComponent | undefined; let chapterBreakControl: ToggleComponent | undefined; let sceneControl: DropdownComponent | undefined; let customSetting: Setting | undefined; let customInput: HTMLInputElement | undefined;
  const effectiveSeparator = (): string => request.docxPreset === "vellum" ? "#" : request.docxPreset === "standard" ? "* * *" : request.custom?.sceneSeparator ?? "#";
  const syncPresetControls = (): void => {
    fontControl?.setValue(formatting.font); sizeControl?.setValue(String(formatting.fontSize)); spacingControl?.setValue(String(formatting.lineSpacing)); indentControl?.setValue(String(formatting.firstLineIndentCm)); pageControl?.setValue(formatting.pageSize); chapterBreakControl?.setValue(formatting.chapterPageBreak);
    const separator = effectiveSeparator(); sceneControl?.setValue(sceneBreakValues.has(separator) ? separator : "custom"); customSetting?.settingEl.toggleClass("is-hidden", sceneBreakValues.has(separator)); if (customInput && !sceneBreakValues.has(separator)) customInput.value = separator;
  };
  container.createEl("h2", { text: "Format your DOCX" }); container.createEl("p", { text: "These choices affect the generated Word document only. Your Markdown notes are never changed." });
  new Setting(container).setName("Document style").addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum-ready manuscript").addOption("standard", "Standard manuscript").addOption("custom", "Custom").setValue(request.docxPreset).onChange((value) => { controller.setDocxPreset(value as DocxStylePreset); syncPresetControls(); }));
  new Setting(container).setName("Book title").addText((text) => text.setValue(request.custom?.variables?.BookTitle ?? "").onChange((value) => controller.setVariable("BookTitle", value)));
  new Setting(container).setName("Author").addText((text) => text.setValue(request.custom?.variables?.Author ?? "").onChange((value) => controller.setVariable("Author", value)));
  new Setting(container).setName("Font").addDropdown((dropdown) => { fontControl = dropdown; dropdown.addOption("Times New Roman", "Times New Roman").addOption("Garamond", "Garamond").addOption("Georgia", "Georgia").addOption("Arial", "Arial").setValue(formatting.font).onChange((font) => controller.setFormatting({ font })); });
  new Setting(container).setName("Font size").addDropdown((dropdown) => { sizeControl = dropdown; dropdown.addOption("11", "11 pt").addOption("12", "12 pt").addOption("13", "13 pt").setValue(String(formatting.fontSize)).onChange((value) => controller.setFormatting({ fontSize: Number(value) })); });
  new Setting(container).setName("Line spacing").addDropdown((dropdown) => { spacingControl = dropdown; dropdown.addOption("1", "Single").addOption("1.15", "1.15").addOption("1.5", "1.5 lines").addOption("2", "Double").setValue(String(formatting.lineSpacing)).onChange((value) => controller.setFormatting({ lineSpacing: Number(value) })); });
  new Setting(container).setName("First-line indent (cm)").addDropdown((dropdown) => { indentControl = dropdown; dropdown.addOption("0", "None").addOption("0.75", "0.75 cm").addOption("1.27", "1.27 cm").setValue(String(formatting.firstLineIndentCm)).onChange((value) => controller.setFormatting({ firstLineIndentCm: Number(value) })); });
  new Setting(container).setName("Page size").addDropdown((dropdown) => { pageControl = dropdown; dropdown.addOption("a4", "A4").addOption("letter", "Letter").setValue(formatting.pageSize).onChange((value) => controller.setFormatting({ pageSize: value === "letter" ? "letter" : "a4" })); });
  new Setting(container).setName("Start chapters on a new page").addToggle((toggle) => { chapterBreakControl = toggle; toggle.setValue(formatting.chapterPageBreak).onChange((chapterPageBreak) => controller.setFormatting({ chapterPageBreak })); });
  new Setting(container).setName("Add a title page").setDesc("Uses the book title and author entered above.").addToggle((toggle) => toggle.setValue(formatting.titlePage).onChange((titlePage) => controller.setFormatting({ titlePage })));
  const selectedSeparator = effectiveSeparator();
  const customSeparator = sceneBreakValues.has(selectedSeparator) ? "" : selectedSeparator;
  new Setting(container).setName("Scene break").addDropdown((dropdown) => { sceneControl = dropdown; dropdown.addOption("#", "#").addOption("*", "*").addOption("***", "***").addOption("* * *", "* * *").addOption("", "Blank line").addOption("custom", "Custom").setValue(sceneBreakValues.has(selectedSeparator) ? selectedSeparator : "custom").onChange((value) => {
    customSetting?.settingEl.toggleClass("is-hidden", value !== "custom");
    if (value !== "custom") controller.setSceneSeparator(value);
  }); });
  customSetting = new Setting(container).setName("Custom scene break").addText((text) => { customInput = text.inputEl; text.setPlaceholder("Enter separator text").setValue(customSeparator).onChange((value) => controller.setSceneSeparator(value)); });
  customSetting.settingEl.toggleClass("is-hidden", sceneBreakValues.has(selectedSeparator));
  displayChoice(container, "Part headings", request.partDisplay ?? "word-title", (value) => controller.setDisplay("part", value)); displayChoice(container, "Chapter headings", request.chapterDisplay ?? "word-title", (value) => controller.setDisplay("chapter", value));
  new Setting(container).setName("Include table of contents").setDesc("Adds a real Word TOC field; update the field in Word to populate it.").addToggle((toggle) => toggle.setValue(request.tableOfContents === true).onChange((value) => controller.setTableOfContents(value)));
  const advanced = container.createEl("details"); advanced.createEl("summary", { text: "Advanced options" }); new Setting(advanced).setName("Manuscript body headings").setDesc("If a note contains one of these headings, only that section is exported.").addText((text) => text.setValue(request.custom?.bodySectionAliases?.join(", ") ?? "Scene, Manuscript, Text, Draft, Body").onChange((value) => controller.setBodyAliases(value.split(",").map((item) => item.trim()).filter(Boolean))));
}
function displayChoice(container: HTMLElement, name: string, current: StructuralDisplay, change: (value: StructuralDisplay) => void): void { const kind = name.startsWith("Part") ? "Part" : "Chapter"; new Setting(container).setName(name).addDropdown((dropdown) => dropdown.addOption("word", `${kind} One`).addOption("numeric", `${kind} 1`).addOption("word-title", `${kind} One — Title`).addOption("numeric-title", `${kind} 1 — Title`).addOption("title", "Title only").addOption("custom", "Legacy profile template").setValue(current).onChange((value) => change(value as StructuralDisplay))); }
