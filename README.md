# Manuscript Compiler

Manuscript Compiler 0.9.2 turns fiction in an Obsidian vault into DOCX, ODT, PDF, EPUB, standalone HTML, or structured XML. It works offline, never changes source notes, and requires neither Pandoc nor another community plugin.

Only content included in the reviewed manuscript structure is exported. Project metadata, author notes, dashboards, and excluded notes are not manuscript content.

## Quick Start

1. In File Explorer, right-click the book folder and choose **Compile manuscript from this folder**.
2. Review the detected structure and correct inclusion, roles, or order if needed.
3. Choose DOCX, ODT, PDF, EPUB, HTML, or XML.
4. Choose the formatting controls that apply to that format.
5. Press **Create and download …**.
6. Complete the save or share flow provided by Obsidian and the operating system.

The selected folder is the exact manuscript root; it never becomes a Part or Chapter. The three-stage workspace is **Manuscript → Contents → Create file**. Contents opens as a compact outline. **Correct structure** exposes keyboard-operable inclusion, type, and ordering controls. Excluded folders collapse without losing child choices or manual order.

If an included note or a semantic compile choice changes after preparation, export is blocked until the preview is refreshed. Changing only the selected format or filename does not rescan, reparse, or rebuild the prepared Book.

## Formats

- **DOCX** is native WordprocessingML for Word, Vellum, editing, and submission. Vellum and Standard Manuscript presets are fully supported.
- **ODT** is a native OpenDocument Text ZIP package for LibreOffice and compatible editors.
- **PDF** is a directly generated, fixed-layout A4 or Letter document with searchable Unicode text, built-in serif/sans-serif choices, and configurable margins. It is not browser-print output and uses no external executable.
- **EPUB** is a native EPUB 3 reflowable package with container, package document, navigation, XHTML sections, and embedded CSS.
- **HTML** is one offline HTML5 file with embedded CSS, semantic sections, and no JavaScript or remote assets.
- **XML** is a deterministic interchange format in the `https://manuscript-compiler.dev/schema` namespace with `schemaVersion="1.0"`. It contains manuscript content and structure, but no vault paths, profile IDs, settings, or private YAML metadata.

DOCX and ODT support document-style pagination controls. PDF uses fixed-layout controls. EPUB and HTML expose only meaningful reflowable controls. XML hides visual formatting controls. No visible control is intended to be inert.

## Discovery and Cleaning

Folders named Manuscript, Draft, Drafts, Book, Content, or Chapters can be transparent containers. Project folders such as Archive, Development, Exports, Research, Notes, Planning, Characters, Locations, Dashboards, Templates, Attachments, and old drafts are ignored by default but remain reviewable.

Front and back matter are inferred from names and ancestry. Parts, Chapters, Scenes, matter, transparent containers, and ignored items can all be corrected before preparation.

For template notes, the default manuscript-body headings are Scene, Manuscript, Text, Draft, and Body. Synopsis, Revision Notes, Editing Notes, Author Notes, Development Notes, and Comments sections are removed. YAML and recognised structured project metadata are removed without treating ordinary prose beginning with words such as “Book” or “Chapter” as metadata.

Bold, italics, combined emphasis, readable Markdown link text, punctuation, smart quotes, accented characters, and Unicode pass through the shared semantic export projection. Embedded media, complex tables, and advanced Markdown layout are outside the restrained fiction model.

## Delivery, Privacy, and Platform Behaviour

All formats are generated and structurally validated in memory before delivery. One platform-neutral service creates a Blob, dispatches a temporary `<a download>` exactly once, removes it, and revokes the object URL. The plugin does not know or persist the final external path. Obsidian or the host may ask where to save the file or place it in Downloads. On mobile, the same mechanism is attempted; there is no vault-output fallback.

Completed manuscript exports are never written into the vault. Historical vault-output settings remain storage-only migration data and cannot activate an old output route. The diagnostics command may still create an explicitly requested privacy-safe Markdown diagnostics note in the vault; that is not a manuscript export.

The plugin has no Electron bridge, Node filesystem export path, network requests, telemetry, cloud service, remote assets, shell command, or external executable. `fflate` is the sole bundled runtime dependency and supplies ZIP creation/inspection.

History records bounded structural facts: time, title, format, filename, counts, generation/validation status, and whether download dispatch started. It does not record prose, Blob URLs, absolute paths, profile IDs, or warning details containing manuscript data.

## DOCX Presets

Vellum defaults to Garamond 12 pt, 1.15 spacing, 0.75 cm first-line indent, A4, `#` scene breaks, separate Part/Chapter number and title styles, and Chapter page starts. Standard Manuscript defaults to Times New Roman 12 pt, double spacing, 1.27 cm indent, A4, `* * *` scene breaks, and Chapter page starts. Custom retains the applicable exposed values.

DOCX includes native Title, Author, Front Matter Heading, Back Matter Heading, Part Number, Part Title, Chapter Number, Chapter Title, First Paragraph, Body Text, and Scene Break styles. No Part 0 or Chapter 0 is invented.

## Development and Validation

```bash
npm ci
npm run typecheck
npm test
npm run test:docx
npm run test:odt
npm run test:pdf
npm run test:epub
npm run test:html
npm run test:xml
npm run test:exports
npm run benchmark:large
npm run build
npm run package
npm run package:validate
npm audit
```

The release archive is `release/manuscript-compiler-0.9.2.zip` and contains exactly `main.js`, `manifest.json`, and `styles.css`.

Automated structural validation is not a substitute for opening outputs in Word, Vellum, LibreOffice, multiple PDF/EPUB readers, and browsers. See [MANUAL_TESTING.md](MANUAL_TESTING.md).

## Known Limits

- Browser/host download behaviour and prompts differ by platform, and the plugin cannot verify the final filesystem copy after dispatch.
- The internal PDF validator checks structure, pages, text operators, and termination; it does not claim comprehensive PDF standards conformance.
- EPUB validation is structural and does not replace EPUBCheck or live reader testing.
- Vellum import semantics require live Vellum testing.
- Unusual authoring templates may require manual structure correction or body-heading aliases.
