# Manuscript Compiler 0.9.2 Manual Release Checklist

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

## ODT

- [ ] Open ODT in LibreOffice and inspect styles, page starts, title/matter order, paragraphs, emphasis, Unicode, and scene breaks.
- [ ] Confirm A4/Letter and Standard Manuscript formatting behave as selected.

## PDF

- [ ] Open PDF in at least two independent viewers.
- [ ] Confirm page size, wrapping, page flow, Parts/Chapters, matter, and scene breaks.
- [ ] In each viewer, render, select, copy, and search `Östersund`, `Å Ä Ö å ä ö`, curly quotes, en/em dashes, `Café, naïve, façade, déjà vu`, and `© ® ™ € £ ¥`.
- [ ] Confirm unsupported characters use the documented `?` fallback and produce one informational item, not mojibake or repeated warnings.
- [ ] Confirm parentheses, backslashes, long wrapped paragraphs, and page breaks do not corrupt surrounding text.
- [ ] Confirm no blank, duplicated, substituted, or missing glyphs within the documented WinAnsi character coverage.
- [ ] Confirm A4 uses 2.54 cm margins and body lines use the full text measure without a narrow right-side void.
- [ ] Confirm only the first line of later body paragraphs is indented; continuation lines return to the left margin, while first prose after Chapter headings and scene breaks is unindented.
- [ ] Inspect Part/Chapter number-title spacing, heading-to-prose spacing, centred scene breaks, continuation pages, and bottom-margin clearance.

## EPUB

- [ ] Open EPUB in at least two EPUB 3 readers.
- [ ] Confirm navigation, spine order, title/matter/Part/Chapter order, reflow, emphasis, Unicode, and scene breaks.
- [ ] Run EPUBCheck separately if available and record its version/results; it is not a runtime requirement.

## HTML and XML

- [ ] Open HTML offline in multiple browsers; confirm embedded styling, navigation, structure, Unicode, and no network requests.
- [ ] Open XML in at least two XML-aware tools and inspect namespace, schema version, hierarchy, emphasis, escaping, and deterministic ordering.
- [ ] Confirm XML contains no vault paths, YAML, settings, profile IDs, or diagnostics.

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
