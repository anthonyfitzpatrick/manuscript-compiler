import type { Book, CompileWarning, WarningSeverity } from "./model";
import type { CompileProfile } from "./settings";
import { extractNumber } from "./ordering";
import { normalizeKey } from "./metadata-filter";

export class WarningEngine {
  analyze(book: Book, profile: CompileProfile, outputPath: string): CompileWarning[] {
    const issues: CompileWarning[] = book.warnings.map((message) => ({ severity: this.legacySeverity(message), code: "structure", message }));
    const chapters = book.parts.flatMap((part) => part.chapters);
    const scenes = [...book.orphanScenes, ...book.parts.flatMap((part) => [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)])];
    this.duplicates(chapters.map((chapter) => ({ value: chapter.title, path: chapter.path })), "duplicate-chapter-title", "Duplicate chapter title", issues);
    this.duplicates(scenes.map((scene) => ({ value: scene.title, path: scene.file.path })), "duplicate-scene-title", "Duplicate scene title", issues);
    this.inconsistent(chapters.map((chapter) => chapter.number), "chapter", issues);
    chapters.forEach((chapter) => this.inconsistent(chapter.scenes.filter((scene) => !scene.excluded).map((scene) => extractNumber(scene.metadata.scene) ?? scene.number), `scene in “${chapter.title}”`, issues));
    book.parts.filter((part) => part.chapters.length === 0 && part.orphanScenes.length === 0).forEach((part) => issues.push(this.warning("empty-part", `Empty part: “${part.title}”.`, part.path)));
    book.parts.filter((part) => { const content = [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)]; return content.length > 0 && content.every((scene) => scene.excluded || !scene.content.trim()); }).forEach((part) => issues.push(this.warning("empty-part-content", `Part has no included content: “${part.title}”.`, part.path)));
    chapters.filter((chapter) => chapter.scenes.length === 0).forEach((chapter) => issues.push(this.warning("chapter-without-scenes", `Chapter without scenes: “${chapter.title}”.`, chapter.path)));
    chapters.filter((chapter) => chapter.scenes.length > 0 && chapter.scenes.every((scene) => scene.excluded || !scene.content.trim())).forEach((chapter) => issues.push(this.warning("empty-chapter", `Chapter has no included content: “${chapter.title}”.`, chapter.path)));
    if (book.frontMatter.documents.length === 0) issues.push(this.info("missing-front-matter", "No front matter was detected."));
    if (book.backMatter.documents.length === 0) issues.push(this.info("missing-back-matter", "No back matter was detected."));
    if (outputPath === book.root.path || outputPath.startsWith(`${book.root.path}/`)) issues.push({ severity: "error", code: "output-inside-root", message: "The output file is inside the manuscript folder and may be compiled on a later run.", path: outputPath });
    if (!profile.name.trim()) issues.push({ severity: "error", code: "invalid-profile", message: "The active profile has no name." });
    if (!profile.outputFilename.trim()) issues.push({ severity: "error", code: "invalid-output", message: "The active profile has no output filename." });
    if (!profile.partHeadingTemplate.trim() || !profile.chapterHeadingTemplate.trim()) issues.push(this.warning("invalid-template", "A heading template is empty; folder titles will be used."));
    profile.metadataFilters.forEach((rule) => { if (!rule.field.trim() || !rule.value.trim() || !["equals", "not-equals"].includes(rule.operator)) issues.push({ severity: "error", code: "invalid-filter", message: "A metadata filter has an invalid operator or an empty field/value." }); });
    scenes.filter((scene) => !scene.excluded && Object.keys(scene.metadata.values).length === 0).forEach((scene) => issues.push(this.info("missing-metadata", `Scene has no YAML metadata: “${scene.file.path}”.`, scene.file.path)));
    const usedMetadata = new Set(["part", "chapter", "scene", "order", "editingstatus", ...profile.metadataFilters.map((rule) => normalizeKey(rule.field))]);
    scenes.forEach((scene) => { for (const [key, value] of Object.entries(scene.metadata.values)) { if (!usedMetadata.has(key)) issues.push({ severity: "information", code: "unused-metadata", message: `Metadata field “${key}” is not used by this profile.`, path: scene.file.path, suggestion: "Remove it if obsolete, or add a metadata filter that uses it." }); if (["part", "chapter", "scene", "order"].includes(key) && extractNumber(value) === undefined) issues.push({ severity: "warning", code: "invalid-metadata-value", message: `Metadata field “${key}” must contain a number.`, path: scene.file.path, suggestion: "Replace the value with a numeric ordering value." }); } });
    return this.deduplicate(issues);
  }
  filter(issues: CompileWarning[], minimum: WarningSeverity): CompileWarning[] { const rank: Record<WarningSeverity, number> = { information: 0, warning: 1, error: 2 }; return issues.filter((issue) => rank[issue.severity] >= rank[minimum]); }
  private duplicates(items: Array<{ value: string; path: string }>, code: string, label: string, output: CompileWarning[]): void {
    const groups = new Map<string, Array<{ value: string; path: string }>>(); items.forEach((item) => { const key = item.value.trim().toLowerCase(); groups.set(key, [...(groups.get(key) ?? []), item]); });
    groups.forEach((matches) => { if (matches.length > 1) output.push(this.warning(code, `${label}: “${matches[0].value}”.`, matches.map((item) => item.path).join(", "))); });
  }
  private legacySeverity(message: string): WarningSeverity { return /unreadable|invalid/i.test(message) ? "error" : /no recognised|missing front|missing back/i.test(message) ? "information" : "warning"; }
  private warning(code: string, message: string, path?: string): CompileWarning { return { severity: "warning", code, message, path }; }
  private info(code: string, message: string, path?: string): CompileWarning { return { severity: "information", code, message, path }; }
  private inconsistent(values: Array<number | undefined>, label: string, output: CompileWarning[]): void { const numbers = [...new Set(values.filter((value): value is number => value !== undefined))].sort((a, b) => a - b); if (numbers.length < 2) return; for (let index = 1; index < numbers.length; index += 1) if (numbers[index] - numbers[index - 1] > 1) { output.push({ severity: "information", code: "numbering-gap", message: `Inconsistent ${label} numbering: ${numbers[index - 1]} is followed by ${numbers[index]}.`, suggestion: "Renumber sequentially or set explicit Order metadata." }); break; } }
  private deduplicate(issues: CompileWarning[]): CompileWarning[] { const seen = new Set<string>(); return issues.filter((issue) => { const key = `${issue.severity}|${issue.message}|${issue.path ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
}
