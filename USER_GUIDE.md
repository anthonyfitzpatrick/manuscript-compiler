# Manuscript Compiler User Guide

## Introduction

Manuscript Compiler turns an author-reviewed set of Markdown notes into DOCX, ODT, EPUB, HTML, Markdown, or XML. It runs inside Obsidian, works offline, and never changes manuscript notes. Exported files are created in memory and handed to the operating system's download or share flow; manuscript exports are not written into the vault.

The workflow has three stages:

1. **Manuscript** — choose the exact book folder and its broad structure.
2. **Contents** — review what will be included and correct roles or order when necessary.
3. **Create file** — choose a format, formatting, filename, and start the download.

For a first export, work through all three stages without skipping the Contents review. The compiler can recognise common publishing structures, but only the author can confirm that every Scene, front-matter note, and back-matter note belongs in the finished book. Corrections made during review affect the compiled Book only; they do not rename, move, or rewrite source notes.

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

After enabling the plugin, confirm the installation before working with a real manuscript. Open the command palette and search for Manuscript Compiler, or right-click a test folder in File Explorer and confirm that **Compile manuscript from this folder** appears. If the command is missing, verify that the three release files are directly inside the plugin folder rather than inside an additional nested directory.

## Updating

1. Close any open Manuscript Compiler window.
2. Back up the vault using the same process used for other important Obsidian data.
3. Replace `main.js`, `manifest.json`, and `styles.css` with all three files from the same release.
4. Restart Obsidian.
5. Open the plugin once and confirm existing profiles and formatting choices remain available.

Never mix files from different release versions. Settings migration is designed to preserve older choices, but downgrading is not a supported migration path.

After updating, check the version shown in **Settings → Community plugins** and run a small test export. If the plugin window was open during replacement, close and reopen it so the interface and background code come from the same release. Keep the previous release archive until the new version has completed a representative export successfully.

## Creating a manuscript

Compilation begins with the vault's existing folder and note structure. The goal is not to reorganise a working writing system, but to select one complete book root and describe how the material inside it maps to publication roles. Use clear folder boundaries where practical, then rely on Contents correction for deliberate exceptions.

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

Folder and note names should make their publishing role easy to recognise. Numbered names such as `Part 1`, `Chapter 03`, and `Scene 02` help produce a predictable initial order, while front- and back-matter folder names help detection place those notes outside the manuscript body. The structure does not need to match this example exactly: use the closest preset, then correct exceptional folders and notes on Contents.

Before compiling, move obsolete drafts and generated exports into clearly named project folders or confirm that they are excluded during review. Avoid selecting the vault root when it contains several books; choosing the narrowest folder that contains the complete book reduces false matches and makes ignored-item review easier.

### Right-click workflow

In File Explorer, right-click the exact book folder and choose **Compile manuscript from this folder**. The clicked folder becomes the authoritative root; it is not exported as a Part or Chapter.

Use this workflow when the correct project folder is already visible:

1. Expand File Explorer until the folder containing the whole book is visible.
2. Right-click that folder, not an individual Chapter or Scene.
3. Choose **Compile manuscript from this folder**.
4. Confirm the folder name and detected structure on the Manuscript screen before continuing.

If the selected folder contains only part of the book, cancel and start again from the complete book folder. The compiler deliberately stays inside the selected root and will not search neighbouring folders for missing material.

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

Read the scan summary before choosing **Review Structure**. The displayed counts are an early warning system: a novel expected to contain twenty Chapters should not proceed unnoticed if the scan reports two. A surprising count does not mean notes were altered; it means the selected root or preset may not describe the project accurately.

To change the root, open the folder chooser, search by folder name, and select the folder that contains all publication content for one book. Then choose the nearest structure preset and let the compiler rescan. Continue only when the selected folder and broad manuscript shape are plausible.

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

Presets are starting rules, not permanent templates. Choose based on how the manuscript is stored now: use **Novel with Parts** only when Parts are real publication headings, and use **Novel** when Chapters are the highest structural level. If a project mixes folder-based Chapters with an occasional Chapter note, choose the dominant pattern and correct the exceptions individually.

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

Review Contents from top to bottom:

1. Compare the Part, Chapter, Scene, and matter counts with the manuscript you expect.
2. Expand representative branches and confirm that their hierarchy is correct.
3. Open **Ignored project notes** and look for publication content that was excluded accidentally.
4. Open **Warnings** and read each explanation before deciding whether a correction is needed.
5. Check ordering at the beginning, at Part boundaries, and around front and back matter.

