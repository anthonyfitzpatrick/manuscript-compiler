/**
 * Manuscript Compiler — stable Obsidian command identifiers.
 *
 * main.ts registers these IDs and tests protect them because users may bind
 * hotkeys externally. Change display names separately; never casually rename IDs.
 */
export const COMMAND_IDS = {
  compileManuscript: "compile-manuscript",
  compileCurrentBook: "compile-current-book",
  compileSelectedFolder: "compile-selected-folder",
  validateManuscript: "validate-manuscript",
  generateDiagnostics: "generate-diagnostics-report"
} as const;
