/**
 * Informational large-manuscript benchmark and deterministic correctness check.
 * Timing is reported, not treated as a universal hardware promise.
 */
import { MarkdownGenerator } from "../src/markdown-generator";
import { ManuscriptParser } from "../src/parser";
import { createDefaultProfiles } from "../src/profiles";
import { StatisticsEngine } from "../src/statistics";
import { EXPORTERS } from "../src/native-exporters";
import { EXPORT_VALIDATORS } from "../src/export-validators";
import { EXPORT_FORMATS } from "../src/export-types";
import { createSemanticDocument } from "../src/semantic-document";

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
const parseStarted = performance.now();
const book = await new ManuscriptParser({ cachedRead: async () => content } as never).parse(scan, profile);
const parseMs = performance.now() - parseStarted;
const statisticsStarted = performance.now();
const statistics = new StatisticsEngine().calculate(book, profile, 250);
const statisticsMs = performance.now() - statisticsStarted;
const markdownStarted = performance.now();
const markdown = new MarkdownGenerator().generate(book, profile, statistics, new Date("2026-01-01T00:00:00Z"));
const markdownMs = performance.now() - markdownStarted;
const options = { title: "Benchmark", author: "", language: "en", titlePage: false, tableOfContents: false, font: "Times New Roman", fontSize: 12, lineSpacing: 1.5, firstLineIndentCm: 0.75, pageSize: "a4" as const, pageMarginCm: 2.54, chapterPageBreak: true, sceneSeparator: "#" };
const semanticStarted = performance.now(); const document = createSemanticDocument(book, profile, options, statistics.totalWordCount); const semanticMs = performance.now() - semanticStarted;
const session = { book, profile, statistics } as never; const formatResults: Array<{ format: string; ms: number; bytes: number }> = [];
for (const format of EXPORT_FORMATS) { const started = performance.now(); const generated = await EXPORTERS[format].generate({ session, document, options, filename: `Benchmark.${format}` }); const ms = performance.now() - started; const validation = EXPORT_VALIDATORS[format].validate(generated.bytes); if (!validation.valid) throw new Error(`${format.toUpperCase()} benchmark validation failed: ${validation.errors.join(" ")}`); formatResults.push({ format, ms, bytes: generated.bytes.length }); }
const duration = parseMs + statisticsMs + markdownMs + semanticMs + formatResults.reduce((total, item) => total + item.ms, 0); const memory = typeof process.memoryUsage === "function" ? Math.round(process.memoryUsage().heapUsed / 1024 / 1024) : undefined;
if (duration > 120_000) throw new Error(`Large-manuscript benchmark exceeded the 120-second runaway guard (${Math.round(duration)} ms).`);
process.stdout.write(`Large-manuscript benchmark: ${statistics.chapterCount} chapters, ${statistics.sceneCount} scenes, ${statistics.totalWordCount.toLocaleString()} words in ${Math.round(duration)} ms. Preparation once: parse/clean/Book ${Math.round(parseMs)} ms; statistics ${Math.round(statisticsMs)} ms; Markdown ${Math.round(markdownMs)} ms; semantic projection ${Math.round(semanticMs)} ms. Exports: ${formatResults.map((item) => `${item.format.toUpperCase()} ${Math.round(item.ms)} ms/${item.bytes.toLocaleString()} bytes`).join("; ")}.${memory === undefined ? "" : ` Observed heap after generation: ${memory} MiB.`}\n`);
