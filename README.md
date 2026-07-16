# Manuscript Compiler <img src="logo.svg" alt="Manuscript Compiler semantic tree logo" width="48" align="right">

Manuscript Compiler 0.9.3 turns fiction in an Obsidian vault into DOCX, ODT, EPUB, standalone HTML, Markdown, or structured XML. It works offline, never changes source notes, and requires neither Pandoc nor another community plugin.

Only content included in the reviewed manuscript structure is exported. Project metadata, author notes, dashboards, and excluded notes are not manuscript content.

The workflow has three stages: **Manuscript → Contents → Create file**. Every format is generated locally in memory, validated, and handed to the host download/share flow. Completed exports are downloaded outside the vault; the plugin does not choose or remember the final destination.

Documentation:

- [User guide](USER_GUIDE.md) — installation, manuscript layout, complete workflow, formats, formatting, troubleshooting, and screenshot plan.
- [Developer guide](DEVELOPER_GUIDE.md) — building, testing, architecture boundaries, extension procedures, security, and releases.
- [Architecture](ARCHITECTURE.md) — source-of-truth pipeline, state ownership, exports, validation, privacy, and source map.
- [Security policy](SECURITY.md) — offline guarantees, data handling, dependency policy, and private reporting.
- [Manual release checklist](MANUAL_TESTING.md) — intentionally unchecked application/platform interoperability gates.

## Installation

Until the plugin is listed in Obsidian's Community Plugins directory, download `main.js`, `manifest.json`, and `styles.css` from a GitHub release whose tag exactly matches the manifest version. Put the three files in a vault plugin folder named `manuscript-compiler`, reload Obsidian, and enable **Manuscript Compiler** under Community Plugins.

## Quick start

1. In File Explorer, right-click the book folder and choose **Compile manuscript from this folder**.
2. Review the detected structure and correct inclusion, roles, or order if needed.
3. Choose DOCX, ODT, EPUB, HTML, Markdown, or XML.
4. Choose the formatting controls that apply to that format.
5. Press **Create and download …**.
6. Complete the save or share flow provided by Obsidian and the operating system.

The selected folder is the exact manuscript root; it never becomes a Part or Chapter. The three-stage workspace is **Manuscript → Contents → Create file**. Contents opens as a compact outline. **Correct structure** exposes keyboard-operable inclusion, type, and ordering controls. Excluded folders collapse without losing child choices or manual order.

If an included note or a semantic compile choice changes after preparation, export is blocked until the preview is refreshed. Changing only the selected format or filename does not rescan, reparse, or rebuild the prepared Book.

## Formats

- **DOCX** is native WordprocessingML for Word, Vellum, editing, and submission. Vellum and Standard Manuscript presets are fully supported.
- **ODT** is a native OpenDocument Text ZIP package for LibreOffice and compatible editors.
- **EPUB** is a native EPUB 3 reflowable package with container, package document, navigation, XHTML sections, and embedded CSS.
- **HTML** is one offline HTML5 file with embedded CSS, semantic sections, and no JavaScript or remote assets.
- **Markdown** is a deterministic, portable plain-text manuscript preserving semantic structure, emphasis, readable links, Unicode, and paragraph spacing.
- **XML** is a deterministic interchange format in the `https://manuscript-compiler.dev/schema` namespace with `schemaVersion="1.0"`. It contains manuscript content and structure, but no vault paths, profile IDs, settings, or private YAML metadata.

DOCX and ODT support document-style pagination controls. EPUB and HTML expose only meaningful reflowable controls. Markdown and XML expose structural content controls without print typography. No visible control is intended to be inert.

The Create file screen offers **Indent first line of paragraphs** for DOCX, ODT, EPUB, and HTML. When enabled, the configured first-line indent applies only to later body paragraphs; the first paragraph after a structural heading or scene break remains unindented. When disabled, all body paragraphs—including copyright and other matter text—use zero first-line indent without changing paragraph or line spacing. The indent-size control is shown only while indentation is enabled. Markdown stays portable and does not simulate indentation with spaces, tabs, HTML, or CSS. XML stays presentation-neutral, so its consuming application controls paragraph indentation.

## Discovery and Cleaning

