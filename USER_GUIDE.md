# Manuscript Compiler User Guide

## Introduction

Manuscript Compiler turns an author-reviewed set of Markdown notes into DOCX, ODT, EPUB, HTML, Markdown, or XML. It runs inside Obsidian, works offline, and never changes manuscript notes. Exported files are created in memory and handed to the operating system's download or share flow; manuscript exports are not written into the vault.

The workflow has three stages:

1. **Manuscript** — choose the exact book folder and its broad structure.
2. **Contents** — review what will be included and correct roles or order when necessary.
3. **Create file** — choose a format, formatting, filename, and start the download.

<!-- SCREENSHOT:01 -->

<br>

<p align="center">
  <img src="docs/images/01-manuscript-compiler-enabled.png" alt="Manuscript Compiler installed and enabled in Obsidian's Community plugins settings" width="75%">
</p>

<br>

*Manuscript Compiler installed and enabled in Obsidian’s Community plugins settings.*

---

## Installation

Until Manuscript Compiler is available through Obsidian's Community Plugins catalogue:

1. Download `main.js`, `manifest.json`, and `styles.css` from a release whose tag exactly matches the manifest version.
2. Create `<vault>/.obsidian/plugins/manuscript-compiler/` if it does not exist.
3. Put only those three files in that folder.
4. Restart Obsidian or reload community plugins.
5. Open **Settings → Community plugins** and enable **Manuscript Compiler**.

The plugin is mobile-safe, but the exact save/share experience depends on the mobile operating system and Obsidian host.

## Updating

1. Close any open Manuscript Compiler window.
2. Back up the vault using the same process used for other important Obsidian data.
3. Replace `main.js`, `manifest.json`, and `styles.css` with all three files from the same release.
4. Restart Obsidian.
5. Open the plugin once and confirm existing profiles and formatting choices remain available.

Never mix files from different release versions. Settings migration is designed to preserve older choices, but downgrading is not a supported migration path.

## Creating a manuscript

### Recommended folder structure

The compiler works best when the selected folder represents exactly one book. A conventional novel might look like this:

```text
Book title/
├── Ebook Front Matter/
│   ├── Copyright.md
│   └── Dedication.md
├── Manuscript/
│   ├── Part 1 - Departure/
│   │   ├── Chapter 1 - Leaving/
│   │   │   ├── Scene 1.md
│   │   │   └── Scene 2.md
│   │   └── Chapter 2 - Crossing/
│   └── Part 2 - Return/
├── Ebook Back Matter/
│   └── About the Author.md
├── Development/
└── Research/
```

`Manuscript`, `Draft`, `Drafts`, `Book`, `Content`, and `Chapters` can act as transparent containers. A transparent container organises the vault but does not create a heading in the exported book. Common project folders—such as Development, Research, Archive, Dashboards, Templates, and Exports—are ignored by default and remain visible for review.

### Right-click workflow

In File Explorer, right-click the exact book folder and choose **Compile manuscript from this folder**. The clicked folder becomes the authoritative root; it is not exported as a Part or Chapter.

<!-- SCREENSHOT:02 -->

<br>

<p align="center">
  <img src="docs/images/02-folder-context-menu.png" alt="Compile manuscript from this folder in the Obsidian File Explorer context menu" width="75%">
</p>

<br>

*Right-click a book folder and choose **Compile manuscript from this folder** to use it as the manuscript root.*

---

You can also open Manuscript Compiler from the command palette or plugin settings. When those routes do not already identify a folder, choose one on the Manuscript screen.

<!-- SCREENSHOT:03 -->

<br>

<p align="center">
  <img src="docs/images/03-plugin-settings.png" alt="Manuscript Compiler settings with defaults, advanced options, support links, and the Open compiler button" width="75%">
</p>

<br>

*The Manuscript Compiler settings tab provides an **Open compiler** button alongside defaults, advanced profile tools, and support links.*

---

## The Manuscript screen

Confirm the selected folder and choose the structure preset closest to the project. The preset controls initial detection only; Contents corrections remain authoritative.

<!-- SCREENSHOT:04 -->

