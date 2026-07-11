import { Vault } from "obsidian";
import { MarkdownGenerator } from "./markdown-generator";
import type { Book, CompileResult } from "./model";
import { ManuscriptParser } from "./parser";
import type { CompileProfile } from "./settings";
import { StatisticsEngine } from "./statistics";
import type { ScannedBook } from "./types";
import { WarningEngine } from "./warnings";
import { throwIfCancelled } from "./cancellation";

export class ManuscriptCompiler {
  private readonly parser: ManuscriptParser; private readonly generator = new MarkdownGenerator();
  private readonly statistics = new StatisticsEngine(); private readonly warnings = new WarningEngine();
  constructor(vault: Vault) { this.parser = new ManuscriptParser(vault); }
  readonly timings = { parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0 };
  async buildModel(scan: ScannedBook, profile: CompileProfile, signal?: AbortSignal): Promise<Book> { const started = performance.now(); const book = await this.parser.parse(scan, profile, signal); this.timings.parseDurationMs = performance.now() - started; this.timings.filterDurationMs = this.parser.filterDurationMs; return book; }
  compile(book: Book, profile: CompileProfile, outputPath: string, wordsPerMinute: number, compileDate = new Date(), signal?: AbortSignal): CompileResult {
    throwIfCancelled(signal);
    const statistics = this.statistics.calculate(book, profile, wordsPerMinute);
    const generationStarted = performance.now(); const markdown = this.generator.generate(book, profile, statistics, compileDate); this.timings.generationDurationMs = performance.now() - generationStarted; throwIfCancelled(signal);
    const issues = this.warnings.analyze(book, profile, outputPath); book.issues = issues;
    return { markdown, parts: profile.useParts ? book.parts.length : 0, chapters: statistics.chapterCount, scenes: statistics.sceneCount,
      frontMatter: book.frontMatter.documents.filter((document) => !document.excluded && profile.includeFrontMatter).length,
      backMatter: book.backMatter.documents.filter((document) => !document.excluded && profile.includeBackMatter).length,
      wordCount: statistics.totalWordCount, readingTimeMinutes: statistics.readingTimeMinutes,
      warnings: issues.map((issue) => issue.message), issues, statistics };
  }
}
