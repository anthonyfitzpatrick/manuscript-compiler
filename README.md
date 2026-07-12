# Manuscript Compiler

Manuscript Compiler 0.7.0 is a self-contained public beta of an Obsidian publishing-workflow plugin that turns a folder-based book into deterministic Markdown and professional DOCX files. Source notes are read-only and are never modified.

## Quick Start

1. Install and enable Manuscript Compiler.
2. Complete the first-run wizard: choose manuscript and export folders, then choose Standard or Vellum.
3. Open the Command Palette and run **Manuscript Compiler: Validate Manuscript**.
4. Resolve any Errors, review Warnings, then run **Compile Current Book**.
5. Review the searchable compile preview and select **Compile**.

The first-run wizard offers to compile `samples/Complete Sample Book` when that folder is present in the vault. The Settings page also includes **Open profile wizard** for every later project.

## Installation

For a manual Release Candidate installation, copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<your vault>/.obsidian/plugins/manuscript-compiler/
```

Restart or reload Obsidian, enable **Community plugins**, then enable **Manuscript Compiler**. Manuscript Compiler does not require another community plugin or an external document converter.

## First Compile

Your manuscript can use Part folders containing Chapter folders containing scene notes. Profiles can also support no Parts and chapters stored as individual notes. Set **Use Parts** and **Chapter source** in the guided profile wizard or profile settings.

Before export, the preview lets you:

- Search chapter and scene names
- Expand or collapse the whole structure
- Inspect scene metadata and inclusion status
- Filter issues by severity
- Sort issues with Errors or Information first
- Review output paths, DOCX status, statistics, and estimated pages

## Plugin independence

Manuscript Compiler has zero runtime dependency on community plugins. It does not call another plugin's API, read another plugin's settings, invoke another plugin's commands, or access Obsidian's community-plugin registry.

Dataview/DataviewJS fences, callouts, wikilinks, and Obsidian comments are recognised as optional text syntax. Cleaning them requires no Dataview, Callout Manager, or other plugin. Content produced by Tasks, Kanban, Excalidraw, Templater, Metadata Menu, Banner, and similar plugins is treated as ordinary files or Markdown unless a documented cleaner explicitly handles its text syntax.

The production bundle includes the small pure-JavaScript `fflate` ZIP implementation used to create DOCX packages. Obsidian supplies the plugin and binary-vault APIs. No external executable, network service, or document-conversion application is required.

## Export formats

Each compile profile can export:

- Markdown
- DOCX
- Markdown + DOCX

Markdown remains the canonical intermediate representation. The scanner, parser, manuscript model, filters, ordering, cleaning pipeline, statistics, warnings, and Markdown generator run identically for every target. Format exporters receive the generated Markdown afterward.

The exporter interface currently has complete Markdown and DOCX implementations and remains open to future formats without changing compiler logic.

## Built-in DOCX

DOCX export is generated locally by the plugin as a standards-compliant Office Open XML package. It uses semantic Word styles for Parts and Chapters, normal manuscript paragraphs, scene breaks, lists, quotations, basic inline emphasis, title/author metadata, and an optional updateable table of contents. It is designed as a clean import document for Vellum and Word.

Pandoc is not installed, detected, invoked, or required. Binary output is written through Obsidian's vault APIs, including on non-filesystem adapters.

## Configuring DOCX export

In a compile profile, select **DOCX** or **Markdown + DOCX**, then optionally enable table-of-contents generation or intermediate Markdown retention and configure title and author variables. Legacy Pandoc and reference-template fields are retained when old settings are migrated, but the built-in exporter does not use them.

## Compile profiles

Profiles independently store:

- Manuscript root, export folder, and filename template
- Export target and DOCX options
- Heading templates, spacing, and scene separator
- Filename or metadata ordering
- Front/back matter inclusion
- Content cleaning options
- Metadata equality/inequality filters
- Book, series, and author variables

Profiles can be created, renamed, duplicated, deleted, imported/exported as validated JSON, and reset to the built-in Default and Vellum profiles. Stage 3 profiles migrate automatically to Markdown export while retaining all previous options.

The profile wizard asks whether chapters are folders or notes, whether the manuscript uses Parts, whether separators and matter sections are included, and whether Vellum is the primary destination. It generates a normal editable profile rather than hiding wizard-only configuration.

## Export preview

The expandable preview tree shows included, excluded, and warning-bearing nodes. Selecting a scene displays its filename, word count, metadata, and compile status without showing its full prose.

Stage 4 also displays:

- Requested output formats and filenames
- Built-in DOCX engine status
- Reference template
- Existing-output warnings
- Word count and estimated page count
- Detailed manuscript statistics
- Information, Warning, and Error groups

Every existing output requires confirmation before replacement.

Compilation displays throttled stage progress for scanning, parsing/filtering, Markdown generation, DOCX packaging, and export. Cancel or Escape aborts queued work. Cancellation before the commit point creates no history/log record; final destination writes are deliberately non-cancellable so an existing export cannot be left partially replaced.

Preview status uses text and symbols as well as colour. All controls are native keyboard-focusable elements, search fields have accessible labels, and forced-colour styles retain borders and status visibility.

## Validation mode

Run **Manuscript Compiler: Validate Manuscript** to perform a read-only audit without generating Markdown, creating temporary files, invoking an exporter, or changing source notes. The report groups Information, Warning, and Error findings and checks:

- Duplicate chapter/scene titles and numbers
- Missing chapter/scene numbers
- Empty chapters, scenes, and parts
- Orphan scenes and unreadable files
- Missing or malformed YAML metadata
- Missing front/back matter
- Invalid or repaired profile/settings values
- Built-in DOCX availability and output configuration

One unreadable or malformed note is recorded and skipped; it does not terminate validation or compilation.

## Export history and compile logs

The settings tab provides **History** and **Logs** viewers.

History records the timestamp, profile, manuscript, output files, word count, and success/failure state. Exported Markdown opens in Obsidian; other local exports open with the operating system’s default application. History can be cleared and is bounded by **Maximum export history entries**.

When compile logging is enabled, logs additionally record requested formats, compiler/DOCX-engine versions, total duration, scan, parse, filter, generation and export durations, warnings, and captured diagnostics. Records are stored through Obsidian’s standard plugin data storage inside the plugin data folder. No logs are transmitted externally.

## Diagnostics

Run **Manuscript Compiler: Generate Diagnostics Report** to create a support-safe Markdown report. It includes plugin/Obsidian environment details, operating system, active-profile summary, DOCX-engine status, latest timings, warning counts, and export-history totals. It excludes note text, manuscript contents, absolute paths, legacy reference paths, metadata/filter values, and environment variables. The dialog can copy the report or save it under `Manuscript Compiler Diagnostics/` in the vault.

## Templates and metadata

The shared template engine supports `{title}`, `{name}`, `{number}`, `{BookTitle}`, `{Series}`, `{Author}`, `{Date}`, `{Year}`, `{WordCount}`, and `{ChapterCount}`. Unknown variables become empty strings.

Metadata filters support `equals` and `not-equals`, with case-insensitive field matching. `Editing Status: Excluded` remains a built-in exclusion for backward compatibility.

## Book structure

```text
Book/
├── Ebook Front Matter/
├── Part 1/
│   ├── Chapter 1/
│   │   ├── Scene 1.md
│   │   └── Scene 2.md
│   └── Chapter 2/
├── Part 2/
└── Ebook Back Matter/
```

Common ebook/print front- and back-matter names are recognised case-insensitively. Unknown visible folders are traversed, hidden items are ignored, and only Markdown source files are compiled.

## Supported manuscript layouts

- Parts → chapter folders → scene notes
- Chapter folders → scene notes, with Parts disabled
- Parts → individual chapter notes
- Individual chapter notes, with Parts disabled
- Anthology-style Parts containing story/chapter notes
- Mixed and nested folders; unexpected Markdown is included or explicitly warned about rather than silently discarded

Numeric ordering recognises padded digits (`Chapter 01`), ordinary digits (`Chapter 10`), and English word numbers through ninety-nine (`Chapter One`). Metadata `Order`, `Part`, `Chapter`, and `Scene` values remain the preferred ordering source when enabled.

## Commands

- **Manuscript Compiler: Compile Current Book** uses the active profile’s root, falling back to detection above the active note.
- **Manuscript Compiler: Compile Selected Folder** compiles a selected vault folder with the active profile.
- **Manuscript Compiler: Validate Manuscript** performs a read-only validation pass.
- **Manuscript Compiler: Generate Diagnostics Report** creates a copyable/saveable support report without prose content.

Stage 1–3 command IDs, profile behavior, Markdown cleaning, metadata ordering/filtering, overwrite protection, preview, statistics, and warnings remain supported.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run test:docx
npm run package
npm run package:validate
```

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/manuscript-compiler/`, then enable the plugin. Tests use Node's built-in assertions and the existing esbuild toolchain; no test framework dependency is installed. The repository includes `samples/Complete Sample Book`, which exercises the entire content pipeline and intentional validation warnings.

## Migration guarantees

Automated tests cover persisted configurations originating from versions 0.1 through 0.6. Migration is repeatable: running repair again produces the same settings, profile identifiers remain stable after the first migration, existing manuscript/export paths survive, missing modern fields receive safe defaults, and invalid values are recorded in configuration repair history rather than discarded silently.

## Testing strategy and measurements

- Unit/regression tests cover parsing, scanning, ordering, metadata filters, every cleaner, templates, statistics, validation, migrations, diagnostics privacy, path safety, and cancellation.
- Golden tests compile every sample project and compare byte-for-byte approved Markdown, detecting heading, ordering, separator, spacing, placeholder, YAML-leak, and duplication regressions.
- DOCX integration generates a document with the built-in engine, validates the ZIP archive and required OOXML parts, verifies styles and expected Part/Chapter headings, and rejects YAML leakage.
- The synthetic benchmark contains 500 chapters, 2,000 scenes, and 2,000,000 words. On the Stage 7 development machine, the in-memory parse/filter/model/statistics plus two deterministic Markdown generations complete below the enforced one-second ceiling. Performance varies by hardware; physical vault I/O and DOCX conversion are measured separately in compile logs.

## Release packaging

`npm run package` first creates the production bundle, verifies that `package.json`, `manifest.json`, and `versions.json` agree, then creates `release/manuscript-compiler-<version>.zip`. The ZIP writer includes exactly `main.js`, `manifest.json`, and `styles.css`. `npm run package:validate` rejects missing or extra archive entries.

## Public beta release checklist

- [x] Stable plugin ID: `manuscript-compiler`
- [x] Version metadata synchronized at 0.7.0
- [x] MIT `LICENSE` included
- [x] No community-plugin API calls, telemetry, cloud, or network runtime
- [x] Clean-install Markdown path remains mobile-compatible
- [x] DOCX is generated locally without Pandoc or another external converter
- [x] Type-check, automated tests, production build, dependency audit, package validation, and DOCX integration available
- [ ] Real beta-user feedback across diverse vaults and operating systems
- [ ] Obsidian Community Plugins submission review by the Obsidian maintainers

## Architecture

```text
Documented Obsidian Vault APIs
              │
              ▼
          VaultScanner
              │
              ▼
      ManuscriptParser ── bounded concurrent reads
              │
              ▼
          Book Model
              │
              ├── MetadataFilterEngine
              ├── Ordering
              ├── ContentCleaningPipeline
              └── ManuscriptValidationService
              │
              ▼
       MarkdownGenerator
              │ canonical Markdown
              ▼
           Exporter
          ┌───┴────────┐
          ▼            ▼
 MarkdownExporter   DocxExporter → built-in OOXML
          │            │
          └─────┬──────┘
                ▼
       History / Compile Logs
