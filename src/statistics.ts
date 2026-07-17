/**
 * Manuscript Compiler — semantic manuscript statistics.
 *
 * Counts only included, non-empty documents from the final Book. Preparation,
 * preview, validation, and reports share this result so raw discovery counts
 * cannot disagree with exported structure.
 * It owns counting only, not tokenisation for parsing, Book mutation, logging, or
 * persistence. Calls are pure, synchronous, deterministic, non-cancellable, and
 * platform-neutral. Future counters must derive from semantic content and avoid
 * quadratic rescans of large manuscripts.
 */
import type { Book, Chapter, ManuscriptDocument, ManuscriptStatistics, NamedStatistic } from "./model";
import type { CompileProfile } from "./settings";
export function documentWordCount(content: string): number { const text = content.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/[\p{P}\p{S}]+/gu, " ").trim(); return text ? text.split(/\s+/u).length : 0; }
/** Stateless calculator over the final semantic Book. */
export class StatisticsEngine {
  calculate(book: Book, profile: CompileProfile, wordsPerMinute: number): ManuscriptStatistics {
    const allScenes: ManuscriptDocument[] = [...book.orphanScenes];
    const chapters: Chapter[] = [];
    for (const part of book.parts) {
      allScenes.push(...part.orphanScenes);
      chapters.push(...part.chapters);
      for (const chapter of part.chapters) allScenes.push(...chapter.scenes);
    }
    const scenes = allScenes.filter((scene) => !scene.excluded && !!scene.content.trim());
    const sceneLengths = scenes.map((scene) => ({ name: scene.title, words: documentWordCount(scene.content) }));
    const chapterLengths: NamedStatistic[] = [];
    for (const chapter of chapters) {
      let words = 0;
      for (const scene of chapter.scenes) if (!scene.excluded && scene.content.trim()) words += documentWordCount(scene.content);
      chapterLengths.push({ name: chapter.title, words });
    }
    const bodyWords = sceneLengths.reduce((sum, item) => sum + item.words, 0);
    const matter = [...(profile.includeFrontMatter ? book.frontMatter.documents : []), ...(profile.includeBackMatter ? book.backMatter.documents : [])];
    const matterWords = matter.filter((document) => !document.excluded && !!document.content.trim()).reduce((sum, document) => sum + documentWordCount(document.content), 0);
    const pick = (items: NamedStatistic[], longest: boolean): NamedStatistic | undefined => items.length ? [...items].sort((a, b) => longest ? b.words - a.words : a.words - b.words || a.name.localeCompare(b.name))[0] : undefined;
    return { totalWordCount: bodyWords + matterWords, chapterCount: chapters.length, sceneCount: scenes.length,
      averageChapterLength: chapters.length ? Math.round(bodyWords / chapters.length) : 0, averageSceneLength: scenes.length ? Math.round(bodyWords / scenes.length) : 0,
      longestChapter: pick(chapterLengths, true), shortestChapter: pick(chapterLengths, false), longestScene: pick(sceneLengths, true), shortestScene: pick(sceneLengths, false),
      readingTimeMinutes: bodyWords + matterWords === 0 ? 0 : Math.ceil((bodyWords + matterWords) / Math.max(1, wordsPerMinute)) };
  }
}
