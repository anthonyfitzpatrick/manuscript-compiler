/**
 * Manuscript Compiler — semantic compilation facade.
 *
 * Joins parsing with deterministic statistics, warning analysis, and Markdown
 * generation. CompilePreparationService owns this facade; exporters consume its
 * finished Book/result and never ask it to parse again.
 */
import { Vault } from "obsidian";
import { MarkdownGenerator } from "./markdown-generator";
import type { Book, CompileResult, ManuscriptStatistics } from "./model";
import { ManuscriptParser } from "./parser";
import type { CompileProfile } from "./settings";
import { StatisticsEngine } from "./statistics";
import type { ScannedBook } from "./types";
import { WarningEngine } from "./warnings";
import { throwIfCancelled } from "./cancellation";

/** Vault-bound facade used only during authoritative preparation. */
export class ManuscriptCompiler {
  private readonly parser: ManuscriptParser; private readonly generator = new MarkdownGenerator();
  private readonly statistics = new StatisticsEngine(); private readonly warnings = new WarningEngine();
  constructor(vault: Vault) { this.parser = new ManuscriptParser(vault); }
  readonly timings = { parseDurationMs: 0, filterDurationMs: 0, generationDurationMs: 0 };
  /** Parses the authoritative scan once; the resulting Book is retained by the prepared session. */
  async buildModel(scan: ScannedBook, profile: CompileProfile, signal?: AbortSignal): Promise<Book> { const started = performance.now(); const book = await this.parser.parse(scan, profile, signal); this.timings.parseDurationMs = performance.now() - started; this.timings.filterDurationMs = this.parser.filterDurationMs; return book; }
  /** Calculates template variables once so preparation does not render Markdown twice. */
  calculateStatistics(book: Book, profile: CompileProfile, wordsPerMinute: number): ManuscriptStatistics { return this.statistics.calculate(book, profile, wordsPerMinute); }
  /**
   * Derives deterministic statistics, warnings, and optional Markdown from an
   * existing Book. It must not rescan or replace that object because preview and
   * native DOCX export depend on object identity.
   */
  compile(book: Book, profile: CompileProfile, outputPath: string, wordsPerMinute: number, compileDate = new Date(), signal?: AbortSignal, preparedStatistics?: ManuscriptStatistics): CompileResult {
    throwIfCancelled(signal);
    const statistics = preparedStatistics ?? this.calculateStatistics(book, profile, wordsPerMinute);
    const generationStarted = performance.now(); const markdown = this.generator.generate(book, profile, statistics, compileDate); this.timings.generationDurationMs = performance.now() - generationStarted; throwIfCancelled(signal);
    const issues = this.warnings.analyze(book, profile, outputPath);
    return { markdown, parts: profile.useParts ? book.parts.length : 0, chapters: statistics.chapterCount, scenes: statistics.sceneCount,
      frontMatter: book.frontMatter.documents.filter((document) => !document.excluded && profile.includeFrontMatter).length,
      backMatter: book.backMatter.documents.filter((document) => !document.excluded && profile.includeBackMatter).length,
      wordCount: statistics.totalWordCount, readingTimeMinutes: statistics.readingTimeMinutes,
      warnings: issues.map((issue) => issue.message), issues, statistics };
  }
}
