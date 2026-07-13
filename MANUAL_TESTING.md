# Manuscript Compiler 0.9.1 Manual Test Checklist

Record the Obsidian version, operating system, Word/LibreOffice version, Vellum version, date, and tester before beginning. Do not mark this checklist complete from automated test output.

## Live Obsidian workflow

- [ ] Enable the locally built plugin in a test vault.
- [ ] Open **Compile Manuscript** from the command palette.
- [ ] Select a real book root that contains front matter, a `Manuscript` container, Parts, Chapters, Scenes, back matter, and project folders.
- [ ] Confirm the selected book root does not appear as a Part or Chapter.
- [ ] Confirm Archive, Development, Exports, Research, dashboard, and revision material are visibly excluded with reasons.
- [ ] Change a folder to **Transparent container** and confirm its children remain in the outline without a container heading.
- [ ] Confirm detected Parts and Chapters, including multi-digit and zero-padded numbers.
- [ ] Explicitly exclude a dashboard note and confirm it remains excluded after moving backwards and forwards.
- [ ] Inspect and reorder individual front- and back-matter notes.
- [ ] Review the Export outline, excluded-material list, warnings, and output filename.
- [ ] Select **Create DOCX** and confirm only one creation action is required, apart from an overwrite confirmation when applicable.
- [ ] Confirm the DOCX is saved to the selected vault export folder.
- [ ] Overwrite an existing DOCX and confirm the replacement opens correctly.
- [ ] Cancel before **Finalising file…** and confirm the existing destination is unchanged.
- [ ] Using a controlled test adapter or permission failure, force a save failure and confirm the original DOCX survives.
- [ ] Inspect the export folder after success and cancellation; confirm no Manuscript Compiler temporary files remain.
- [ ] Confirm uncertain recovery backup files are preserved rather than removed automatically.
- [ ] Test **Save to vault** on a desktop filesystem vault and, separately, on a mobile/non-filesystem vault where available.
- [ ] Confirm Open, Reveal, and Save Copy result actions appear only after a fully successful save.
- [ ] Use **Save a copy to computer** or the platform-equivalent save/share action.
- [ ] Use **Open DOCX** where supported.
- [ ] Use **Reveal in file manager** where supported.

## Word or LibreOffice inspection

- [ ] Open the generated DOCX in Microsoft Word or LibreOffice.
- [ ] Confirm title and author are on the title page and no Chapter 0 appears.
- [ ] Confirm front matter precedes the manuscript and back matter follows it.
- [ ] Confirm Parts and Chapters start on new pages with separate clean number/title paragraphs.
- [ ] Confirm First Paragraph is unindented and later Body Text paragraphs use the selected indent.
- [ ] Confirm scene breaks are centred and do not force a new page.
- [ ] Confirm bold, italics, smart quotes, em/en dashes, accented characters, and Unicode display correctly.
- [ ] Search for Archive, Development, Exports, Dashboard, Revision Notes, Synopsis, Series, Book, Part, Chapter, Characters, and Editing Status metadata leaks.
- [ ] Confirm no dashboard links, revision comments, property tables, headers, footers, page numbers, or unexpected table of contents appear.

## Vellum import

- [ ] Import the DOCX into Vellum.
- [ ] Confirm Vellum recognises Parts and Chapters as book structure.
- [ ] Confirm Part and Chapter titles appear once and in the intended order.
- [ ] Confirm scene breaks and first paragraphs import cleanly.
- [ ] Confirm front and back matter appear in the intended locations.
- [ ] Confirm no authoring metadata, project folders, dashboard notes, synopsis, or revision notes appear.

## Result record

- Live Obsidian workflow completed: [ ] Yes [ ] No
- Word/LibreOffice inspection completed: [ ] Yes [ ] No
- Vellum import completed: [ ] Yes [ ] No
- Issues found:
- Evidence or screenshots:
