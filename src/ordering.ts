import type { Chapter, ManuscriptDocument, Part } from "./model";
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export function extractNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/\d+(?:\.\d+)?/); if (match) return Number(match[0]);
  const words = value.toLowerCase().match(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g); if (!words?.length) return undefined;
  const values: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }; return words.slice(0, 2).reduce((total, word) => total + values[word], 0);
}
export function titleName(title: string): string { const typed = title.match(/^(?:part|chapter|scene)\b/i); if (!typed) return title.trim(); let remainder = title.slice(typed[0].length).trim(); remainder = remainder.replace(/^\d+(?:\.\d+)?[\s:._—-]*/i, ""); remainder = remainder.replace(/^(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?)[\s:._—-]*/i, ""); return remainder.trim(); }
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
