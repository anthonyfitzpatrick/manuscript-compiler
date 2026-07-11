# Manuscript Compiler

Manuscript Compiler is a self-contained Obsidian publishing-workflow plugin that turns a folder-based book into deterministic Markdown and professional DOCX files. Source notes are read-only and are never modified.

## Quick Start

1. Install and enable Manuscript Compiler.
2. Complete the first-run wizard: choose manuscript and export folders, detect Pandoc if desired, and choose Standard or Vellum.
3. Open the Command Palette and run **Manuscript Compiler: Validate Manuscript**.
4. Resolve any Errors, review Warnings, then run **Compile Current Book**.
5. Review the searchable compile preview and select **Compile**.

The first-run wizard offers to compile `samples/Complete Sample Book` when that folder is present in the vault. The Settings page also includes **Open profile wizard** for every later project.

## Installation

For a manual Release Candidate installation, copy `manifest.json`, `main.js`, and `styles.css` into:

```text
<your vault>/.obsidian/plugins/manuscript-compiler/
```

Restart or reload Obsidian, enable **Community plugins**, then enable **Manuscript Compiler**. Manuscript Compiler itself does not require any other community plugin. Pandoc is optional and only needed for DOCX.

## First Compile

Your manuscript can use Part folders containing Chapter folders containing scene notes. Profiles can also support no Parts and chapters stored as individual notes. Set **Use Parts** and **Chapter source** in the guided profile wizard or profile settings.

Before export, the preview lets you:

- Search chapter and scene names
- Expand or collapse the whole structure
- Inspect scene metadata and inclusion status
- Filter issues by severity
- Sort issues with Errors or Information first
- Review output paths, Pandoc state, statistics, and estimated pages

## Plugin independence

Manuscript Compiler has zero runtime dependency on community plugins. It does not call another plugin's API, read another plugin's settings, invoke another plugin's commands, or access Obsidian's community-plugin registry.

Dataview/DataviewJS fences, callouts, wikilinks, and Obsidian comments are recognised as optional text syntax. Cleaning them requires no Dataview, Callout Manager, or other plugin. Content produced by Tasks, Kanban, Excalidraw, Templater, Metadata Menu, Banner, and similar plugins is treated as ordinary files or Markdown unless a documented cleaner explicitly handles its text syntax.

The production bundle has no third-party runtime npm dependencies. Obsidian supplies the documented plugin API. DOCX export optionally invokes a user-installed Pandoc executable; Markdown compilation does not require Pandoc.

## Export formats

Each compile profile can export:

- Markdown
- DOCX
- Markdown + DOCX

Markdown remains the canonical intermediate representation. The scanner, parser, manuscript model, filters, ordering, cleaning pipeline, statistics, warnings, and Markdown generator run identically for every target. Format exporters receive the generated Markdown afterward.

The exporter interface currently has complete Markdown and DOCX implementations and remains open to future formats without changing compiler logic.

## Installing Pandoc

