/**
 * Manuscript Compiler — staged, validated binary output.
 *
 * Validates complete DOCX bytes, writes a same-folder temporary file, verifies
 * readback, then commits or rolls back through an adapter-aware backend. Called
 * by DocxExporter; calls docx-validator and platform adapters.
 *
 * Invariants: preserve the old file until final verification, stop accepting
 * cancellation at commit, return success only after validation, and clean only
 * artifacts matching this plugin's exact naming convention.
 */
import { FileSystemAdapter, normalizePath, type DataAdapter, type Vault } from "obsidian";
import { CompilationCancelledError } from "./cancellation";
import { assertValidDocx, validateDocxBytes, type DocxValidationResult } from "./docx-validator";
import { nodeFs } from "./filesystem";
import { validateVaultPath } from "./output-path";

export type SafeSaveStage = "Saving to vault" | "Verifying temporary file" | "Finalising file" | "Verifying saved DOCX" | "Restoring previous file" | "Cleaning up";
/** Per-operation callbacks and cancellation supplied by export orchestration. */
export interface SafeBinaryWriteOptions { signal?: AbortSignal; onProgress?: (stage: SafeSaveStage) => void; onCommit?: () => void; token?: string; }
/** Returned only after the destination has been read back and validated. */
export interface SafeBinaryWriteResult { path: string; strategy: "same-folder-filesystem" | "verified-adapter-recovery"; replacedExisting: boolean; finalValidation: DocxValidationResult; checksum: string; }
export interface StaleCleanupResult { removed: string[]; preservedBackups: string[]; }
export interface BinaryEntry { path: string; mtime: number; }
/**
 * Minimal binary storage contract. Tests inject deterministic failure backends;
 * production wraps either a local filesystem or generic Obsidian adapter.
 */
export interface SafeBinaryBackend {
  readonly kind: "filesystem" | "adapter";
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(folder: string): Promise<BinaryEntry[]>;
}

/** Failure carrying restoration outcome and, only when critical, recovery paths. */
export class SafeBinaryWriteError extends Error {
  readonly severity: "error" | "critical";
  constructor(message: string, readonly restoration: "not-needed" | "restored" | "failed", readonly backupPath?: string, readonly destinationPath?: string) { super(message); this.name = "SafeBinaryWriteError"; this.severity = restoration === "failed" ? "critical" : "error"; }
}

/**
 * Transaction-like writer for validated DOCX bytes. One instance may serve many
 * sequential exports; callers provide per-write cancellation/progress. It owns
 * temporary and backup artifacts but never records history or displays UI.
 */
export class SafeBinaryWriter {
  static readonly STALE_TEMP_AGE_MS = 24 * 60 * 60 * 1000;
  private readonly backend: SafeBinaryBackend;
  constructor(vaultOrBackend: Vault | SafeBinaryBackend) { this.backend = isBackend(vaultOrBackend) ? vaultOrBackend : backendForVault(vaultOrBackend); }

  /**
   * Validates before touching the destination, stages and verifies bytes, then
   * completes replacement or rollback. Cancellation after `onCommit` is ignored.
   */
  async writeValidated(destinationPath: string, bytes: Uint8Array, options: SafeBinaryWriteOptions = {}): Promise<SafeBinaryWriteResult> {
    const destination = validateVaultPath(destinationPath); assertValidDocx(bytes, "Generated DOCX"); checkCancelled(options.signal);
    const { temp, backup } = artifactPaths(destination, options.token ?? token()); const generatedChecksum = checksum(bytes); let commitStarted = false; let preserveBackup = false;
    try {
      options.onProgress?.("Saving to vault"); await this.backend.write(temp, bytes); checkCancelled(options.signal);
      options.onProgress?.("Verifying temporary file"); const temporary = await this.backend.read(temp); verifyEqualAndValid(temporary, bytes.length, generatedChecksum, "Temporary DOCX"); checkCancelled(options.signal);
      const beginCommit = (): void => { checkCancelled(options.signal); commitStarted = true; options.onCommit?.(); options.onProgress?.("Finalising file"); };
      return this.backend.kind === "filesystem" ? await this.commitFilesystem(destination, temp, backup, bytes, generatedChecksum, options, beginCommit, () => { preserveBackup = true; }) : await this.commitAdapter(destination, temp, backup, bytes, generatedChecksum, options, beginCommit, () => { preserveBackup = true; });
    } catch (error) {
      if (!commitStarted && options.signal?.aborted) throw new CompilationCancelledError();
      throw error;
    } finally {
      options.onProgress?.("Cleaning up"); await removeIfPresent(this.backend, temp); if (!preserveBackup) await removeIfPresent(this.backend, backup);
    }
  }

