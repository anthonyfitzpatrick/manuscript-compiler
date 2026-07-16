# Manuscript Compiler 0.9.3 Manual Release Checklist <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

All items are intentionally unchecked. Record date, tester, Obsidian version, operating system, and application versions. Automated tests do not complete these gates.

## Installation and workflow

- [ ] Install only `main.js`, `manifest.json`, and `styles.css` in a clean Obsidian vault.
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