DOCX export requires a local [Pandoc](https://pandoc.org/installing.html) installation. Pandoc is optional, is never downloaded or bundled by this plugin, and is not required for Markdown export.

After installing Pandoc:

1. Open **Settings → Manuscript Compiler**.
2. Leave **Automatically detect Pandoc** enabled and select **Detect**.
3. If detection fails, enter the full executable path, such as `/opt/homebrew/bin/pandoc`, `/usr/local/bin/pandoc`, or the corresponding Windows path.

The plugin safely invokes the executable directly with an explicit argument array and `shell: false`. It never constructs or runs a shell command. DOCX export requires Obsidian Desktop and a local filesystem vault.

If Pandoc is unavailable, Markdown export continues working. A DOCX-only profile is disabled in preview with a clear explanation; a combined profile can still produce its Markdown output.

## Configuring DOCX export

In a compile profile, select **DOCX** or **Markdown + DOCX**, then optionally configure:

- Reference DOCX template
- Pandoc YAML/JSON metadata file
- Additional Pandoc arguments
- Table of contents generation
- Intermediate Markdown retention
- Title and author variables

Output paths are managed by the plugin. Additional arguments cannot override Pandoc’s output path. Pandoc stdout and stderr are captured for diagnostics without showing stack traces to users.

## Reference DOCX templates

A reference DOCX controls the Word styles Pandoc applies. Enter an absolute path or a vault-relative path, or use the profile’s **Browse** button. The preview validates that the template exists before export. Templates are never modified.

Pandoc metadata files work the same way and are also validated before compilation.

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

The profile wizard asks whether chapters are folders or notes, whether the manuscript uses Parts, whether separators and matter sections are included, whether a reference DOCX is available, and whether Vellum is the primary destination. It generates a normal editable profile rather than hiding wizard-only configuration.

## Export preview

The expandable preview tree shows included, excluded, and warning-bearing nodes. Selecting a scene displays its filename, word count, metadata, and compile status without showing its full prose.

Stage 4 also displays:

- Requested output formats and filenames
- Pandoc availability and version
- Reference template
- Existing-output warnings
- Word count and estimated page count
- Detailed manuscript statistics
- Information, Warning, and Error groups

Every existing output requires confirmation before replacement.

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
- Pandoc availability, reference DOCX, metadata file, and output configuration

One unreadable or malformed note is recorded and skipped; it does not terminate validation or compilation.

## Export history and compile logs

The settings tab provides **History** and **Logs** viewers.

History records the timestamp, profile, manuscript, output files, word count, and success/failure state. Exported Markdown opens in Obsidian; other local exports open with the operating system’s default application. History can be cleared and is bounded by **Maximum export history entries**.

When compile logging is enabled, logs additionally record requested formats, compiler/Pandoc versions, total duration, scan, parse, filter, generation and export durations, warnings, and captured diagnostics. Records are stored through Obsidian’s standard plugin data storage inside the plugin data folder. No logs are transmitted externally.

## Diagnostics

Run **Manuscript Compiler: Generate Diagnostics Report** to create a support-safe Markdown report. It includes plugin/Obsidian environment details, operating system, active-profile summary, Pandoc status, latest timings, warning counts, and export-history totals. It intentionally excludes note text and manuscript contents. The dialog can copy the report or save it under `Manuscript Compiler Diagnostics/` in the vault.

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
```

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/manuscript-compiler/`, then enable the plugin. Tests use Node's built-in assertions and the existing esbuild toolchain; no test framework dependency is installed. The repository includes `samples/Complete Sample Book`, which exercises the entire content pipeline and intentional validation warnings.

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
 MarkdownExporter   DocxExporter → optional Pandoc
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
- DOCX export: Obsidian Desktop on macOS, Windows, or Linux with a local filesystem vault.
- Pandoc: version 3.x is supported; automated production validation uses Pandoc 3.9.
- Mobile: Markdown compilation remains available. Pandoc/DOCX and opening non-Markdown exports externally are desktop-only capabilities.

## Troubleshooting

- **Pandoc not found:** use the Detect button, then configure the absolute executable path if needed. Run `pandoc --version` outside Obsidian to confirm the installation.
- **Reference DOCX missing:** use Browse or enter a valid absolute or vault-relative path. Validation reports the exact missing path.
- **Permission denied:** choose an export folder writable by the vault and verify template/metadata-file read permissions.
- **Invalid YAML:** run Validate Manuscript. The affected note is reported and compilation continues with empty metadata for that note.
- **Unexpected exclusions:** inspect the scene in preview and review every metadata filter in the active profile; all filter rules must match.
- **Output included on a later compile:** move the export folder outside the manuscript root. Validation reports this unsafe configuration.
- **Non-Markdown export does not open:** use the operating system's file manager. External opening uses an isolated Electron compatibility bridge and fails gracefully when unavailable.

## FAQ

### Does Manuscript Compiler modify source notes?

No. Scanning, validation, preview, and compilation only read manuscript notes. Exporters write exclusively to configured output paths.

### Is Pandoc required?

No. Markdown export works without Pandoc. Pandoc is required only for DOCX.

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

Both are optional, desktop-only conveniences with safe failure behavior; text path entry and file-manager opening remain available. Node built-ins (`child_process`, `fs/promises`, `os`, and `path`) are isolated in `pandoc.ts`, used only on desktop for local DOCX conversion, and never execute through a shell.

Development-only dependencies are TypeScript, esbuild, Obsidian API typings, and Node typings. Transitive CodeMirror/moment packages come only from the Obsidian development package and are not bundled into `main.js`.