<br>

<p align="center">
  <img src="docs/images/04-manuscript-screen.png" alt="The Manuscript stage showing the selected book folder, detected structure, scan summary, and Review Structure action" width="75%">
</p>

<br>

*The Manuscript stage confirms the selected book folder and detected structure before you choose **Review Structure**.*

---

<!-- SCREENSHOT:05 -->

You only need the folder chooser when you want to change the selected folder or when you opened Manuscript Compiler without using **Compile manuscript from this folder** in the File Explorer right-click menu.

<br>

<p align="center">
  <img src="docs/images/05-folder-chooser.png" alt="The manuscript folder chooser filtered to Warden of Silence" width="75%">
</p>

<br>

*Search for and select the folder that represents the complete book. The chosen folder becomes the manuscript root.*

---

### Structure presets

- **Novel with Parts** — Part folders contain Chapter folders, which contain Scene notes.
- **Novel** — Chapter folders contain Scene notes; no Parts are required.
- **Chapter notes** — each Chapter is a note rather than a folder of Scenes.
- **Short story** — one or more manuscript notes without a Part/Chapter hierarchy.
- **Anthology** — collections and story notes are treated as a multi-work structure.
- **Custom** — retains advanced profile rules and is intended for established non-standard layouts.

Choose the nearest preset and correct exceptions on Contents. Renaming the vault is not required merely to satisfy a preset.

<!-- SCREENSHOT:06 -->

<br>

<p align="center">
  <img src="docs/images/06-structure-presets.png" alt="The Detected structure menu showing every available manuscript structure preset" width="75%">
</p>

<br>

*Choose the preset that most closely matches the book. **Novel with Parts** is selected here before reviewing the detected structure.*

---

## Reviewing Contents

Contents opens as a compact review, not an editing form. Summary cards show detected manuscript counts, and the outline shows included structure. Ignored material and warnings have focused review filters.

<!-- SCREENSHOT:07 -->

<br>

<p align="center">
  <img src="docs/images/07-contents-review.png" alt="The Contents stage showing detected counts, review controls, and the collapsed manuscript outline" width="75%">
</p>

<br>

*Review the detected counts, ignored items, warnings, and manuscript outline before continuing or choosing **Correct structure**.*

---

### Understanding ignored notes

Ignored notes are not deleted or changed. They are excluded from the prepared Book because their folder or content resembles project material, dashboards, notes, revisions, research, templates, or old exports. Review the ignored filter when a manuscript note is missing. If detection is wrong, use correction mode to include it and assign the appropriate role.

### Correcting structure

Choose **Correct structure** to reveal inclusion toggles, type selectors, disclosure controls, and Move up/down actions. The button changes to **Finish correcting structure** while correction mode is active.

Available roles are Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude. Correct a folder role before correcting many descendants; front/back matter inheritance updates untouched children while preserving explicit overrides.

Keyboard users can Tab to controls, use Space/Enter on buttons and toggles, and use the format radio group's arrow keys later on Create file. Focus remains visible.

<!-- SCREENSHOT:08 -->

<br>

<p align="center">
  <img src="docs/images/08-correct-structure.png" alt="Correction mode showing inclusion checkboxes, folder disclosure, role selectors, and ordering controls" width="75%">
</p>

<br>

*In correction mode, use the checkboxes, role selectors, disclosure controls, and arrows to change inclusion, structure, and order.*

---

<!-- SCREENSHOT:09 -->

<br>

<p align="center">
  <img src="docs/images/09-collapsed-structure.png" alt="Correction mode with one chapter expanded into scenes and neighbouring chapters collapsed" width="75%">
</p>

<br>

*Collapse large branches to simplify structure review. Descendant inclusion, roles, and ordering remain saved while a branch is collapsed.*

---

<!-- SCREENSHOT:10 -->

<br>

<p align="center">
  <img src="docs/images/10-ignored-project-notes.png" alt="The Ignored project notes review showing excluded items and their reasons" width="75%">
</p>

<br>

*Open **Ignored project notes** to review excluded material and the reason each item was left out of the prepared book.*

