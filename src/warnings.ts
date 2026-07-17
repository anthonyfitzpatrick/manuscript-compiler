/**
 * Manuscript Compiler — semantic and output-safety warning analysis.
 *
 * Examines the final Book and resolved profile, never permissive scanner output.
 * Warnings are prose-free and author-facing; export-safety applies blocking policy.
 * It owns deterministic analysis only, not UI severity presentation, persistence,
 * or export decisions. Calls are pure, synchronous, non-cancellable, and portable.
 * New warnings require stable codes and bounded details; never embed prose, YAML
 * values, or absolute source paths.
 */
import type { Book, Chapter, CompileWarning, ManuscriptDocument, WarningSeverity } from "./model";
import type { CompileProfile } from "./settings";
import { extractNumber } from "./ordering";
import { normalizeKey } from "./metadata-filter";

/** Stateless semantic/output analysis run after model construction. */
export class WarningEngine {
  analyze(book: Book, profile: CompileProfile, _outputPath: string): CompileWarning[] {
    const issues: CompileWarning[] = book.warnings.map((message) => ({ severity: this.legacySeverity(message), code: "structure", message }));
    const chapters: Chapter[] = [];
    const scenes: ManuscriptDocument[] = [...book.orphanScenes];
    for (const part of book.parts) {
      chapters.push(...part.chapters);
      scenes.push(...part.orphanScenes);
      for (const chapter of part.chapters) scenes.push(...chapter.scenes);
    }
    this.duplicates(chapters.map((chapter) => ({ value: chapter.title, path: chapter.path })), "duplicate-chapter-title", "Duplicate chapter title", issues);
    this.duplicates(scenes.map((scene) => ({ value: scene.title, path: scene.file.path })), "duplicate-scene-title", "Duplicate scene title", issues);
    const chapterNumbers: Array<number | undefined> = [];
    for (const chapter of chapters) chapterNumbers.push(chapter.number);
    this.inconsistent(chapterNumbers, "chapter", issues);
    for (const chapter of chapters) {
      const sceneNumbers: Array<number | undefined> = [];
      for (const scene of chapter.scenes) if (!scene.excluded) sceneNumbers.push(extractNumber(scene.metadata.scene) ?? scene.number);
      this.inconsistent(sceneNumbers, `scene in “${chapter.title}”`, issues);
    }
    for (const part of book.parts) if (part.chapters.length === 0 && part.orphanScenes.length === 0) issues.push(this.warning("empty-part", `Empty part: “${part.title}”.`, part.path));
    for (const part of book.parts) {
      const content: ManuscriptDocument[] = [...part.orphanScenes];
      for (const chapter of part.chapters) content.push(...chapter.scenes);
      let hasIncludedContent = false;
      for (const scene of content) if (!scene.excluded && scene.content.trim()) { hasIncludedContent = true; break; }
      if (content.length > 0 && !hasIncludedContent) issues.push(this.warning("empty-part-content", `Part has no included content: “${part.title}”.`, part.path));
    }
    for (const chapter of chapters) if (chapter.scenes.length === 0) issues.push(this.warning("chapter-without-scenes", `Chapter without scenes: “${chapter.title}”.`, chapter.path));
    for (const chapter of chapters) {
      let hasIncludedContent = false;
      for (const scene of chapter.scenes) if (!scene.excluded && scene.content.trim()) { hasIncludedContent = true; break; }
      if (chapter.scenes.length > 0 && !hasIncludedContent) issues.push(this.warning("empty-chapter", `Chapter has no included content: “${chapter.title}”.`, chapter.path));
    }
    if (book.frontMatter.documents.length === 0) issues.push(this.info("missing-front-matter", "No front matter was detected."));
    if (book.backMatter.documents.length === 0) issues.push(this.info("missing-back-matter", "No back matter was detected."));
    if (!profile.name.trim()) issues.push({ severity: "error", code: "invalid-profile", message: "The active profile has no name." });
    if (!profile.outputFilename.trim()) issues.push({ severity: "error", code: "invalid-output", message: "The active profile has no output filename." });
    if (!profile.partHeadingTemplate.trim() || !profile.chapterHeadingTemplate.trim()) issues.push(this.warning("invalid-template", "A heading template is empty; folder titles will be used."));
    profile.metadataFilters.forEach((rule) => { if (!rule.field.trim() || !rule.value.trim() || !["equals", "not-equals"].includes(rule.operator)) issues.push({ severity: "error", code: "invalid-filter", message: "A metadata filter has an invalid operator or an empty field/value." }); });
    scenes.filter((scene) => !scene.excluded && Object.keys(scene.metadata.values).length === 0).forEach((scene) => issues.push(this.info("missing-metadata", `Scene has no YAML metadata: “${scene.file.path}”.`, scene.file.path)));
    const usedMetadata = new Set(["part", "chapter", "scene", "order", "editingstatus", ...profile.metadataFilters.map((rule) => normalizeKey(rule.field))]);
    let removedMetadataFields = 0;
    scenes.forEach((scene) => { for (const [key, value] of Object.entries(scene.metadata.values)) { if (!scene.excluded && !usedMetadata.has(key)) removedMetadataFields += 1; if (["part", "chapter", "scene", "order"].includes(key) && extractNumber(value) === undefined) issues.push({ severity: "warning", code: "invalid-metadata-value", message: `Metadata field “${key}” must contain a number.`, path: scene.file.path, suggestion: "Replace the value with a numeric ordering value." }); } });
    if (removedMetadataFields) issues.push(this.info("metadata-removed", `${removedMetadataFields.toLocaleString()} metadata field${removedMetadataFields === 1 ? "" : "s"} removed from manuscript.`));
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
