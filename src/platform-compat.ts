import { FileSystemAdapter, Vault } from "obsidian";

/**
 * Obsidian documents vault/workspace APIs but does not expose a cross-platform
 * API for opening arbitrary non-vault files or selecting an absolute path.
 * These desktop-only Electron bridges are isolated here and always fail closed.
 */
export async function openExternalVaultFile(vault: Vault, vaultPath: string): Promise<boolean> {
  if (!(vault.adapter instanceof FileSystemAdapter)) return false;
  try { const electron = (globalThis as typeof globalThis & { require?: (id: string) => { shell: { openPath(path: string): Promise<string> } } }).require?.("electron"); if (!electron) return false; return (await electron.shell.openPath(vault.adapter.getFullPath(vaultPath))) === ""; } catch { return false; }
}
export function chooseLocalFile(accept: string, callback: (path: string) => void): void {
  const input = document.createElement("input"); input.type = "file"; input.accept = accept;
  input.setAttribute("aria-label", "Choose local file"); input.addEventListener("change", () => { const selected = input.files?.[0] as (File & { path?: string }) | undefined; if (selected?.path) callback(selected.path); }); input.click();
}
