/**
 * Manuscript Compiler — final export eligibility policy.
 *
 * Converts prepared errors into one format-independent blocking decision.
 * Preview and export coordination share this pure policy so UI code cannot
 * accidentally bypass output-safety errors.
 */
import type { CompileWarning } from "./model";
const blockingCodes = new Set(["invalid-profile", "invalid-output", "invalid-filter"]);
export function canProceedWithExport(issues: CompileWarning[]): boolean { return !issues.some((issue) => issue.severity === "error" && blockingCodes.has(issue.code)); }