---

<!-- SCREENSHOT:11 -->

<br>

<p align="center">
  <img src="docs/images/11-warnings-review.png" alt="The Warnings review showing affected chapters and author-facing explanations" width="75%">
</p>

<br>

*Open **Warnings** to review structural concerns and their explanations before continuing to Create file.*

---

When finished, choose **Finish correcting structure** and continue to Create file. The prepared preview is invalidated whenever inclusion, roles, order, cleaning inputs, or semantic formatting changes.

## Create file

Create file shows the prepared Book summary, six format cards, relevant formatting controls, warnings, resolved filename, and the primary create/download action. Switching only the format or filename reuses the same prepared Book. A source-note or semantic-choice change requires **Refresh preview**.

<!-- SCREENSHOT:12 -->

<br>

<p align="center">
  <img src="docs/images/12-create-file-overview.png" alt="The Create file stage showing the prepared book summary and all six export formats" width="75%">
</p>

<br>

*Create file keeps the prepared book summary visible while you choose DOCX, ODT, EPUB, HTML, Markdown, or XML. DOCX is selected here.*

---

### Format selector

Click a card or focus the selected card and use Left/Right or Up/Down arrows. Home selects DOCX and End selects XML. Changing formats corrects the filename extension automatically.

<!-- SCREENSHOT:13 -->

<br>

<p align="center">
  <img src="docs/images/13-docx-format.png" alt="DOCX selected with document style, indentation, scene break, title page, table of contents, and chapter controls" width="75%">
</p>

<br>

*Selecting DOCX reveals its document formatting controls and changes the primary action to **Create and download DOCX**.*

---

<!-- SCREENSHOT:14 -->

<br>

<p align="center">
  <img src="docs/images/14-odt-format.png" alt="ODT selected with document style, indentation, scene break, title page, table of contents, and chapter controls" width="75%">
</p>

<br>

*Selecting ODT reveals its OpenDocument formatting controls and changes the primary action to **Create and download ODT**.*

---

<!-- SCREENSHOT:15 -->

<br>

<p align="center">
  <img src="docs/images/15-epub-format.png" alt="EPUB selected with reflowable ebook, indentation, scene break, title page, table of contents, and advanced formatting controls" width="75%">
</p>

<br>

*Selecting EPUB reveals its reflowable-ebook controls and changes the primary action to **Create and download EPUB**.*

---

<!-- SCREENSHOT:16 -->

<br>

<p align="center">
  <img src="docs/images/16-html-format.png" alt="HTML selected with web-readable, indentation, scene break, title page, table of contents, and advanced formatting controls" width="75%">
</p>

<br>

*Selecting HTML reveals its web-readable formatting controls for a standalone webpage.*

---

<!-- SCREENSHOT:17 -->

<br>

<p align="center">
  <img src="docs/images/17-markdown-format.png" alt="Markdown selected with plain-text structure, indentation guidance, scene break, title page, and advanced content options" width="75%">
</p>

<br>

*Markdown preserves portable plain-text structure, emphasis, and links, but does not support portable first-line indentation.*

---

<!-- SCREENSHOT:18 -->

<br>

<p align="center">
  <img src="docs/images/18-xml-format.png" alt="XML selected with structured manuscript guidance and advanced content options" width="75%">
</p>

<br>

*XML preserves structured manuscript content for interchange; paragraph presentation is controlled by the application that consumes the XML.*

---

## Formatting

Formatting controls are format-specific. Controls that have no meaningful effect are hidden rather than left inert.

### Formatting presets

- **Vellum** — Garamond 12 pt, 1.15 spacing, enabled 0.75 cm first-line indentation, A4, `#` scene breaks, separate Part/Chapter number and title styles, and Chapter page starts.
- **Standard manuscript** — Times New Roman 12 pt, double spacing, enabled 1.27 cm first-line indentation, A4, `* * *` scene breaks, and Chapter page starts.
- **Custom** — retains exposed manual choices. Changing a formatting control selects Custom where that is the established behavior.

### Paragraph indentation

