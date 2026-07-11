import { Vault } from "obsidian";
import { MarkdownGenerator } from "./markdown-generator";
import type { Book, CompileResult } from "./model";
import { ManuscriptParser } from "./parser";
import type { CompileProfile } from "./settings";
import { StatisticsEngine } from "./statistics";
import type { ScannedBook } from "./types";
import { WarningEngine } from "./warnings";

export class ManuscriptCompiler {
  private readonly parser: ManuscriptParser; private readonly generator = new MarkdownGenerator();
  private readonly statistics = new StatisticsEngine(); private readonly warnings = new WarningEngine();
  constructor(vault: Vault) { this.parser = new ManuscriptParser(vault); }
  async buildModel(scan: ScannedBook, profile: CompileProfile): Promise<Book> { return this.parser.parse(scan, profile); }
  compile(book: Book, profile: CompileProfile, outputPath: string, wordsPerMinute: number, compileDate = new Date()): CompileResult {
    const statistics = this.statistics.calculate(book, profile, wordsPerMinute);
    const markdown = this.generator.generate(book, profile, statistics, compileDate);
    const issues = this.warnings.analyze(book, profile, outputPath); book.issues = issues;
    return { markdown, parts: book.parts.length, chapters: statistics.chapterCount, scenes: statistics.sceneCount,
      frontMatter: book.frontMatter.documents.filter((document) => !document.excluded && profile.includeFrontMatter).length,
      backMatter: book.backMatter.documents.filter((document) => !document.excluded && profile.includeBackMatter).length,
      wordCount: statistics.totalWordCount, readingTimeMinutes: statistics.readingTimeMinutes,
      warnings: issues.map((issue) => issue.message), issues, statistics };
  }
}
