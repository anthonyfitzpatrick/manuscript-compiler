# Saved Compilations — Preparation Integration

> **Implemented through Part 8:** a Saved Compilation is an optional input-restoration context on the one authoritative preparation route. Visible workflow and root-scoped management delegate to this same lifecycle; neither creates a second preparation route.

The route is unchanged:

    root → VaultScanner → inferred Content Plan → optional reconciliation
         → applyContentPlan → parser/cleaner → current Book → validators/exporters

For a saved context, `CompilePreparationService` builds the normal current inferred plan once and calls `reconcileSavedCompilation` before `applyContentPlan`. It never uses a saved Book or prose cache. The resulting prepared session carries the reconciliation result and current source fingerprint for a future workspace/UI owner.

`savedCompilationRequest` maps the persisted resolved recipe/output snapshot into the normal `SimpleCompileRequest`; global defaults are not changed. `CompileWorkspaceOrigin` distinguishes `{ kind: "new" }` from a saved immutable ID and persisted recipe signature. Recipe dirty state is independent from source freshness and becomes true for workspace edits only in saved mode.

Saved lifecycle controls are visible in the existing workspace and management browser, but remain delegated to the service/orchestrator/controller owners. No Saved Compilation command or separate pipeline is introduced.

## Completed Part 6 integration

The preparation route remains unchanged: persisted intent → current-source reconciliation → session overlay → existing Content Plan/parser/Book route. `SavedCompilationOrchestrator` performs review gating before the existing `ExportCoordinator`; only a successful validated browser dispatch may record safe export facts. Dirty exports never mark the persisted recipe current, and bookkeeping failure never changes a real export success. Export facts contain no destination, bytes, Blob URL, or prose; `CURRENT` never proves an external file still exists.
