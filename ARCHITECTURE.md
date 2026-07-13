# Compile Route Architecture

This document is the maintainer handbook for the runtime architecture. The README explains the product to authors; this file explains where a developer can safely change it and which boundaries must remain intact.

## Mental model

The plugin deliberately has two models:

- `ScannedBook` is a permissive physical discovery model. It describes what exists below a folder and is never safe to export directly.
- `Book` is the semantic publishing model. It contains only prepared front matter, Parts, Chapters, Scenes, and back matter and is the sole input to renderers.

`ContentPlanItem[]` is the bridge between them. Automatic inference proposes roles, while the Contents workspace records authoritative author corrections. This intermediate plan exists because vault organisation is not publishing structure: project folders, transparent containers, dashboards, and template notes can coexist beside manuscript prose.

Every production route resolves a `TFolder` through `BookRootResolver` and crosses one root-to-model boundary: `CompilePreparationService.prepareAuthoritative()` in `src/compile-preparation.ts`. `VaultScanner` performs mechanical discovery only. No command, validator, or exporter may convert its raw `ScannedBook` independently.

## Composition and runtime boundaries

`src/main.ts` is the plugin composition root. It loads and repairs settings, constructs services, registers stable command IDs and the settings tab, runs conservative startup cleanup, and cancels the active global operation on unload.

It also registers the documented workspace `file-menu` event through `registerEvent()`. `folder-context-menu.ts` adds the action only for `TFolder`; its callback delegates to `openCompilerForFolder()` and contains no scanning or preparation logic.

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
| File Explorer folder action | exact right-clicked `TFolder`; no ancestry inference | workspace scan, then edited authoritative plan | `preview` / `guided` | same four-step workspace and `exportPreparedSession()` |
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
  -> BookRootResolver
  -> CompilePreparationService
  -> VaultScanner mechanical discovery
  -> create/classify ContentPlan (or accept edited workspace plan)
  -> apply transparent containers, exclusions, roles, inclusion, and order
  -> ManuscriptCompiler.buildModel
  -> ManuscriptParser
  -> ContentCleaningPipeline
  -> semantic Book
  -> statistics, warnings, exclusions, Markdown, fingerprints
  -> PreparedCompileSession
  -> workspace/legacy preview or validation
  -> ExportCoordinator fingerprint and overwrite checks
  -> MarkdownExporter or DocxExporter
  -> validateDocxBytes (DOCX in memory)
  -> SafeBinaryWriter staged write/readback/replacement/final validation
  -> CompileHistoryService after verified success/failure/cancellation
  -> ResultActionService / result view
```

The guided UI call graph is:

```text
SimpleCompileModal
  -> step renderer
  -> CompileWorkspaceController
  -> CompileCommandService.prepareGuided
  -> BookRootResolver.require
  -> CompilePreparationService
  -> PreparedCompileSession
  -> buildExportPreviewViewModel(session)
  -> CompileWorkspaceController.export
  -> ExportCoordinator
