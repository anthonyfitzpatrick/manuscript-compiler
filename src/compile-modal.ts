import { App, FuzzySuggestModal, Modal, Notice, Setting, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { classifyContentPlan, createContentPlan, type ContentPlanItem, type ContentRole } from "./content-plan";
import { STRUCTURE_PRESET_NAMES, validateSimpleCompileRequest, type DocxFormatting, type SimpleCompileRequest } from "./simple-workflow";
import type { DocxStylePreset, StructuralDisplay, StructurePreset } from "./settings";
import { numberWord } from "./ordering";
import { preparedSessionMatchesInputs, type PreparedCompileSession } from "./compile-preparation";
import type { Chapter, ManuscriptDocument, Part } from "./model";

class FolderPicker extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly selected: (folder: TFolder) => void) { super(app); this.setPlaceholder("Choose a folder…"); }
  getItems(): TFolder[] { return this.app.vault.getAllLoadedFiles().filter((item): item is TFolder => item instanceof TFolder && item.path !== "/"); }
  getItemText(item: TFolder): string { return item.path; }
  onChooseItem(item: TFolder): void { this.selected(item); }
}

const steps = ["Manuscript", "Contents", "Formatting", "Export"] as const;
const roleLabels: Record<ContentRole, string> = { "front-matter": "Front matter", transparent: "Transparent container", part: "Part", chapter: "Chapter", scene: "Scene", "back-matter": "Back matter", ignore: "Exclude" };

