# Saved Compilations — Workspace Session Model

Parts 1–6 implement this runtime state model for save, refresh, transitions, review, authorization, and export bookkeeping.

    Persisted Saved Compilation recipe
              ↓
    Reconciled effective current-source plan
              ↓
    Session author overlay
              ↓
    Canonical Workspace Recipe

`CanonicalWorkspaceRecipe` is a deterministic, JSON-safe representation of current author intent: root association, explicit structural overrides, compact sibling-order facts, and resolved output choices. It excludes prose, parsed notes, Books, findings, timestamps, DOM state, and download objects.

The persisted recipe remains the compact, versioned schema-1 contract. The workspace recipe is a runtime projection with explicit conversions in `saved-compilation-session.ts`; controller/UI code must not construct persistence-shaped objects ad hoc.

For a loaded Saved Compilation, dirty state is derived from canonical author intent versus the persisted recipe signature. Reconciliation changes caused by source evolution—such as a newly inferred Scene—do not make the workspace author-dirty. Only an author overlay does. Reverting an edit removes the redundant overlay and restores a clean state.

An overlay is never persisted automatically. On refresh, it is applied only to exact compatible current references. Missing or incompatible overlay paths are returned as unresolved state; they are never rebound to a similar note. Output edits survive refresh because they do not attach to source files. An explicit session root override is likewise unsaved author intent until a later Save Changes workflow persists it.

Ownership is deliberately narrow:

- `SavedCompilationService` owns validated persisted state and all writes.
- `SavedCompilationReconciler` compares persisted intent with current source without writes.
- `SavedCompilationWorkspaceSession` owns runtime baseline, overlay, canonical recipe, and derived dirty state.
- `CompileWorkspaceController` owns visible workspace editing and synchronizes its edits into the session; it does not call persistence mutations.
- `SavedCompilationOrchestrator` owns Saved lifecycle transitions, review resolution, and export authorization.
- `ExportCoordinator` remains the sole owner of exporters and browser delivery.

The independent axes are recipe dirty state, prepared-source safety, and reconciliation readiness (`READY`, `REVIEW_RECOMMENDED`, `REVIEW_REQUIRED`, `BLOCKED`).
