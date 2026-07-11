import type { Chapter, ManuscriptDocument, Part } from "./model";
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\d+(?:\.\d+)?/); return match ? Number(match[0]) : undefined;
}
export function titleName(title: string): string { return title.replace(/^(?:part|chapter|scene)\s*\d+[\s:._-]*/i, "").trim() || title; }
function compareValues(aOrder: number | undefined, aNumber: number | undefined, aName: string, bOrder: number | undefined, bNumber: number | undefined, bName: string, metadataOrdering: boolean): number {
  if (metadataOrdering && aOrder !== bOrder) { if (aOrder === undefined) return 1; if (bOrder === undefined) return -1; return aOrder - bOrder; }
  if (aNumber !== bNumber) { if (aNumber === undefined) return 1; if (bNumber === undefined) return -1; return aNumber - bNumber; }
  return collator.compare(aName, bName);
}
export function sortDocuments(documents: ManuscriptDocument[], metadataOrdering: boolean): void {
  documents.sort((a, b) => compareValues(a.metadata.order ?? extractNumber(a.metadata.scene), a.number, a.file.name, b.metadata.order ?? extractNumber(b.metadata.scene), b.number, b.file.name, metadataOrdering));
}
export function sortChapters(chapters: Chapter[], metadataOrdering: boolean): void { chapters.sort((a, b) => compareValues(a.order, a.number, a.title, b.order, b.number, b.title, metadataOrdering)); chapters.forEach((chapter) => sortDocuments(chapter.scenes, metadataOrdering)); }
export function sortParts(parts: Part[], metadataOrdering: boolean): void { parts.sort((a, b) => compareValues(a.order, a.number, a.title, b.order, b.number, b.title, metadataOrdering)); parts.forEach((part) => { sortDocuments(part.orphanScenes, metadataOrdering); sortChapters(part.chapters, metadataOrdering); }); }
