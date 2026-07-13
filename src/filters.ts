/**
 * Manuscript Compiler — content cleaning pipeline.
 *
 * Converts authoring-oriented Markdown into publishable manuscript Markdown.
 * Parser and content-plan classification call this pure module. Metadata is
 * removed only in structured boundary regions or known property forms so prose
 * beginning with words such as “Book” or “Chapter” is preserved.
 */
import type { CleaningSettings } from "./settings";
export type ContentFilter = (markdown: string) => string;
/** Stateless configured cleaner; `clean` is deterministic and cancellable upstream. */
export class ContentCleaningPipeline {
  clean(markdown: string, settings: CleaningSettings): string {
    const filters: ContentFilter[] = [];
    if (settings.stripYamlFrontmatter) filters.push(stripYamlFrontmatter);
    if (settings.removeObsidianComments) filters.push(removeObsidianComments);
    if (settings.removeHtmlComments) filters.push(removeHtmlComments);
    if (settings.removeDataviewBlocks) filters.push(removeDataviewBlocks);
    if (settings.removeCallouts) filters.push(convertCalloutsToPlainText);
    if (settings.stripInternalLinks) filters.push(stripInternalLinks);
    return cleanManuscriptContent(filters.reduce((content, filter) => filter(content), markdown), settings.bodySectionAliases);
  }
}
const DEFAULT_BODY_ALIASES = ["Scene", "Manuscript", "Text", "Draft", "Body"];
const AUTHORING_SECTIONS = new Set(["revision notes", "editing notes", "author notes", "scene notes", "development notes", "comments", "synopsis"]);
const METADATA_FIELDS = new Set(["series", "book", "book number", "part", "part number", "chapter", "chapter number", "scene", "scene number", "point of view", "pov", "characters", "locations", "plotlines", "editing status", "editing stage", "status", "stage", "importance", "date", "start time", "end time"]);

/** Performs mandatory body extraction and structured metadata/author-note removal. */
export function cleanManuscriptContent(markdown: string, bodyAliases: string[] = DEFAULT_BODY_ALIASES): string {
  const withoutYaml = stripYamlFrontmatter(markdown); const section = extractBodySection(withoutYaml, bodyAliases); const withoutSections = section.found ? section.content : removeAuthoringSections(section.content);
  return removeProjectMetadataRegions(withoutSections).replace(/^\s+|\s+$/g, "");
}

/** Selects one configured body section through its next peer/ancestor heading. */
export function extractBodySection(markdown: string, aliases: string[] = DEFAULT_BODY_ALIASES): { content: string; found: boolean } {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); const allowed = new Set(aliases.map(normalizeLabel)); let start = -1; let level = 0;
  for (let index = 0; index < lines.length; index += 1) { const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]); if (heading && allowed.has(normalizeLabel(heading[2]))) { start = index + 1; level = heading[1].length; break; } }
  if (start < 0) return { content: markdown, found: false }; let end = lines.length;
  for (let index = start; index < lines.length; index += 1) { const heading = /^(#{1,6})\s+/.exec(lines[index]); if (heading && heading[1].length <= level) { end = index; break; } }
  return { content: lines.slice(start, end).join("\n"), found: true };
}

/** Omits template sections such as Synopsis and Revision Notes from whole notes. */
export function removeAuthoringSections(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); const output: string[] = []; let skippingLevel = 0;
  for (const line of lines) { const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line); if (heading) { const level = heading[1].length; if (skippingLevel && level <= skippingLevel) skippingLevel = 0; if (AUTHORING_SECTIONS.has(normalizeLabel(heading[2]))) { skippingLevel = level; continue; } } if (!skippingLevel) output.push(line); }
  return output.join("\n");
}

/** Removes recognised property lines/tables only at structured note boundaries. */
export function removeProjectMetadataRegions(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n"); let first = 0; let last = lines.length - 1;
  while (first <= last && !lines[first].trim()) first += 1; while (last >= first && !lines[last].trim()) last -= 1;
  while (first <= last) { const consumed = metadataBlockLength(lines, first, 1); if (!consumed) break; first += consumed; while (first <= last && !lines[first].trim()) first += 1; }
  while (last >= first) { const consumed = metadataBlockLength(lines, last, -1); if (!consumed) break; last -= consumed; while (last >= first && !lines[last].trim()) last -= 1; }
  return lines.slice(first, last + 1).join("\n");
}
/** Flags suspicious structured fields that survived mandatory cleaning. */
export function hasProjectMetadataLeakage(markdown: string): boolean { return markdown.split(/\r?\n/).some(isMetadataLine); }

function metadataBlockLength(lines: string[], index: number, direction: 1 | -1): number {
  const line = lines[index]; if (isMetadataLine(line)) { let count = 1; let cursor = index + direction; while (cursor >= 0 && cursor < lines.length && (isMetadataLine(lines[cursor]) || /^\s+(?:[-*]|\d+[.)])\s+/.test(lines[cursor]) || !lines[cursor].trim())) { count += 1; cursor += direction; } return count; }
  if (/^\s*\|/.test(line)) { let start = index; let end = index; while (start > 0 && /^\s*\|/.test(lines[start - 1])) start -= 1; while (end + 1 < lines.length && /^\s*\|/.test(lines[end + 1])) end += 1; const cells = lines.slice(start, end + 1).join(" ").split("|").map(normalizeLabel); if (cells.some((cell) => METADATA_FIELDS.has(cell))) return direction === 1 ? end - index + 1 : index - start + 1; }
  const definition = normalizeLabel(line); const adjacent = lines[index + direction]; if (METADATA_FIELDS.has(definition) && adjacent !== undefined && /^\s*:\s+/.test(adjacent)) return 2;
  return 0;
}

function isMetadataLine(line: string): boolean { const match = line.match(/^\s*(?:[-*]\s+)?(?:\*\*|__)?([^:*_]+?)(?:\*\*|__)?\s*(?:::|:)\s*(?:.*)$/); return !!match && METADATA_FIELDS.has(normalizeLabel(match[1])); }
function normalizeLabel(value: string): string { return value.replace(/[*_`:[\]]/g, "").replace(/[—–-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
/** Removes one leading YAML document without interpreting its values. */
export function stripYamlFrontmatter(markdown: string): string { return markdown.replace(/^\uFEFF/, "").replace(/^---[\t ]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/, ""); }
export function removeObsidianComments(markdown: string): string { return markdown.replace(/%%[\s\S]*?%%/g, ""); }
export function removeHtmlComments(markdown: string): string { return markdown.replace(/<!--[\s\S]*?-->/g, ""); }
export function removeDataviewBlocks(markdown: string): string { return markdown.replace(/```(?:dataview|dataviewjs)\b[^\n]*\n[\s\S]*?```[\t ]*(?:\r?\n)?/gi, ""); }
/** Removes Obsidian callout markers/titles while preserving readable body text. */
export function convertCalloutsToPlainText(markdown: string): string {
  const output: string[] = []; let inCallout = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*>\s*\[![^\]]+\][+-]?/i.test(line)) { inCallout = true; continue; }
    if (inCallout && /^\s*>/.test(line)) { output.push(line.replace(/^\s*>\s?/, "")); continue; }
    inCallout = false; output.push(line);
  }
  return output.join("\n");
}
/** Retained for source and profile compatibility with pre-0.9.1 integrations. */
export const removeCallouts = convertCalloutsToPlainText;
/** Converts wikilinks/embeds to their readable alias or target label. */
export function stripInternalLinks(markdown: string): string { return markdown.replace(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => alias ?? target.split("/").pop() ?? target); }
