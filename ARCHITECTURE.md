# Compile Route Architecture

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
