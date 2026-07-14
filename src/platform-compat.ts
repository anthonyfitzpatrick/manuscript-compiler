/**
 * Manuscript Compiler — platform capability isolation.
 *
 * Provides optional desktop open/reveal/file-picker bridges without leaking
 * Electron or filesystem details into modals. ResultActionService is the main
 * caller. Every operation fails closed when unavailable.
 */
import { apiVersion, FileSystemAdapter, Platform, Vault } from "obsidian";

/**
 * Obsidian documents vault/workspace APIs but does not expose a cross-platform
 * API for opening arbitrary non-vault files or selecting an absolute path.
 * These desktop-only Electron bridges are isolated here and always fail closed.
 */
export async function openExternalVaultFile(vault: Vault, vaultPath: string): Promise<boolean> {
  if (!Platform.isDesktopApp || !(vault.adapter instanceof FileSystemAdapter)) return false;
  try { const electron = (globalThis as typeof globalThis & { require?: (id: string) => { shell: { openPath(path: string): Promise<string> } } }).require?.("electron"); if (!electron) return false; return (await electron.shell.openPath(vault.adapter.getFullPath(vaultPath))) === ""; } catch { return false; }
}
export function revealExternalVaultFile(vault: Vault, vaultPath: string): boolean {
  if (!Platform.isDesktopApp || !(vault.adapter instanceof FileSystemAdapter)) return false;
  try { const electron = (globalThis as typeof globalThis & { require?: (id: string) => { shell: { showItemInFolder(path: string): void } } }).require?.("electron"); if (!electron) return false; electron.shell.showItemInFolder(vault.adapter.getFullPath(vaultPath)); return true; } catch { return false; }
}
export function getObsidianVersion(): string { return apiVersion; }
