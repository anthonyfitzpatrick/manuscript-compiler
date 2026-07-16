# Manuscript Compiler <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

Compile structured Obsidian manuscripts into publication-ready DOCX, ODT, EPUB, HTML, Markdown, and XML files for Vellum and other publishing workflows.

<p align="center">
  <img src="docs/images/12-create-file-overview.png" alt="Manuscript Compiler Create file screen with a prepared book summary and six export formats" width="75%">
</p>

*The final Create file stage: a reviewed 129,576-word novel, ready to compile into any of six native publishing formats.*

Manuscript Compiler guides the book through **Manuscript → Contents → Create file**. By the time this screen appears, the selected notes have been scanned, their publishing roles and order have been reviewed, and one semantic Book has been prepared for every format. Choose the output and formatting you need, then create the file locally—without rewriting the Markdown manuscript.

[![Latest release](https://img.shields.io/github/v/release/anthonyfitzpatrick/manuscript-compiler?label=release)](https://github.com/anthonyfitzpatrick/manuscript-compiler/releases/latest)
[![MIT licence](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Obsidian plugin](https://img.shields.io/badge/Obsidian-plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md/)
[![TypeScript](https://img.shields.io/github/languages/top/anthonyfitzpatrick/manuscript-compiler)](https://www.typescriptlang.org/)
[![Tests](https://github.com/anthonyfitzpatrick/manuscript-compiler/actions/workflows/ci.yml/badge.svg)](https://github.com/anthonyfitzpatrick/manuscript-compiler/actions/workflows/ci.yml)
![Offline](https://img.shields.io/badge/works-offline-success)
![No Pandoc](https://img.shields.io/badge/Pandoc-not%20required-success)
[![Open source](https://img.shields.io/badge/open%20source-yes-success)](LICENSE)

## Why Manuscript Compiler?

Manuscript Compiler understands a book as **Parts, Chapters, Scenes, Front Matter, and Back Matter**—not merely as a collection of Markdown files. It detects that publishing structure, lets you review and correct inclusion, roles, and order, then compiles only the manuscript you approved.

Designed specifically for long-form authors, it keeps research, dashboards, development notes, and excluded drafts out of the finished book while preserving the hierarchy expected by editing and publishing tools. Your source notes are never rewritten.

## Features

### Author Workflow

- Right-click any manuscript folder
- Automatic structure detection
- Manual correction before export
- Semantic review of the complete book
- One-click compilation and download

### Publishing

- Native DOCX
- Native ODT
- Native EPUB 3
- Native offline HTML
- Native Markdown
- Native semantic XML
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

- One shared semantic `Book` model for every format
- Format-specific structural validation before download
- Deterministic structural output
- Stale-preview protection
- Comprehensive automated tests

## Quick Start

1. [Install the plugin](#installation).
2. Right-click the complete manuscript folder in Obsidian.
3. Review and correct the detected structure.
4. Choose an export format and formatting preset.
5. Select **Create and download**.

See the [User Guide](USER_GUIDE.md) for the complete author workflow.

## Export Formats

| Format | Purpose |
| --- | --- |
| **DOCX** | Word editing, submission, and Vellum import workflows |
| **ODT** | LibreOffice and other OpenDocument workflows |
| **EPUB** | Reflowable EPUB 3 proofing and ebook workflows |
| **HTML** | A self-contained offline browser proof with embedded CSS |
| **Markdown** | Portable, readable plain-text manuscripts |
| **XML** | Presentation-neutral semantic interchange and automation |

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

## Screenshots

### Plugin Settings

<p align="center">
  <img src="docs/images/03-plugin-settings.png" alt="Manuscript Compiler settings with defaults, advanced options, support links, and the Open compiler button" width="75%">
</p>

*Set author defaults once, then open the compiler directly from Obsidian settings.*

### Right-click Menu

<p align="center">
  <img src="docs/images/02-folder-context-menu.png" alt="Compile manuscript from this folder in the Obsidian File Explorer context menu" width="75%">
</p>

*Start from the exact folder that contains the complete book.*

### Manuscript Screen

<p align="center">
  <img src="docs/images/04-manuscript-screen.png" alt="The Manuscript stage showing the selected book folder, detected structure, scan summary, and Review Structure action" width="75%">
</p>

*Confirm the manuscript root and automatically detected book structure.*

### Contents Review

<p align="center">
  <img src="docs/images/07-contents-review.png" alt="The Contents stage showing detected counts, review controls, and the collapsed manuscript outline" width="75%">
</p>

*Review Parts, Chapters, Scenes, matter, warnings, and ignored notes before export.*

### Correct Structure

<p align="center">
  <img src="docs/images/08-correct-structure.png" alt="Correction mode showing inclusion checkboxes, folder disclosure, role selectors, and ordering controls" width="75%">
</p>

*Correct inclusion, publishing roles, and order without moving or rewriting source notes.*

### Create File

<p align="center">
  <img src="docs/images/13-docx-format.png" alt="DOCX selected with document style, indentation, scene break, title page, table of contents, and chapter controls" width="75%">
</p>

*Choose the output format and meaningful publishing controls, then create the file.*

### DOCX in Microsoft Word

<p align="center">
  <img src="docs/images/26-docx-in-word.png" alt="A compiled manuscript chapter open in Microsoft Word with named manuscript styles visible" width="75%">
</p>

*Native DOCX opens with distinct structural formatting and named manuscript styles.*

### DOCX in Vellum

<p align="center">
  <img src="docs/images/27-docx-in-vellum.png" alt="The compiled DOCX imported into Vellum with its book hierarchy and chapter preview visible" width="75%">
</p>

*Vellum recognises the compiled Part and Chapter hierarchy.*

### ODT in LibreOffice

<p align="center">
  <img src="docs/images/28-odt-in-libreoffice.png" alt="A compiled manuscript ODT chapter open in LibreOffice Writer" width="75%">
</p>

*Native ODT carries the manuscript structure into LibreOffice Writer.*

### EPUB Reader

<p align="center">
  <img src="docs/images/29-epub-reader.png" alt="The compiled EPUB open in a reader with its contents navigation and chapter text visible" width="75%">
</p>

*The EPUB provides navigable contents and a reflowable reading view.*

## Documentation

- [User Guide](USER_GUIDE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Security Policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Manual Release Checklist](MANUAL_TESTING.md)

## Installation

### Community Plugins

Manuscript Compiler is not yet listed in Obsidian's Community Plugins catalogue. Once available, search for **Manuscript Compiler**, select **Install**, then **Enable**.

### Manual Installation

Download `main.js`, `manifest.json`, and `styles.css` from the same [GitHub release](https://github.com/anthonyfitzpatrick/manuscript-compiler/releases). Place them directly in `<vault>/.obsidian/plugins/manuscript-compiler/`, reload Obsidian, and enable **Manuscript Compiler** under Community Plugins.

## Known Limitations

- Complex tables, embedded media, and advanced Markdown layouts are outside the semantic fiction model.
- Save and share behaviour depends on the desktop or mobile host.
- EPUB and target-application validation still require representative reader testing.
- Unusual authoring templates may require manual structure correction.
- Manuscript Compiler is not a fixed-page desktop-publishing engine.

See [Known limitations in the User Guide](USER_GUIDE.md#known-limitations) for details and recommended testing.

## Development and Validation

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:docx
npm run test:odt
npm run test:epub
npm run test:html
npm run test:markdown
npm run test:xml
npm run test:exports
npm run benchmark:large
npm run build
npm run package
npm run package:validate
npm audit
git diff --check
```

The release archive is `release/manuscript-compiler-0.9.3.zip` and contains exactly `main.js`, `manifest.json`, and `styles.css`.

Automated structural validation is not a substitute for opening outputs in Word, Vellum, LibreOffice, multiple EPUB readers, text editors, and browsers. See the [Manual Release Checklist](MANUAL_TESTING.md).

## Licence

[MIT](LICENSE)
