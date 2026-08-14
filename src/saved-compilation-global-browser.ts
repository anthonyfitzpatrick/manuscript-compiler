/**
 * Settings-launched discovery for every persisted Saved Compilation. Listing is
 * service-derived and side-effect free; opening and deletion remain delegated.
 */
import { App, Modal, Notice, TFolder } from "obsidian";
import type ManuscriptCompilerPlugin from "./main";
import { DeleteCompilationModal } from "./compile-modal";
import type { SavedCompilation } from "./saved-compilations";

export interface GlobalSavedCompilationChoice {
  id: string;
  name: string;
  rootPath: string;
  manuscriptName: string;
  rootLocation: string;
  format: string;
  rootAvailable: boolean;
}

/** Maps the service's already deterministic, copy-safe list without reading the vault. */
export function globalSavedCompilationChoices(entries: readonly SavedCompilation[], rootAvailable: (path: string) => boolean): GlobalSavedCompilationChoice[] {
  return entries.map((entry) => {
    const root = rootPresentation(entry.root.path);
    return { id: entry.id, name: entry.name, rootPath: entry.root.path, manuscriptName: root.name, rootLocation: root.location, format: entry.output.format.toUpperCase(), rootAvailable: rootAvailable(entry.root.path) };
  });
}

/** Local UI filtering only: it neither scans manuscript content nor mutates Saved state. */
export function filterGlobalSavedCompilationChoices(entries: readonly GlobalSavedCompilationChoice[], query: string): GlobalSavedCompilationChoice[] {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? entries.filter((entry) => `${entry.name}\n${entry.rootPath}`.toLocaleLowerCase().includes(normalized)) : entries.slice();
}

export class SavedCompilationGlobalBrowserModal extends Modal {
  private query = "";
  private busy = false;
  private results?: HTMLElement;
  private search?: HTMLInputElement;

  constructor(app: App, private readonly plugin: ManuscriptCompilerPlugin) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("manuscript-global-saved-browser");
    this.titleEl.setText("Saved compilations");
    const body = this.contentEl.createDiv({ cls: "manuscript-global-saved-browser-body" });
    const field = body.createDiv({ cls: "manuscript-global-saved-browser-search" });
    this.search = field.createEl("input", { type: "search", attr: { id: "manuscript-global-saved-search", "aria-label": "Search saved compilations", placeholder: "Search saved compilations…" } });
    this.search.addEventListener("input", () => { this.query = this.search?.value ?? ""; this.renderResults(); });
    this.results = body.createDiv({ cls: "manuscript-global-saved-browser-list", attr: { "aria-label": "Saved compilations" } });
    this.renderResults();
    this.search.focus();
  }

  onClose(): void { this.contentEl.empty(); }

  private choices(): GlobalSavedCompilationChoice[] {
    return globalSavedCompilationChoices(this.plugin.savedCompilations.listAll(), (path) => this.app.vault.getAbstractFileByPath(path) instanceof TFolder);
  }

  private renderResults(): void {
    const results = this.results; if (!results) return;
    results.empty();
    const all = this.choices(); const visible = filterGlobalSavedCompilationChoices(all, this.query);
    if (!all.length) { results.createEl("p", { text: "No saved compilations yet.", cls: "manuscript-empty-state" }); return; }
    if (!visible.length) { results.createEl("p", { text: "No saved compilations match your search.", cls: "manuscript-empty-state" }); return; }
    visible.forEach((choice) => {
      const row = results.createDiv({ cls: "manuscript-global-saved-browser-row" });
      const details = row.createDiv({ cls: "manuscript-global-saved-browser-details" });
      details.createEl("strong", { text: choice.name, cls: "manuscript-global-saved-browser-name" });
      details.createSpan({ text: choice.manuscriptName, cls: "manuscript-global-saved-browser-manuscript" });
      if (choice.rootLocation) details.createSpan({ text: choice.rootLocation, cls: "manuscript-global-saved-browser-location", attr: { title: choice.rootPath } });
      if (!choice.rootAvailable) details.createSpan({ text: "Manuscript folder unavailable", cls: "manuscript-global-saved-browser-missing", attr: { role: "status" } });
      const footer = row.createDiv({ cls: "manuscript-global-saved-browser-footer" });
      footer.createSpan({ text: choice.format, cls: "manuscript-global-saved-browser-format" });
      const actions = footer.createDiv({ cls: "manuscript-global-saved-browser-actions" });
      const open = actions.createEl("button", { text: this.busy ? "Opening…" : "Open", attr: { "aria-label": `Open ${choice.name}` } });
      open.disabled = this.busy;
      open.addEventListener("click", () => { void this.openCompilation(choice.id); });
      const remove = actions.createEl("button", { text: "Delete", cls: "mod-warning", attr: { "aria-label": `Delete ${choice.name}` } });
      remove.disabled = this.busy;
      remove.addEventListener("click", () => this.confirmDelete(choice));
    });
  }

  private async openCompilation(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.renderResults();
    try {
      const result = await this.plugin.openSavedCompilation(id);
      if (result.status === "ready" || result.status === "root-unavailable") { this.close(); this.plugin.presentSavedCompilation(result.controller); return; }
      new Notice(result.status === "not-found" ? "That saved compilation is no longer available." : "Couldn’t open that saved compilation.", 7000);
    } finally {
      this.busy = false;
      if (this.contentEl.isConnected) this.renderResults();
    }
  }

  private confirmDelete(choice: GlobalSavedCompilationChoice): void {
    new DeleteCompilationModal(this.app, choice.name, async () => {
      const result = await this.plugin.deleteSavedCompilationGlobally(choice.id);
      if (result.status !== "ok") { new Notice("Couldn’t delete the saved compilation. Try again.", 7000); return false; }
      this.renderResults();
      return true;
    }).open();
  }
}

/** Presentation-only root identity: full vault-relative path remains available in the title attribute. */
function rootPresentation(path: string): { name: string; location: string } {
  const segments = path.split("/").filter(Boolean); const last = segments.length ? segments[segments.length - 1] : path;
  return { name: last.replace(/^(.*) - (.*)$/, "$1 – $2"), location: segments.slice(0, -1).join(" › ") };
}
