import type { Book, ManuscriptStatistics, NamedStatistic } from "./model";
import type { CompileProfile } from "./settings";
export function documentWordCount(content: string): number { const text = content.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/[\p{P}\p{S}]+/gu, " ").trim(); return text ? text.split(/\s+/u).length : 0; }
export class StatisticsEngine {
  calculate(book: Book, profile: CompileProfile, wordsPerMinute: number): ManuscriptStatistics {
    const scenes = [...book.orphanScenes, ...book.parts.flatMap((part) => [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)])].filter((scene) => !scene.excluded);
    const chapters = book.parts.flatMap((part) => part.chapters);
    const sceneLengths = scenes.map((scene) => ({ name: scene.title, words: documentWordCount(scene.content) }));
    const chapterLengths = chapters.map((chapter) => ({ name: chapter.title, words: chapter.scenes.filter((scene) => !scene.excluded).reduce((sum, scene) => sum + documentWordCount(scene.content), 0) }));
    const bodyWords = sceneLengths.reduce((sum, item) => sum + item.words, 0);
    const matter = [...(profile.includeFrontMatter ? book.frontMatter.documents : []), ...(profile.includeBackMatter ? book.backMatter.documents : [])];
    const matterWords = matter.filter((document) => !document.excluded).reduce((sum, document) => sum + documentWordCount(document.content), 0);
    const pick = (items: NamedStatistic[], longest: boolean): NamedStatistic | undefined => items.length ? [...items].sort((a, b) => longest ? b.words - a.words : a.words - b.words || a.name.localeCompare(b.name))[0] : undefined;
    return { totalWordCount: bodyWords + matterWords, chapterCount: chapters.length, sceneCount: scenes.length,
      averageChapterLength: chapters.length ? Math.round(bodyWords / chapters.length) : 0, averageSceneLength: scenes.length ? Math.round(bodyWords / scenes.length) : 0,
      longestChapter: pick(chapterLengths, true), shortestChapter: pick(chapterLengths, false), longestScene: pick(sceneLengths, true), shortestScene: pick(sceneLengths, false),
      readingTimeMinutes: bodyWords + matterWords === 0 ? 0 : Math.ceil((bodyWords + matterWords) / Math.max(1, wordsPerMinute)) };
  }
}
