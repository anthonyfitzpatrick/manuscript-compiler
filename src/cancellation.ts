/**
 * Manuscript Compiler — cancellation vocabulary.
 *
 * Gives cancellable services one recognisable error and a shared checkpoint.
 * Callers distinguish cancellation from failure so no failure history is written.
 */
export class CompilationCancelledError extends Error { constructor() { super("Compilation cancelled."); this.name = "CompilationCancelledError"; } }
export function throwIfCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new CompilationCancelledError(); }
