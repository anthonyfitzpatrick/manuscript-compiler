# Manuscript Compiler User Guide

## Introduction

Manuscript Compiler turns an author-reviewed set of Markdown notes into DOCX, ODT, EPUB, HTML, Markdown, or XML. It runs inside Obsidian, works offline, and never changes manuscript notes. Exported files are created in memory and handed to the operating system's download or share flow; manuscript exports are not written into the vault.

The workflow has three stages:

1. **Manuscript** — choose the exact book folder and its broad structure.
2. **Contents** — review what will be included and correct roles or order when necessary.
3. **Create file** — choose a format, formatting, filename, and start the download.

<!-- SCREENSHOT:01 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #01
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture Obsidian Settings → Community plugins after Manuscript Compiler has been installed and enabled.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Manuscript Compiler plugin name

• The enabled toggle in its active state

• The installed plugin version

• Enough of the Community plugins screen to establish location, with unrelated personal plugin names cropped out

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Confirms that the plugin is installed and enabled and that no companion plugin is required.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

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
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #02
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture the File Explorer context menu immediately after right-clicking the exact folder that represents one book.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The selected book folder visible behind the menu

• The “Compile manuscript from this folder” command in full

• Enough of the expanded folder tree to show that a folder, not an individual note, was selected

• No unrelated private vault or project names

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Teaches the preferred folder-first workflow and shows that the clicked folder becomes the authoritative manuscript root.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

You can also open Manuscript Compiler from the command palette or plugin settings. When those routes do not already identify a folder, choose one on the Manuscript screen.

<!-- SCREENSHOT:03 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #03
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open Obsidian's command palette, search for Manuscript Compiler, and capture the available plugin command before executing it.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The command palette search field

• A search term that clearly narrows the results to Manuscript Compiler

• The full command name used to open the workflow

• The highlighted command ready for keyboard or mouse activation

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows the alternative command-palette entry point when the author does not begin from a File Explorer folder.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

## The Manuscript screen

Confirm the selected folder and choose the structure preset closest to the project. The preset controls initial detection only; Contents corrections remain authoritative.

<!-- SCREENSHOT:04 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #04
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture the initial Manuscript screen after opening the workflow, before changing any detected choices.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The complete “Manuscript → Contents → Create file” stage indicator

• The manuscript-folder area

• The structure-preset selector

• The scan or folder summary area

• The Continue button and visible keyboard-focus treatment where practical

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Introduces the first workflow stage and identifies the choices that establish the manuscript root and initial structural interpretation.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:05 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #05
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open Manuscript Compiler from the command palette, invoke the folder chooser, select a safe sample book folder, and capture the selected result on the Manuscript screen.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The selected book folder name and safe vault-relative context

• A sample tree containing front matter, a transparent Manuscript folder, a Part, a Chapter, Scenes, back matter, and one project folder

• The control used to change the selected folder

• No private vault names or unrelated personal folders

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Demonstrates how authors who start outside File Explorer choose the exact folder that represents one book.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Structure presets

- **Novel with Parts** — Part folders contain Chapter folders, which contain Scene notes.
- **Novel** — Chapter folders contain Scene notes; no Parts are required.
- **Chapter notes** — each Chapter is a note rather than a folder of Scenes.
- **Short story** — one or more manuscript notes without a Part/Chapter hierarchy.
- **Anthology** — collections and story notes are treated as a multi-work structure.
- **Custom** — retains advanced profile rules and is intended for established non-standard layouts.

Choose the nearest preset and correct exceptions on Contents. Renaming the vault is not required merely to satisfy a preset.

<!-- SCREENSHOT:06 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #06
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select “Novel with Parts” for a safe sample manuscript and capture the Manuscript screen after automatic detection has completed.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• “Novel with Parts” visibly selected

• The selected manuscript folder

• The detected structural summary or scan counts

• Front matter, Parts, Chapters, Scenes, back matter, and ignored project material represented in the sample

• The enabled Continue action

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows how a structure preset produces the initial automatic classification before the author reviews or corrects it.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

## Reviewing Contents

Contents opens as a compact review, not an editing form. Summary cards show detected manuscript counts, and the outline shows included structure. Ignored material and warnings have focused review filters.

<!-- SCREENSHOT:07 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #07
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture the Contents screen in normal review mode immediately after the sample manuscript has been scanned.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• All summary cards and their detected counts

• The primary “Correct structure” button and supporting text

• Front matter, one Part, one Chapter, and multiple Scenes in the outline

• The Ignored and Warnings review controls in their secondary state

• Enough of the page to show that correction controls are not yet expanded

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows the automatically detected manuscript structure before any manual correction and explains the normal Contents review state.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Understanding ignored notes

