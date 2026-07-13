/**
 * Manuscript Compiler — isolated desktop filesystem capability bridge.
 *
 * Keeps optional Node access out of UI/domain modules. Platform services call
 * it only after capability checks; mobile and generic adapters retain vault-API
 * fallbacks. No shell or child process is used.
 */
interface NodeRequire { (id: "fs/promises"): typeof import("fs/promises"); (id: "os"): typeof import("os"); (id: "path"): typeof import("path"); }
function nodeRequire(): NodeRequire { return (globalThis as typeof globalThis & { require: NodeRequire }).require; }
export async function pathExists(path: string): Promise<boolean> { if (!path) return false; try { await nodeRequire()("fs/promises").access(path); return true; } catch { return false; } }
export function nodeFs() { return { fs: nodeRequire()("fs/promises"), os: nodeRequire()("os"), path: nodeRequire()("path") }; }
