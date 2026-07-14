/** Minimal semantic Book factory shared by DOCX validator/writer tests. */
import type { Book, ManuscriptDocument } from "../src/model";
import { createManuscriptDocx } from "../src/docx";
import { createDefaultProfiles } from "../src/profiles";

export function createTestDocx(content: string, title = "Test Book"): Uint8Array {
  const document = {
    file: { name: "Scene 1.md", basename: "Scene 1", path: "Book/Chapter 1/Scene 1.md" },
    title: "Scene 1",
    number: 1,
    metadata: { values: {} },
    content,
    excluded: false
  } as ManuscriptDocument;
  const book = {
    root: { name: title, path: "Book" }, title,
    frontMatter: { kind: "front", title: "Front Matter", documents: [] },
    parts: [{ title: "Book", name: title, path: "Book", synthetic: true, chapters: [{ title: "Chapter 1", name: "", number: 1, path: "Book/Chapter 1", scenes: [document], orphan: false }], orphanScenes: [] }],
    orphanScenes: [], backMatter: { kind: "back", title: "Back Matter", documents: [] },
    includedFiles: [document.file], excludedFiles: [], warnings: []
  } as Book;
  const profile = createDefaultProfiles()[0];
  profile.useParts = false;
  return createManuscriptDocx(book, profile, { title, author: "Author", chapterPageBreak: true });
}