Ignored notes are not deleted or changed. They are excluded from the prepared Book because their folder or content resembles project material, dashboards, notes, revisions, research, templates, or old exports. Review the ignored filter when a manuscript note is missing. If detection is wrong, use correction mode to include it and assign the appropriate role.

### Correcting structure

Choose **Correct structure** to reveal inclusion toggles, type selectors, disclosure controls, and Move up/down actions. The button changes to **Finish correcting structure** while correction mode is active.

Available roles are Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude. Correct a folder role before correcting many descendants; front/back matter inheritance updates untouched children while preserving explicit overrides.

Keyboard users can Tab to controls, use Space/Enter on buttons and toggles, and use the format radio group's arrow keys later on Create file. Focus remains visible.

<!-- SCREENSHOT:08 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #08
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Activate Correct structure, expand one representative manuscript folder, and capture the Contents screen while correction mode is active.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The active “Finish correcting structure” button

• An inclusion toggle

• A note or folder type selector

• Folder disclosure controls

• Move up and Move down controls

• Ordinary review controls remaining visually secondary

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains the active correction state and the controls used to change inclusion, semantic roles, and order.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:09 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #09
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Collapse a folder in correction mode and capture the resulting row without changing the folder's saved descendant choices.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The collapsed-folder disclosure icon

• The folder name or safe sample name

• Its child-item count

• The folder's inclusion and type controls

• A nearby expanded folder for visual comparison

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows how large manuscript trees can be collapsed for easier review without clearing descendant roles or order.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:10 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #10
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Return to normal review mode, select the Ignored review, and capture a safe sample containing grouped project notes.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Ignored review selected

• A collapsed Development or Research folder

• The ignored item count and exclusion reason

• At least one included manuscript item for contrast

• No private note titles or project names

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains that ignored notes remain unchanged and reviewable while project material is excluded from the prepared Book.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:11 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #11
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select the Warnings review for a safe sample containing at least one non-blocking structural warning.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Warnings review selected

• The warning summary count

• A stable warning category and concise author-facing explanation

• The related structural row where available

• No manuscript prose, YAML values, or absolute vault paths

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows where authors review structural concerns before preparing the final export without exposing manuscript content in diagnostics.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

When finished, choose **Finish correcting structure** and continue to Create file. The prepared preview is invalidated whenever inclusion, roles, order, cleaning inputs, or semantic formatting changes.

## Create file

Create file shows the prepared Book summary, six format cards, relevant formatting controls, warnings, resolved filename, and the primary create/download action. Switching only the format or filename reuses the same prepared Book. A source-note or semantic-choice change requires **Refresh preview**.

<!-- SCREENSHOT:12 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #12
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture the format-selection area at the top of Create file before opening Advanced formatting.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• All six format cards: DOCX, ODT, EPUB, HTML, Markdown, and XML

• One clearly selected card

• The selected card's visible focus or selection treatment

• The prepared Book summary above the selector

• The filename extension corresponding to the selected format

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Introduces the six export choices and shows that changing format updates the filename while retaining the same prepared Book.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Format selector

Click a card or focus the selected card and use Left/Right or Up/Down arrows. Home selects DOCX and End selects XML. Changing formats corrects the filename extension automatically.

<!-- SCREENSHOT:13 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #13
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select DOCX on Create file and capture the selected card together with the controls and action that change for DOCX.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The DOCX card in its obvious selected state

• The “Editable word-processing document” description

• The resolved filename ending in `.docx`

• The “Create and download DOCX” primary button

• The beginning of the DOCX formatting controls

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows how the selected format controls the filename, available formatting options, and final download action.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:14 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #14
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select ODT on Create file and capture the selected card together with the ODT filename and primary action.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The ODT card in its obvious selected state

• The format description

• The resolved filename ending in `.odt`

• The “Create and download ODT” primary button

• First-line indentation controls available for ODT

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Identifies ODT as the editable OpenDocument choice and demonstrates its format-specific selection state.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:15 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #15
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select EPUB on Create file and capture the selected card together with its reflowable-book controls and action.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The EPUB card in its obvious selected state

• The reflowable ebook description

• The resolved filename ending in `.epub`

• The “Create and download EPUB” primary button

• The title-page and table-of-contents choices where visible

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows the EPUB choice and the controls relevant to a reflowable ebook package.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:16 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #16
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select HTML on Create file using keyboard navigation and capture the selected card with a visible focus ring.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The HTML card selected

• A visible keyboard focus ring distinct from the selected state

• The web-readable format description

• The resolved filename ending in `.html`

