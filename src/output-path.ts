/**
 * Manuscript Compiler — vault-relative path validation.
 *
 * Shared by output code before adapter access. Rejects absolute, traversal, and
 * non-portable paths. WarningEngine separately checks whether a valid output
 * path would still fall inside the manuscript source root.
 */
import { normalizePath } from "obsidian";

export function validateVaultPath(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^(?:\/|\\|[A-Za-z]:)/.test(raw)) throw new Error("Export paths must be vault-relative, not absolute.");
  // Validate before normalization because adapters may collapse traversal segments.
  if (raw.split("/").some((segment) => segment === ".." || segment === ".")) throw new Error("Export paths may not contain traversal segments.");
  const normalized = normalizePath(raw.replace(/\/+$/g, ""));
  if (/[\\:*?"<>|]/.test(normalized)) throw new Error("Export path contains characters that are not portable across supported operating systems.");
  return normalized;
}
