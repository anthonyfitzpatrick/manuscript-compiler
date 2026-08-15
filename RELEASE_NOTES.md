# Manuscript Compiler 0.2.0 <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

Manuscript Compiler 0.2.0 is a substantial workflow and reliability update focused on making book compilation clearer, safer, and more repeatable.

The release refines the full **Manuscript → Contents → Create file** workflow, expands Saved Compilation management, separates configuration saving from output-file saving, improves structure review, removes structural Scene headings from manuscript output, and strengthens consistency across all supported export formats.

## Highlights

- Refined three-stage manuscript workflow
- Reusable Saved Compilations with search, switching, management, and safe deletion
- Clear save-before-create choices for new and changed setups
- Host save, download, or share flow for generated output destinations
- Reliable removal of leading structural Scene headings from manuscript body text
- Better Contents review and correction of inclusion, role, and order
- Repeatable DOCX, ODT, EPUB, HTML, Markdown, and XML output creation
- Format-specific Formatting and Advanced formatting controls
- Updated README and User Guide with a complete visual walkthrough

## Saved Compilations

Saved Compilations store a reusable manuscript setup: the selected root, reviewed Contents choices, output choices, and formatting. They do not store a copy of manuscript prose.

Use **Save changes** to update the current setup or **Save as…** to create another setup from the current choices. Saved Compilations can be opened from Settings, switched from the compiler, and managed through rename, duplicate, delete, and moved-folder recovery actions. Deleting a setup never deletes manuscript notes or generated files.

## Safer output creation

Saving a Saved Compilation is separate from creating a manuscript file. From a New compilation, **Create and download _format_** lets you choose **Create without saving** or **Save and create**. A Saved Compilation with unsaved edits offers the corresponding choice to save changes before creating. A clean Saved Compilation creates output directly.

Generated files use Obsidian’s host save, download, or share flow, so the operating system or host controls the filename and destination. The Create file workspace remains available afterwards, allowing another copy or another output format without rebuilding the manuscript structure.

## Structure and Scene handling

Manuscript Compiler recognises Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude roles. Structure presets guide initial detection, while the choices made in **Contents** are authoritative for the compilation.

Structural Scene titles remain available for organisation and navigation, but a leading structural Scene heading is not emitted as manuscript body text. Later authored headings within a Scene remain intact. Source notes are never renamed, moved, or rewritten by structural review.

## Export formats and formatting

Version 0.2.0 supports:

- **DOCX** — Microsoft Word document
- **ODT** — OpenDocument Text
- **EPUB** — Ebook
- **HTML** — Standalone webpage
- **Markdown** — Portable plain-text manuscript
- **XML** — Structured manuscript

Depending on the selected format, Formatting includes document styles, paragraph indentation, Scene breaks, title pages, tables of contents, and chapter page breaks. Advanced formatting provides title and author overrides, typography, page size, custom Scene breaks, Part and Chapter heading styles, and filename templates where supported.

## Compatibility and reliability

Existing Saved Compilations continue to load through the current repair and compatibility logic. The release expands regression coverage for Scene handling, Saved Compilation persistence, DOCX generation, six-format exports, and multi-part and multi-chapter manuscripts.

## Documentation

The README and User Guide now match the current interface and workflow, covering manuscript detection, Contents review, Saved Compilations, output creation, saving, formatting, advanced formatting, troubleshooting, and known limitations.

## Installation

Install Manuscript Compiler through Obsidian Community Plugins, or manually place the matching `main.js`, `manifest.json`, and `styles.css` release files in:

```text
<vault>/.obsidian/plugins/manuscript-compiler/
```

Reload Obsidian and enable the plugin. For the full author workflow, see the [User Guide](USER_GUIDE.md).
