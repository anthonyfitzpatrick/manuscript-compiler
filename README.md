# Manuscript Compiler <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

[![Latest release](https://img.shields.io/github/v/release/anthonyfitzpatrick/manuscript-compiler?label=release)](https://github.com/anthonyfitzpatrick/manuscript-compiler/releases/latest)
[![MIT licence](https://img.shields.io/github/license/anthonyfitzpatrick/manuscript-compiler)](LICENSE)
[![Obsidian 1.5.0+](https://img.shields.io/badge/Obsidian-1.5.0%2B-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://github.com/anthonyfitzpatrick/manuscript-compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/anthonyfitzpatrick/manuscript-compiler/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/anthonyfitzpatrick/manuscript-compiler/total)](https://github.com/anthonyfitzpatrick/manuscript-compiler/releases)
<a href="https://buymeacoffee.com/wolf359pressab"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="20"></a>

Compile structured Obsidian manuscripts into publication-ready DOCX, ODT, EPUB, HTML, Markdown, and XML files for Vellum and other publishing workflows.

Manuscript Compiler guides a book through **Manuscript → Contents → Create file**. Review the detected publishing roles and order, choose an output format and formatting options, then create the file locally without rewriting the Markdown manuscript. The workspace remains open so you can create another format from the same reviewed manuscript.

When you create a file from a **New compilation**, choose **Save and create** to name and retain the setup, or **Create without saving** to export it only. A dirty Saved Compilation similarly offers **Save changes and create** or **Create without saving**. Clean Saved Compilations create files directly.

## Save a setup, then create a file

**Save changes** and **Save as…** save a Saved Compilation configuration: the selected manuscript, reviewed Contents choices, and output settings. They do not create a manuscript file.

On **Create file**, confirm the book summary, choose a format and formatting options, then select **Create and download _format_**. Manuscript Compiler creates the file and starts Obsidian’s/browser host download or share flow. When the host presents a system save dialog, choose the output filename and destination there; other hosts may save to Downloads or offer sharing. Manuscript Compiler does not present its own destination picker and never writes output into the vault. Cancelling the setup-save prompt creates nothing; dismissing a host save/share flow leaves no confirmed output file.

## Why Manuscript Compiler?

Manuscript Compiler understands a book as **Parts, Chapters, Scenes, Front Matter, and Back Matter**—not merely as a collection of Markdown files. It detects that publishing structure, lets you review and correct inclusion, roles, and order, then compiles only the manuscript you approved.

Designed specifically for long-form authors, it keeps research, dashboards, development notes, and excluded drafts out of the finished book while preserving the hierarchy expected by editing and publishing tools. Your source notes are never rewritten.

For a file designated as a **Scene**, its structural title is used for organisation and navigation, not emitted as manuscript body text. Headings written later in the Scene body remain in the export.

## Features

### Author Workflow

- Right-click the complete book folder
- Automatic structure detection
- Manual correction before export
- Review the complete book before export
- One-click compilation and download

### Publishing

- Native DOCX
- Native ODT
- Native EPUB 3
- Native offline HTML
- Native Markdown
- Native structured XML
- DOCX designed for Vellum workflows

### Privacy

- Fully offline compilation and export
- No telemetry or analytics
- No cloud service or account
- No manuscript network access
- No external executables
- No companion plugins
- No changes to manuscript notes

### Reliability

- One reviewed manuscript structure for every format
- Format-specific checks before download
- Deterministic structural output
- Stale-preview protection
- Comprehensive automated tests

## Quick Start

1. [Install the plugin](#installation).
2. Right-click the complete manuscript folder in Obsidian.
3. Review and correct the detected structure.
4. Choose an export format and formatting preset.
5. Select **Create and download _format_**, then complete the host download or share flow.

See the [User Guide](USER_GUIDE.md) for the complete author workflow.

## Saved Compilations

A **Saved Compilation** stores a reusable setup for a manuscript, not a copy of its prose. **Save changes** updates the current setup; **Save as…** creates another setup from the current choices. Use **Manage…** to browse, rename, duplicate, or delete saved setups for the current manuscript. Deleting a Saved Compilation never deletes manuscript notes or generated files.

## Export Formats

| Format | Purpose |
| --- | --- |
| **DOCX** | Word editing, submission, and Vellum import workflows |
| **ODT** | LibreOffice and other OpenDocument workflows |
| **EPUB** | Reflowable EPUB 3 proofing and ebook workflows |
| **HTML** | A self-contained offline browser proof with embedded CSS |
| **Markdown** | Portable, readable plain-text manuscripts |
| **XML** | Structured manuscript interchange and automation |

## Capability Comparison

| Capability | Manuscript Compiler |
| --- | :---: |
| Native DOCX | ✅ |
| Native ODT | ✅ |
| Native EPUB | ✅ |
| Offline operation | ✅ |
| No Pandoc | ✅ |
| No companion plugin | ✅ |
| No telemetry | ✅ |
| Open source | ✅ |

## Documentation

- [User Guide](USER_GUIDE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Security Policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Manual Release Checklist](MANUAL_TESTING.md)

## Installation

### Community Plugins

Search the [Obsidian Community Plugins directory](https://community.obsidian.md/plugins/manuscript-compiler) for **Manuscript Compiler**, then select **Install** and **Enable**.

### Manual Installation

Download `main.js`, `manifest.json`, and `styles.css` from the same [GitHub release](https://github.com/anthonyfitzpatrick/manuscript-compiler/releases). Place them directly in `<vault>/.obsidian/plugins/manuscript-compiler/`, reload Obsidian, and enable **Manuscript Compiler** under Community Plugins.

## Known Limitations

- Complex tables, embedded media, and advanced Markdown layouts are outside the supported manuscript model.
- Save and share behaviour depends on the desktop or mobile host.
- EPUB and target-application validation still require representative reader testing.
- Unusual authoring templates may require manual structure correction.
- Manuscript Compiler is not a fixed-page desktop-publishing engine.

See [Known limitations in the User Guide](USER_GUIDE.md#known-limitations) for details and recommended testing.

## Licence

[MIT](LICENSE)
