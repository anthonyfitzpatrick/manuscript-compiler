# Manuscript Compiler 0.9.2 Manual Release Checklist

Record the date, tester, Obsidian version, operating system, Word/LibreOffice version, and Vellum version. Automated tests do not complete any item below.

## Clean install

- [ ] Install only `main.js`, `manifest.json`, and `styles.css` in `.obsidian/plugins/manuscript-compiler/`.
- [ ] Enable Manuscript Compiler without enabling another community plugin.
- [ ] Confirm first-run behaviour is understandable and does not require Pandoc or an external executable.
- [ ] Open **Manuscript Compiler: Compile Manuscript** from the command palette.
- [ ] Open the compiler from **Open Manuscript Compiler** in plugin settings.

## Real manuscript

- [ ] Select the actual book folder, not its `Manuscript` child.
- [ ] Confirm the selected root is not displayed as a Part or Chapter.
- [ ] Confirm `Manuscript` is suggested as a Transparent container and creates no heading.
- [ ] Confirm Archive, Development, and Exports are visibly excluded with reasons.
- [ ] Confirm dashboard and revision notes are visibly excluded.
- [ ] Inspect and reorder individual front- and back-matter notes.
- [ ] Change one folder or note role manually and confirm the outline updates.
- [ ] Reorder two Scenes and confirm the order survives moving between steps.
- [ ] Exclude and re-enable a parent folder; confirm prior child choices are preserved.
- [ ] Confirm no Part 0 or Chapter 0 is shown.

## Final preview

- [ ] Confirm the Export step shows the final semantic outline, counts, word count, exclusions, warnings, filename, and vault destination.
- [ ] Compare Part, Chapter, and Scene counts with the Contents step.
- [ ] Edit an included source note after preview preparation.
- [ ] Confirm **Create DOCX** is blocked and the workspace remains open with **Refresh Preview**.
- [ ] Refresh and confirm the updated source appears in the preview.

## Vellum DOCX

- [ ] Select Vellum and create a DOCX.
- [ ] Inspect title-page enabled and disabled behaviour.
- [ ] Confirm every Part begins on a new page without an unintended blank page.
- [ ] Confirm Chapters begin on new pages with separate Chapter Number and Chapter Title styles.
- [ ] Confirm scene breaks occur only between included Scenes.
- [ ] Confirm the first paragraph after a Chapter or scene break is unindented and later Body Text is indented.
- [ ] Search for YAML, Series/Book/Part/Chapter/Scene metadata, Dashboard, Synopsis, Revision Notes, Archive, Development, and Exports.
- [ ] Import the DOCX into Vellum on macOS.
- [ ] Confirm Vellum recognises Parts and Chapters and does not duplicate their titles.

## Standard Manuscript

- [ ] Select Standard Manuscript and confirm Times New Roman 12 pt.
- [ ] Confirm double spacing and a 0.5-inch first-line indent on Body Text.
- [ ] Confirm First Paragraph remains unindented.
- [ ] Confirm Chapters start on new pages.

## Custom formatting

- [ ] Disable Chapter page breaks and confirm Chapters continue without forced page changes.
- [ ] Compare Letter and A4 page sizes.
- [ ] Change font, font size, line spacing, and first-line indent and inspect each result.
- [ ] Test title page on and off.
- [ ] Enable the TOC, update fields in Word/LibreOffice, and confirm it populates.
- [ ] Test centred `* * *`, blank scene spacing, and a compatible-profile custom/Unicode separator.
- [ ] Confirm bold, italics, combined emphasis, links, smart quotes, dashes, accented characters, and non-Latin Unicode survive.
- [ ] Confirm callout markers/titles become plain text while their body remains readable.

## Saving and recovery

- [ ] Save a new DOCX destination in the vault.
- [ ] Overwrite an existing DOCX and confirm the replacement is valid.
- [ ] Cancel before **Finalising file…** and confirm the previous destination is unchanged.
- [ ] Force a controlled save failure and confirm the previous file is restored or recovery guidance identifies the preserved backup.
- [ ] Confirm no recognised temporary files remain after success or cancellation.
- [ ] Use **Save a copy to computer** or the platform-equivalent save/share action.
- [ ] Use **Open DOCX** where supported.
- [ ] Use **Reveal in file manager** where supported.
- [ ] Confirm result actions appear only after successful final verification.

## Platforms and applications

- [ ] Obsidian Desktop on macOS.
- [ ] Obsidian Desktop on Windows, when available.
- [ ] Obsidian Desktop on Linux, when available.
- [ ] Obsidian Mobile, when available.
- [ ] Microsoft Word or LibreOffice visual page inspection.
- [ ] Vellum import on macOS.

## Result record

- Clean install completed: [ ] Yes [ ] No
- Real manuscript and preview completed: [ ] Yes [ ] No
- Vellum DOCX completed: [ ] Yes [ ] No
- Standard and Custom DOCX completed: [ ] Yes [ ] No
- Saving/recovery completed: [ ] Yes [ ] No
- Platforms tested:
- Issues found:
- Evidence or screenshots:
