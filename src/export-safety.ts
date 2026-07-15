/**
 * Manuscript Compiler — final export eligibility policy.
 *
 * Converts prepared errors into one format-independent blocking decision.
 * Preview and export coordination share this pure policy so UI code cannot
 * accidentally bypass output-safety errors.
 * It owns no validation discovery, state, logging, or user notification. Calls
 * are synchronous, deterministic, non-throwing, non-cancellable, and identical
 * on desktop/mobile. New blocking codes must be stable and covered at both UI
 * and coordinator boundaries.
 */
import type { CompileWarning } from "./model";
const blockingCodes = new Set(["invalid-profile", "invalid-output", "invalid-filter"]);
export function canProceedWithExport(issues: CompileWarning[]): boolean { return !issues.some((issue) => issue.severity === "error" && blockingCodes.has(issue.code)); }
