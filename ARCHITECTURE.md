# Compile Route Architecture

Every production route crosses one root-to-model boundary: `CompilePreparationService.prepareAuthoritative()` in `src/compile-preparation.ts`. `VaultScanner` performs mechanical discovery only. No command, validator, or exporter may convert its raw `ScannedBook` independently.

## Composition and runtime boundaries

`src/main.ts` is the plugin composition root. It loads and repairs settings, constructs services, registers stable command IDs and the settings tab, runs conservative startup cleanup, and cancels the active global operation on unload.

- `CompileCommandService` resolves roots and coordinates guided, legacy, sample, validation, and diagnostics commands.
- `CompilePreparationService` is the only root-to-`PreparedCompileSession` boundary.
- `CompileWorkspaceController` owns four-step state, validation, invalidation, duplicate-click protection, and cancellable workspace operations.
- Step renderers in `src/workspace/` own DOM controls and event wiring only.
- `ExportCoordinator` verifies fingerprints, handles overwrite and progress UI, invokes exporters, and reports the outcome.
- `CompileHistoryService` is the only export-history and compile-log persistence boundary.
- `ResultActionService` isolates open, reveal, and platform save-copy capabilities.
- `SafeBinaryWriter` owns staged binary replacement, verification, rollback, and cleanup.
- `OperationStateController` models idle, preparation, export, non-cancellable finalisation, cancellation, failure, and completion.

## Entry-point map

| Command or caller | Root resolution | Content plan | Preparation purpose | Consumer |
| --- | --- | --- | --- | --- |
| `compile-manuscript` / `SimpleCompileModal` | explicit workspace folder through the preparation service | edited workspace plan, authoritative | `preview` / `guided` | Export-step preview, then `exportPreparedSession()` |
| `compileRequest()` compatibility caller | explicit request root | supplied plan, or safely inferred when absent | `preview` / `guided` | `exportPreparedSession()` |
| `compile-current-book` | `BookRootResolver.configuredOrCurrent()` | safely inferred and classified | `compile` / `current-book` | final-model preview, then `exportPreparedSession()` |
| `compile-selected-folder` | `BookRootResolver.selected()` | safely inferred and classified | `compile` / `selected-folder` | final-model preview, then `exportPreparedSession()` |
| profile-compatible `compileFolder()` | `BookRootResolver.selected()` | safely inferred unless an authoritative plan is supplied | `compile` / `legacy-profile` | final-model preview, then `exportPreparedSession()` |
| first-run sample compile | `BookRootResolver.require()` | safely inferred and classified | `compile` / `sample` | final-model preview, then `exportPreparedSession()` |
| `validate-manuscript` | `BookRootResolver.configuredOrCurrent()` | safely inferred and classified | `validation` / `validation` | `ManuscriptValidationService.validate(session)`; no write |
| Markdown and DOCX exporters | none | none | none | exact `PreparedCompileSession.book` and prepared Markdown only |

`generate-diagnostics-report` is not a compile route and never reads manuscript content.

## Authoritative pipeline

```text
TFolder book root
  -> VaultScanner mechanical discovery
  -> create/classify ContentPlan (or accept edited workspace plan)
  -> apply transparent containers, exclusions, roles, inclusion, and order
  -> ManuscriptCompiler.buildModel / parser and cleaning
  -> semantic Book
  -> statistics, warnings, exclusions, Markdown, fingerprints
  -> PreparedCompileSession
  -> workspace/legacy preview or validation
  -> ExportCoordinator fingerprint and overwrite checks
  -> MarkdownExporter or DocxExporter + SafeBinaryWriter
  -> CompileHistoryService
  -> ResultActionService / result view
```

The guided UI call graph is:

```text
SimpleCompileModal
  -> step renderer
  -> CompileWorkspaceController
  -> CompileCommandService.prepareGuided
  -> CompilePreparationService
  -> PreparedCompileSession
  -> buildExportPreviewViewModel(session)
  -> CompileWorkspaceController.export
  -> ExportCoordinator
```

The workspace plan wins over inference and legacy profile structure. Automatic routes always classify project folders, dashboards, revision notes, and empty cleaned notes before parsing. Legacy profiles can still supply formatting, output choices, matter preferences, and scene-break settings, but cannot bypass the content plan.

## Execution invariants

- The selected root names the book and is never a Part or Chapter.
- Transparent containers never emit headings.
- The parser receives only a scan rewritten by an authoritative content plan.
- Manual workspace inclusion, roles, and sibling order remain authoritative.
- Zero is never invented for missing Part or Chapter numbers.
- Preview, validation, Markdown, and DOCX consume the prepared semantic model; exporters never accept `ScannedBook`.
- Source and input fingerprints are checked before export.
- `SafeBinaryWriter` is the normal DOCX vault-save path.
- Exporters never write history or open result UI.
- Step renderers never scan, parse, export, or access filesystem/Electron bridges.
- Native DOCX creation remains offline and requires no community plugin, Pandoc, shell, or external executable.
