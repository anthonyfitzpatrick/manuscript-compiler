import type { Book, Chapter, ManuscriptDocument, ManuscriptStatistics, Part } from "./model";
import type { CompileProfile } from "./settings";
import { TemplateEngine, type TemplateVariables } from "./template-engine";

export class MarkdownGenerator {
  private readonly templates = new TemplateEngine();
  generate(book: Book, profile: CompileProfile, statistics: ManuscriptStatistics, compileDate = new Date()): string {
    const blocks: Array<{ text: string; blankLines: number }> = [];
    const variables: TemplateVariables = {
      ...profile.variables, BookTitle: profile.variables.BookTitle || book.title,
      Date: compileDate.toISOString().slice(0, 10), Year: compileDate.getFullYear(),
      WordCount: statistics.totalWordCount, ChapterCount: statistics.chapterCount
    };
    const add = (text: string, blankLines = profile.blankLinesBetweenSections): void => { if (text.trim()) blocks.push({ text: text.trim(), blankLines }); };
    if (profile.includeFrontMatter) this.addDocuments(add, book.frontMatter.documents, profile, false);
    for (const part of book.parts) {
      if (profile.useParts) add(`# ${this.heading(profile.partHeadingTemplate, part, variables)}`);
      this.addDocuments(add, part.orphanScenes, profile, true);
      for (const chapter of part.chapters) {
        add(`## ${this.heading(profile.chapterHeadingTemplate, chapter, variables)}`, profile.blankLinesBetweenChapters);
        this.addDocuments(add, chapter.scenes, profile, true);
      }
    }
    this.addDocuments(add, book.orphanScenes, profile, true);
    if (profile.includeBackMatter) this.addDocuments(add, book.backMatter.documents, profile, false);
    const chunks: string[] = []; blocks.forEach((block, index) => { if (index > 0) chunks.push("\n".repeat(Math.max(1, block.blankLines + 1))); chunks.push(block.text); });
    return `${chunks.join("").replace(/[\t ]+$/gm, "").replace(/\n+$/g, "")}\n`;
  }
  private addDocuments(add: (text: string, blankLines?: number) => void, documents: ManuscriptDocument[], profile: CompileProfile, scenes: boolean): void {
    const included = documents.filter((document) => !document.excluded && document.content.trim());
    included.forEach((document, index) => {
      if (scenes && index > 0 && profile.sceneSeparator.trim()) add(profile.sceneSeparator);
      add(scenes && profile.includeSceneTitles ? `### ${document.title}\n\n${document.content}` : document.content);
    });
  }
  private heading(template: string, item: Part | Chapter, variables: TemplateVariables): string {
    return this.templates.render(template, { ...variables, title: item.title, number: item.number, name: item.name }).replace(/[\s:—-]+$/g, "").trim() || item.title;
  }
}
