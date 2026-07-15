/**
 * Manuscript Compiler — structural title, number, and ordering rules.
 *
 * Parser and generators share these helpers. Explicit manual content order is
 * applied after automatic comparators. Missing numbers stay undefined; zero is
 * never used as a fallback.
 * Content planning and parsing call these pure deterministic helpers. They own no
 * vault reads, mutation, presentation, error reporting, or cancellation. Unicode
 * and locale-independent fallback behavior must remain stable across platforms;
 * do not silently replace explicit author order with inferred numbering.
 */
import type { Chapter, ManuscriptDocument, Part } from "./model";
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
/** Extracts explicit numeric/English-word structure numbers without inventing 0. */
export function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\d+(?:\.\d+)?/); if (match) return Number(match[0]);
  const words = value.toLowerCase().match(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g); if (!words?.length) return undefined;
  const values: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }; return words.slice(0, 2).reduce((total, word) => total + values[word], 0);
}
/** Separates a clean display name from internal Part/Chapter/Scene prefixes. */
export function titleName(title: string): string {
  let value = title.trim(); const typed = value.match(/^(?:part|chapter|scene)\b/i);
  if (typed) value = value.slice(typed[0].length).trim();
  else value = value.replace(/^\d+(?:\.\d+)?[\s:._—–-]*(?:(?:part|chapter|scene)\b[\s:._—–-]*)?/i, "");
  value = value.replace(/^\d+(?:\.\d+)?[\s:._—–-]*/i, "");
  value = value.replace(/^(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?)[\s:._—–-]*/i, "");
  return value.replace(/^[\s:._—–-]+|[\s:._—–-]+$/g, "").trim();
}

/** Formats supported positive structure numbers for author-facing headings. */
export function numberWord(value: number): string { const ones = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]; const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]; if (!Number.isInteger(value) || value < 0) return String(value); if (value < 20) return ones[value]; if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${ones[value % 10]}` : ""}`; return String(value); }
function compareValues(aOrder: number | undefined, aNumber: number | undefined, aName: string, bOrder: number | undefined, bNumber: number | undefined, bName: string, metadataOrdering: boolean): number {
  if (metadataOrdering && aOrder !== bOrder) { if (aOrder === undefined) return 1; if (bOrder === undefined) return -1; return aOrder - bOrder; }
  if (aNumber !== bNumber) { if (aNumber === undefined) return 1; if (bNumber === undefined) return -1; return aNumber - bNumber; }
  return collator.compare(aName, bName);
}
/** Sorts a mutable document list by metadata (when enabled), number, then title. */
export function sortDocuments(documents: ManuscriptDocument[], metadataOrdering: boolean): void {
  documents.sort((a, b) => compareValues(a.metadata.order ?? extractNumber(a.metadata.scene), a.number, a.file.name, b.metadata.order ?? extractNumber(b.metadata.scene), b.number, b.file.name, metadataOrdering));
}
export function sortChapters(chapters: Chapter[], metadataOrdering: boolean): void { chapters.sort((a, b) => compareValues(a.order, a.number, a.title, b.order, b.number, b.title, metadataOrdering)); chapters.forEach((chapter) => sortDocuments(chapter.scenes, metadataOrdering)); }
export function sortParts(parts: Part[], metadataOrdering: boolean): void { parts.sort((a, b) => compareValues(a.order, a.number, a.title, b.order, b.number, b.title, metadataOrdering)); parts.forEach((part) => { sortDocuments(part.orphanScenes, metadataOrdering); sortChapters(part.chapters, metadataOrdering); }); }