```

UI classes select settings, invoke services, and render results; they do not scan, parse, filter, validate, generate, or export. Exporters never access scanner/parser behavior, and the parser has no exporter knowledge.

## Compatibility

- Minimum Obsidian version: 1.5.0, as declared in `manifest.json`.
- API type-check baseline: Obsidian API package 1.13.1.
- Markdown export: all operating systems supported by Obsidian, including non-filesystem adapters.
- DOCX export: generated through Obsidian's binary vault APIs without an external executable.
- Mobile: Markdown and DOCX generation use cross-platform APIs; opening DOCX externally depends on the platform.

## Known limitations

- Cancelling during the final atomic destination swap is intentionally disabled to preserve output integrity.
- English word-number parsing covers zero through ninety-nine; more complex written numbers should use numeric metadata.
- Opening arbitrary DOCX files and selecting absolute reference paths rely on isolated Electron conveniences that may be unavailable on some future Desktop builds; manual file-manager opening and text path entry remain available.
- Golden fixtures model common folder conventions but cannot represent every custom vault taxonomy. Unknown Markdown is surfaced rather than silently dropped.

## Troubleshooting

- **Permission denied:** choose an export folder writable by the vault.
- **Invalid YAML:** run Validate Manuscript. The affected note is reported and compilation continues with empty metadata for that note.
- **Unexpected exclusions:** inspect the scene in preview and review every metadata filter in the active profile; all filter rules must match.
- **Output included on a later compile:** move the export folder outside the manuscript root. Validation reports this unsafe configuration.
- **Non-Markdown export does not open:** use the operating system's file manager. External opening uses an isolated Electron compatibility bridge and fails gracefully when unavailable.

## FAQ

### Does Manuscript Compiler modify source notes?

No. Scanning, validation, preview, and compilation only read manuscript notes. Exporters write exclusively to configured output paths.

### Is Pandoc required?

No. Both Markdown and DOCX exports are created directly by the plugin.

### Are Dataview or other plugins required?

No. Optional plugin syntax is processed as text. No community-plugin API is called.

### Can chapters be individual notes?

Yes. Choose **Chapter source: Individual chapter notes**. For a short story or no-Parts novel, also turn **Use Parts** off.

### Why is metadata reported as unused?

A field is unused when it is neither structural metadata nor referenced by an active profile filter. It remains in the source note and can safely be retained.

### Where are diagnostics and exports saved?

Exports use the active profile’s export folder. Saved diagnostics use `Manuscript Compiler Diagnostics/`. Compile logs and history use standard plugin data storage.

## API and dependency audit

The plugin uses documented Obsidian `Plugin`, `Vault`, `Workspace`, `TFile`, `TFolder`, `FileSystemAdapter`, `Modal`, `FuzzySuggestModal`, `PluginSettingTab`, `Setting`, `Notice`, `Platform`, `normalizePath`, and `parseYaml` exports.

Three capabilities have no documented cross-platform Obsidian equivalent and are isolated in `platform-compat.ts`:

1. Electron's `shell.openPath` for reopening non-Markdown exports.
2. Electron's desktop file-input `File.path` extension for choosing an absolute reference/template file.
3. Electron's application-version bridge for diagnostics; the report states “Unavailable through documented API” when this bridge is absent.

These are optional desktop conveniences with safe failure behavior; file-manager opening remains available. DOCX creation itself uses bundled JavaScript and Obsidian's binary vault APIs.

The only production dependency is `fflate`, which is bundled for ZIP packaging. Development-only dependencies are TypeScript, esbuild, Obsidian API typings, and Node typings. Transitive CodeMirror/moment packages come only from the Obsidian development package and are not bundled into `main.js`.
