import type { PreparedCompileSession } from "../compile-preparation";
import type { ContentPlanItem } from "../content-plan";
import type { OperationStatus } from "../operation-state";
import type { DocxFormatting, SimpleCompileRequest } from "../simple-workflow";

export type CompileWorkspaceStep = "manuscript" | "contents" | "formatting" | "export";
export interface WorkspaceError {
  message: string;
  suggestion?: string;
  technicalDetail?: string;
  severity: "information" | "warning" | "error" | "critical";
  recoverable: boolean;
}
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