**Indent first line of paragraphs** controls only later ordinary body paragraphs:

- Enabled: later body paragraphs use the selected first-line indent.
- Disabled: all body paragraphs are flush left.
- In both modes: the first paragraph after a heading or scene break remains flush left.
- Headings, title, author, scene separators, and line/paragraph spacing are unaffected.

The first-line indent size appears only when indentation is enabled. Markdown has no portable first-line indentation standard, so it shows an explanation instead of the toggle. XML delegates presentation to the consuming application.

<!-- SCREENSHOT:19 -->

<br>

<p align="center">
  <img src="docs/images/19-standard-formatting.png" alt="The Standard manuscript formatting preset with indentation, scene break, title page, table of contents, chapter start, and advanced formatting controls" width="75%">
</p>

<br>

*The Standard manuscript preset shows the ordinary document controls available before opening **Advanced formatting**.*

---

<!-- SCREENSHOT:20 -->

<br>

<p align="center">
  <img src="docs/images/20-paragraph-indentation.png" alt="Paragraph indentation enabled with the first-line indent size menu open" width="75%">
</p>

<br>

*When paragraph indentation is enabled, choose **None**, **0.75 cm**, or **1.27 cm**. Disabling indentation hides this size control.*

---

### Scene breaks

Choose `#`, `*`, `***`, `* * *`, a styled blank line, or Custom. Scene separators appear only between included Scenes. The first prose after a scene separator uses First Paragraph styling and stays unindented.

<!-- SCREENSHOT:21 -->

<br>

<p align="center">
  <img src="docs/images/21-scene-break-options.png" alt="The Scene break menu showing hash, asterisk, blank-line, and custom separator choices" width="75%">
</p>

<br>

*Choose `#`, `*`, `***`, `* * *`, a blank line, or a custom separator between included Scenes. `* * *` is selected here.*

---

### Title page, front matter, and back matter

**Add title page** creates a generated title/author section when supported. Front and back matter come from notes assigned those roles; title-page generation does not replace those notes. Matter headings are structural, while matter paragraphs follow the chosen global indentation setting. Disabling indentation is often appropriate for copyright, ISBN, rights, edition, and publisher statements.

<!-- SCREENSHOT:22 -->

<br>

<p align="center">
  <img src="docs/images/22-front-matter-structure.png" alt="Front matter correction controls with Copyright notices expanded above the manuscript Parts" width="75%">
</p>

<br>

*Review front-matter inclusion, roles, and order separately from the manuscript Parts. The Copyright notices container is expanded here.*

---

<!-- SCREENSHOT:23 -->

<br>

<p align="center">
  <img src="docs/images/23-back-matter-structure.png" alt="Back matter correction controls with the Front and back matter container expanded" width="75%">
</p>

<br>

*Review which notes will follow the manuscript body, including their inclusion, Back matter roles, and order.*

---

### Advanced formatting

Advanced formatting contains title/author overrides, typography where meaningful, page size for document formats, custom scene separators, structural heading display, manuscript body-heading choices, and filename templates. Use `{BookTitle}` in a filename template to insert the resolved title.

<!-- SCREENSHOT:24 -->

<br>

<p align="center">
  <img src="docs/images/24a-advanced-formatting-typography.png" alt="Advanced formatting with book and author overrides, font, font size, and line spacing" width="75%">
</p>

<br>

*Advanced formatting begins with book and author overrides plus typography controls.*

<br>

<p align="center">
  <img src="docs/images/24b-advanced-formatting-structure.png" alt="Advanced formatting with page size, custom scene break, structural heading styles, manuscript body headings, and filename template" width="75%">
</p>

<br>

*The remaining controls set page size, scene breaks, structural heading styles, manuscript body headings, and the filename template.*

---

## Export formats

### DOCX

DOCX is native WordprocessingML intended for Microsoft Word, LibreOffice, editing workflows, and Vellum import. It includes named structural styles for Title, Author, matter headings, Part/Chapter number and title, First Paragraph, Body Text, and Scene Break. The plugin validates the package structure before download.

### ODT

