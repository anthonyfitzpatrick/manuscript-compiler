# Manuscript Compiler

Manuscript Compiler 0.9.2 turns fiction written in an Obsidian vault into a clean native DOCX for Vellum, Word, LibreOffice, editing, or submission. It works locally, does not require another community plugin or Pandoc, and never modifies source notes.

> **Only explicitly included publishable content is exported. Vault organisation and project metadata are never manuscript content.**

## Quick Start

1. Install and enable Manuscript Compiler.
2. In the File Explorer, right-click the actual book folder and choose **Compile manuscript from this folder** (or run **Manuscript Compiler: Compile Manuscript**).
3. Confirm the selected folder shown as the exact book root.
4. Review and correct **Contents**.
5. Choose **Vellum** or **Standard Manuscript** formatting, or select supported Custom values.
6. Review the exact final manuscript and press **Create DOCX**.
7. Save the verified DOCX to the vault, then optionally save a copy to the computer, open it, or reveal it where supported.

The selected folder is the book root and never becomes a Part or Chapter. The Contents step lets the author confirm front matter, transparent containers, Parts, Chapters, Scenes, back matter, inclusion, and order before any output is created. Role and inclusion edits update the affected rows without returning the tree to the top; scroll position, keyboard focus, expansion state, child choices, and manual order are retained. Excluding a folder collapses it automatically while preserving its descendants' individual choices for later re-enabling.

The File Explorer action passes the exact right-clicked `TFolder` to the existing four-step workspace and starts its scan. Explicit selection never walks to an ancestor or substitutes a nested `Book`, `Manuscript`, or `Draft` folder. Nested organisational containers can be transparent while their Part → Chapter → Scene relationships remain intact.

The four-step compile workspace is authoritative for that export. Existing profiles and settings are preserved for compatibility but cannot override explicit workspace choices.

If an included source note changes after the final preview is prepared, export is blocked until **Refresh Preview** rebuilds the manuscript model. The plugin never silently exports source content that differs from the reviewed preview.

All compile routes use this same preparation path. **Compile Current Book**, **Compile Selected Folder**, profile-compatible compilation, the first-run sample, Markdown export, DOCX export, and **Validate Manuscript** all construct or consume one prepared semantic manuscript. Older command IDs remain available for hotkeys, but their former permissive scanner-to-export path no longer exists. Validation reports the exact semantic content that would be exported and writes no file.

Internally, workspace state, command preparation, export execution, history, and platform result actions use separate focused services. This keeps the final semantic model and safe save guarantees unchanged while making cancellation and session invalidation consistent across the UI.

## Safe Manuscript Discovery

Folders named `Manuscript`, `Draft`, `Drafts`, `Book`, `Content`, or `Chapters` are suggested as **Transparent container**. Their children remain available, but the container contributes no heading.

Project folders such as Archive, Development, Exports, Research, Notes, Revision Notes, Planning, Characters, Locations, Plotlines, Dashboards, Templates, Attachments, Images, Trash, and old drafts are excluded by default. Matching ignores case, punctuation, hyphens, spaces, and numeric prefixes. Exclusions remain visible and may be explicitly overridden.

Dashboard/index notes, revision notes, underscore-prefixed project notes, and notes classified by YAML as dashboard, character, location, plotline, research, planning, or revision material are also excluded by default. Empty notes are shown as exclusions after manuscript cleaning.

Mixed matter folders such as `Front and back matter`, `Front & Back Matter`, and the observed `Font and back matter` spelling are treated as transparent matter containers. `Copyright notices` is a transparent front-matter container. Common names including Copyright variants, About the Author, Acknowledgments/Acknowledgements, Also by…, Back Cover Blurb, and author/newsletter notes are classified as matter rather than manuscript Chapters or Scenes. Every inferred role remains editable.

## Scene Templates and Metadata Cleaning

For template-based scene notes, the compiler recognises these manuscript-body headings by default:

- Scene
- Manuscript
- Text
- Draft
- Body

When one is present, only that section is exported, ending at the next heading of the same or higher level. Synopsis, Revision Notes, Editing Notes, Author Notes, Scene Notes, Development Notes, and Comments sections are authoring material and are omitted.

YAML is stripped, and structured project metadata at note boundaries is removed in `Field: value`, bold-field, Dataview inline-field, definition-list, property-block, and metadata-table forms. Recognised fields include Series, Book, Part, Chapter, Scene, POV, Characters, Locations, Plotlines, editing state, importance, and date/time fields. Ordinary prose is not removed merely because a sentence begins with “Book” or “Chapter”. Body-heading aliases are available only under the compile window’s collapsed Advanced options.

## Native Fiction DOCX

DOCX generation is native, offline, and model-driven. The exporter does not convert the selected vault folder into a generic document and does not invoke Pandoc.

Generated Word paragraph styles include:

- Title and Author
- Part Number and Part Title
- Chapter Number and Chapter Title
- Body Text and First Paragraph
- Scene Break
- Front Matter Heading and Back Matter Heading

Parts always begin on a new page. Chapters begin on a new page by default; in Custom formatting this can be disabled without changing the Chapter Number or Chapter Title styles. Page breaks are paragraph properties on the first displayed heading, not synthetic blank paragraphs. Number and title can be shown separately, numerically, in words, as title only, or through a retained legacy-profile template. Missing numbers remain missing—zero is never invented.

