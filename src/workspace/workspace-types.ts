/**
 * Manuscript Compiler — four-step workspace state contracts.
 *
 * State is controller-owned and mutable. Views read it synchronously and request
 * mutations rather than retaining divergent copies.
 */
import type { PreparedCompileSession } from "../compile-preparation";
import type { ContentPlanItem } from "../content-plan";
import type { OperationStatus } from "../operation-state";
import type { DocxFormatting, SimpleCompileRequest } from "../simple-workflow";

export type CompileWorkspaceStep = "manuscript" | "contents" | "formatting" | "export";
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
}
