/**
 * Manuscript Compiler — single-operation state and cancellation ownership.
 *
 * Prevents duplicate preparation/export and gives each task one AbortController.
 * Finalisation disables cancellation so replacement or rollback can finish.
 * Controllers and ExportCoordinator acquire handles; this module calls no vault,
 * UI, generator, or persistence service. Invalid concurrent starts throw before
 * side effects. State transitions are synchronous and platform-neutral. Always
 * settle handles in `finally`, and never make terminal delivery cancellable.
 */
export type OperationStatus = "idle" | "preparing" | "ready" | "exporting" | "finalising" | "cancelled" | "failed" | "complete";

/** Handle retained by one caller until `settle`; methods are idempotent by design. */
export interface ActiveOperation {
  readonly signal: AbortSignal;
  readonly status: OperationStatus;
  cancel(): boolean;
  finalise(): void;
  complete(): void;
  fail(): void;
  settle(): void;
}

/** Owns at most one active operation and releases its lock only when settled. */
export class OperationStateController {
  private current?: OperationHandle;
  status: OperationStatus = "idle";

  /** Acquires the global operation slot, returning undefined rather than queueing duplicate work. */
  begin(status: "preparing" | "exporting"): ActiveOperation | undefined {
    if (this.current) return undefined;
    const handle = new OperationHandle(status, (next) => { this.status = next; }, () => { if (this.current === handle) this.current = undefined; });
    this.current = handle;
    this.status = status;
    return handle;
  }

  /** Requests cancellation only while the active handle still permits interruption. */
  cancel(): boolean { return this.current?.cancel() ?? false; }
  /** Indicates ownership of the operation slot, including non-cancellable finalisation. */
  get busy(): boolean { return this.current !== undefined; }
}

class OperationHandle implements ActiveOperation {
  private readonly controller = new AbortController();
  private cancellable = true;
  constructor(public status: OperationStatus, private readonly changed: (status: OperationStatus) => void, private readonly released: () => void) {}
  get signal(): AbortSignal { return this.controller.signal; }
  cancel(): boolean {
    if (!this.cancellable) return false;
    this.controller.abort();
    this.set("cancelled");
    return true;
  }
  finalise(): void { this.cancellable = false; this.set("finalising"); }
  complete(): void { this.set("complete"); this.released(); }
  fail(): void { this.set("failed"); this.released(); }
  settle(): void { this.released(); }
  private set(status: OperationStatus): void { this.status = status; this.changed(status); }
}