ODT is a native OpenDocument Text package for LibreOffice and compatible editors. Named paragraph styles carry explicit structural formatting and indentation choices.

### EPUB

EPUB is a reflowable EPUB 3 package with navigation, ordered spine, XHTML sections, and an embedded offline stylesheet. Reader typography controls can override some presentation, but the package explicitly defines manuscript heading weight and paragraph indentation.

### HTML

HTML is one offline HTML5 file with embedded CSS, semantic sections, no JavaScript, and no remote assets. It is suitable for browser reading, inspection, or further controlled processing.

### Markdown

Markdown is deterministic portable plain text. Structural headings use standard `#`, `##`, and `###` syntax; the source is expected to show heading markers and becomes visually bold in a rendered Markdown view. The exporter never adds leading spaces, HTML, or CSS to imitate first-line indentation.

### XML

XML is a deterministic, presentation-neutral interchange document in the Manuscript Compiler namespace. It preserves title, author, matter, Parts, Chapters, Scenes, paragraphs, emphasis, and links without CSS or visual indentation preferences. XML consumers decide how to display it.

## Download and completion

After validation, the plugin starts one browser/host download. Desktop systems may show a save prompt or place the file in Downloads. Mobile systems may display a share sheet. The plugin cannot know or remember the final external path.

<!-- SCREENSHOT:25 -->

<br>

<p align="center">
  <img src="docs/images/25-download-save-prompt.png" alt="The macOS save prompt for a Warden of Silence DOCX export" width="75%">
</p>

<br>

*The completed DOCX is handed to macOS, where you confirm the filename and choose the external save destination.*

---

<!-- SCREENSHOT:26 -->

<br>

<p align="center">
  <img src="docs/images/26-docx-in-word.png" alt="A compiled Warden of Silence chapter open in Microsoft Word with named manuscript styles visible" width="75%">
</p>

<br>

*The generated DOCX opens in Microsoft Word with separate chapter number and title formatting, manuscript body text, a scene break, and named styles available in the Styles gallery.*

---

<!-- SCREENSHOT:27 -->

<br>

<p align="center">
  <img src="docs/images/27-docx-in-vellum.png" alt="The compiled Warden of Silence DOCX imported into Vellum with its book hierarchy and chapter preview visible" width="75%">
</p>

<br>

*Vellum recognises the imported Part and Chapter hierarchy, displays the selected chapter once in the manuscript pane, and renders its corresponding print preview.*

---

<!-- SCREENSHOT:28 -->

<br>

<p align="center">
  <img src="docs/images/28-odt-in-libreoffice.png" alt="A compiled Warden of Silence ODT chapter open in LibreOffice Writer" width="75%">
</p>

<br>

*LibreOffice Writer renders the generated ODT with distinct chapter number and title formatting, manuscript body text, and a centred scene separator.*

---

<!-- SCREENSHOT:29 -->

<br>

<p align="center">
  <img src="docs/images/29-epub-reader.png" alt="The Warden of Silence EPUB open in a reader with its contents navigation and chapter text visible" width="75%">
</p>

<br>

*The generated EPUB provides navigable front matter and Chapters alongside a reflowable reading view with a distinct Chapter heading and scene separator.*

---

<!-- SCREENSHOT:30 -->

<br>

<p align="center">
  <img src="docs/images/30-offline-html-in-browser.png" alt="The Warden of Silence HTML export opened locally in a browser" width="75%">
</p>

<br>

*The self-contained HTML file opens directly from local storage with distinct Part and Chapter headings, manuscript body text, and a centred scene separator.*

---

<!-- SCREENSHOT:31 -->

<br>

<p align="center">
  <img src="docs/images/31-markdown-rendered-view.png" alt="The Warden of Silence Markdown export displayed in a rendered editing view" width="75%">
</p>

<br>

*The portable Markdown renders Part and Chapter headings distinctly while preserving ordinary manuscript paragraphs and the configured scene separator.*

---

<!-- SCREENSHOT:32 -->

<br>

<p align="center">
  <img src="docs/images/32-xml-semantic-structure.png" alt="The Warden of Silence XML export with expanded Part, Chapter, Scene, heading, and paragraph elements" width="75%">