• The “Create and download HTML” primary button

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Demonstrates HTML selection, automatic extension changes, and keyboard-accessible format navigation.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:17 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #17
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select Markdown on Create file and capture its selected card and portability guidance.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Markdown card in its obvious selected state

• The “Portable plain-text manuscript” description

• The note that Markdown does not support portable first-line indentation

• The resolved filename ending in `.md`

• The “Create and download Markdown” primary button

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains Markdown's portable plain-text role and why print-specific indentation controls are absent.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:18 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #18
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select XML on Create file and capture its selected card and presentation-neutral guidance.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The XML card in its obvious selected state

• The structured interchange description

• The note that paragraph indentation is controlled by the consuming application

• The resolved filename ending in `.xml`

• The “Create and download XML” primary button

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains XML's semantic interchange role and why it has no presentation or typography controls.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

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
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #19
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Select DOCX and capture the complete standard Formatting section before expanding Advanced formatting.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Document style preset selector

• Font, size, and line-spacing controls where displayed

• The paragraph-indentation control group

• The Scene break selector

• Title-page and chapter-page-start choices

• The collapsed Advanced formatting control

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Provides an overview of the ordinary format-specific controls authors use most often before creating a file.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:20 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #20
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Create one side-by-side or two-panel image of the DOCX Formatting section with “Indent first line of paragraphs” enabled in one panel and disabled in the other.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The exact “Indent first line of paragraphs” label and explanatory description

• The enabled toggle with “First-line indent (cm)” visible beneath it

• The disabled toggle with the indent-size control absent

• Scene break visible in both panels to show unrelated formatting remains available

• The statement that first paragraphs after headings and scene breaks remain flush left

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains that the toggle affects only later ordinary body paragraphs and demonstrates when the configured indent-size control appears.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Scene breaks

Choose `#`, `*`, `***`, `* * *`, a styled blank line, or Custom. Scene separators appear only between included Scenes. The first prose after a scene separator uses First Paragraph styling and stays unindented.

<!-- SCREENSHOT:21 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #21
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the Scene break selector for a presentation format and capture the available separator choices.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Scene break label

• The `#`, `*`, `***`, and `* * *` choices

• The styled blank-line and Custom choices

• One clearly selected separator

• The custom text field only if Custom is selected

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows how authors choose the visible separator placed between Scenes and reinforces that following prose resets to First Paragraph styling.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Title page, front matter, and back matter

**Add title page** creates a generated title/author section when supported. Front and back matter come from notes assigned those roles; title-page generation does not replace those notes. Matter headings are structural, while matter paragraphs follow the chosen global indentation setting. Disabling indentation is often appropriate for copyright, ISBN, rights, edition, and publisher statements.

<!-- SCREENSHOT:22 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #22
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture Contents for a safe sample with the front-matter branch expanded and correctly classified.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Front matter structural role

• A Copyright note

• A Dedication or Epigraph note

• Inclusion state and ordering

• The boundary between front matter and the first Part or Chapter

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows which notes become front matter and how their order is reviewed independently of the generated title page.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:23 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #23
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture Contents for the same safe sample with the back-matter branch expanded and correctly classified.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Back matter structural role

• An About the Author note

• An Acknowledgements or Also by note

• Inclusion state and ordering

• The boundary after the final manuscript Chapter or Scene

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows which notes are exported after the manuscript body and how their inclusion and order are reviewed.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

### Advanced formatting

Advanced formatting contains title/author overrides, typography where meaningful, page size for document formats, custom scene separators, structural heading display, manuscript body-heading choices, and filename templates. Use `{BookTitle}` in a filename template to insert the resolved title.

<!-- SCREENSHOT:24 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #24
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture the complete Create file screen with DOCX selected and Advanced formatting expanded, using a safe sample title and author.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The prepared Book summary

• The selected DOCX card

• Standard Formatting controls

• Expanded font, size, spacing, page-size, Part-heading, and Chapter-heading controls

• The filename template and resolved `.docx` filename

• The “Create and download DOCX” primary button

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Provides the definitive overview of everything an author reviews on Create file before starting generation and download.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

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
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #25
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Start a DOCX export and capture the operating-system, browser, or mobile-host download prompt before confirming the destination.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The corrected `.docx` filename

• The host-controlled Save, Download, or Share action

• The file type where the host displays it

• Enough surrounding host interface to distinguish it from the plugin

• Personal folder names and account details redacted

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows that Manuscript Compiler hands the completed file to the host and does not write it into the vault or choose the final destination.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:26 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #26
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the generated DOCX in Microsoft Word and capture a representative Chapter page with the Styles pane visible if it does not obscure the manuscript.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• A structural Chapter heading

