export type OperationStatus = "idle" | "preparing" | "ready" | "exporting" | "finalising" | "cancelled" | "failed" | "complete";

export interface ActiveOperation {
  readonly signal: AbortSignal;
  readonly status: OperationStatus;
  cancel(): boolean;
  finalise(): void;
  complete(): void;
  fail(): void;
  settle(): void;
}

/** A single-operation lock with an explicit non-cancellable finalisation boundary. */
export class OperationStateController {
  private current?: OperationHandle;
  status: OperationStatus = "idle";

  begin(status: "preparing" | "exporting"): ActiveOperation | undefined {
    if (this.current) return undefined;
    const handle = new OperationHandle(status, (next) => { this.status = next; }, () => { if (this.current === handle) this.current = undefined; });
    this.current = handle;
    this.status = status;
    return handle;
  }

  cancel(): boolean { return this.current?.cancel() ?? false; }
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
