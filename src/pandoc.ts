import { FileSystemAdapter, Platform, Vault, normalizePath } from "obsidian";
import type { ChildProcessWithoutNullStreams } from "child_process";
import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";

export interface PandocStatus { available: boolean; executable?: string; version?: string; explanation?: string; }
export interface PandocRunResult { stdout: string; stderr: string; }
interface NodeRequire { (id: "child_process"): typeof import("child_process"); (id: "fs/promises"): typeof import("fs/promises"); (id: "os"): typeof import("os"); (id: "path"): typeof import("path"); }
function nodeRequire(): NodeRequire { return (globalThis as typeof globalThis & { require: NodeRequire }).require; }

export class PandocService {
  constructor(private readonly settings: ManuscriptCompilerSettings) {}
  async detect(): Promise<PandocStatus> {
    if (!Platform.isDesktopApp) return { available: false, explanation: "DOCX export requires the Obsidian desktop app." };
    const candidates = [this.settings.pandocExecutablePath.trim(), ...(this.settings.automaticallyDetectPandoc ? ["pandoc", "/opt/homebrew/bin/pandoc", "/usr/local/bin/pandoc", "/usr/bin/pandoc"] : [])].filter(Boolean);
    for (const executable of [...new Set(candidates)]) {
      try { const result = await this.run(executable, ["--version"]); const firstLine = result.stdout.split(/\r?\n/)[0]?.trim(); if (firstLine) return { available: true, executable, version: firstLine.replace(/^pandoc\s*/i, "") }; } catch { /* Try the next known executable. */ }
    }
    return { available: false, explanation: this.settings.automaticallyDetectPandoc ? "Pandoc was not found. Install Pandoc or configure its executable path." : "Pandoc automatic detection is disabled and the configured executable is unavailable." };
  }
  async convert(executable: string, input: string, output: string, profile: CompileProfile, title: string, author: string, signal?: AbortSignal): Promise<PandocRunResult> {
    const args = [input, "--from=markdown", "--to=docx", "--output", output, "--metadata", `title=${title}`, "--metadata", `author=${author}`];
    if (profile.generateTableOfContents) args.push("--toc");
    if (profile.referenceDocx) args.push(`--reference-doc=${profile.referenceDocx}`);
    if (profile.pandocMetadataFile) args.push(`--metadata-file=${profile.pandocMetadataFile}`);
    const additional = parseArguments(profile.additionalPandocArguments); validatePandocArguments(additional);
    args.push(...additional);
    return this.run(executable, args, signal);
  }
  private run(executable: string, args: string[], signal?: AbortSignal): Promise<PandocRunResult> {
    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try { child = nodeRequire()("child_process").spawn(executable, args, { shell: false, windowsHide: true }); } catch (error) { reject(error); return; }
      let closed = false; let forceTimer: ReturnType<typeof setTimeout> | undefined; const abort = (): void => { child.kill(); forceTimer = setTimeout(() => { if (!closed) child.kill("SIGKILL"); }, 2000); }; if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
      let stdout = ""; let stderr = ""; child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); }); child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
      child.on("error", (error) => { signal?.removeEventListener("abort", abort); if (forceTimer) clearTimeout(forceTimer); reject(error); }); child.on("close", (code) => { closed = true; signal?.removeEventListener("abort", abort); if (forceTimer) clearTimeout(forceTimer); if (signal?.aborted) reject(new Error("Compilation cancelled.")); else if (code === 0) resolve({ stdout, stderr }); else reject(new PandocError(`Pandoc exited with code ${code ?? "unknown"}.`, stdout, stderr)); });
    });
  }
}
export class PandocError extends Error { constructor(message: string, readonly stdout = "", readonly stderr = "") { super(message); } }
export function parseArguments(value: string): string[] {
  const args: string[] = []; let current = ""; let quote: "'" | '"' | null = null;
  for (const char of value.trim()) { if (quote) { if (char === quote) quote = null; else current += char; } else if (char === "'" || char === '"') quote = char; else if (/\s/.test(char)) { if (current) { args.push(current); current = ""; } } else current += char; }
  if (quote) throw new Error("Additional Pandoc arguments contain an unclosed quote."); if (current) args.push(current); return args;
}
export function validatePandocArguments(args: string[]): void { if (args.some((argument) => argument === "-o" || argument === "--output" || argument.startsWith("--output="))) throw new Error("Additional Pandoc arguments may not override the managed output path."); }
export function resolveVaultOrAbsolutePath(vault: Vault, value: string): string {
  if (!value.trim()) return ""; const path = nodeRequire()("path"); if (path.isAbsolute(value)) return value;
  if (!(vault.adapter instanceof FileSystemAdapter)) throw new Error("DOCX export requires a local filesystem vault."); return vault.adapter.getFullPath(normalizePath(value));
}
export async function pathExists(path: string): Promise<boolean> { if (!path) return false; try { await nodeRequire()("fs/promises").access(path); return true; } catch { return false; } }
export function nodeFs() { return { fs: nodeRequire()("fs/promises"), os: nodeRequire()("os"), path: nodeRequire()("path") }; }
