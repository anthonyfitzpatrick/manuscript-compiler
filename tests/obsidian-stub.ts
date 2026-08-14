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
export interface TestElement { texts: string[]; toggles: TestToggle[]; setText(value: string): void; empty(): void; createEl(_tag: string, options?: { text?: string }): TestElement; createDiv(options?: { text?: string }): TestElement; createSpan(options?: { text?: string }): TestElement; }
export interface TestToggle { value?: boolean; change?(value: boolean): void; setValue(value: boolean): TestToggle; onChange(change: (value: boolean) => void): TestToggle; }
const element = (texts: string[] = [], toggles: TestToggle[] = []): any => ({ texts, toggles, setText(value: string) { texts.push(value); }, empty() {}, createEl: (_tag: string, options?: { text?: string }) => { if (options?.text) texts.push(options.text); return element(texts, toggles); }, createDiv: (options?: { text?: string }) => { if (options?.text) texts.push(options.text); return element(texts, toggles); }, createSpan: (options?: { text?: string }) => { if (options?.text) texts.push(options.text); return element(texts, toggles); }, prepend() {}, append() {}, addClass() {}, toggleClass() {}, remove() {}, setAttribute() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, win: { open() {} } });
export function createTestElement(): TestElement { return element(); }
export class Modal { app: App; contentEl = element(); titleEl = element(); modalEl = element(); constructor(app: App) { this.app = app; } open(): void { (this as any).onOpen?.(); } close(): void { (this as any).onClose?.(); } }
export class Notice {}
class Button { buttonEl = element(); setButtonText(): this { return this; } setWarning(): this { return this; } setCta(): this { return this; } setDisabled(): this { return this; } onClick(): this { return this; } }
export class ButtonComponent extends Button { constructor(_container?: unknown) { super(); } setTooltip(): this { return this; } setClass(): this { return this; } setIcon(): this { return this; } }
export class Setting { settingEl = element(); constructor(private readonly container?: TestElement) {} setName(value: string): this { this.container?.texts.push(value); return this; } setDesc(value: string): this { this.container?.texts.push(value); return this; } addButton(callback: (button: Button) => void): this { callback(new Button()); return this; } addDropdown(): this { return this; } addToggle(callback?: (toggle: TestToggle) => void): this { const toggle: TestToggle = { setValue(value) { this.value = value; return this; }, onChange(change) { this.change = change; return this; } }; callback?.(toggle); this.container?.toggles.push(toggle); return this; } addText(): this { return this; } addSearch(): this { return this; } }
export class PluginSettingTab { containerEl = element(); constructor(_app: App, _plugin: unknown) {} }
export class TextAreaComponent { inputEl = element(); constructor(_container?: unknown) {} setValue(): this { return this; } onChange(): this { return this; } }
export const apiVersion = "1.13.1";
export const Platform = { isDesktopApp: true, isMobile: false };
export const normalizePath = (value: string): string => value;
export const setIcon = (_element: HTMLElement, _icon: string): void => undefined;
