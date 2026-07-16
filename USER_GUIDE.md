# Manuscript Compiler User Guide

## Introduction

Manuscript Compiler turns an author-reviewed set of Markdown notes into DOCX, ODT, EPUB, HTML, Markdown, or XML. It runs inside Obsidian, works offline, and never changes manuscript notes. Exported files are created in memory and handed to the operating system's download or share flow; manuscript exports are not written into the vault.

The workflow has three stages:

1. **Manuscript** — choose the exact book folder and its broad structure.
2. **Contents** — review what will be included and correct roles or order when necessary.
3. **Create file** — choose a format, formatting, filename, and start the download.

<!-- SCREENSHOT:01 -->

![Manuscript Compiler installed and enabled in Obsidian's Community plugins settings](docs/images/01-manuscript-compiler-enabled.png)

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

![Compile manuscript from this folder in the Obsidian File Explorer context menu](docs/images/02-folder-context-menu.png)

*Right-click a book folder and choose **Compile manuscript from this folder** to use it as the manuscript root.*

---

You can also open Manuscript Compiler from the command palette or plugin settings. When those routes do not already identify a folder, choose one on the Manuscript screen.

<!-- SCREENSHOT:03 -->

![Manuscript Compiler settings with defaults, advanced options, support links, and the Open compiler button](docs/images/03-plugin-settings.png)

*The Manuscript Compiler settings tab provides an **Open compiler** button alongside defaults, advanced profile tools, and support links.*

---

## The Manuscript screen

Confirm the selected folder and choose the structure preset closest to the project. The preset controls initial detection only; Contents corrections remain authoritative.

<!-- SCREENSHOT:04 -->

![The Manuscript stage showing the selected book folder, detected structure, scan summary, and Review Structure action](docs/images/04-manuscript-screen.png)

*The Manuscript stage confirms the selected book folder and detected structure before you choose **Review Structure**.*

---

<!-- SCREENSHOT:05 -->

You only need the folder chooser when you want to change the selected folder or when you opened Manuscript Compiler without using **Compile manuscript from this folder** in the File Explorer right-click menu.

![The manuscript folder chooser filtered to Warden of Silence](docs/images/05-folder-chooser.png)

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

![The Detected structure menu showing every available manuscript structure preset](docs/images/06-structure-presets.png)

*Choose the preset that most closely matches the book. **Novel with Parts** is selected here before reviewing the detected structure.*

---

## Reviewing Contents

Contents opens as a compact review, not an editing form. Summary cards show detected manuscript counts, and the outline shows included structure. Ignored material and warnings have focused review filters.

<!-- SCREENSHOT:07 -->

![The Contents stage showing detected counts, review controls, and the collapsed manuscript outline](docs/images/07-contents-review.png)

*Review the detected counts, ignored items, warnings, and manuscript outline before continuing or choosing **Correct structure**.*

---

### Understanding ignored notes

Ignored notes are not deleted or changed. They are excluded from the prepared Book because their folder or content resembles project material, dashboards, notes, revisions, research, templates, or old exports. Review the ignored filter when a manuscript note is missing. If detection is wrong, use correction mode to include it and assign the appropriate role.

### Correcting structure

Choose **Correct structure** to reveal inclusion toggles, type selectors, disclosure controls, and Move up/down actions. The button changes to **Finish correcting structure** while correction mode is active.

Available roles are Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude. Correct a folder role before correcting many descendants; front/back matter inheritance updates untouched children while preserving explicit overrides.

Keyboard users can Tab to controls, use Space/Enter on buttons and toggles, and use the format radio group's arrow keys later on Create file. Focus remains visible.

<!-- SCREENSHOT:08 -->

![Correction mode showing inclusion checkboxes, folder disclosure, role selectors, and ordering controls](docs/images/08-correct-structure.png)

*In correction mode, use the checkboxes, role selectors, disclosure controls, and arrows to change inclusion, structure, and order.*

---

<!-- SCREENSHOT:09 -->

![Correction mode with one chapter expanded into scenes and neighbouring chapters collapsed](docs/images/09-collapsed-structure.png)

*Collapse large branches to simplify structure review. Descendant inclusion, roles, and ordering remain saved while a branch is collapsed.*

---

<!-- SCREENSHOT:10 -->

![The Ignored project notes review showing excluded items and their reasons](docs/images/10-ignored-project-notes.png)

*Open **Ignored project notes** to review excluded material and the reason each item was left out of the prepared book.*

---

<!-- SCREENSHOT:11 -->

![The Warnings review showing affected chapters and author-facing explanations](docs/images/11-warnings-review.png)

*Open **Warnings** to review structural concerns and their explanations before continuing to Create file.*

---

When finished, choose **Finish correcting structure** and continue to Create file. The prepared preview is invalidated whenever inclusion, roles, order, cleaning inputs, or semantic formatting changes.

## Create file

Create file shows the prepared Book summary, six format cards, relevant formatting controls, warnings, resolved filename, and the primary create/download action. Switching only the format or filename reuses the same prepared Book. A source-note or semantic-choice change requires **Refresh preview**.

<!-- SCREENSHOT:12 -->

![The Create file stage showing the prepared book summary and all six export formats](docs/images/12-create-file-overview.png)

*Create file keeps the prepared book summary visible while you choose DOCX, ODT, EPUB, HTML, Markdown, or XML. DOCX is selected here.*

---

### Format selector

Click a card or focus the selected card and use Left/Right or Up/Down arrows. Home selects DOCX and End selects XML. Changing formats corrects the filename extension automatically.

<!-- SCREENSHOT:13 -->

![DOCX selected with document style, indentation, scene break, title page, table of contents, and chapter controls](docs/images/13-docx-format.png)

*Selecting DOCX reveals its document formatting controls and changes the primary action to **Create and download DOCX**.*

---

<!-- SCREENSHOT:14 -->

![ODT selected with document style, indentation, scene break, title page, table of contents, and chapter controls](docs/images/14-odt-format.png)

*Selecting ODT reveals its OpenDocument formatting controls and changes the primary action to **Create and download ODT**.*

---

<!-- SCREENSHOT:15 -->

![EPUB selected with reflowable ebook, indentation, scene break, title page, table of contents, and advanced formatting controls](docs/images/15-epub-format.png)

*Selecting EPUB reveals its reflowable-ebook controls and changes the primary action to **Create and download EPUB**.*

---

<!-- SCREENSHOT:16 -->

![HTML selected with web-readable, indentation, scene break, title page, table of contents, and advanced formatting controls](docs/images/16-html-format.png)

*Selecting HTML reveals its web-readable formatting controls for a standalone webpage.*

---

<!-- SCREENSHOT:17 -->

![Markdown selected with plain-text structure, indentation guidance, scene break, title page, and advanced content options](docs/images/17-markdown-format.png)

*Markdown preserves portable plain-text structure, emphasis, and links, but does not support portable first-line indentation.*

---

<!-- SCREENSHOT:18 -->

![XML selected with structured manuscript guidance and advanced content options](docs/images/18-xml-format.png)

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

![The Standard manuscript formatting preset with indentation, scene break, title page, table of contents, chapter start, and advanced formatting controls](docs/images/19-standard-formatting.png)

*The Standard manuscript preset shows the ordinary document controls available before opening **Advanced formatting**.*

---

<!-- SCREENSHOT:20 -->

![Paragraph indentation enabled with the first-line indent size menu open](docs/images/20-paragraph-indentation.png)

*When paragraph indentation is enabled, choose **None**, **0.75 cm**, or **1.27 cm**. Disabling indentation hides this size control.*

---

### Scene breaks

Choose `#`, `*`, `***`, `* * *`, a styled blank line, or Custom. Scene separators appear only between included Scenes. The first prose after a scene separator uses First Paragraph styling and stays unindented.

<!-- SCREENSHOT:21 -->

![The Scene break menu showing hash, asterisk, blank-line, and custom separator choices](docs/images/21-scene-break-options.png)

*Choose `#`, `*`, `***`, `* * *`, a blank line, or a custom separator between included Scenes. `* * *` is selected here.*

---

### Title page, front matter, and back matter

**Add title page** creates a generated title/author section when supported. Front and back matter come from notes assigned those roles; title-page generation does not replace those notes. Matter headings are structural, while matter paragraphs follow the chosen global indentation setting. Disabling indentation is often appropriate for copyright, ISBN, rights, edition, and publisher statements.

<!-- SCREENSHOT:22 -->

![Front matter correction controls with Copyright notices expanded above the manuscript Parts](docs/images/22-front-matter-structure.png)

*Review front-matter inclusion, roles, and order separately from the manuscript Parts. The Copyright notices container is expanded here.*

---

<!-- SCREENSHOT:23 -->

![Back matter correction controls with the Front and back matter container expanded](docs/images/23-back-matter-structure.png)

*Review which notes will follow the manuscript body, including their inclusion, Back matter roles, and order.*

---

### Advanced formatting

Advanced formatting contains title/author overrides, typography where meaningful, page size for document formats, custom scene separators, structural heading display, manuscript body-heading choices, and filename templates. Use `{BookTitle}` in a filename template to insert the resolved title.

<!-- SCREENSHOT:24 -->

![Advanced formatting with book and author overrides, font, font size, and line spacing](docs/images/24a-advanced-formatting-typography.png)

*Advanced formatting begins with book and author overrides plus typography controls.*

![Advanced formatting with page size, custom scene break, structural heading styles, manuscript body headings, and filename template](docs/images/24b-advanced-formatting-structure.png)

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

![The macOS save prompt for a Warden of Silence DOCX export](docs/images/25-download-save-prompt.png)

*The completed DOCX is handed to macOS, where you confirm the filename and choose the external save destination.*

---

<!-- SCREENSHOT:26 -->

![A compiled Warden of Silence chapter open in Microsoft Word with named manuscript styles visible](docs/images/26-docx-in-word.png)

*The generated DOCX opens in Microsoft Word with separate chapter number and title formatting, manuscript body text, a scene break, and named styles available in the Styles gallery.*

---

<!-- SCREENSHOT:27 -->

![The compiled Warden of Silence DOCX imported into Vellum with its book hierarchy and chapter preview visible](docs/images/27-docx-in-vellum.png)

*Vellum recognises the imported Part and Chapter hierarchy, displays the selected chapter once in the manuscript pane, and renders its corresponding print preview.*

---

<!-- SCREENSHOT:28 -->

![A compiled Warden of Silence ODT chapter open in LibreOffice Writer](docs/images/28-odt-in-libreoffice.png)

*LibreOffice Writer renders the generated ODT with distinct chapter number and title formatting, manuscript body text, and a centred scene separator.*

---

<!-- SCREENSHOT:29 -->

![The Warden of Silence EPUB open in a reader with its contents navigation and chapter text visible](docs/images/29-epub-reader.png)

*The generated EPUB provides navigable front matter and Chapters alongside a reflowable reading view with a distinct Chapter heading and scene separator.*

---

<!-- SCREENSHOT:30 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #30
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Open the generated HTML file locally in a browser and capture a representative Part or Chapter section.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>A visibly bold Part or Chapter heading</li>
<li>A flush-left first paragraph</li>
<li>An indented later paragraph</li>
<li>A normal-weight scene separator</li>
<li>The local-file location and, where practical, developer tools showing no network requests</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Demonstrates the self-contained offline HTML presentation and its manuscript-specific structural styling.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

---

<!-- SCREENSHOT:31 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #31
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Open the exported Markdown in Obsidian and capture Source view beside Reading view for the same manuscript passage.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>A Part heading and Chapter heading with clean `#` syntax in Source view</li>
<li>The same headings rendered in Reading view</li>
<li>Two ordinary paragraphs without leading spaces or tabs</li>
<li>Bold, italics, a readable link, and a scene separator</li>
<li>No redundant `**` around heading text</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Explains the difference between clean Markdown source and its rendered presentation inside Obsidian.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

---

<!-- SCREENSHOT:32 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #32
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Open the generated XML in an XML-aware editor or viewer and expand representative semantic elements.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>The manuscript metadata element</li>
<li>Expanded frontMatter and backMatter elements</li>
<li>One Part, one Chapter, and one Scene</li>
<li>Paragraph and inline emphasis or link elements</li>
<li>No style attributes, CSS, vault paths, YAML, or presentation markup</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Shows XML as deterministic semantic interchange whose visual presentation is controlled by the consuming application.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

---

<!-- SCREENSHOT:33 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #33
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Capture Manuscript Compiler's successful completion state immediately after the host accepts a generated download.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>The completed export format</li>
<li>The portable filename</li>
<li>Successful validation and download-dispatch status</li>
<li>The available next action</li>
<li>No private filesystem path or Blob URL</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Shows the truthful terminal state recorded after validated bytes have been handed to the browser or operating system.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

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

<!-- SCREENSHOT:34 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #34
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Create a safe sample where one Scene is inside an ignored Research folder and capture a two-panel before-and-after correction example.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>The Scene missing from the normal outline and represented in Ignored review</li>
<li>The Research ancestor folder and its inherited exclusion</li>
<li>Correction mode with the folder included and assigned Transparent container</li>
<li>The child note included and assigned Scene</li>
<li>Safe sample filenames that clearly show the ancestor/child relationship</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Teaches how to recover a manuscript note whose ancestor folder caused it to be ignored without hard-coding a special project layout.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

---

<!-- SCREENSHOT:35 -->

<p style="color:#cc0000; font-size:1.5em; font-weight:bold; margin-bottom:0;">
📸 SCREENSHOT REQUIRED — #35
</p>

<p style="color:#cc0000; font-weight:bold;">
CAPTURE
</p>

<p style="color:#cc0000;">
Prepare a safe sample, edit one included note after preparation, attempt export, and capture the resulting stale-preview state.
</p>

<p style="color:#cc0000; font-weight:bold;">
SHOW
</p>

<ul style="color:#cc0000;">
<li>The stale-preview warning in full</li>
<li>The “Refresh preview” action</li>
<li>The create/download action blocked or unavailable</li>
<li>Enough Create file context to show which prepared manuscript became stale</li>
<li>No private manuscript prose from the edited note</li>
</ul>

<p style="color:#cc0000; font-weight:bold;">
PURPOSE
</p>

<p style="color:#cc0000;">
Shows that source changes invalidate the reviewed preparation and that the plugin requires an explicit refresh instead of silently rebuilding before export.
</p>

<p style="color:#cc0000; font-weight:bold;">
WHEN REPLACING
</p>

<p style="color:#cc0000;">
Delete this entire placeholder and replace it with the final screenshot and caption.
</p>

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
