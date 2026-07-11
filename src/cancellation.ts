export class CompilationCancelledError extends Error { constructor() { super("Compilation cancelled."); this.name = "CompilationCancelledError"; } }
export function throwIfCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new CompilationCancelledError(); }
