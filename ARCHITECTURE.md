# Architecture

## Source-of-truth pipeline

The plugin has one manuscript interpretation path:

```text
TFolder manuscript root
  → BookRootResolver
  → CompilePreparationService
  → VaultScanner (mechanical discovery only)
  → ContentPlan inference and author corrections
  → ManuscriptParser
  → ContentCleaningPipeline
  → semantic Book
  → statistics, warnings, fingerprints, preview
  → PreparedCompileSession
  → SemanticDocument export projection
  → selected native exporter
  → format validator
  → BrowserDownloadService
  → privacy-safe history
```

`ScannedBook` describes physical vault discovery and is never exportable. `ContentPlanItem[]` records inferred and corrected structure. `Book` is the publishing model and is the sole manuscript source for preview and every exporter. `SemanticDocument` is an export-oriented projection of that exact Book; it does not replace Book and cannot scan, parse, clean, or infer.

Changing a filename or export format does not invalidate or reconstruct the prepared Book. Changes affecting manuscript structure, content selection, cleaning, or semantic formatting invalidate the session. Export also verifies source-content and input fingerprints to reject stale previews.

## Runtime boundaries

- `main.ts` is the composition root and registers commands, settings, and the documented `file-menu` event.
- `compile-preparation.ts` is the only root-to-`PreparedCompileSession` boundary.
- `workspace/compile-workspace-controller.ts` owns three-stage state, invalidation, cancellation, and duplicate-action suppression.
- Workspace step modules render DOM controls only.
- `semantic-document.ts` creates one format-independent block/section projection.
- `native-exporters.ts` contains DOCX, ODT, PDF, EPUB, HTML, and XML byte generators.
- `export-validators.ts` is the validator registry used before delivery.
- `export-coordinator.ts` verifies the session, generates, validates, starts one download, and records history.
- `browser-download.ts` owns the complete Blob/object-URL/temporary-anchor lifecycle.
- `compile-history.ts` owns bounded history and log persistence.

No exporter accepts `ScannedBook`, a vault, a parser, or raw note paths. Exporters receive one `ManuscriptExportContext` containing the prepared session, its shared `SemanticDocument`, formatting, and a portable filename.

## Export contracts

`ExportFormat` is `docx | odt | pdf | epub | html | xml`. Each exporter returns `{ format, filename, mimeType, bytes, warnings }`. `EXPORTERS` and `EXPORT_VALIDATORS` are exhaustive registries keyed by that union.

The coordinator order is fixed:

1. Verify prepared-session fingerprints.
2. Create one `SemanticDocument` from `session.book`.
3. Generate bytes with the selected exporter.
4. Validate bytes using the selected validator.
5. Enter non-cancellable finalisation for download dispatch.
6. Start one browser download.
7. Record success only when dispatch reports it started.

Download-started is not filesystem-persisted. No final external path, Downloads path, Blob URL, or vault destination is stored.

## Format implementation

DOCX retains the native WordprocessingML generator and structural validator. ODT and EPUB use `fflate` with the required first, uncompressed `mimetype` entry and controlled package paths. HTML and XML use UTF-8 `TextEncoder` output. PDF is generated internally as direct binary PDF objects, pages, content streams, xref, trailer, and EOF marker; it uses no runtime PDF dependency. PDF display codes use the built-in font's WinAnsi encoding, while a deterministic ToUnicode CMap maps every emitted byte back to Unicode for selection, search, and copy. Input is normalised to NFC; unsupported characters receive an intentional `?` glyph and one grouped informational issue rather than corrupting adjacent text.

The PDF layout pass uses one centimetre/millimetre-to-point conversion, exact A4 or Letter dimensions, and `page width - left margin - right margin` as its text measure. Wrapping uses the emitted Times-Roman or Helvetica glyph widths in their 1000-unit coordinate system. Semantic blocks retain their own alignment, leading, spacing, keep-with-next rules, and first-line indentation; paragraph continuations use the full measure. Part/Chapter heading groups and scene breaks are kept with following content where space permits. Generated page dictionaries carry bounded layout measurements so the validator can reject implausibly narrow columns and out-of-bounds text without screenshot analysis.

All ZIP entry names are constants or generated section filenames under controlled prefixes. User-controlled filenames never become ZIP paths. XML 1.0-invalid characters are removed, element text and attributes are escaped, HTML is escaped, and CSS font names are constrained before interpolation.

The XML interchange structure uses:

```xml
<manuscript xmlns="https://manuscript-compiler.dev/schema" schemaVersion="1.0">
  <metadata>…</metadata>
  <frontMatter><document><scene><paragraph/></scene></document></frontMatter>
  <body><part><chapter><scene><paragraph/></scene></chapter></part></body>
  <backMatter>…</backMatter>
</manuscript>
```

Inline emphasis is represented with `span` elements carrying `bold` and/or `italic`. The schema deliberately excludes source paths, YAML, profile identifiers, settings, diagnostics, and compiler state.

## Output delivery and compatibility data

Completed exports exist in memory until `BrowserDownloadService` constructs a Blob. The service assigns anchor `href` and `download` as DOM properties, appends the anchor, clicks once, removes it, and revokes the object URL on both success and failure. There is no Electron, Node filesystem, or vault binary-write path.

Fields such as `exportFolder`, `defaultExportFolder`, `saveToVaultByDefault`, external-path memory, overwrite/open/reveal settings, Pandoc fields, and legacy export targets remain only because deleting persisted fields would destroy user data or make migration non-idempotent. They are not active delivery controls and do not select an old route.

The explicit diagnostics command may write its redacted Markdown report through documented vault APIs. That path neither contains manuscript prose nor handles generated manuscript files.

## State and privacy invariants

- Only one global preparation/export operation can run.
- Workspace preparation and export promises are deduplicated.
- Cancellation is accepted before download finalisation and all locks settle in `finally` paths.
- Validation failure blocks download.
- History success follows validation and successful dispatch.
- Normal warnings use stable categories/counts; metadata removal is Information.
- Diagnostics and logs never retain prose, warning details, absolute paths, Blob URLs, environment variables, or private metadata values.
- Exporters do not write history, settings, vault files, or UI.

## Tests

- `tests/run.ts`: parsing, cleaning, inference, migration, state, privacy, UI view models, route identity, and repository hygiene.
- `tests/docx-integration.ts`: semantic Word XML and package regression coverage.
- `tests/exports.ts`: all exporter registries, formats, validators, escaping, forbidden-content checks, filenames, and browser-download cleanup.
- `tests/large-manuscript-benchmark.ts`: prepares one large Book/SemanticDocument, then measures all six generators independently with a generous runaway guard.

Automated package tests do not establish application interoperability. Live gates remain unchecked in `MANUAL_TESTING.md` until performed.