Do not continue merely because the total word count looks reasonable. A duplicated draft can offset a missing Scene, while still producing a plausible total. The structural outline is the authoritative preview of what will be prepared.

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

When recovering an ignored note, inspect its parent folders as well as the note itself. Exclusion can be inherited from an ignored ancestor such as `Research` or `Archive`. Include the required ancestor, assign organisational ancestors **Transparent container**, and assign the publication note its real role. This preserves the vault layout without creating unwanted headings in the export.

### Correcting structure

Choose **Correct structure** to reveal inclusion toggles, type selectors, disclosure controls, and Move up/down actions. The button changes to **Finish correcting structure** while correction mode is active.

Available roles are Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude. Correct a folder role before correcting many descendants; front/back matter inheritance updates untouched children while preserving explicit overrides.

Keyboard users can Tab to controls, use Space/Enter on buttons and toggles, and use the format radio group's arrow keys later on Create file. Focus remains visible.

Make corrections in a stable order: first inclusion, then folder roles, then note roles, and finally ordering. Correcting a parent before its children reduces repetitive work because inherited roles can update untouched descendants. Use Move up/down only after the correct items are included; otherwise a later inclusion change can make the intended order harder to judge.

Before leaving correction mode, collapse and re-expand edited branches to confirm the saved hierarchy. Then compare the summary counts again. A Part should contain Chapters, a Chapter should contain its Scenes or body note, and transparent containers should organise content without appearing as publication headings.

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

If a correction produces an unexpected result, remain on Contents and adjust it rather than relying on the target application to repair the document later. Structural fixes made here apply consistently to every export format generated from the prepared Book.

## Create file

Create file shows the prepared Book summary, six format cards, relevant formatting controls, warnings, resolved filename, and the primary create/download action. Switching only the format or filename reuses the same prepared Book. A source-note or semantic-choice change requires **Refresh preview**.

Complete this screen in the following order:

1. Confirm the prepared title, author, counts, and word count.
2. Select the target format.
3. Choose a formatting preset, then adjust any exposed controls.
4. Review advanced formatting only when the defaults do not match the publishing workflow.
5. Check the resolved filename and extension.
6. Read any remaining warning before choosing the create/download action.

Generate one format at a time and open it in the application that will actually consume it. Returning to Create file and selecting another format reuses the reviewed Book, provided no source or semantic setting has changed.

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

Choose the format according to the next step in the workflow, not only by visual similarity. DOCX and ODT are editable word-processing documents; EPUB is for reflowable ebook testing; HTML is a self-contained browser document; Markdown is portable source text; and XML is structured interchange. Formatting controls change as the selection changes because not every concept applies to every format.

After switching formats, review the visible controls again. A choice such as page size is meaningful for a paged document but not for presentation-neutral XML, while reader-controlled EPUB typography can behave differently from a DOCX opened in Word.

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

Start with the preset closest to the destination application, then change only the settings you can explain and test. Choose **Vellum** for a Vellum-oriented DOCX workflow, **Standard manuscript** for conventional submission-style output, and **Custom** when maintaining deliberate house settings. Switching presets replaces the applicable exposed values, so select the preset before fine-tuning individual controls.

### Paragraph indentation

**Indent first line of paragraphs** controls only later ordinary body paragraphs:

- Enabled: later body paragraphs use the selected first-line indent.
- Disabled: all body paragraphs are flush left.
- In both modes: the first paragraph after a heading or scene break remains flush left.
- Headings, title, author, scene separators, and line/paragraph spacing are unaffected.

The first-line indent size appears only when indentation is enabled. Markdown has no portable first-line indentation standard, so it shows an explanation instead of the toggle. XML delegates presentation to the consuming application.

For fiction, enable indentation and inspect both the first paragraph after a Chapter heading and a later body paragraph in the exported file. The first should remain flush left while the later paragraph uses the selected indent. For copyright pages, reference material, or layouts that use paragraph spacing instead of indentation, disable the option and verify several matter and manuscript pages in the target application.

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

Select a separator that remains unambiguous in the destination format. A visible marker such as `* * *` is useful for editorial documents, while a styled blank line may suit finished reading formats. When using Custom, enter a short text marker rather than layout instructions; then inspect consecutive Scenes to confirm the separator appears once and that the following paragraph resets to First Paragraph styling.

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

