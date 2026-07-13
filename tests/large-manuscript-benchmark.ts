import { MarkdownGenerator } from "../src/markdown-generator";
import { ManuscriptParser } from "../src/parser";
import { createDefaultProfiles } from "../src/profiles";
import { StatisticsEngine } from "../src/statistics";

const profile = createDefaultProfiles()[0];
const content = `${"word ".repeat(999)}word`;
let sceneIndex = 0;
const allMarkdown: Array<{ name: string; basename: string; path: string }> = [];
const parts = Array.from({ length: 10 }, (_, partIndex) => ({
  folder: { name: `Part ${partIndex + 1}`, path: `Book/Part ${partIndex + 1}` },
  looseScenes: [],
  chapters: Array.from({ length: 50 }, (_, chapterIndex) => ({
    folder: { name: `Chapter ${partIndex * 50 + chapterIndex + 1}`, path: `Book/Part ${partIndex + 1}/Chapter ${chapterIndex + 1}` },
    scenes: Array.from({ length: 4 }, () => {
      const name = `Scene ${++sceneIndex}`;
      const scene = { name: `${name}.md`, basename: name, path: `Book/Part ${partIndex + 1}/Chapter ${chapterIndex + 1}/${name}.md` };
      allMarkdown.push(scene);
      return scene;
    })
  }))
}));
const scan = { root: { path: "Book", name: "Book" }, frontMatter: [], backMatter: [], looseScenes: [], parts, allMarkdown, warnings: [] } as never;
const started = performance.now();
const book = await new ManuscriptParser({ cachedRead: async () => content } as never).parse(scan, profile);
const statistics = new StatisticsEngine().calculate(book, profile, 250);
const markdown = new MarkdownGenerator().generate(book, profile, statistics, new Date("2026-01-01T00:00:00Z"));
const duration = performance.now() - started;
process.stdout.write(`Large-manuscript benchmark: ${statistics.chapterCount} chapters, ${statistics.sceneCount} scenes, ${statistics.totalWordCount.toLocaleString()} words, ${markdown.length.toLocaleString()} characters in ${Math.round(duration)} ms.\n`);
