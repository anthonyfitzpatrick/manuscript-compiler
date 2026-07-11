import type { CompileWarning } from "./model";
import type { ExportTarget } from "./settings";

const blockingConfigurationCodes = new Set(["output-inside-root", "invalid-profile", "invalid-output", "invalid-filter", "invalid-output-folder", "invalid-output-path"]);
export function canProceedWithExport(issues: CompileWarning[], target: ExportTarget, docxReady: boolean): boolean { if (target === "docx" && !docxReady) return false; return !issues.some((issue) => issue.severity === "error" && blockingConfigurationCodes.has(issue.code)); }