Review matter in the order a reader should encounter it. Front matter should appear before the first Part or Chapter, and back matter should follow the final manuscript Scene. Use Move up/down on Contents to arrange items such as copyright, dedication, acknowledgements, and author information. If a folder exists only to group matter notes, assign the folder **Transparent container** and assign the notes Front matter or Back matter individually.

When enabling a generated title page, verify that the title and author resolve correctly and that an existing title-page note does not create unintended duplication. Use the advanced title and author overrides when the publishing title differs from the selected folder name or stored metadata.

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

Open this panel only after selecting the target format and base preset. Enter overrides exactly as they should appear in the finished file, then review the resolved filename before export. Keep filename templates portable: avoid slashes, colons, and other characters that operating systems may replace or reject. Structural heading options affect how recognised Parts and Chapters are displayed; they do not change the underlying hierarchy reviewed on Contents.

After changing semantic heading or content options, refresh the prepared preview if prompted. Typography-only choices can be checked in the target application, but hierarchy and inclusion should always be corrected before generation.

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

Every format is generated from the same reviewed semantic Book, but each serves a different downstream purpose. Select the format that matches the next application or publishing step, retain the resolved extension, and perform the verification described for that format. Generating several formats is safe as long as the prepared preview remains current.

### DOCX

DOCX is native WordprocessingML intended for Microsoft Word, LibreOffice, editing workflows, and Vellum import. It includes named structural styles for Title, Author, matter headings, Part/Chapter number and title, First Paragraph, Body Text, and Scene Break. The plugin validates the package structure before download.

Choose DOCX when the next step involves Word editing, tracked changes, a formatter, or Vellum import. After export, inspect the Styles gallery, verify that Chapter headings are recognised separately from body text, and check the first paragraph and one later paragraph. For Vellum, perform an actual import and confirm that Parts and Chapters appear once in its navigator.

### ODT

ODT is a native OpenDocument Text package for LibreOffice and compatible editors. Named paragraph styles carry explicit structural formatting and indentation choices.

Choose ODT for an OpenDocument-native workflow. Open the file in LibreOffice Writer, select representative headings and paragraphs, and confirm their named styles and spacing. Also inspect a scene boundary and a matter page, because application defaults can reveal layout differences that package validation alone cannot show.

### EPUB

EPUB is a reflowable EPUB 3 package with navigation, ordered spine, XHTML sections, and an embedded offline stylesheet. Reader typography controls can override some presentation, but the package explicitly defines manuscript heading weight and paragraph indentation.

Choose EPUB for ebook proofing or as input to a later publishing workflow. Test the contents navigation, move through several Chapter boundaries, and change the reader window or font size to confirm that text reflows without clipping. Use at least one mainstream reader in addition to structural validation, because reader engines and user accessibility settings can alter presentation.

### HTML

HTML is one offline HTML5 file with embedded CSS, semantic sections, no JavaScript, and no remote assets. It is suitable for browser reading, inspection, or further controlled processing.

Choose HTML for a self-contained browser proof or controlled downstream transformation. Open the downloaded file while offline, confirm that headings and scene breaks render correctly, and inspect the beginning and end of the document. Because all styling is embedded, the file can be moved without an accompanying asset folder.

### Markdown

Markdown is deterministic portable plain text. Structural headings use standard `#`, `##`, and `###` syntax; the source is expected to show heading markers and becomes visually bold in a rendered Markdown view. The exporter never adds leading spaces, HTML, or CSS to imitate first-line indentation.

Choose Markdown when portability and readable source are more important than fixed presentation. Review both Source and Reading views: Source should contain clean heading markers and ordinary unindented paragraphs, while Reading view should render the structural hierarchy. If another Markdown tool interprets headings differently, configure that tool rather than adding presentation-only markup to the export.

### XML

XML is a deterministic, presentation-neutral interchange document in the Manuscript Compiler namespace. It preserves title, author, matter, Parts, Chapters, Scenes, paragraphs, emphasis, and links without CSS or visual indentation preferences. XML consumers decide how to display it.

Choose XML for archival inspection, automation, or a custom conversion pipeline. Open it in an XML-aware editor, expand representative elements, and confirm that structural roles and ordering match Contents. Treat the XML as semantic data rather than a reading format; a consuming stylesheet or application is responsible for its visual presentation.

