/** Runtime-only Obsidian API stubs for Node-based bundled tests. */
export function parseYaml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of source.split(/\r?\n/)) { const match = line.match(/^([^:#]+):\s*(.*)$/); if (!match) throw new Error(`Invalid YAML line: ${line}`); const value = match[2].trim(); result[match[1].trim()] = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : value; }
  return result;
}
export class TFile {}
export class TFolder {}
export class Vault {}
export class FileSystemAdapter {}
export class App {}
export class FuzzySuggestModal<T> {}
const element = (): any => ({ setText() {}, empty() {}, createEl: () => element(), createDiv: () => element(), createSpan: () => element(), addClass() {}, remove() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {} });
export class Modal { app: App; contentEl = element(); titleEl = element(); modalEl = element(); constructor(app: App) { this.app = app; } open(): void { (this as any).onOpen?.(); } close(): void { (this as any).onClose?.(); } }
export class Notice {}
class Button { buttonEl = element(); setButtonText(): this { return this; } setWarning(): this { return this; } setCta(): this { return this; } setDisabled(): this { return this; } onClick(): this { return this; } }
export class Setting { constructor(_container?: unknown) {} setName(): this { return this; } setDesc(): this { return this; } addButton(callback: (button: Button) => void): this { callback(new Button()); return this; } addDropdown(): this { return this; } addToggle(): this { return this; } addText(): this { return this; } addSearch(): this { return this; } }
export class PluginSettingTab { containerEl = element(); constructor(_app: App, _plugin: unknown) {} }
export class TextAreaComponent { inputEl = element(); constructor(_container?: unknown) {} setValue(): this { return this; } onChange(): this { return this; } }
export const apiVersion = "1.13.1";
export const Platform = { isDesktopApp: true, isMobile: false };
export const normalizePath = (value: string): string => value;
