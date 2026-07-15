/**
 * Manuscript Compiler — three-stage workspace state contracts.
 *
 * State is controller-owned and mutable. Views read it synchronously and request
 * mutations rather than retaining divergent copies.
 * These contracts are shared by modal, controller, and step renderers and call no
 * runtime service. They own no lifecycle, I/O, failure handling, or cancellation.
 * Prepared session identity and explicit dirty/stale state must remain visible;
 * do not move semantic Book interpretation into view state.
 */
import type { PreparedCompileSession } from "../compile-preparation";
import type { ContentPlanItem } from "../content-plan";
import type { OperationStatus } from "../operation-state";
import type { DocxFormatting, SimpleCompileRequest } from "../simple-workflow";
import type { ExportFormat } from "../export-types";

export const WORKSPACE_STEPS = ["manuscript", "contents", "create"] as const;
export type CompileWorkspaceStep = typeof WORKSPACE_STEPS[number];
/** Separates concise author guidance from log-only technical detail. */
export interface WorkspaceError {
  message: string;
  suggestion?: string;
  technicalDetail?: string;
  severity: "information" | "warning" | "error" | "critical";
  recoverable: boolean;
}
/** Single mutable state tree owned exclusively by CompileWorkspaceController. */
export interface CompileWorkspaceState {
  step: CompileWorkspaceStep;
  request: SimpleCompileRequest;
  contentPlan: ContentPlanItem[];
  formatting: DocxFormatting;
  scannedRoot: string;
  preparedSession?: PreparedCompileSession;
  preparationStatus: OperationStatus;
  exportStatus: OperationStatus;
  error?: WorkspaceError;
  exportFormat: ExportFormat;
}
