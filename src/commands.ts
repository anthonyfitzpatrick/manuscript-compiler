/**
 * Manuscript Compiler — stable Obsidian command identifiers.
 *
 * main.ts registers these IDs and tests protect them because users may bind
 * hotkeys externally. Change display names separately; never casually rename IDs.
 * This pure module owns no registration lifecycle, execution, failure handling,
 * or cancellation. It is shared on desktop/mobile; additions must be registered
 * through Plugin lifecycle APIs and documented as compatibility-sensitive.
 */
export const COMMAND_IDS = {
  compileManuscript: "compile-manuscript",
  compileCurrentBook: "compile-current-book",
  compileSelectedFolder: "compile-selected-folder",
  validateManuscript: "validate-manuscript",
  generateDiagnostics: "generate-diagnostics-report"
} as const;
