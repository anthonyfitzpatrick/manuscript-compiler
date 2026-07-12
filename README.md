# Manuscript Compiler

Manuscript Compiler 0.8.0 is a simplified beta for authors who write books in Obsidian and want a clean DOCX for Vellum, Word, an editor, or submission. It is self-contained, works locally, and never modifies source notes.

## Quick Start

1. Run **Manuscript Compiler: Compile Manuscript**.
2. Choose the folder containing your manuscript.
3. Choose the structure that best matches the book.
4. Confirm the export folder, filename, and **DOCX** format.
5. Select **Create DOCX**, then open the result in Vellum or Word.

No compile profile, other Obsidian plugin, internet connection, cloud account, or Pandoc installation is required.

## First Run

The short setup asks only for the manuscript folder, book structure, export folder, and whether the usual destination is Vellum or Standard DOCX. It is safe to skip and complete these choices later in the Compile Manuscript window.

## Book Structure Presets

- **Novel with Parts:** Part folders contain Chapter folders, which contain scene notes.
- **Novel without Parts:** Chapter folders contain scene notes directly under the book.
- **Chapter Notes:** Each chapter is a Markdown note and Parts are not used.
- **Short Story:** A single story note with minimal generated headings.
- **Anthology:** Part or collection folders contain individual story notes.
- **Custom:** Uses explicit Parts and chapter-source choices and preserves expert profile behavior.

Presets configure headings, scene separators, ordering, and cleaning internally. Authors normally do not need to know those settings.

## Vellum DOCX

The Vellum preset creates predictable Part and Chapter styles, consistent scene breaks, and clean paragraph spacing. It removes YAML, Obsidian and HTML comments, Dataview blocks, and callout syntax, and converts internal links to readable text. It does not add a table of contents unless that default is explicitly enabled.

Vellum imports the resulting `.docx` directly. Markdown remains an internal compiler representation and no intermediate Markdown file is created unless the expert option requests one.

## Standard DOCX

Standard DOCX uses conventional manuscript structure and filename ordering for editing or submission. The native generator creates semantic Word heading styles, normal manuscript paragraphs, page breaks, scene breaks, lists, quotations, inline emphasis, title/author document metadata, and an optional updateable table of contents.

## Settings

The normal settings page contains only:

- default manuscript and export folders
- default book structure and output format
- overwrite and preview preferences
- Vellum or Standard DOCX style
- automatic opening and table-of-contents preferences
- advanced-options and post-export statistics visibility

Technical controls are under the collapsed **Advanced settings** section. These include heading and scene-break rules, metadata ordering, cleaning controls, retained profiles, internal Markdown copies, history, and compile logs. Most authors do not need them.

## Existing Profiles and Migration

Version 0.8 migrates settings from 0.7 and earlier idempotently. Existing manuscript roots, export folders, output filenames, structure choices, cleaning options, metadata filters, and user-created profiles are preserved. Profiles remain available under Advanced settings but are no longer required by the normal workflow.

Old Pandoc path, argument, metadata, and reference-template values may remain in migrated stored profiles so user data is not silently discarded. They are not used by the native exporter and are not shown in the normal interface. The obsolete Pandoc execution service has been removed, leaving one DOCX export path.

## Preview and Results

The normal preview shows the manuscript folder, detected Parts, Chapters, Scenes, front/back matter counts, word count, output path, and important warnings. The full tree, issue details, and extended statistics are behind **Details**.

After export, the result window shows the filename, word count, Chapters, Scenes, and warnings that need attention, with actions to open or reveal the exported document.

## Independence and Privacy

Manuscript Compiler:

- does not call another Obsidian plugin's API
- does not require Dataview, Templater, Metadata Menu, Tasks, or any community plugin
- has no telemetry, network requests, cloud service, or online account
- does not require Pandoc
- uses only Obsidian APIs and bundled `fflate` for native DOCX ZIP packaging
- reads manuscript notes and writes only configured export and diagnostics paths

Dataview fences, callouts, wikilinks, and comments are handled as optional text syntax without loading the plugins that may have created them.

## Supported Layouts

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

Parts may be disabled, and chapters may be folders or individual notes. Unknown visible folders are traversed, hidden items are ignored, and malformed notes are reported and skipped rather than terminating the compile.

## Platform Notes

The plugin declares Obsidian 1.5.0 as its minimum version and is not desktop-only. Native DOCX generation uses JavaScript and Obsidian binary vault APIs. Opening or revealing a DOCX after creation depends on platform support; the document can still be created when external opening is unavailable.

## Development

```bash
npm install
npm run typecheck
npm test
npm run test:docx
npm run build
npm run package
npm run package:validate
```

Tests cover parsing, scanning, filtering, ordering, cleaning, templates, presets, settings migration, validation, cancellation, path safety, golden Markdown output, performance, and native DOCX package structure.

## Release Packaging

`npm run package` creates `release/manuscript-compiler-0.8.0.zip` containing exactly `main.js`, `manifest.json`, and `styles.css`. `npm run package:validate` verifies its contents and version metadata.

## Troubleshooting

- **Manuscript folder not found:** choose an existing vault folder in Compile Manuscript.
- **Invalid filename:** use a filename without slashes or operating-system-reserved characters.
- **Invalid YAML:** run Validate Manuscript; the affected note is reported and compilation continues.
- **Unexpected exclusions:** open Advanced settings and inspect the retained profile's metadata filters.
- **Output included in a later compile:** choose an export folder outside the manuscript root.
- **DOCX does not open automatically:** open it from the operating system's file manager; generation itself is unaffected.