• A flush-left First Paragraph

• An indented later Body Text paragraph

• A scene separator followed by flush-left prose

• Named paragraph styles in the Styles pane where practical

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Demonstrates the intended DOCX structure and paragraph behavior in Microsoft Word rather than only at package-validation level.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:27 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #27
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Import the same generated DOCX into Vellum and capture the navigator and manuscript pane after import completes.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• Recognised Part structure in the navigator

• Recognised Chapter structure in the navigator

• The corresponding manuscript heading in the reading pane

• No duplicate Part or Chapter headings

• A safe sample title, with the Vellum version recorded for the eventual caption

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows that the DOCX/Vellum workflow preserves manuscript hierarchy and avoids duplicate structural headings.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:28 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #28
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open a generated ODT in LibreOffice Writer and capture a representative Chapter page with the paragraph-style selector visible.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• A bold structural Chapter heading

• A flush-left FirstParagraph

• An indented BodyText paragraph

• A normal-weight scene separator

• The paragraph-style selector identifying structural and body styles

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Demonstrates that ODT's named structural and body paragraph styles render distinctly in LibreOffice Writer.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:29 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #29
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the generated EPUB in a mainstream EPUB 3 reader and capture its navigation pane beside a representative Chapter page.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• Navigation entries for Parts or Chapters

• A visibly bold Chapter heading

• A flush-left first paragraph

• An indented later paragraph

• Reader name and version available for the eventual caption

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows the EPUB navigation and reflowable manuscript presentation in an actual reader application.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:30 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #30
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the generated HTML file locally in a browser and capture a representative Part or Chapter section.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• A visibly bold Part or Chapter heading

• A flush-left first paragraph

• An indented later paragraph

• A normal-weight scene separator

• The local-file location and, where practical, developer tools showing no network requests

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Demonstrates the self-contained offline HTML presentation and its manuscript-specific structural styling.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:31 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #31
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the exported Markdown in Obsidian and capture Source view beside Reading view for the same manuscript passage.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• A Part heading and Chapter heading with clean `#` syntax in Source view

• The same headings rendered in Reading view

• Two ordinary paragraphs without leading spaces or tabs

• Bold, italics, a readable link, and a scene separator

• No redundant `**` around heading text

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Explains the difference between clean Markdown source and its rendered presentation inside Obsidian.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:32 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #32
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Open the generated XML in an XML-aware editor or viewer and expand representative semantic elements.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The manuscript metadata element

• Expanded frontMatter and backMatter elements

• One Part, one Chapter, and one Scene

• Paragraph and inline emphasis or link elements

• No style attributes, CSS, vault paths, YAML, or presentation markup

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows XML as deterministic semantic interchange whose visual presentation is controlled by the consuming application.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:33 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #33
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Capture Manuscript Compiler's successful completion state immediately after the host accepts a generated download.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The completed export format

• The portable filename

• Successful validation and download-dispatch status

• The available next action

• No private filesystem path or Blob URL

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows the truthful terminal state recorded after validated bytes have been handed to the browser or operating system.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

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
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #34
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Create a safe sample where one Scene is inside an ignored Research folder and capture a two-panel before-and-after correction example.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The Scene missing from the normal outline and represented in Ignored review

• The Research ancestor folder and its inherited exclusion

• Correction mode with the folder included and assigned Transparent container

• The child note included and assigned Scene

• Safe sample filenames that clearly show the ancestor/child relationship

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Teaches how to recover a manuscript note whose ancestor folder caused it to be ignored without hard-coding a special project layout.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

<!-- SCREENSHOT:35 -->
<div style="border:3px solid #cc0000; background:#fff5f5; padding:20px; margin:24px 0; color:#cc0000;">

<h2 style="margin-top:0;color:#cc0000;">
📸 SCREENSHOT REQUIRED — #35
</h2>

<p style="color:#cc0000;">

<b>CAPTURE:</b>

Prepare a safe sample, edit one included note after preparation, attempt export, and capture the resulting stale-preview state.

</p>

<p style="color:#cc0000;">

<b>SHOW:</b>

• The stale-preview warning in full

• The “Refresh preview” action

• The create/download action blocked or unavailable

• Enough Create file context to show which prepared manuscript became stale

• No private manuscript prose from the edited note

</p>

<p style="color:#cc0000;">

<b>PURPOSE:</b>

Shows that source changes invalidate the reviewed preparation and that the plugin requires an explicit refresh instead of silently rebuilding before export.

</p>

<p style="color:#cc0000;">

<b>WHEN REPLACING:</b>

Delete this entire block and replace it with the final screenshot and caption.

</p>

</div>

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
