/** Shared, UI-neutral construction seam for New and Saved workspace controllers. */
import type { PreparedCompileSession } from "../compile-preparation";
import { savedWorkspaceOrigin } from "../saved-compilation-integration";
import type { SavedCompilation } from "../saved-compilations";
import type { SavedCompilationWorkspaceSession } from "../saved-compilation-session";
import type { DocxFormatting, SimpleCompileRequest } from "../simple-workflow";
import { CompileWorkspaceController, type CompileWorkspaceServices } from "./compile-workspace-controller";

export type CompileWorkspaceInitialization =
  | { kind: "new"; request: SimpleCompileRequest; formatting: DocxFormatting }
  | { kind: "saved"; compilation: SavedCompilation; session: SavedCompilationWorkspaceSession; request: SimpleCompileRequest; formatting: DocxFormatting; prepared?: PreparedCompileSession };

/** Creates the one controller class for either origin; Saved state is attached once here. */
export function createCompileWorkspaceController(initialization: CompileWorkspaceInitialization, services: CompileWorkspaceServices): CompileWorkspaceController {
  if (initialization.kind === "new") return new CompileWorkspaceController(initialization.request, initialization.formatting, services);
  const controller = new CompileWorkspaceController(initialization.request, initialization.formatting, services, savedWorkspaceOrigin(initialization.compilation));
  if (initialization.prepared) controller.initializePreparedWorkspace(initialization.prepared);
  controller.attachSavedCompilationSession(initialization.session);
  return controller;
}