Folders named Manuscript, Draft, Drafts, Book, Content, or Chapters can be transparent containers. Project folders such as Archive, Development, Exports, Research, Notes, Planning, Characters, Locations, Dashboards, Templates, Attachments, and old drafts are ignored by default but remain reviewable.

Front and back matter are inferred from names and ancestry. Parts, Chapters, Scenes, matter, transparent containers, and ignored items can all be corrected before preparation.

For template notes, the default manuscript-body headings are Scene, Manuscript, Text, Draft, and Body. Synopsis, Revision Notes, Editing Notes, Author Notes, Development Notes, and Comments sections are removed. YAML and recognised structured project metadata are removed without treating ordinary prose beginning with words such as “Book” or “Chapter” as metadata.

Bold, italics, combined emphasis, readable Markdown link text, punctuation, smart quotes, accented characters, and Unicode pass through the shared semantic export projection. Embedded media, complex tables, and advanced Markdown layout are outside the restrained fiction model.

## Delivery, Privacy, and Platform Behaviour

All formats are generated and structurally validated in memory before delivery. One platform-neutral service creates a Blob, dispatches a temporary `<a download>` exactly once, removes it, and revokes the object URL. The plugin does not know or persist the final external path. Obsidian or the host may ask where to save the file or place it in Downloads. On mobile, the same mechanism is attempted; there is no vault-output fallback.

Completed manuscript exports are never written into the vault. Historical vault-output settings remain storage-only migration data and cannot activate an old output route. The diagnostics command may still create an explicitly requested privacy-safe Markdown diagnostics note in the vault; that is not a manuscript export.

The plugin has no Electron bridge, Node filesystem export path, background network requests, telemetry, cloud service, remote assets, shell command, or external executable. Support and funding links open an external website only when the user explicitly selects them. `fflate` is the sole bundled runtime dependency and supplies ZIP creation/inspection.

### Disclosures

| Topic | Disclosure |
| --- | --- |
| External file access | Browser/host-controlled download only; the host chooses the destination. |
| Network | No background requests. Export, validation, and delivery initiation are offline. User-selected support links open in the system browser. |
| Accounts | None. |
| Payments and advertising | No advertising or in-plugin payments. An optional external donation link is identified as **Buy me a coffee**. |
| Telemetry and analytics | None. |
| Closed-source components | None. |
| Runtime dependencies | `fflate` 0.8.3, bundled under its MIT licence. |
| Vault writes | No manuscript export is written to the vault. The explicit diagnostics action can create a redacted Markdown support note. |
| Mobile | The same browser download mechanism is attempted. Some mobile hosts may block or redirect downloads; no vault fallback is used. |

History records bounded structural facts: time, title, format, filename, counts, generation/validation status, and whether download dispatch started. It does not record prose, Blob URLs, absolute paths, profile IDs, or warning details containing manuscript data.

## DOCX Presets

Vellum defaults to Garamond 12 pt, 1.15 spacing, enabled 0.75 cm first-line indentation, A4, `#` scene breaks, separate Part/Chapter number and title styles, and Chapter page starts. Standard Manuscript defaults to Times New Roman 12 pt, double spacing, enabled 1.27 cm indentation, A4, `* * *` scene breaks, and Chapter page starts. Custom retains both the indentation toggle and its configured size along with the other applicable exposed values.

DOCX includes native Title, Author, Front Matter Heading, Back Matter Heading, Part Number, Part Title, Chapter Number, Chapter Title, First Paragraph, Body Text, and Scene Break styles. No Part 0 or Chapter 0 is invented.

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

Automated structural validation is not a substitute for opening outputs in Word, Vellum, LibreOffice, multiple EPUB readers, text editors, and browsers. See [MANUAL_TESTING.md](MANUAL_TESTING.md).

## Known Limits

- Browser/host download behaviour and prompts differ by platform, and the plugin cannot verify the final filesystem copy after dispatch.
- On mobile, the host may block the download or route it through a platform share sheet. The plugin reports dispatch failure and does not write a fallback copy into the vault.
- EPUB validation is structural and does not replace EPUBCheck or live reader testing.
- Vellum import semantics require live Vellum testing.
- Unusual authoring templates may require manual structure correction or body-heading aliases.

For a full author-oriented explanation of these limits and recovery steps, see [USER_GUIDE.md](USER_GUIDE.md).
