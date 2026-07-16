# Manuscript Compiler 0.10.0 <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

Manuscript Compiler is an Obsidian plugin for turning structured, long-form writing projects into publication-ready documents. It exists because a book is more than a folder of Markdown files: it contains Parts, Chapters, Scenes, Front Matter, Back Matter, deliberate ordering, and material that should never appear in the finished manuscript. Manuscript Compiler gives authors a guided way to review that structure and compile only the approved book into formats suited to editing, publishing, interchange, and archival workflows.

## Highlights

- **Semantic manuscript compilation** understands the publishing role of each included note instead of treating the project as undifferentiated Markdown.
- **Right-click manuscript workflow** starts directly from the book folder in Obsidian's File Explorer.
- **Review and correction before export** lets you confirm inclusion, structure, publishing roles, and order before creating a file.
- **Fully offline operation** keeps manuscript processing on your device.
- **No Pandoc required.**
- **No external executables required.**
- **No other Obsidian plugins required.**
- **Source notes remain unchanged** throughout scanning, review, and compilation.

The workflow is deliberately straightforward: choose the manuscript folder, review its contents, correct anything that was detected incorrectly, select a format, and create the finished file.

## Supported export formats

Manuscript Compiler generates six native export formats:

- **DOCX** — for Microsoft Word, editing, submission, and publishing workflows. DOCX output is designed with Vellum workflows in mind, including meaningful manuscript structure and named document styles.
- **ODT** — for LibreOffice Writer and other OpenDocument-compatible applications.
- **EPUB** — a reflowable EPUB 3 package for ebook proofing and reader workflows.
- **HTML** — a self-contained offline HTML5 document with embedded styling and no remote assets.
- **Markdown** — a portable, readable plain-text manuscript with clear semantic headings.
- **XML** — a deterministic, presentation-neutral interchange format for archival use, automation, and custom publishing pipelines.

Every format is created from the same reviewed manuscript, helping Parts, Chapters, Scenes, matter, ordering, emphasis, and readable links remain consistent across outputs.

DOCX is the recommended format when the next step is importing the manuscript into Vellum.

## Key Features

- Semantic support for **Parts, Chapters, and Scenes**
- Dedicated **Front Matter and Back Matter** roles
- Automatic detection of common long-form manuscript structures
- Manual correction of inclusion, publishing roles, and order
- Transparent organisational folders that do not become unwanted headings
- Deterministic structural exports
- Native document generation without conversion utilities
- Multiple formatting presets, including Vellum and Standard Manuscript options
- Configurable paragraph indentation and scene separators
- Title-page and table-of-contents options where supported
- Browser and operating-system download delivery
- No manuscript exports written back into the vault
- Protection against exporting a stale, unreviewed preview
- Privacy-first data handling
- Offline compilation and validation
- Source Markdown remains untouched
- Support for Unicode, accented characters, punctuation, emphasis, and readable Markdown link text

Manuscript Compiler has been extensively tested throughout development with representative novels, large manuscript structures, and every supported export format.

## Built for Authors

Many export tools begin with a simple assumption: gather Markdown files and concatenate them. Manuscript Compiler begins with a different assumption—a writing project is a book.

The plugin recognises the difference between a Part, a Chapter, a Scene, Front Matter, Back Matter, and a folder that exists only to organise the vault. Before export, the complete detected manuscript is presented for review. You can include or exclude material, correct publishing roles, and adjust order without renaming, moving, or rewriting the original notes.

Only the reviewed manuscript content is compiled.

Recognised project material such as dashboards, structured metadata, author notes, planning material, research, development folders, and excluded drafts is kept out of the finished book. Ignored and excluded content remains reviewable so that automatic detection never replaces the author's final decision.

This approach is intended for authors who keep an entire writing project in Obsidian—not only polished prose, but also the supporting material required to develop and manage a book.

## Privacy

Manuscripts are private creative work, so Manuscript Compiler is designed to operate without sending them anywhere.

- **No telemetry or analytics**
- **No cloud services**
- **No network activity during compilation, validation, or export**
- **No user accounts**
- **No advertising**
- **No manuscript uploads**
- **No background network requests**
- **No external processing service**

Compilation happens locally. Generated files are created in memory, validated, and handed to the browser or operating system's download or share mechanism. Manuscript exports are not written into the selected vault.

Support and project links open an external website only when explicitly selected by the user.

## Open Source

Manuscript Compiler is open-source software released under the **MIT Licence**.

The complete source code is available in the [Manuscript Compiler repository](https://github.com/anthonyfitzpatrick/manuscript-compiler). Contributions are welcome, including focused bug fixes, documentation improvements, interoperability findings, accessibility improvements, and carefully scoped feature proposals.

Before contributing, please read the project's contribution guidance and respect its privacy, portability, and manuscript-safety guarantees.

## Documentation

- [User Guide](https://github.com/anthonyfitzpatrick/manuscript-compiler/blob/main/USER_GUIDE.md)
- [Developer Guide](https://github.com/anthonyfitzpatrick/manuscript-compiler/blob/main/DEVELOPER_GUIDE.md)
- [Architecture Guide](https://github.com/anthonyfitzpatrick/manuscript-compiler/blob/main/ARCHITECTURE.md)

The User Guide covers installation, manuscript organisation, the complete three-stage workflow, formatting controls, export formats, troubleshooting, and known limitations.

## Installation

Until Manuscript Compiler is accepted into the Obsidian Community Plugins directory, install it manually from this GitHub Release.

Download all four release assets:

- `main.js`
- `manifest.json`
- `styles.css`
- `logo.svg`

Create the following folder inside the vault if it does not already exist:

```text
<vault>/.obsidian/plugins/manuscript-compiler/
```

Place the four files directly inside that folder. Do not mix files from different releases.

Restart Obsidian or reload Community Plugins, then open **Settings → Community plugins** and enable **Manuscript Compiler**.

After installation, right-click a test manuscript folder in File Explorer and confirm that **Compile manuscript from this folder** appears.

## Known limitations

- Live interoperability testing across different EPUB readers is ongoing. EPUB output is structurally validated, but readers may apply their own typography and accessibility preferences.
- DOCX has been tested with Vellum workflows. Authors should still perform a representative Vellum import before relying on a particular manuscript structure or formatting choice for production.
- XML is intended for semantic interchange, archival inspection, and automation rather than visual presentation. A receiving application or stylesheet determines how it is displayed.
- Browser download behaviour depends on Obsidian, the host operating system, and platform permissions. Desktop systems may show a save prompt or use the Downloads folder; mobile systems may use a share sheet.
- Complex tables, embedded media, and advanced Markdown layouts are outside the current restrained manuscript model.
- Manuscript Compiler is not a fixed-page desktop-publishing application. Final typography and platform-specific rendering should be checked in the intended destination application.

## Thank you

Thank you to the early testers and authors who helped shape Manuscript Compiler's first public release. Your real-world manuscripts, publishing workflows, and careful feedback have been invaluable.

If you encounter a problem or have a focused improvement to suggest, please open a bug report or feature request in the [GitHub issue tracker](https://github.com/anthonyfitzpatrick/manuscript-compiler/issues).