```

The workspace plan wins over inference and legacy profile structure. Automatic routes always classify project folders, dashboards, revision notes, and empty cleaned notes before parsing. Legacy profiles can still supply formatting, output choices, matter preferences, and scene-break settings, but cannot bypass the content plan.

`createContentPlan()` records each detected role, recognises dedicated and mixed matter containers, and treats nested folders repeating the selected root name as transparent when they are not explicit Parts or Chapters. `applyContentPlan()` reconstructs the scan using each item’s nearest included Part/Chapter ancestor. Transparent folders therefore flatten only their own heading; they do not flatten or detach the structural descendants below them. Manual order is read from the authoritative global content order.

## Why preview owns the final Book

The parser and cleaner can exclude empty or malformed notes after the Contents plan has been edited. A plan-derived preview could therefore promise content that the exporter would later omit. Preparation resolves this by constructing one `PreparedCompileSession`: its `book` reference drives the outline, statistics, warnings, Markdown, and DOCX. Export verifies source and input fingerprints but does not rebuild the model. Treat prepared sessions as immutable snapshots even though TypeScript does not deep-freeze them.

## Content-cleaning boundary

`ManuscriptParser` reads each included file and delegates mandatory manuscript-body cleaning to `filters.ts`. Body-heading extraction runs before optional syntax conversion. Structured metadata removal is deliberately limited to recognised property regions, tables, and note boundaries; broad “lines beginning with Book/Chapter” deletion would destroy valid fiction prose. Any new cleaner must be deterministic, prose-preserving, and covered by an exact leakage regression.

## Execution invariants

- The selected root names the book and is never a Part or Chapter.
- An explicitly selected root is exact: no ancestor or nested child may replace it.
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
- The production DOCX module exposes only semantic `Book` generation; no generic Markdown-to-DOCX production entry point remains.

## Native DOCX formatting boundary

`SimpleCompileRequest` carries the authoritative formatting selection. `resolveSimpleCompileRequest()` maps it to compatibility profile fields, `DocxExporter` passes those fields to `createManuscriptDocx()`, and `resolveDocxOptions()` repairs numeric compatibility values before XML generation. The generator consumes the prepared `Book`; it never reparses Markdown structure.

| Active control | Request/profile field | WordprocessingML effect |
| --- | --- | --- |
| Vellum / Standard / Custom | `docxPreset` plus `DocxFormatting` | deterministic supported defaults or explicit values |
| Font, size, line spacing, indent | `docxFont`, `docxFontSize`, `docxLineSpacing`, `docxFirstLineIndent` | style defaults, `BodyText`, and `FirstParagraph` properties |
| Letter / A4 | `docxPageSize` | section page dimensions |
| Chapter page breaks | `docxChapterPageBreak` | `pageBreakBefore` on the first displayed Chapter heading only |
| Part headings | semantic Part plus `partDisplay` | Parts always start on a new page; number/title paragraphs are kept together |
| Chapter headings | semantic Chapter plus `chapterDisplay` | Chapter Number/Title styles with no invented numbering |
| Scene break | `sceneSeparator` | centred Scene Break paragraph only between included scenes |
| Title page | `docxTitlePage` plus title/author variables | Title and Author styles, followed by one page break |
| Table of contents | `tableOfContents` / `generateTableOfContents` | genuine Word TOC field; off by default |
| Front/back matter inclusion | authoritative content plan plus matter flags | included matter notes use matter headings and page starts |
| Part/Chapter inclusion | authoritative structural roles and `useParts` | only semantic nodes receive structural headings |
| Scene titles | compatibility-only `includeSceneTitles` | functional for legacy profiles but not exposed in the normal workflow |

The `Subtitle` style was removed because the semantic model has no supported subtitle field. Legacy custom heading templates, `includeSceneTitles`, and the stored `removeCallouts` field remain data-compatible; the active wording for the latter is **Convert callouts to plain text**. Pandoc/reference-document fields remain migration-only and are not active formatting controls. Margins are fixed at one inch, and separate front/back page-behaviour toggles are not exposed.

## Safe-saving transaction

`createManuscriptDocx()` returns complete bytes and never accesses the vault. `DocxExporter` validates those bytes and passes them to `SafeBinaryWriter`, the only normal DOCX destination-writing path.

On a local filesystem the writer stages in the destination directory, verifies readback, renames an existing destination to a backup, renames the temporary file into place, verifies the final file, then removes the backup. A failed replacement restores the backup. Generic adapters use the same validation stages but preserve original bytes and a recovery backup because their write APIs cannot promise rename atomicity. Cancellation is accepted before commit; after commit begins the writer must finish replacement or rollback.

History success and Open/Reveal/Save Copy actions occur only after final verification. Do not move those side effects into exporters or UI components.

## Settings and migration

`settings.ts` is the persisted schema. `profiles.ts` performs historical migration followed by repair. Migration retains obsolete fields when deleting them would lose user data, but retained Pandoc fields are inert. Both stages must remain idempotent: applying them twice must produce the same serialised settings.

When adding a persisted field:

1. Add a safe new-user default.
2. Repair missing or malformed values without overwriting valid explicit values.
3. Add a realistic old-settings migration test and run it twice.
4. Decide whether the field belongs in the normal workspace, Advanced compatibility UI, or storage only.

## Testing map

- `tests/run.ts` is the broad unit/release suite: cleaning, parser, content plan, migrations, route identity, workspace state, privacy, and Warden semantic regressions.
- `tests/docx-integration.ts` opens generated Word XML and asserts semantic styles, page behaviour, matter ordering, Unicode, and forbidden content.
- `tests/safe-binary-writer.ts` injects failures at every save phase and proves rollback/cleanup.
- `tests/large-manuscript-benchmark.ts` checks deterministic large-book correctness and reports informative timing.
- `tests/golden/` protects stable Markdown output for representative structures.
- `tests/fixtures/real-vault/` reproduces nested transparent containers and mixed matter that previously produced zero Chapters and orphan Scenes.

Automated XML tests establish semantic structure, not visual pagination in Word/Vellum. Keep application-level checks in `MANUAL_TESTING.md` truthful and unchecked until performed.

## Safe extension points

- Add folder/note aliases in `content-plan.ts`, with fixture tests proving both inferred roles and final Book structure.
- Add a deterministic warning in `warnings.ts`; keep blocking policy in `export-safety.ts`.
- Add a supported DOCX option by carrying it from `SimpleCompileRequest` through resolved profile fields into `DocxOptions`, then assert its XML effect. Do not expose the control first.
- Add a result capability behind `ResultActionService` and `platform-compat.ts`; UI should only render reported capabilities.
- Add a cleaner in `filters.ts` only when it can distinguish authoring syntax from ordinary prose.

Areas requiring cross-pipeline review are content-plan authority, Book shape, prepared-session identity/fingerprints, migration, DOCX styles, and SafeBinaryWriter commit order. These should not be changed as local conveniences.