The deterministic **Vellum** preset uses Garamond 12 pt, 1.15 line spacing, a 0.75 cm body indent, A4 pages, a centred `#` scene break, clean separate word-number/title headings, Chapter page breaks, and no automatic TOC. **Standard Manuscript** uses Times New Roman 12 pt, double spacing, a 1.27 cm body indent, 2.54 cm margins, A4 pages, a centred `* * *` scene break, and Chapter page breaks. Selecting an individual formatting value switches the workspace to **Custom**. Custom supports the exposed font, size, spacing, metric indent, A4/Letter, Chapter-break, title-page, scene-break, heading-display, and TOC choices; margins remain fixed at 2.54 cm.

The title page is off by default. When enabled, it contains only the book title and author and ends with a page break. The optional table of contents is a genuine Word TOC field that must be updated in Word; it is off by default for Vellum. Scene-break choices are `#`, `*`, `***`, `* * *`, Blank line, and Custom. Blank-line mode emits an empty Scene Break paragraph only between included scenes. Headers, footers, and page numbers are not generated because Vellum handles final book layout.

Bold, italics, combined bold/italics, readable Markdown link text, inline-code text, punctuation, accented characters, smart quotes, dashes, and Unicode are preserved. Complex nested Markdown, tables, embedded media, and advanced layout are intentionally unsupported. **Convert callouts to plain text** removes the Obsidian callout marker and callout title while preserving its quoted body as readable text; ordinary blockquotes are not classified as callouts.

## Front and Back Matter

Front- and back-matter container folders do not emit headings. Individual notes can be included, excluded, and ordered in the Contents step. Common front-matter items are ordered with Title Page before Copyright, Dedication, Epigraph, Contents, Preface, and Prologue. Common back-matter items include Acknowledgements, About the Author, Also by the Author, Newsletter, and Copyright Notes.

Inference is intentionally name- and ancestry-based, not a general natural-language classifier. Unusual matter names or unconventional structures should be corrected in Contents before preparing the final preview.

## Settings and Compatibility

The registered plugin settings page contains saved defaults and a prominent **Open Manuscript Compiler** button. Legacy profiles and migration data remain preserved for compatibility. The normal compile workflow does not require or expose the legacy profile system.

Settings from earlier releases are repaired idempotently. Existing Letter selections are retained, and legacy inch-based indentation values are converted once to the canonical centimetre value without changing the resulting Word indentation. New settings use A4 and metric measurements. Obsolete Pandoc-related values may remain in stored profiles so user data is not silently deleted, but no Pandoc runtime exists or executes.

## Privacy and Platform Support

The plugin has no telemetry, network requests, cloud dependency, or online account. It uses Obsidian APIs and bundled `fflate` ZIP generation. Compile logs retain structural warning-code counts rather than note text or parser excerpts, and shareable diagnostics omit legacy warning detail. DOCX creation works on supported Obsidian platforms; opening, revealing, browser-style saving, or platform share/save actions depend on platform capabilities.

## Verified and Recoverable Saving

The complete DOCX is generated in memory and checked before the destination is touched. It is then written to a same-folder temporary file, read back, compared with the generated file, and checked again before replacement. The saved destination is read and checked once more before export is reported as successful.

Local filesystem vaults use a staged same-folder replacement designed to preserve the previous file if saving fails. Other vault adapters use staged verification and recovery where supported: the previous bytes are preserved in memory and in a temporary recovery backup until the new destination has passed verification. No other Obsidian plugin, Pandoc installation, shell command, or external executable is involved.

At startup and before an export, cleanup inspects only the configured/current export folder. Recognised temporary files older than 24 hours are removed; recent temporary files and all recovery backups are preserved. Unrelated hidden, `.tmp`, and `.bak` files are never selected by this cleanup rule.

## Development and Validation

```bash
npm install
npm run typecheck
npm test
npm run test:safe-writer
npm run test:docx
npm run benchmark:large
npm run build
npm run package
npm run package:validate
npm audit
```

The regression suite includes a realistic `Book 1 - Warden of Silence` vault tree with transparent manuscript containers, excluded project folders, dashboard notes, YAML properties, scene templates, synopsis/revision sections, front/back matter, Unicode prose, and multiple Parts and Chapters. The DOCX test inspects `document.xml` and `styles.xml` semantically and writes `.test-build/Warden-of-Silence-regression.docx` for manual inspection. The normal large-manuscript test uses a generous runaway guard and deterministic count/output assertions; `npm run benchmark:large` reports separate parse/clean/Book, statistics, Markdown, and combined DOCX/ZIP timings without applying a desktop-specific pass/fail target.

See [MANUAL_TESTING.md](MANUAL_TESTING.md) for the live Obsidian, Word/LibreOffice, and Vellum checklist. Automated tests do not substitute for those application-level checks.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the command-to-preparation call graph and execution-path invariants.

## Known Limits

- DOCX save/open/reveal actions depend on the current Obsidian platform and operating-system integration.
- Vellum interpretation must be confirmed in Vellum itself for each release; XML style assertions cannot prove Vellum application behaviour.
- Highly custom authoring templates may need additional body-section aliases or explicit item-role overrides.
- Embedded media and advanced Markdown layout are intentionally outside the restrained fiction-manuscript output model.

## Release Package

`npm run package` creates `release/manuscript-compiler-0.9.2.zip` containing exactly `main.js`, `manifest.json`, and `styles.css`. `npm run package:validate` verifies archive contents and matching version metadata.
