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
export class Modal {}
export class Notice {}
export class Setting {}
export const apiVersion = "1.13.1";
export const Platform = { isDesktopApp: true };
export const normalizePath = (value: string): string => value;
