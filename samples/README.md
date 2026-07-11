# Sample Manuscript

`Complete Sample Book` exercises folder classification, metadata ordering and filtering, YAML removal, comments, wikilinks, callouts, Dataview blocks, front/back matter, parts, chapters, scenes, warnings, statistics, Markdown generation, and DOCX preparation.

Point a compile profile's manuscript root at `samples/Complete Sample Book`. The intentionally empty scene and duplicate scene number are useful validation fixtures.

Additional release-candidate fixtures:

- `Small Novel`: chapter folders without Parts; use `Use Parts = off`.
- `Novel with Parts`: a compact Parts/chapters/scenes structure.
- `Short Story`: one chapter stored as a note; use `Chapter source = notes` and `Use Parts = off`.
- `Anthology`: chapter notes inside a Part with author/order metadata.
- `Mixed and Malformed`: orphan notes, unexpected/nested folders, Unicode, word/padded numbers, invalid numeric metadata, and malformed YAML.
- The automated synthetic fixture generates 500 chapters, 2,000 scenes, and 2 million words without committing a multi-megabyte prose file.