## Download and completion

After validation, the plugin starts one browser/host download. Desktop systems may show a save prompt or place the file in Downloads. Mobile systems may display a share sheet. The plugin cannot know or remember the final external path.

Before starting the download, read the resolved filename and confirm that its extension matches the selected format. Then choose the create/download action once and wait for the host prompt. Select an external destination, complete the save or share action, and open the resulting file from that destination. If the host renames a duplicate with a number suffix, use the newest file for verification.

Successful generation means the plugin validated the bytes and handed them to the host. It does not prove that a particular application will render every choice identically, so complete the format-specific checks above before treating the file as a release candidate.

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

Most problems can be resolved by checking the workflow in order: selected root, detected structure, Contents inclusion and roles, prepared-preview freshness, format settings, and finally the host download flow. Start with the relevant symptom below and return to the preceding stage when the current screen cannot correct the underlying cause.

### A note is missing

Open Contents, review Ignored and Warnings, then use correction mode. Confirm that every ancestor folder is included and that the note is assigned Scene, front matter, or back matter rather than Exclude.

Expand the outline from the selected root down to the note's expected location. If the note appears under **Ignored project notes**, read the displayed reason and inspect whether a parent folder caused inherited exclusion. Include the necessary parent as a Transparent container, include the note, assign its publishing role, and finish correction mode. If the note is absent from both included and ignored views, return to the Manuscript screen and confirm that the selected root actually contains it.

### A folder appears as a heading

Assign it **Transparent container** if it is organisational only. Assign Part or Chapter only when the folder should create that semantic structure.

Open correction mode, select the folder's role menu, and change the role before adjusting its children. Confirm that the child Chapters or Scenes retain their intended roles, then finish correction mode and review the outline again. Do not rename or flatten a useful vault folder merely to remove its exported heading.

### The preview is stale

Choose **Refresh preview**. Included note edits and semantic formatting changes invalidate preparation to prevent exporting different content from the reviewed Book.

Save the edited note first, return to Create file, and choose **Refresh preview**. Recheck the prepared summary and any warnings because the edit may have changed word counts or structure detection. The create/download action remains unavailable until the refreshed Book represents the current source and semantic choices.

### The download does not start

Retry after checking host download permissions, popup/download blocking, storage availability, and mobile share-sheet behavior. The plugin does not fall back to writing the export into the vault.

First confirm that validation completed and that the button did not report an export error. Check the browser or operating system's download indicator, then allow downloads for Obsidian if the host requests permission. On mobile, wait for the share sheet and select a destination that accepts the generated file type. Avoid clicking repeatedly while a host prompt is hidden behind another window.

### Markdown headings do not look bold

Open the file in a rendered Markdown or Reading view. Clean Markdown source shows `#` markers; it does not embed presentation markup merely to appear bold in a plain-text editor.

Confirm that Part, Chapter, and Scene heading markers begin at the start of their lines with a space after the marker. Switch the receiving editor to Reading or Preview mode to see the rendered hierarchy. If the source contains the expected markers, plain-text appearance is normal and does not indicate a failed export.

### Paragraphs appear indented on a copyright page

Disable **Indent first line of paragraphs** for that export. All body paragraphs become flush left while structural headings and spacing remain unchanged.

Return to Create file, select the same format and preset, disable indentation, and generate a new file with a distinguishable filename. Inspect both the copyright page and ordinary manuscript pages to confirm the global choice is appropriate. The current setting applies consistently to body paragraphs; it is not a per-note override.

---

## Frequently asked questions

These answers clarify what the compiler changes, where processing happens, and which responsibilities remain with the operating system or target application.

**Does the plugin modify my notes?**

No. Scanning, preparation, and export read notes. Generated manuscript files use the host download/share mechanism.

Structure corrections are stored as compiler choices rather than implemented by moving or rewriting vault content. You can cancel a compilation without changing manuscript files.

**Does it upload my manuscript?**

No manuscript or settings data is sent over the network. There are no accounts, telemetry, cloud services, or background network requests. Support and funding links open an external website only when you select them.

Compilation and package validation happen locally. The operating system or application chosen in the save/share flow may have its own cloud-sync behavior, which is outside the plugin's control.

**Do I need Pandoc, LibreOffice, Word, or another Obsidian plugin?**

No external tool is required to generate files. Applications such as Word, LibreOffice, Vellum, and EPUB readers are useful for opening and manually checking their respective formats.

Use the application appropriate to the delivery workflow for final verification. A structurally valid file can still expose application-specific pagination, font substitution, or import behavior.

**Can I export directly into the vault?**

No. Manuscript exports are deliberately delivered outside the vault. The separate diagnostics action can create an explicitly requested redacted support note.

Choose a destination through the host's save or share interface. Keeping generated manuscripts outside the selected book root also prevents old exports from being mistaken for publication source during later scans.

**Why was a dashboard ignored?**

Dashboards and project notes are not publication content. They remain reviewable and can be explicitly corrected when detection is wrong.

Open **Ignored project notes** to see the reason. Include the note only if it genuinely belongs in the published book, then assign Front matter, Scene, or Back matter as appropriate.

**Can one prepared manuscript be exported in several formats?**

Yes. Switching formats reuses the same prepared semantic Book as long as source notes and semantic choices remain current.

After each download, return to Create file, select another format, review its format-specific controls, and generate again. If a source note or semantic option changes, refresh the preview before continuing so all formats come from the same reviewed content.

**Why do EPUB readers look different?**

EPUB is reflowable and readers expose user typography preferences. The package supplies explicit structural and paragraph rules, but a reader may apply accessibility or user overrides.

Test navigation and hierarchy separately from exact typography. Resize text and the reader window to confirm robust reflow, and compare more than one reader when visual consistency is important.

## Tips

Use these habits to make repeated compilations predictable:

- Keep one book per selected root.
- Separate manuscript material from Development, Research, Archive, and Exports.
- Use transparent containers instead of forcing organisational folders into Parts.
- Number folders or use metadata consistently when automatic order matters.
- Review ignored content before the first export from a new project.
- Use correction mode for exceptions instead of renaming an established vault unnecessarily.
- Disable first-line indentation for copyright-heavy or non-fiction-style output.
- Open every release candidate in its target application; byte-level validation cannot prove application interoperability.

For a new project, create one small test export before investing time in detailed typography. Once inclusion, hierarchy, and ordering are correct, save or reuse the chosen profile and perform the full-format checks required by the publishing workflow.

## Performance

The compiler reads and prepares the manuscript once, then exports the prepared Book. Large manuscripts are supported, but initial preparation time depends on note count, manuscript size, device speed, and mobile memory. Keep unrelated research outside the selected root or in clearly ignored folders to reduce discovery work. There is no machine-specific timeout or performance guarantee.

If preparation feels unexpectedly slow, confirm that the selected root does not contain archives, duplicate books, or large unrelated note collections. Collapse of the visual outline does not exclude content or reduce preparation work; exclusion and a narrower root do. On memory-constrained mobile devices, close unrelated panes and applications before compiling a large manuscript, then generate and verify one format at a time.

## Known limitations

Manuscript Compiler intentionally targets a restrained, semantic book model. Review the following constraints before relying on it for a layout-heavy project:

- Complex tables, embedded media, and advanced Markdown layout are outside the restrained manuscript model.
- Browser/host download prompts differ by operating system, and final external persistence cannot be verified by the plugin.
- EPUB structural validation does not replace EPUBCheck or reader testing.
- Vellum recognition requires an actual Vellum import test.
- Markdown has no portable first-line indentation standard.
- XML is intentionally presentation-neutral.
- Unusual templates may require corrected roles or manuscript-body heading aliases.

When a project depends on one of these areas, create a representative sample and test it in the target application before compiling the complete book. The plugin preserves supported manuscript semantics, but it is not a desktop-publishing or fixed-page-layout engine.

## Uninstalling

1. Finish or cancel any active compilation.
2. Disable Manuscript Compiler under Community plugins.
3. Delete `.obsidian/plugins/manuscript-compiler/` if desired.

Uninstalling does not remove or alter manuscript notes. Deleting the plugin directory also deletes its saved plugin settings, profiles, history, and compile logs. Exports already downloaded outside the vault are unaffected.

If profiles or logs may be needed later, copy the plugin directory to a safe backup location before deleting it. Restart Obsidian after removal and confirm that the command-palette entry and File Explorer context-menu action are gone. Any downloaded DOCX, ODT, EPUB, HTML, Markdown, or XML files remain wherever the operating system saved them.
