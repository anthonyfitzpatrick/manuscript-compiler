# Manuscript Compiler Manual Release Checklist <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

All items are intentionally unchecked. Record date, tester, Obsidian version, operating system, and application versions. Automated tests do not complete these gates.

## Installation and workflow

- [ ] Install only `main.js`, `manifest.json`, and `styles.css` in a clean Obsidian vault; confirm the settings page still displays the logo.
- [ ] Upgrade an existing vault from the prior plugin version; confirm profiles, history, and formatting choices survive.
- [ ] Load malformed persisted settings and confirm bounded, actionable recovery.
- [ ] Right-click a folder and confirm the exact root opens in **Manuscript → Contents → Create file**.
- [ ] Confirm the command-palette and settings entry points use the same workspace.
- [ ] Confirm no other community plugin, Pandoc, office suite, or executable is needed.

## Manuscript structure

- [ ] Compile a novel with Parts.
- [ ] Compile a novel without Parts.
- [ ] Review front matter and back matter ordering.
- [ ] Confirm transparent containers do not emit headings.
- [ ] Confirm project notes and ignored folders remain excluded.
- [ ] Exercise Correct structure: include/exclude, role correction, and Move up/down with mouse and keyboard.
- [ ] Confirm ignored-note and warning review filters show only affected items.
- [ ] Exclude and re-enable a folder; verify descendants, roles, choices, and order survive while the branch remains collapsed.
- [ ] Edit an included note after preparation; confirm stale export is rejected until Refresh Preview.
- [ ] Test a very large real manuscript in a narrow desktop pane and mobile-sized workspace.

## Universal delivery

- [ ] Confirm each successful action starts exactly one download/share flow.
- [ ] After each successful export, confirm **Create file** stays open with the prepared Book and current compilation choices intact; adjust a setting, create another file, then use **Save changes** or **Save as…** where applicable.
- [ ] From a New compilation, select **Create file** and verify **Save compilation?** offers Cancel, **Create without saving**, and **Save and create**. Verify Save and create exports after naming without another Create click; Cancel creates nothing.
- [ ] From a dirty Saved Compilation, verify **Save changes?** offers the same safe choices. Verify Save changes and create exports once and clears dirty state; Create without saving exports while the compilation remains dirty. Verify clean Saved Compilations export without a prompt.
- [ ] Cancel or block the host download and confirm the UI remains retryable and truthful.
- [ ] Repeat downloads and confirm no Blob URL or temporary anchor is retained.
- [ ] Confirm no completed export, hidden copy, temporary output, or recovery file appears in the vault.
- [ ] Confirm filenames are corrected when switching formats and reserved/invalid names are repaired.
- [ ] Test download behaviour on Windows.
- [ ] Test download behaviour on macOS.
- [ ] Test download behaviour on Linux.
- [ ] Test download/share behaviour on mobile.

## DOCX

- [ ] Open DOCX in Microsoft Word and inspect title, matter, Parts, Chapters, page starts, First Paragraph, Body Text, and scene breaks.
- [ ] Open DOCX in LibreOffice and inspect the same structure.
- [ ] Import DOCX into Vellum and confirm Parts/Chapters are recognised without duplicate titles.
- [ ] Exercise Vellum, Standard Manuscript, Custom, A4/Letter, title page, TOC, Unicode, and every scene-break choice.
- [ ] Export DOCX with **Indent first line of paragraphs** on and off; confirm later Body Text follows the toggle and configured size while First Paragraph, headings, and scene breaks remain zero-indent or otherwise unchanged.
- [ ] With indentation enabled, confirm the first paragraph after a Chapter heading and after a scene break remains unindented.

## ODT

- [ ] Open ODT in LibreOffice and inspect styles, page starts, title/matter order, paragraphs, emphasis, Unicode, and scene breaks.
- [ ] Confirm title, front/back matter, Part number/title, and Chapter number/title paragraphs are visibly bold; confirm Author, body prose, and scene separators retain their existing normal weight.
- [ ] Confirm A4/Letter and Standard Manuscript formatting behave as selected.
- [ ] Export ODT with **Indent first line of paragraphs** on and off; confirm BodyText changes while FirstParagraph, headings, and scene breaks do not.

## EPUB

