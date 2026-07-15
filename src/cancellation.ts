/**
 * Manuscript Compiler — cancellation vocabulary.
 *
 * Gives cancellable services one recognisable error and a shared checkpoint.
 * Callers distinguish cancellation from failure so no failure history is written.
 * It owns no operation state: OperationStateController owns AbortControllers and
 * services choose safe checkpoints. Helpers are synchronous, platform-neutral,
 * privacy-neutral, and must remain free of logging or cleanup side effects.
 */
/** Recognisable control-flow error used to prevent cancellation being logged as failure. */
export class CompilationCancelledError extends Error { constructor() { super("Compilation cancelled."); this.name = "CompilationCancelledError"; } }
/**
 * Enforces an optional cancellation checkpoint.
 * @throws `CompilationCancelledError` when the signal is aborted.
 * @remarks Has no side effects when active and carries no manuscript data.
 */
export function throwIfCancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new CompilationCancelledError(); }
/** Reports cancellation truthfully when a compatibility export already produced a verified file. */
