# Manuscript Compiler

Manuscript Compiler is an Obsidian publishing-workflow plugin that turns a folder-based book into deterministic Markdown and professional DOCX files. Source notes are read-only and are never modified.

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
```

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/manuscript-compiler/`, then enable the plugin. The project currently defines build and type-check scripts; no lint or test scripts are configured.