- [ ] Open EPUB in at least two EPUB 3 readers.
- [ ] Confirm navigation, spine order, title/matter/Part/Chapter order, reflow, emphasis, Unicode, and scene breaks.
- [ ] Confirm combined and separate Part/Chapter heading modes are visibly bold while body prose and scene separators remain normal weight.
- [ ] Export EPUB with **Indent first line of paragraphs** on and off; confirm later body paragraphs change and first paragraphs after headings and scene breaks remain unindented.
- [ ] Run EPUBCheck separately if available and record its version/results; it is not a runtime requirement.

## Markdown

- [ ] Open Markdown in at least two text editors and confirm title, author, matter, Parts, Chapters, Scenes, emphasis, readable links, Unicode, and scene separators.
- [ ] Inspect both source and rendered views: source must use clean, unescaped `#`/`##` heading syntax without `**`; visible bold is expected only in the rendered view.
- [ ] Confirm there is no YAML, project metadata, dashboard content, Synopsis, Revision Notes, Part 0, or Chapter 0.
- [ ] Confirm paragraph spacing is canonical and the file ends with exactly one newline.
- [ ] Confirm Markdown shows the portability note, offers no indentation toggle or size control, and contains no indentation spaces, tabs, HTML, or CSS workaround.

## HTML and XML

- [ ] Open HTML offline in multiple browsers; confirm combined and separate Part/Chapter headings are visibly bold, body prose and scene separators remain normal weight, and there are no network requests.
- [ ] Export HTML with **Indent first line of paragraphs** on and off; confirm later body paragraphs change and first paragraphs after headings and scene breaks remain unindented.
- [ ] With indentation off, inspect front matter and a copyright page; confirm legal text, ISBN, publisher, edition, and rights paragraphs are unindented while spacing remains readable.
- [ ] Open XML in at least two XML-aware tools and inspect namespace, schema version, hierarchy, emphasis, escaping, and deterministic ordering.
- [ ] Confirm XML Part, Chapter, and heading elements remain semantic and contain no CSS, HTML, Markdown markers, or presentation attributes.
- [ ] Confirm XML contains no vault paths, YAML, settings, profile IDs, or diagnostics.
- [ ] Confirm XML shows the presentation-neutral note, offers no indentation toggle or size control, and contains no indentation preference or presentation attributes.

## Privacy and independence

- [ ] Review successful and failed history/log/diagnostics records for prose, private metadata, absolute paths, usernames, Blob URLs, and external destinations.
- [ ] Observe network activity during preparation and all six exports; confirm no request is made.
- [ ] Confirm no Electron, shell, external executable, or community-plugin API is invoked.

## Result record

- Tester/date:
- Obsidian/platform versions:
- Applications/readers tested:
- Formats passed:
- Issues and reproduction steps:
- Screenshots or evidence:
# Saved compilation UI checks

- In light and dark themes, launch a root with zero saved entries and confirm the normal New workflow opens immediately.
- With one, many, and 50 saved entries, verify the chooser is scrollable, keyboard usable, and New compilation remains reachable.
- Open a saved setup; verify Save changes, Save as…, Switch…, review panels, and textual statuses wrap at narrow widths.
- Test Save As, Save changes, clean reversion, dirty-switch Cancel and Discard, and root recovery through Locate manuscript….
- Test new content acceptance, missing-reference removal, explicit mapping, 50 findings, and keyboard focus after a resolved row disappears.
- Verify Not exported yet, Export up to date, Export out of date, Export not current, and Export status unknown without implying an external file exists.
- Repeat the chooser, Save As, switch confirmation, mapping select, and root picker with keyboard only.
- Open **Manage…** from New and Saved workspaces. Verify root-scoped zero, one, many, and 50-entry lists remain scrollable and that duplicate display names retain exactly one textual **Current** indicator.
- Verify management row order is **Rename**, **Duplicate**, **Delete**. Check keyboard focus after Rename, Duplicate, inactive Delete, Cancel, and Escape; do not allow Escape to confirm Delete.
- Rename active and inactive entries, including long names and duplicate names. Verify rename changes only the display name and does not affect unsaved recipe state or export status.
- Duplicate active and inactive entries. Verify Duplicate copies persisted state, does not switch to the copy, does not capture an active unsaved overlay, and has no inherited export status.
- Delete inactive, current clean, current dirty, missing-root current, and final entries. Confirm the warning says manuscript/exported files are unaffected; verify current deletion becomes New, preserves usable choices, and offers Save as… without a stale Saved status.
- At narrow/mobile widths, verify Rename, Duplicate, and Delete wrap without horizontal scrolling and remain practical touch targets. Confirm light, dark, and high-contrast themes retain visible focus and destructive distinction.