  /**
   * Non-recursively removes only recognised old temporary files. Backups and
   * recent files are preserved because they may represent recovery or active work.
   */
  async cleanupStaleArtifacts(folderPath: string, now = Date.now()): Promise<StaleCleanupResult> {
    const folder = validateVaultPath(folderPath); const removed: string[] = []; const preservedBackups: string[] = [];
    for (const entry of await this.backend.list(folder)) {
      if (isBackupArtifact(entry.path)) { preservedBackups.push(entry.path); continue; }
      if (!isTemporaryArtifact(entry.path) || now - entry.mtime < SafeBinaryWriter.STALE_TEMP_AGE_MS) continue;
      if (await removeIfPresent(this.backend, entry.path)) removed.push(entry.path);
    }
    return { removed, preservedBackups };
  }

  private async commitFilesystem(destination: string, temp: string, backup: string, generated: Uint8Array, generatedChecksum: string, options: SafeBinaryWriteOptions, beginCommit: () => void, preserveBackup: () => void): Promise<SafeBinaryWriteResult> {
    const existed = await this.backend.exists(destination); const original = existed ? await this.backend.read(destination) : undefined; let backedUp = false;
    beginCommit();
    try {
      if (existed) { await this.backend.rename(destination, backup); backedUp = true; }
      await this.backend.rename(temp, destination);
      options.onProgress?.("Verifying saved DOCX"); const final = await this.backend.read(destination); const validation = verifyEqualAndValid(final, generated.length, generatedChecksum, "Saved DOCX");
      if (backedUp) await removeIfPresent(this.backend, backup);
      return { path: destination, strategy: "same-folder-filesystem", replacedExisting: existed, finalValidation: validation, checksum: generatedChecksum };
    } catch (error) {
      if (!existed) { await removeIfPresent(this.backend, destination); throw new SafeBinaryWriteError(userSaveError(error, false), "not-needed", undefined, destination); }
      if (!backedUp) throw new SafeBinaryWriteError(userSaveError(error, true), "restored", undefined, destination);
      options.onProgress?.("Restoring previous file"); try { await removeIfPresent(this.backend, destination); await this.backend.rename(backup, destination); if (original) verifyEqual(await this.backend.read(destination), original.length, checksum(original), "Restored previous DOCX"); throw new SafeBinaryWriteError(userSaveError(error, true), "restored", undefined, destination); } catch (restoreError) { if (restoreError instanceof SafeBinaryWriteError) throw restoreError; preserveBackup(); throw new SafeBinaryWriteError(`The DOCX could not be saved and the previous file could not be restored automatically. Keep the recovery file at “${backup}” and restore it to “${destination}” before trying again.`, "failed", backup, destination); }
    }
  }

  private async commitAdapter(destination: string, temp: string, backup: string, generated: Uint8Array, generatedChecksum: string, options: SafeBinaryWriteOptions, beginCommit: () => void, preserveBackup: () => void): Promise<SafeBinaryWriteResult> {
    const existed = await this.backend.exists(destination); const original = existed ? await this.backend.read(destination) : undefined;
    if (original) { await this.backend.write(backup, original); verifyEqual(await this.backend.read(backup), original.length, checksum(original), "Recovery backup"); }
    beginCommit();
    try {
      await this.backend.write(destination, generated);
      options.onProgress?.("Verifying saved DOCX"); const final = await this.backend.read(destination); const validation = verifyEqualAndValid(final, generated.length, generatedChecksum, "Saved DOCX");
      if (original) await removeIfPresent(this.backend, backup);
      return { path: destination, strategy: "verified-adapter-recovery", replacedExisting: existed, finalValidation: validation, checksum: generatedChecksum };
    } catch (error) {
      if (!original) { await removeIfPresent(this.backend, destination); throw new SafeBinaryWriteError(userSaveError(error, false), "not-needed", undefined, destination); }
      options.onProgress?.("Restoring previous file"); try { await this.backend.write(destination, original); verifyEqual(await this.backend.read(destination), original.length, checksum(original), "Restored previous DOCX"); throw new SafeBinaryWriteError(userSaveError(error, true), "restored", undefined, destination); } catch (restoreError) { if (restoreError instanceof SafeBinaryWriteError) throw restoreError; preserveBackup(); throw new SafeBinaryWriteError(`The DOCX could not be saved and the previous file could not be restored automatically. Keep the recovery file at “${backup}” and restore it to “${destination}” before trying again.`, "failed", backup, destination); }
    }
  }
}

