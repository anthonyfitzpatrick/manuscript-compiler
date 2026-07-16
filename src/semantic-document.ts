/**
 * Manuscript Compiler — shared export-oriented semantic projection.
 *
 * Converts the prepared Book into ordered sections/blocks that distinguish
 * structural headings, first/later paragraphs, scene breaks, and inline emphasis.
 * Called once by ExportCoordinator and consumed by all exporters/validators. It
 * does not own scanning, parsing, cleaning, ordering, delivery, or the Book model.
 * Invariants: preserve Book order/content, never invent zero headings, reset first
 * paragraphs after headings/breaks, and retain presentation neutrality. Functions
 * are pure, deterministic, non-cancellable, and platform-independent; changes are
 * cross-format and require complete exporter regression coverage.
 */
import type { Book, ManuscriptDocument } from "./model";
import type { CompileProfile } from "./settings";
import type { ExportFormattingOptions } from "./export-types";
import { structuralLines } from "./docx";

export interface SemanticInline { text: string; bold?: boolean; italic?: boolean; href?: string; }
export type SemanticBlock =
  | { kind: "heading"; style: "title" | "author" | "front-matter" | "back-matter" | "part-number" | "part-title" | "chapter-number" | "chapter-title" | "body-heading"; inlines: SemanticInline[]; pageBreakBefore?: boolean; pageBreakAfter?: boolean }
  | { kind: "paragraph"; inlines: SemanticInline[]; first: boolean }
  | { kind: "scene-break"; text: string }
  | { kind: "page-break" };
export interface SemanticSection { id: string; kind: "title" | "front-matter" | "part" | "chapter" | "body" | "back-matter"; title: string; number?: number; parentId?: string; blocks: SemanticBlock[]; }
export interface SemanticDocument { title: string; author: string; language: string; wordCount: number; sections: SemanticSection[]; }

/**
 * Projects one prepared Book into the shared exporter block model.
 * @param book Exact semantic Book retained by PreparedCompileSession.
 * @param profile Resolved structural/matter choices.
 * @param options Shared presentation options.
 * @param wordCount Prepared semantic word count.
 * @returns A new deterministic projection; `book` is never mutated.
 */
export function createSemanticDocument(book: Book, profile: CompileProfile, options: ExportFormattingOptions, wordCount: number): SemanticDocument {
  const sections: SemanticSection[] = []; let id = 0; const next = (kind: SemanticSection["kind"], title: string, number?: number): SemanticSection => ({ id: `section-${++id}`, kind, title, number, blocks: [] });
  if (options.titlePage) { const section = next("title", options.title); section.blocks.push(heading("title", options.title), { ...heading("author", options.author), pageBreakAfter: true }); sections.push(section); }
  if (profile.includeFrontMatter) for (const item of included(book.frontMatter.documents)) { const section = next("front-matter", item.title); section.blocks.push(heading("front-matter", item.title, true), ...bodyBlocks(item.content)); sections.push(section); }
  for (const part of book.parts) {
    let partId: string | undefined;
    if (profile.useParts && !part.synthetic) { const section = next("part", part.name || part.title, part.number); partId = section.id; const [number, title] = structuralLines("Part", part, profile.partDisplay ?? "word-title", profile.partHeadingTemplate); if (number) section.blocks.push(heading("part-number", number, true)); if (title) section.blocks.push(heading("part-title", title)); sections.push(section); }
    const orphanSection = next("body", part.name || part.title); orphanSection.parentId = partId; addSceneSection(sections, orphanSection, included(part.orphanScenes), profile, options);
    for (const chapter of part.chapters) { const section = next("chapter", chapter.name || chapter.title, chapter.number); section.parentId = partId; const [number, title] = structuralLines("Chapter", chapter, profile.chapterDisplay ?? "word-title", profile.chapterHeadingTemplate); if (number) section.blocks.push(heading("chapter-number", number, options.chapterPageBreak)); if (title) section.blocks.push(heading("chapter-title", title, !number && options.chapterPageBreak)); addScenes(section.blocks, included(chapter.scenes), profile, options.sceneSeparator); sections.push(section); }
  }
  addSceneSection(sections, next("body", book.title), included(book.orphanScenes), profile, options);
  if (profile.includeBackMatter) for (const item of included(book.backMatter.documents)) { const section = next("back-matter", item.title); section.blocks.push(heading("back-matter", item.title, true), ...bodyBlocks(item.content)); sections.push(section); }
  return { title: options.title || book.title, author: options.author, language: options.language || "en", wordCount, sections };
}

