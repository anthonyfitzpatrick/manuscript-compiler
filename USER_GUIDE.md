# Manuscript Compiler User Guide

## What Manuscript Compiler does

Manuscript Compiler turns an author-reviewed set of Markdown notes into DOCX, ODT, EPUB, HTML, Markdown, or XML. It runs locally in Obsidian, does not change your manuscript notes, and does not write generated files into the vault.

The workspace has three stages:

1. **Manuscript** — select the complete book folder and confirm its broad structure.
2. **Contents** — review inclusion, roles, and order.
3. **Create file** — prepare one output format and start the host download or share flow.

## Getting started

Install and enable Manuscript Compiler from [Obsidian Community Plugins](https://community.obsidian.md/plugins/manuscript-compiler). For a manual install, place the matching `main.js`, `manifest.json`, and `styles.css` release files directly in `<vault>/.obsidian/plugins/manuscript-compiler/`, then reload Obsidian and enable the plugin.

The recommended starting point is the complete book root:

1. Open File Explorer and locate the folder containing the complete book.
2. Right-click that book folder.
3. Choose **Compile manuscript from this folder**.

Manuscript Compiler opens with that folder as the manuscript root. Do not start from an individual Chapter or Scene: it can compile only material inside the folder you select, so a Chapter or Scene selection would omit the rest of the book.

You can also open **Compile manuscript** from the command palette, or choose **Open compiler** in the Manuscript Compiler settings. These routes open the compiler without an already-selected book folder, so choose the complete book root on the Manuscript stage.

> **Screenshot 1 — Start from a book folder**
>
> **Where:** File Explorer, with a neutral/sample complete book folder right-clicked.
>
> **Show:** Enough of the folder hierarchy to make the selected folder clearly the book root, plus the open context menu with **Compile manuscript from this folder** fully visible. Do not include private manuscript prose, personal vault names, or unrelated panes.
>
> **Purpose:** Shows that compilation begins from the complete book folder, not an individual Chapter or Scene.

<p align="center">
  <img src="docs/images/01-start-from-book-folder.png" alt="Obsidian File Explorer with a book folder selected and the Compile manuscript from this folder context-menu command visible" width="429">
</p>

## Manuscript structure

The compiler recognises **Front matter**, **Part**, **Chapter**, **Scene**, and **Back matter**. It also recognises **Transparent container** folders: these organise notes in the vault but do not create headings in the generated manuscript. Typical project folders such as Research, Development, Archive, Dashboards, Templates, and Exports are excluded by default and remain reviewable on Contents.

Choose the structure preset that most closely matches the manuscript. Presets guide initial detection; the choices you make on Contents are authoritative.

- **Novel with Parts** — Parts contain Chapters, which contain Scenes.
- **Novel without Parts** — Chapters contain Scenes; no Parts are required.
- **Chapter Notes** — each Chapter is a note.
- **Short Story** — manuscript notes without a Part/Chapter hierarchy.
- **Anthology** — a multi-work collection.
- **Custom** — an established non-standard layout.

For files structurally designated as **Scene**, the Scene title is structural information rather than manuscript body text. A leading Scene heading is not emitted in the compiled manuscript. Later headings authored in the Scene body remain part of the manuscript.

> **Screenshot 2 — Manuscript stage**
>
> **Where:** Open a neutral sample book in the **Manuscript** stage immediately after detection.
>
> **Show:** The **Manuscript** stage selected, the book title and selected book folder, the **Detected structure** control with its active preset, the note/ignored-note scan summary, and **Review Structure**. Include enough of the workspace to identify Manuscript Compiler, but avoid private paths or manuscript prose.
>
> **Purpose:** Shows what Manuscript Compiler detected and what the user should verify before proceeding to **Contents**.

<p align="center">
  <img src="docs/images/02-manuscript-stage.png" alt="Manuscript Compiler Manuscript stage showing a selected book folder, detected structure, scan summary, and Review Structure button" width="100%">
</p>

## Review Contents

Use Contents to confirm that the expected Parts, Chapters, Scenes, front matter, and back matter are included and in the right order. Read the summary, expand representative branches, and inspect transparent containers, ignored project notes, and current structure warnings before continuing. Transparent containers organise notes without producing a heading of their own in the compiled manuscript.

Choose **Correct structure** to edit inclusion, role, and order. The available roles are Front matter, Transparent container, Part, Chapter, Scene, Back matter, and Exclude. Use **Finish correcting structure** when you are done. These choices affect only the compilation; they never rename, move, or rewrite the source notes.

> **Screenshot 3 — Contents review**
>
> **Where:** Open a neutral sample book in **Contents** before activating **Correct structure**.
>
> **Show:** **Contents** selected; the included-note, Part, Chapter, Scene, Front Matter, Back Matter, and Ignored summary; **Correct structure**; **Ignored project notes** with **Review**; a representative hierarchy including a Transparent container and Parts; genuine warning labels where present; **Back** and **Continue**. Do not use the correction-mode screen or include private prose.
>
> **Purpose:** Shows the normal review state and what to verify— inclusion, detected structure, transparent containers, ignored project notes, and genuine current warnings—before changing anything.

<p align="center">
  <img src="docs/images/03-contents-review.png" alt="Manuscript Compiler Contents stage showing the normal review state, summary, Correct structure button, ignored project notes, and manuscript hierarchy" width="100%">
</p>

> **Screenshot 4 — Correct structure**
>
> **Where:** On **Contents**, after selecting **Correct structure** for a neutral sample manuscript.
>
> **Show:** An expanded Part and Chapter with Scene rows; inclusion checkboxes, disclosure controls, role selectors showing Part, Chapter, and Scene, Move up/down controls, and **Back** and **Continue**. Do not show private manuscript prose.
>
> **Purpose:** Shows how to change inclusion, role, and order without renaming, moving, rewriting, or otherwise modifying source notes.

<p align="center">
  <img src="docs/images/04-correct-structure.png" alt="Manuscript Compiler Contents correction mode showing inclusion checkboxes, role selectors, and ordering controls" width="100%">
</p>

## Saved Compilations

A **Saved Compilation** stores a reusable setup for a manuscript: its selected root, reviewed Contents choices, output choices, and formatting. It does not store a copy of the manuscript prose and does not create an output file.

There are two different kinds of saving in Manuscript Compiler:

- **Save changes** saves the current Saved Compilation configuration for later reuse.
- **Create and download** creates the selected manuscript file and starts the host download/share flow. It does not save a configuration unless you explicitly choose a save option when prompted.

### Create a Saved Compilation

Start a **New compilation**, choose the manuscript folder, and review Contents. Select **Save as…**, enter a name in the **Save compilation** dialog, and choose **Save**. The current workspace becomes that Saved Compilation; the prepared manuscript does not need to be rebuilt solely because it was saved.

Use **Save changes** when a Saved Compilation has unsaved setup edits. This updates that same Saved Compilation. The button is disabled when there is nothing new to save.

Use **Save as…** to create a separate Saved Compilation from the current choices. It does not overwrite the current Saved Compilation.

### Open a Saved Compilation

To access saved setups:

1. Open Obsidian **Settings** and select Manuscript Compiler.
2. Under **Saved compilations**, select **Manage saved compilations…**.

>
> **Screenshot 5 — Manage Saved Compilations from Settings**
>
> **Where:** Open Obsidian **Settings**, then open the Manuscript Compiler plugin settings.
>
> **Show:** The **Saved compilations** section and **Manage saved compilations…** button. Keep **Open compiler** visible to establish the plugin settings page; the defaults may remain visible but do not need separate explanation.
>
> **Purpose:** Shows where to access Saved Compilations. This control manages reusable compilation setups, not generated manuscript files.

<p align="center">
  <img src="docs/images/05-manage-saved-compilations-settings.png" alt="Manuscript Compiler plugin settings showing the Saved compilations section and Manage saved compilations button" width="100%">
</p>

3. Find the setup you want to use and select **Open**.
4. Manuscript Compiler opens the Saved Compilation and restores its saved configuration.

The manager lists each setup’s name, manuscript folder, vault-relative location, and selected output format. Use the search field to narrow the list.

> **Screenshot 6 — Saved Compilations manager**
>
> **Where:** Open **Manage saved compilations…** from the Manuscript Compiler settings.
>
> **Show:** The **Saved compilations** title, search field, one neutral Saved Compilation with its manuscript root, vault-relative location, and output format, plus **Open** and **Delete**.
>
> **Purpose:** Shows where to search, inspect, open, or delete a reusable Saved Compilation setup.

<p align="center">
  <img src="docs/images/06-saved-compilations-manager.png" alt="Saved Compilations manager showing a search field, saved setup details, and Open and Delete actions" width="100%">
</p>

Select **Open** to load the chosen setup back into Manuscript Compiler. **Delete** opens a confirmation and removes only the stored Saved Compilation setup; it does not delete manuscript notes, the book folder, source Markdown, or previously generated files.

> **Screenshot 7 — Opened Saved Compilation**
>
> **Where:** Select **Open** for a Saved Compilation in the manager.
>
> **Show:** The saved compilation name and **Saved compilation** label at the top, **Save changes**, **Save as…**, **Switch…**, and **Manage…**, the three workflow stages, the restored book folder, detected structure, and **Review Structure**.
>
> **Purpose:** Confirms that the Saved Compilation has reopened and its reusable configuration is ready to review, adjust, or continue through **Contents** and **Create file**.

<p align="center">
  <img src="docs/images/07-opened-saved-compilation.png" alt="Opened Saved Compilation in Manuscript Compiler showing its name, saved configuration controls, restored folder, and detected structure" width="100%">
</p>

### Open, switch, and manage Saved Compilations

Use **Switch…** to move between **New compilation** and Saved Compilations for the current manuscript folder. If the current setup has unsaved changes, choose **Cancel** to stay where you are or **Discard and switch** to leave those setup edits behind.

Use **Manage…** to work with Saved Compilations for the current manuscript folder:

- **Rename** changes only the display name.
- **Duplicate** makes another saved setup without switching to it.
- **Delete** removes only the saved setup. It never deletes manuscript notes or previously generated files.

If a Saved Compilation’s folder has moved, use **Locate manuscript…** to select its new folder, then choose **Save changes** to retain that association.

### Include or exclude a new Scene

When a new Scene appears in **Contents**, use its inclusion checkbox to decide whether it participates in the compilation. The Scene remains structurally identified as **Scene** either way.

1. Open the Saved Compilation and go to **Contents**.
2. Select **Correct structure**.
3. Locate the Scene in the hierarchy.
4. Select its inclusion checkbox to include it; clear the checkbox to exclude it.
5. Select **Finish correcting structure** when you are done.
6. Select **Save changes** to retain the revised inclusion choice in the Saved Compilation.

Excluding a Scene affects only the compilation setup. It does not delete, rename, move, or rewrite the Scene note, and it remains in the vault.

> **Screenshot 8 — Include or exclude a new Scene**
>
> **Where:** Open a Saved Compilation in **Contents**, then select **Correct structure**.
>
> **Show:** A Transparent container, Part, and Chapter with Scene rows. Keep the additional Scene visible with its role set to **Scene**, its inclusion checkbox cleared, and the role and ordering controls, **Back**, and **Continue** in view.
>
> **Purpose:** Shows that a Scene can remain structurally identified while being excluded from the compiled manuscript through its inclusion checkbox.

<p align="center">
  <img src="docs/images/08-include-or-exclude-new-scene.png" alt="Contents correction mode showing a Scene with its inclusion checkbox cleared while its role remains Scene" width="100%">
</p>

In this example, the additional Scene remains a Scene in the structure, but its cleared checkbox keeps it out of the compiled manuscript.

## Create the manuscript file

On **Create file**, confirm the **Book summary**, choose an **Export format**, and review the available **Formatting** options. The stage confirms that your Markdown notes will not be changed: creating an export writes a separate output file and never rewrites the manuscript source.

The six formats are **DOCX** (Microsoft Word document), **ODT** (OpenDocument Text), **EPUB** (Ebook), **HTML** (Standalone webpage), **Markdown** (Portable plain-text manuscript), and **XML** (Structured manuscript). The available formatting controls depend on the selected format. For example, DOCX and ODT offer **Document style**; DOCX, ODT, EPUB, and HTML offer paragraph indentation; and title-page, table-of-contents, scene-break, and chapter-page controls appear where that format supports them.

> **Screenshot 9 — Create file and choose a format**
>
> **Where:** Open **Create file** with a prepared sample manuscript.
>
> **Show:** The **Book summary**, the six format cards—DOCX, ODT, EPUB, HTML, Markdown, and XML—DOCX selected, the beginning of **Formatting**, and the footer’s **Create and download DOCX** button. Do not start creation.
>
> **Purpose:** Shows where to confirm the prepared manuscript, choose an export format, review formatting, and begin output creation.

<p align="center">
  <img src="docs/images/09-create-file-and-choose-format.png" alt="Create file stage showing a book summary, six export formats, formatting controls, and the Create and download DOCX button" width="100%">
</p>

### Create and save the output file

Choose **Create and download _format_** to create one file. The button changes with the selected format, for example **Create and download DOCX** or **Create and download EPUB**. The **Filename** field lower on the Create file page supplies a suggested output name; it is safely normalised and its extension is corrected when the selected format changes or the file is created.

After Manuscript Compiler generates and validates the file, the host starts its system save, download, or share flow. When a system save dialog appears, choose the filename and destination, then select **Save**. On macOS, this looks like the dialog below; its appearance varies by operating system and host.

> **Screenshot 10 — Choose where to save the generated file**
>
> **Where:** After selecting **Create and download DOCX** (or the chosen format), when the host presents a system save dialog.
>
> **Show:** The suggested filename, destination control, **Cancel**, and **Save**. Use a neutral filename and location where possible.
>
> **Purpose:** Shows that **Save** writes the generated manuscript to the selected location, while **Cancel** dismisses that host save operation without a confirmed output file.

<p align="center">
  <img src="docs/images/10-choose-save-output-location.png" alt="macOS system save dialog showing filename, Downloads destination, Cancel, and Save" width="347">
</p>

The plugin cannot inspect the final filesystem location. Depending on the operating system and host settings, the host may instead save to a configured Downloads location or offer sharing. No generated file is written into the vault. If you cancel or dismiss the host flow, no completed output file is confirmed; the **Create file** workspace remains open, and the cancellation makes no further change to the Saved Compilation configuration.

### Save the configuration before creating

**Save changes**, **Save as…**, and **Save** in the system dialog are different actions. **Save changes** updates the current Saved Compilation configuration; **Save as…** creates another Saved Compilation configuration; **Save** in the system dialog saves the generated manuscript output file.

- From a New compilation, Manuscript Compiler asks whether to **Create without saving** or **Save and create**. The latter first opens the naming dialog for a new Saved Compilation, then creates the file.
- From a Saved Compilation with unsaved setup edits, it asks whether to **Create without saving** or **Save changes and create**.
- From a clean Saved Compilation, creation starts directly.
- Choosing **Cancel** in this decision dialog does not save the configuration and does not create a file.

> **Screenshot 11 — Save setup before creating**
>
> **Where:** From a New compilation on **Create file**, select **Create and download DOCX** (or the chosen format).
>
> **Show:** The **Save compilation?** dialog with **Cancel**, **Create without saving**, and **Save and create**. Do not use an operating-system file dialog.
>
> **Purpose:** Shows that this prompt concerns the Saved Compilation configuration, not the generated file’s destination.

> **Screenshot 12 — Creation complete**
>
> **Where:** Return to the still-open **Create file** workspace after a successful sample export.
>
> **Show:** The selected format, the **Create and download** button available for another export, and any unobtrusive success notice if it remains visible. Do not show personal download paths.
>
> **Purpose:** Shows that one prepared compilation can create more than one format.

## Output formats

- **DOCX** — native Word document for editing, submissions, and Vellum-oriented workflows.
- **ODT** — native OpenDocument Text file for LibreOffice and compatible editors.
- **EPUB** — reflowable EPUB 3 ebook for reader testing.
- **HTML** — self-contained offline browser document.
- **Markdown** — portable, readable manuscript Markdown.
- **XML** — semantic manuscript XML for interchange and automation.

### Formatting options

The visible controls depend on the selected format. DOCX and ODT offer **Document style** presets: Vellum, Standard manuscript, and Custom. DOCX, ODT, EPUB, and HTML support first-line indentation; the first paragraph after a heading or scene break remains flush left. Markdown does not have portable first-line indentation, and XML leaves presentation to its consumer.

The main controls include **Scene break**, **Add title page**, **Add table of contents** where supported, and **Start chapters on a new page** for DOCX and ODT. Open **Advanced formatting**—or **Advanced content options** for Markdown and XML—for title/author overrides, available typography controls, Part and Chapter heading styles, and the filename template. XML also offers **Include title page document**.

> **Screenshot 13 — Advanced formatting**
>
> **Where:** Select DOCX or ODT on **Create file**, then expand **Advanced formatting**.
>
> **Show:** The book-title and author overrides, font controls, page size, Part/Chapter heading styles, and filename template. Use neutral example values and leave source prose out of frame.
>
> **Purpose:** Shows which less-common controls are available without implying they apply to every format.

## Troubleshooting

### A note is missing or has the wrong role

Return to **Contents**, inspect **Ignored project notes**, then use **Correct structure** to include the note and set its role. Confirm its parent folders are not excluded.

### Create asks for a refresh

The manuscript notes or a setting that affects the prepared result changed after preparation. Select **Refresh preview** on Create file, review the result, then create the file again.

### The download does not start

Check whether the host blocked the download or share action, then try again. The plugin does not have a vault or desktop-filesystem fallback. Verify the final file in the location chosen by the host.

### A Scene title appears unexpectedly

Confirm that the file is assigned the **Scene** role on Contents. A structural Scene title is omitted only for structural Scene files; headings written later in the Scene body are retained intentionally.

## Known limitations

- Complex tables, embedded media, and advanced Markdown layouts are outside the manuscript model.
- Save and share behavior varies by operating system and host.
- Validate generated files in the application that will consume them, especially EPUB readers and publishing tools.
- Unusual vault layouts may need manual correction on Contents.

For installation, release, and interoperability details, see the [README](README.md), [Security Policy](SECURITY.md), and [Manual Release Checklist](MANUAL_TESTING.md).