export class SimpleCompileModal extends Modal {
  private step = 0;
  private plan: ContentPlanItem[] = [];
  private scannedRoot = "";
  private preparedSession?: PreparedCompileSession;
  private preparing = false;
  private preparationError = "";
  private preparationController?: AbortController;
  private exportStateEl?: HTMLElement;
  private refreshButton?: HTMLButtonElement;
  private request: SimpleCompileRequest;
  private formatting: DocxFormatting = { font: "Times New Roman", fontSize: 12, lineSpacing: 2, firstLineIndent: 0.5, pageSize: "letter", chapterPageBreak: true, titlePage: false };
  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) {
    super(app); const settings = plugin.settings; const profile = plugin.getActiveProfile();
    this.request = { manuscriptRoot: settings.defaultManuscriptFolder || profile.manuscriptRoot, structurePreset: settings.defaultStructurePreset,
      includeFrontMatter: true, includeBackMatter: true, exportFolder: settings.defaultExportFolder || profile.exportFolder,
      outputFilename: this.filename(profile.outputFilename || "Manuscript.docx", "docx"), outputFormat: "docx", docxPreset: settings.defaultDocxStyle,
      downloadAfterExport: true, formatting: this.formatting, partDisplay: "word-title", chapterDisplay: "word-title", custom: { variables: { ...profile.variables }, bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])] }
    }; this.formatting.titlePage = settings.includeTitlePageByDefault;
  }
  onOpen(): void { this.modalEl.addClass("manuscript-compile-workspace"); this.render(); }
  private render(): void {
    const c = this.contentEl; c.empty(); this.titleEl.setText("Compile Manuscript");
    const nav = c.createDiv({ cls: "manuscript-compile-steps", attr: { role: "tablist", "aria-label": "Compile steps" } });
    steps.forEach((label, index) => { const button = nav.createEl("button", { text: `${index + 1}  ${label}`, cls: index === this.step ? "is-active" : index < this.step ? "is-complete" : "" }); button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(index === this.step)); button.disabled = index > this.step + 1 || index > 0 && !this.plan.length; button.addEventListener("click", () => this.enterStep(index)); });
    const body = c.createDiv({ cls: "manuscript-compile-body" });
    if (this.step === 0) this.renderManuscript(body); else if (this.step === 1) this.renderContents(body); else if (this.step === 2) this.renderFormatting(body); else this.renderExport(body);
    this.renderFooter(c);
  }
  private renderManuscript(c: HTMLElement): void {
    c.createEl("h2", { text: "Select your manuscript" }); c.createEl("p", { text: "Choose the vault folder that contains the notes for this book." });
    const setting = new Setting(c).setName("Manuscript folder").setDesc("The plugin will scan this folder without changing your notes.");
    setting.addText((text) => { text.setPlaceholder("Books/My Novel").setValue(this.request.manuscriptRoot).onChange((value) => { this.request.manuscriptRoot = value.trim(); this.invalidatePrepared(); }); text.inputEl.setAttribute("aria-label", "Manuscript folder path"); });
    setting.addButton((button) => button.setButtonText("Choose").setCta().onClick(() => new FolderPicker(this.app, (folder) => { void this.selectFolder(folder); }).open()));
    setting.addButton((button) => button.setButtonText("Use current folder").onClick(() => { const folder = this.app.workspace.getActiveFile()?.parent; if (folder) void this.selectFolder(folder); else new Notice("Open a note inside the manuscript folder first."); }));
    new Setting(c).setName("Book structure").setDesc("Choose the closest match. You can correct every item on the next step.").addDropdown((dropdown) => { for (const [value, label] of Object.entries(STRUCTURE_PRESET_NAMES)) dropdown.addOption(value, label); dropdown.setValue(this.request.structurePreset).onChange((value) => { this.request.structurePreset = value as StructurePreset; this.plan = []; this.scannedRoot = ""; this.invalidatePrepared(); }); });
    const folder = this.folder();
    if (folder && this.scannedRoot === folder.path && this.plan.length) { const notes = this.plan.filter((item) => item.kind === "note").length; const folders = this.plan.filter((item) => item.kind === "folder").length; const card = c.createDiv({ cls: "manuscript-found-card" }); card.createEl("h3", { text: "Manuscript found" }); card.createEl("strong", { text: folder.name }); card.createEl("p", { text: `${notes} Markdown note${notes === 1 ? "" : "s"} in ${folders} folder${folders === 1 ? "" : "s"}.` }); card.createEl("p", { text: "Next, check what each folder and note represents." }); }
  }
  private renderContents(c: HTMLElement): void {
    c.createEl("h2", { text: "Choose and arrange contents" }); c.createEl("p", { text: "Include the notes that belong in the manuscript, identify what each item represents, and use the arrows to set the order." });
    const controls = new Setting(c).setName(`${this.includedNotes()} of ${this.plan.filter((item) => item.kind === "note").length} notes included`);
    controls.addButton((button) => button.setButtonText("Include all").onClick(() => { this.plan.forEach((item) => { item.included = true; item.userOverride = true; if (item.role === "ignore") item.role = item.kind === "folder" ? "transparent" : "scene"; }); this.invalidatePrepared(); this.render(); })).addButton((button) => button.setButtonText("Exclude all").onClick(() => { this.plan.forEach((item) => { if (item.kind === "note") { item.included = false; item.userOverride = true; } }); this.invalidatePrepared(); this.render(); }));
    const tree = c.createDiv({ cls: "manuscript-content-plan", attr: { role: "tree", "aria-label": "Manuscript contents" } });
    this.plan.forEach((item, index) => this.renderPlanItem(tree, item, index));
    if (!this.plan.length) c.createEl("p", { cls: "manuscript-empty-state", text: "No Markdown notes were found. Go back and choose another folder." });
  }
  private renderPlanItem(parent: HTMLElement, item: ContentPlanItem, index: number): void {
    const row = parent.createDiv({ cls: `manuscript-content-row ${this.isEffectivelyIncluded(item) ? "" : "is-excluded"}` }); row.setAttribute("role", "treeitem");
    const depth = Math.max(0, item.path.slice(this.request.manuscriptRoot.length + 1).split("/").length - 1); row.style.setProperty("--manuscript-depth", String(depth));
    const include = row.createEl("input", { type: "checkbox" }); include.checked = this.isEffectivelyIncluded(item); include.setAttribute("aria-label", `${include.checked ? "Exclude" : "Include"} ${item.name}`); include.addEventListener("change", () => { this.setIncluded(item, include.checked); this.invalidatePrepared(); this.render(); });
    const label = row.createDiv({ cls: "manuscript-content-name" }); label.createSpan({ text: item.kind === "folder" ? "▸" : "•", cls: "manuscript-content-icon" }); label.createSpan({ text: item.name }); label.createEl("small", { text: item.exclusionReason && !this.isEffectivelyIncluded(item) ? item.exclusionReason : item.kind === "folder" ? "Folder" : "Note" });
    const select = row.createEl("select"); select.setAttribute("aria-label", `Role for ${item.name}`); Object.entries(roleLabels).forEach(([value, text]) => select.createEl("option", { value, text })); select.value = item.role; select.addEventListener("change", () => { item.role = select.value as ContentRole; item.userOverride = true; item.exclusionReason = item.role === "ignore" ? "Excluded by user." : undefined; this.setIncluded(item, item.role !== "ignore"); this.invalidatePrepared(); this.render(); });
    const buttons = row.createDiv({ cls: "manuscript-order-buttons" }); const siblings = this.plan.filter((candidate) => candidate.parentPath === item.parentPath); const siblingIndex = siblings.findIndex((candidate) => candidate.path === item.path);
    const up = buttons.createEl("button", { text: "↑", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} up` } }); up.disabled = siblingIndex === 0; up.addEventListener("click", () => this.move(index, -1));
    const down = buttons.createEl("button", { text: "↓", cls: "clickable-icon", attr: { "aria-label": `Move ${item.name} down` } }); down.disabled = siblingIndex === siblings.length - 1; down.addEventListener("click", () => this.move(index, 1));
  }
  private renderFormatting(c: HTMLElement): void {
    c.createEl("h2", { text: "Format your DOCX" }); c.createEl("p", { text: "These choices affect the generated Word document only. Your Markdown notes are never changed." });
    const changed = (): void => this.invalidatePrepared();
    new Setting(c).setName("Document style").addDropdown((dropdown) => dropdown.addOption("vellum", "Vellum-ready manuscript").addOption("standard", "Standard manuscript").setValue(this.request.docxPreset).onChange((value) => { this.request.docxPreset = value as DocxStylePreset; changed(); }));
    new Setting(c).setName("Font").addDropdown((dropdown) => dropdown.addOption("Times New Roman", "Times New Roman").addOption("Garamond", "Garamond").addOption("Georgia", "Georgia").addOption("Arial", "Arial").setValue(this.formatting.font).onChange((value) => { this.formatting.font = value; changed(); }));
    new Setting(c).setName("Font size").addDropdown((dropdown) => dropdown.addOption("11", "11 pt").addOption("12", "12 pt").addOption("13", "13 pt").setValue(String(this.formatting.fontSize)).onChange((value) => { this.formatting.fontSize = Number(value); changed(); }));
    new Setting(c).setName("Line spacing").addDropdown((dropdown) => dropdown.addOption("1", "Single").addOption("1.15", "1.15").addOption("1.5", "1.5 lines").addOption("2", "Double").setValue(String(this.formatting.lineSpacing)).onChange((value) => { this.formatting.lineSpacing = Number(value); changed(); }));
    new Setting(c).setName("First-line indent").addDropdown((dropdown) => dropdown.addOption("0", "None").addOption("0.25", "0.25 in").addOption("0.5", "0.5 in").setValue(String(this.formatting.firstLineIndent)).onChange((value) => { this.formatting.firstLineIndent = Number(value); changed(); }));
    new Setting(c).setName("Page size").addDropdown((dropdown) => dropdown.addOption("letter", "US Letter").addOption("a4", "A4").setValue(this.formatting.pageSize).onChange((value) => { this.formatting.pageSize = value === "a4" ? "a4" : "letter"; changed(); }));
    new Setting(c).setName("Start chapters on a new page").addToggle((toggle) => toggle.setValue(this.formatting.chapterPageBreak).onChange((value) => { this.formatting.chapterPageBreak = value; changed(); }));
    new Setting(c).setName("Add a title page").setDesc("Uses the book title and author entered on the Export step.").addToggle((toggle) => toggle.setValue(this.formatting.titlePage).onChange((value) => { this.formatting.titlePage = value; changed(); }));
    new Setting(c).setName("Scene breaks").addDropdown((dropdown) => dropdown.addOption("#", "Centered * * *").addOption("***", "Three asterisks").addOption("", "Blank space only").setValue(this.request.custom?.sceneSeparator ?? "#").onChange((value) => { if (this.request.custom) this.request.custom.sceneSeparator = value; changed(); }));
    this.displayChoice(c, "Part headings", this.request.partDisplay ?? "word-title", (value) => { this.request.partDisplay = value; changed(); });
    this.displayChoice(c, "Chapter headings", this.request.chapterDisplay ?? "word-title", (value) => { this.request.chapterDisplay = value; changed(); });
    new Setting(c).setName("Include table of contents").setDesc("Word will populate the table when fields are updated.").addToggle((toggle) => toggle.setValue(this.plugin.settings.includeTableOfContentsByDefault).onChange((value) => { this.plugin.settings.includeTableOfContentsByDefault = value; changed(); }));
    const advanced = c.createEl("details"); advanced.createEl("summary", { text: "Advanced options" }); new Setting(advanced).setName("Manuscript body headings").setDesc("If a note contains one of these headings, only that section is exported.").addText((text) => text.setValue(this.request.custom?.bodySectionAliases?.join(", ") ?? "Scene, Manuscript, Text, Draft, Body").onChange((value) => { if (this.request.custom) this.request.custom.bodySectionAliases = value.split(",").map((item) => item.trim()).filter(Boolean); changed(); }));
  }
  private renderExport(c: HTMLElement): void {
    c.createEl("h2", { text: "Create your manuscript" }); this.exportStateEl = c.createDiv({ cls: "manuscript-ready-card" });
    if (this.preparing) { this.exportStateEl.createEl("strong", { text: "Preparing final manuscript…" }); this.exportStateEl.createEl("p", { text: "Parsing and cleaning the selected notes so this preview exactly matches the export." }); return; }
    if (!this.preparedSession) { this.exportStateEl.createEl("strong", { text: this.preparationError ? "Preview needs attention" : "Final preview is not prepared" }); this.exportStateEl.createEl("p", { text: this.preparationError || "Refresh the preview before creating the DOCX." }); this.refreshButton = this.exportStateEl.createEl("button", { text: "Refresh Preview", cls: "mod-cta" }); this.refreshButton.addEventListener("click", () => { void this.prepareFinalPreview(true); }); return; }
    const session = this.preparedSession; this.exportStateEl.createEl("strong", { text: "Final manuscript prepared" }); this.exportStateEl.createEl("p", { text: "This preview and the export use the same parsed manuscript model." });
    const summary = c.createEl("dl", { cls: "manuscript-export-summary" }); this.summaryRow(summary, "Book title", session.profile.variables.BookTitle || session.book.title); this.summaryRow(summary, "Total words", session.statistics.totalWordCount.toLocaleString()); this.summaryRow(summary, "Output filename", this.request.outputFilename); this.summaryRow(summary, "Format", `${this.formatting.font}, ${this.formatting.fontSize} pt, ${this.formatting.lineSpacing === 2 ? "double" : this.formatting.lineSpacing} spacing`);
    c.createEl("h3", { text: "Output outline" }); this.renderPreparedOutline(c, session);
    if (session.exclusions.length) { const details = c.createEl("details"); details.createEl("summary", { text: `Excluded notes (${session.exclusions.length})` }); const list = details.createEl("ul"); session.exclusions.forEach((item) => list.createEl("li", { text: `${item.name} — ${item.reason}` })); }
    if (session.warnings.length) { const details = c.createEl("details"); details.open = true; details.createEl("summary", { text: `Final warnings (${session.warnings.length})` }); const list = details.createEl("ul"); session.warnings.forEach((warning) => list.createEl("li", { text: warning.message })); }
    const invalidated = (): void => this.invalidatePrepared("Preview inputs changed. Refresh the preview before creating the DOCX.");
    new Setting(c).setName("Book title").addText((text) => text.setValue(this.request.custom?.variables?.BookTitle || this.folder()?.name || "").onChange((value) => { if (this.request.custom?.variables) this.request.custom.variables.BookTitle = value; invalidated(); }));
    new Setting(c).setName("Author").addText((text) => text.setValue(this.request.custom?.variables?.Author || "").onChange((value) => { if (this.request.custom?.variables) this.request.custom.variables.Author = value; invalidated(); }));
    new Setting(c).setName("Filename").addText((text) => { text.setValue(this.request.outputFilename).onChange((value) => { this.request.outputFilename = this.filename(value, "docx"); invalidated(); }); text.inputEl.setAttribute("aria-label", "DOCX filename"); });
    new Setting(c).setName("Save a copy in the vault").setDesc("The DOCX is saved here so it remains available with your project.").addText((text) => text.setValue(this.request.exportFolder).setPlaceholder("Manuscript Exports").onChange((value) => { this.request.exportFolder = value.trim(); invalidated(); }));
    new Setting(c).setName("Save a copy to computer").setDesc("Also save the finished DOCX using your platform's normal download or share action.").addToggle((toggle) => toggle.setValue(this.request.downloadAfterExport === true).onChange((value) => { this.request.downloadAfterExport = value; }));
    const ready = c.createDiv({ cls: "manuscript-ready-card" }); ready.createEl("strong", { text: "Ready to compile" }); ready.createEl("p", { text: "Press Create DOCX to export exactly the manuscript shown above." });
  }
  private displayChoice(c: HTMLElement, name: string, current: StructuralDisplay, change: (value: StructuralDisplay) => void): void { new Setting(c).setName(name).addDropdown((dropdown) => dropdown.addOption("word", `${name.startsWith("Part") ? "Part" : "Chapter"} One`).addOption("numeric", `${name.startsWith("Part") ? "Part" : "Chapter"} 1`).addOption("word-title", `${name.startsWith("Part") ? "Part" : "Chapter"} One — Title`).addOption("numeric-title", `${name.startsWith("Part") ? "Part" : "Chapter"} 1 — Title`).addOption("title", "Title only").addOption("custom", "Custom template").setValue(current).onChange((value) => change(value as StructuralDisplay))); }
  private renderPreparedOutline(c: HTMLElement, session: PreparedCompileSession): void {
    const list = c.createEl("ul", { cls: "manuscript-output-outline" }); if (session.profile.docxTitlePage) list.createEl("li", { text: "Title Page" });
    this.renderMatter(list, "Front Matter", session.book.frontMatter.documents, session.profile.includeFrontMatter);
    const includedScenes = (documents: ManuscriptDocument[]): ManuscriptDocument[] => documents.filter((document) => !document.excluded && !!document.content.trim());
    const chapter = (host: HTMLElement, item: Chapter): void => { const row = host.createEl("li", { text: this.modelHeading("Chapter", item, session.profile.chapterDisplay ?? "word-title") }); const count = includedScenes(item.scenes).length; row.createEl("small", { text: ` — ${count} scene${count === 1 ? "" : "s"}` }); };
    for (const part of session.book.parts) {
      if (session.profile.useParts && !part.synthetic) { const row = list.createEl("li", { text: this.modelHeading("Part", part, session.profile.partDisplay ?? "word-title") }); const children = row.createEl("ul"); part.chapters.forEach((item) => chapter(children, item)); }
      else part.chapters.forEach((item) => chapter(list, item));
    }
    this.renderMatter(list, "Back Matter", session.book.backMatter.documents, session.profile.includeBackMatter);
  }
  private renderMatter(parent: HTMLElement, label: string, documents: ManuscriptDocument[], enabled: boolean): void { const included = enabled ? documents.filter((item) => !item.excluded && !!item.content.trim()) : []; if (!included.length) return; const row = parent.createEl("li", { text: label }); const children = row.createEl("ul"); included.forEach((item) => children.createEl("li", { text: item.title })); }
  private modelHeading(kind: "Part" | "Chapter", item: Part | Chapter, display: StructuralDisplay): string { const numeric = item.number === undefined ? kind : `${kind} ${item.number}`; const word = item.number === undefined ? kind : `${kind} ${numberWord(item.number)}`; const title = item.name || item.title; if (display === "word") return item.number === undefined ? title : word; if (display === "numeric") return item.number === undefined ? title : numeric; if (display === "title" || display === "custom") return title; if (display === "numeric-title") return item.number === undefined ? title : `${numeric} — ${title}`; return item.number === undefined ? title : `${word} — ${title}`; }
  private renderFooter(c: HTMLElement): void {
    const footer = c.createDiv({ cls: "manuscript-compile-footer" });
    footer.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const forward = footer.createDiv({ cls: "manuscript-footer-forward" });
    if (this.step > 0) forward.createEl("button", { text: "Back" }).addEventListener("click", () => this.enterStep(this.step - 1));
    const primary = forward.createEl("button", { text: this.step === 3 ? this.preparing ? "Preparing…" : "Create DOCX" : this.step === 0 ? "Scan manuscript" : "Continue", cls: `mod-cta${this.step === 3 ? " manuscript-create-button" : ""}` }); primary.disabled = this.step === 3 && (!this.preparedSession || this.preparing);
    primary.addEventListener("click", () => { if (this.step === 0) void this.scanAndContinue(); else if (this.step < 3) { if (this.step === 1 && this.includedNotes() === 0) { new Notice("Include at least one manuscript note."); return; } this.enterStep(this.step + 1); } else void this.export(); });
  }
  private async selectFolder(folder: TFolder): Promise<void> { this.invalidatePrepared(); this.request.manuscriptRoot = folder.path; this.plan = createContentPlan(folder, this.request.structurePreset); this.scannedRoot = folder.path; if (/^(?:Manuscript|Untitled)/i.test(this.request.outputFilename)) this.request.outputFilename = `${folder.name}.docx`; this.render(); await classifyContentPlan(this.app.vault, this.plan); if (this.scannedRoot === folder.path) this.render(); }
  private async scanAndContinue(): Promise<void> { const folder = this.folder(); if (!folder) { new Notice("Choose a manuscript folder that exists in this vault.", 7000); return; } if (this.scannedRoot !== folder.path || !this.plan.length) { this.plan = createContentPlan(folder, this.request.structurePreset); this.scannedRoot = folder.path; await classifyContentPlan(this.app.vault, this.plan); } if (!this.plan.some((item) => item.kind === "note")) { new Notice("No Markdown notes were found in that folder.", 7000); this.render(); return; } this.step = 1; this.render(); }
  private move(index: number, direction: -1 | 1): void { const item = this.plan[index]; const siblings = this.plan.filter((candidate) => candidate.parentPath === item.parentPath).sort((a, b) => a.order - b.order); const at = siblings.findIndex((candidate) => candidate.path === item.path); const target = siblings[at + direction]; if (!target) return; const order = item.order; item.order = target.order; target.order = order; this.plan = this.orderedPlan(); this.invalidatePrepared(); this.render(); }
  private orderedPlan(): ContentPlanItem[] { const children = new Map<string, ContentPlanItem[]>(); this.plan.forEach((item) => children.set(item.parentPath, [...(children.get(item.parentPath) ?? []), item])); const result: ContentPlanItem[] = []; const visit = (parent: string): void => { (children.get(parent) ?? []).sort((a, b) => a.order - b.order).forEach((item) => { result.push(item); if (item.kind === "folder") visit(item.path); }); }; visit(this.request.manuscriptRoot); return result; }
  private async export(): Promise<void> { const session = this.preparedSession; if (!session || !preparedSessionMatchesInputs(session, this.request, this.plan)) { this.preparedSession = undefined; this.preparationError = "Refresh the final preview before creating the DOCX."; this.render(); return; } if (!await this.plugin.preparedSessionIsCurrent(session)) { this.preparedSession = undefined; this.preparationError = "The manuscript changed after the preview was prepared. Refresh the preview before creating the DOCX."; this.render(); return; } this.close(); try { await this.plugin.exportPreparedSession(session); } catch (error) { new Notice(error instanceof Error ? error.message : String(error), 8000); } }
  private folder(): TFolder | null { const item = this.app.vault.getAbstractFileByPath(this.request.manuscriptRoot); return item instanceof TFolder ? item : null; }
  private includedNotes(): number { return this.plan.filter((item) => item.kind === "note" && this.isEffectivelyIncluded(item)).length; }
  private isEffectivelyIncluded(item: ContentPlanItem): boolean { if (!item.included || item.role === "ignore") return false; let parent = item.parentPath; while (parent !== this.request.manuscriptRoot) { const ancestor = this.plan.find((candidate) => candidate.path === parent); if (ancestor && (!ancestor.included || ancestor.role === "ignore")) return false; const slash = parent.lastIndexOf("/"); if (slash < 0) break; parent = parent.slice(0, slash); } return true; }
  private setIncluded(item: ContentPlanItem, included: boolean): void { item.included = included; item.userOverride = true; if (included && item.role === "ignore") item.role = item.kind === "folder" ? "transparent" : "scene"; if (item.kind === "folder") this.plan.filter((candidate) => candidate.path.startsWith(`${item.path}/`)).forEach((candidate) => { candidate.included = included; candidate.userOverride = true; if (included && candidate.role === "ignore") candidate.role = candidate.kind === "folder" ? "transparent" : "scene"; }); if (included) { let parent = item.parentPath; while (parent !== this.request.manuscriptRoot) { const ancestor = this.plan.find((candidate) => candidate.path === parent); if (ancestor) { ancestor.included = true; if (ancestor.role === "ignore") ancestor.role = "transparent"; } const slash = parent.lastIndexOf("/"); if (slash < 0) break; parent = parent.slice(0, slash); } } }
  private filename(value: string, format: "docx"): string { const base = value.replace(/\.(?:docx|md)$/i, "") || "Manuscript"; return `${base}.${format}`; }
  private summaryRow(list: HTMLElement, label: string, value: string): void { list.createEl("dt", { text: label }); list.createEl("dd", { text: value }); }
  private enterStep(index: number): void { if (index !== 3 && this.preparing) { this.preparationController?.abort(); this.preparing = false; } this.step = index; this.render(); if (index === 3) void this.prepareFinalPreview(); }
  private async prepareFinalPreview(force = false): Promise<void> { if (this.preparing || this.preparedSession && !force && preparedSessionMatchesInputs(this.preparedSession, this.request, this.plan)) return; const errors = validateSimpleCompileRequest(this.request); if (!this.includedNotes()) errors.push("Include at least one manuscript note."); if (errors.length) { this.preparationError = errors.join(" "); this.render(); return; } this.preparationController?.abort(); const controller = new AbortController(); this.preparationController = controller; this.preparing = true; this.preparationError = ""; this.render(); try { this.request.contentPlan = this.plan; this.request.formatting = this.formatting; this.preparedSession = await this.plugin.prepareCompileRequest(this.request, this.plan, controller.signal); } catch (error) { if (!controller.signal.aborted) this.preparationError = `The final manuscript could not be prepared. ${error instanceof Error ? error.message : String(error)}`; } finally { if (this.preparationController === controller) { this.preparing = false; this.preparationController = undefined; this.render(); } } }
  private invalidatePrepared(message = ""): void { this.preparationController?.abort(); this.preparedSession = undefined; this.preparationError = message; const button = this.contentEl.querySelector<HTMLButtonElement>(".manuscript-create-button"); if (button) button.disabled = true; if (this.exportStateEl && message) { this.exportStateEl.empty(); this.exportStateEl.createEl("strong", { text: "Preview needs refresh" }); this.exportStateEl.createEl("p", { text: message }); this.refreshButton = this.exportStateEl.createEl("button", { text: "Refresh Preview", cls: "mod-cta" }); this.refreshButton.addEventListener("click", () => { void this.prepareFinalPreview(true); }); } }
  onClose(): void { this.preparationController?.abort(); this.contentEl.empty(); }
}