function backendForVault(vault: Vault): SafeBinaryBackend { return vault.adapter instanceof FileSystemAdapter ? filesystemBackend(vault.adapter) : adapterBackend(vault.adapter); }
function filesystemBackend(adapter: FileSystemAdapter): SafeBinaryBackend {
  const { fs, path } = nodeFs(); const absolute = (value: string): string => adapter.getFullPath(value);
  return { kind: "filesystem", exists: (value) => adapter.exists(value), read: async (value) => new Uint8Array(await fs.readFile(absolute(value))), write: async (value, bytes) => { const handle = await fs.open(absolute(value), "wx"); try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); } }, rename: async (from, to) => { await fs.rename(absolute(from), absolute(to)); }, remove: async (value) => { await fs.rm(absolute(value), { force: true }); }, list: async (folder) => { try { const names = await fs.readdir(absolute(folder)); return await Promise.all(names.map(async (name) => { const value = normalizePath(folder ? `${folder}/${name}` : name); const stat = await fs.stat(path.join(absolute(folder), name)); return { path: value, mtime: stat.mtimeMs }; })); } catch { return []; } } };
}
function adapterBackend(adapter: DataAdapter): SafeBinaryBackend { return { kind: "adapter", exists: (path) => adapter.exists(path), read: async (path) => new Uint8Array(await adapter.readBinary(path)), write: (path, bytes) => adapter.writeBinary(path, buffer(bytes)), rename: (from, to) => adapter.rename(from, to), remove: (path) => adapter.remove(path), list: async (folder) => { try { const listed = await adapter.list(folder); return await Promise.all(listed.files.map(async (path) => ({ path, mtime: (await adapter.stat(path))?.mtime ?? 0 }))); } catch { return []; } } }; }
function isBackend(value: Vault | SafeBinaryBackend): value is SafeBinaryBackend { return "kind" in value && typeof value.read === "function"; }
function artifactPaths(destination: string, id: string): { temp: string; backup: string } { const slash = destination.lastIndexOf("/"); const folder = slash < 0 ? "" : destination.slice(0, slash); const name = slash < 0 ? destination : destination.slice(slash + 1); const prefix = `.${name}.manuscript-compiler-${id}`; return { temp: validateVaultPath(folder ? `${folder}/${prefix}.tmp` : `${prefix}.tmp`), backup: validateVaultPath(folder ? `${folder}/${prefix}.backup` : `${prefix}.backup`) }; }
function token(): string { const random = globalThis.crypto?.getRandomValues ? [...globalThis.crypto.getRandomValues(new Uint32Array(2))].map((value) => value.toString(36)).join("") : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; return `${Date.now().toString(36)}-${random}`; }
function isTemporaryArtifact(path: string): boolean { return /(?:^|\/)\.[^/]+\.docx\.manuscript-compiler-[a-z0-9-]+\.tmp$/i.test(path); }
function isBackupArtifact(path: string): boolean { return /(?:^|\/)\.[^/]+\.docx\.manuscript-compiler-[a-z0-9-]+\.backup$/i.test(path); }
function verifyEqualAndValid(bytes: Uint8Array, length: number, expectedChecksum: string, context: string): DocxValidationResult { verifyEqual(bytes, length, expectedChecksum, context); const validation = validateDocxBytes(bytes); if (!validation.valid) throw new Error(`${context} validation failed: ${validation.errors.join(" ")}`); return validation; }
function verifyEqual(bytes: Uint8Array, length: number, expectedChecksum: string, context: string): void { if (bytes.length !== length) throw new Error(`${context} length did not match the generated file.`); if (checksum(bytes) !== expectedChecksum) throw new Error(`${context} checksum did not match the generated file.`); }
function checksum(bytes: Uint8Array): string { let result = 2166136261; for (const byte of bytes) { result ^= byte; result = Math.imul(result, 16777619); } return (result >>> 0).toString(16).padStart(8, "0"); }
function buffer(bytes: Uint8Array): ArrayBuffer { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }
function checkCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new CompilationCancelledError(); }
async function removeIfPresent(backend: SafeBinaryBackend, path: string): Promise<boolean> { try { if (await backend.exists(path)) await backend.remove(path); return true; } catch { return false; /* A later stale-file cleanup can retry temporary files. */ } }
function userSaveError(error: unknown, restored: boolean): string { const detail = error instanceof Error ? error.message : String(error); return restored ? `The DOCX could not be saved. The previous file was restored. ${detail}` : `The DOCX could not be saved safely. ${detail}`; }
