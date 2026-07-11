# Manuscript Compiler

Manuscript Compiler is a self-contained Obsidian publishing-workflow plugin that turns a folder-based book into deterministic Markdown and professional DOCX files. Source notes are read-only and are never modified.

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

The exporter interface currently has complete Markdown and DOCX implementations. HTML and JSON debug exporter placeholders establish extension points for future formats.

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

When compile logging is enabled, logs additionally record requested formats, Pandoc version, duration, warnings, and captured diagnostics. Records are stored through Obsidian’s standard plugin data storage inside the plugin data folder. No logs are transmitted externally.

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

## API and dependency audit

The plugin uses documented Obsidian `Plugin`, `Vault`, `Workspace`, `TFile`, `TFolder`, `FileSystemAdapter`, `Modal`, `FuzzySuggestModal`, `PluginSettingTab`, `Setting`, `Notice`, `Platform`, `normalizePath`, and `parseYaml` exports.

Two capabilities have no documented cross-platform Obsidian equivalent and are isolated in `platform-compat.ts`:

1. Electron's `shell.openPath` for reopening non-Markdown exports.
2. Electron's desktop file-input `File.path` extension for choosing an absolute reference/template file.

Both are optional, desktop-only conveniences with safe failure behavior; text path entry and file-manager opening remain available. Node built-ins (`child_process`, `fs/promises`, `os`, and `path`) are isolated in `pandoc.ts`, used only on desktop for local DOCX conversion, and never execute through a shell.

Development-only dependencies are TypeScript, esbuild, Obsidian API typings, and Node typings. Transitive CodeMirror/moment packages come only from the Obsidian development package and are not bundled into `main.js`.
