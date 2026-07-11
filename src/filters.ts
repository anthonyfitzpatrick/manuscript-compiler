import type { CleaningSettings } from "./settings";
export type ContentFilter = (markdown: string) => string;
export class ContentCleaningPipeline {
  clean(markdown: string, settings: CleaningSettings): string {
    const filters: ContentFilter[] = [];
    if (settings.stripYamlFrontmatter) filters.push(stripYamlFrontmatter);
    if (settings.removeObsidianComments) filters.push(removeObsidianComments);
    if (settings.removeHtmlComments) filters.push(removeHtmlComments);
    if (settings.removeDataviewBlocks) filters.push(removeDataviewBlocks);
    if (settings.removeCallouts) filters.push(removeCallouts);
    if (settings.stripInternalLinks) filters.push(stripInternalLinks);
    return filters.reduce((content, filter) => filter(content), markdown);
  }
}
export function stripYamlFrontmatter(markdown: string): string { return markdown.replace(/^\uFEFF/, "").replace(/^---[\t ]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/, ""); }
export function removeObsidianComments(markdown: string): string { return markdown.replace(/%%[\s\S]*?%%/g, ""); }
export function removeHtmlComments(markdown: string): string { return markdown.replace(/<!--[\s\S]*?-->/g, ""); }
export function removeDataviewBlocks(markdown: string): string { return markdown.replace(/```(?:dataview|dataviewjs)\b[^\n]*\n[\s\S]*?```[\t ]*(?:\r?\n)?/gi, ""); }
export function removeCallouts(markdown: string): string {
  const output: string[] = []; let inCallout = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*>\s*\[![^\]]+\][+-]?/i.test(line)) { inCallout = true; continue; }
    if (inCallout && /^\s*>/.test(line)) { output.push(line.replace(/^\s*>\s?/, "")); continue; }
    inCallout = false; output.push(line);
  }
  return output.join("\n");
}
export function stripInternalLinks(markdown: string): string { return markdown.replace(/!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target: string, alias?: string) => alias ?? target.split("/").pop() ?? target); }