function addSceneSection(output: SemanticSection[], section: SemanticSection, scenes: ManuscriptDocument[], profile: CompileProfile, options: ExportFormattingOptions): void { if (!scenes.length) return; addScenes(section.blocks, scenes, profile, options.sceneSeparator); output.push(section); }
function addScenes(blocks: SemanticBlock[], scenes: ManuscriptDocument[], profile: CompileProfile, separator: string): void { scenes.forEach((scene, index) => { if (index) blocks.push({ kind: "scene-break", text: separator }); if (profile.includeSceneTitles) blocks.push(heading("body-heading", scene.title)); blocks.push(...bodyBlocks(scene.content)); }); }
function included(items: ManuscriptDocument[]): ManuscriptDocument[] { return items.filter((item) => !item.excluded && Boolean(item.content.trim())); }
function heading(style: Extract<SemanticBlock, { kind: "heading" }>["style"], value: string, pageBreakBefore = false): Extract<SemanticBlock, { kind: "heading" }> { return { kind: "heading", style, inlines: [{ text: value }], pageBreakBefore }; }

/**
 * Converts already-cleaned document Markdown into paragraph/body-heading/break blocks.
 * First-paragraph state resets after body headings and scene breaks. Pure and
 * deterministic; this is inline presentation parsing, not manuscript detection.
 */
export function bodyBlocks(markdown: string): SemanticBlock[] {
  const output: SemanticBlock[] = []; let lines: string[] = []; let first = true;
  const flush = (): void => { const value = lines.join(" ").trim(); lines = []; if (value) { output.push({ kind: "paragraph", inlines: inlineMarkdown(value), first }); first = false; } };
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) { const line = raw.trim(); if (!line) { flush(); continue; } if (/^(?:---+|\*\s*\*\s*\*|#)$/.test(line)) { flush(); output.push({ kind: "scene-break", text: "* * *" }); first = true; continue; } const match = /^#{1,6}\s+(.+)$/.exec(line); if (match) { flush(); output.push(heading("body-heading", match[1])); first = true; continue; } lines.push(line.replace(/^>\s?/, "").replace(/^[-*+]\s+/, "• ")); } flush(); return output;
}

/** Extracts supported emphasis, code text, and readable links without retaining link targets in plain output. */
export function inlineMarkdown(value: string): SemanticInline[] {
  const output: SemanticInline[] = []; const pattern = /(\*\*\*|___)(.+?)\1|(\*\*|__)(.+?)\3|(^|[^*])\*([^*]+?)\*|_([^_]+?)_|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g; let offset = 0; let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) { if (match.index > offset) output.push({ text: value.slice(offset, match.index) }); if (match[2]) output.push({ text: match[2], bold: true, italic: true }); else if (match[4]) output.push({ text: match[4], bold: true }); else if (match[6]) { if (match[5]) output.push({ text: match[5] }); output.push({ text: match[6], italic: true }); } else if (match[7]) output.push({ text: match[7], italic: true }); else if (match[8]) output.push({ text: match[8], href: match[9] }); else output.push({ text: match[10] ?? "" }); offset = match.index + match[0].length; } if (offset < value.length) output.push({ text: value.slice(offset) }); return output.length ? output : [{ text: value }];
}
/** Returns presentation-free visible text for validation; performs no unescaping or mutation. */
export function plainText(block: SemanticBlock): string { return "inlines" in block ? block.inlines.map((item) => item.text).join("") : block.kind === "scene-break" ? block.text : ""; }