</p>

<br>

*The presentation-neutral XML preserves the manuscript as explicit Part, Chapter, Scene, heading, and paragraph elements for deterministic interchange.*

---

## Troubleshooting

### A note is missing

Open Contents, review Ignored and Warnings, then use correction mode. Confirm that every ancestor folder is included and that the note is assigned Scene, front matter, or back matter rather than Exclude.

### A folder appears as a heading

Assign it **Transparent container** if it is organisational only. Assign Part or Chapter only when the folder should create that semantic structure.

### The preview is stale

Choose **Refresh preview**. Included note edits and semantic formatting changes invalidate preparation to prevent exporting different content from the reviewed Book.

### The download does not start

Retry after checking host download permissions, popup/download blocking, storage availability, and mobile share-sheet behavior. The plugin does not fall back to writing the export into the vault.

### Markdown headings do not look bold

Open the file in a rendered Markdown or Reading view. Clean Markdown source shows `#` markers; it does not embed presentation markup merely to appear bold in a plain-text editor.

### Paragraphs appear indented on a copyright page

Disable **Indent first line of paragraphs** for that export. All body paragraphs become flush left while structural headings and spacing remain unchanged.

---

## Frequently asked questions

**Does the plugin modify my notes?**

No. Scanning, preparation, and export read notes. Generated manuscript files use the host download/share mechanism.

**Does it upload my manuscript?**

No. There are no network requests, accounts, telemetry, or cloud services.

**Do I need Pandoc, LibreOffice, Word, or another Obsidian plugin?**

No external tool is required to generate files. Applications such as Word, LibreOffice, Vellum, and EPUB readers are useful for opening and manually checking their respective formats.

**Can I export directly into the vault?**

No. Manuscript exports are deliberately delivered outside the vault. The separate diagnostics action can create an explicitly requested redacted support note.

**Why was a dashboard ignored?**

Dashboards and project notes are not publication content. They remain reviewable and can be explicitly corrected when detection is wrong.

**Can one prepared manuscript be exported in several formats?**

Yes. Switching formats reuses the same prepared semantic Book as long as source notes and semantic choices remain current.

**Why do EPUB readers look different?**

EPUB is reflowable and readers expose user typography preferences. The package supplies explicit structural and paragraph rules, but a reader may apply accessibility or user overrides.

## Tips

- Keep one book per selected root.
- Separate manuscript material from Development, Research, Archive, and Exports.
- Use transparent containers instead of forcing organisational folders into Parts.
- Number folders or use metadata consistently when automatic order matters.
- Review ignored content before the first export from a new project.
- Use correction mode for exceptions instead of renaming an established vault unnecessarily.
- Disable first-line indentation for copyright-heavy or non-fiction-style output.
- Open every release candidate in its target application; byte-level validation cannot prove application interoperability.

## Performance

The compiler reads and prepares the manuscript once, then exports the prepared Book. Large manuscripts are supported, but initial preparation time depends on note count, manuscript size, device speed, and mobile memory. Keep unrelated research outside the selected root or in clearly ignored folders to reduce discovery work. There is no machine-specific timeout or performance guarantee.

## Known limitations

- Complex tables, embedded media, and advanced Markdown layout are outside the restrained manuscript model.
- Browser/host download prompts differ by operating system, and final external persistence cannot be verified by the plugin.
- EPUB structural validation does not replace EPUBCheck or reader testing.
- Vellum recognition requires an actual Vellum import test.
- Markdown has no portable first-line indentation standard.
- XML is intentionally presentation-neutral.
- Unusual templates may require corrected roles or manuscript-body heading aliases.

## Uninstalling

1. Finish or cancel any active compilation.
2. Disable Manuscript Compiler under Community plugins.
3. Delete `.obsidian/plugins/manuscript-compiler/` if desired.

Uninstalling does not remove or alter manuscript notes. Deleting the plugin directory also deletes its saved plugin settings, profiles, history, and compile logs. Exports already downloaded outside the vault are unaffected.
