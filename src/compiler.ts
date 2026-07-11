import { Vault } from "obsidian";
import type { ManuscriptCompilerSettings } from "./settings";
import type { CompileResult, ScannedBook } from "./types";

export class ManuscriptCompiler {
  constructor(private readonly vault: Vault) {}

  async compile(book: ScannedBook, settings: ManuscriptCompilerSettings): Promise<CompileResult> {
    const sections: string[] = [];
    const warnings = [...book.warnings];
    let scenes = 0;
    let chapters = 0;

    if (settings.includeFrontMatter) {
      const content = await this.readFiles(book.frontMatter, settings, false);
      sections.push(...content);
    }

    for (const part of book.parts) {
      sections.push(`# ${part.folder.name}`);
      const loose = await this.readFiles(part.looseScenes, settings, true);
      sections.push(...this.joinScenes(loose, settings.sceneSeparator));
      scenes += loose.length;

      for (const chapter of part.chapters) {
        sections.push(`## ${chapter.folder.name}`);
        chapters += 1;
        const content = await this.readFiles(chapter.scenes, settings, true);
        sections.push(...this.joinScenes(content, settings.sceneSeparator));
        scenes += content.length;
        if (content.length === 0) warnings.push(`Chapter “${chapter.folder.name}” contains no Markdown files.`);
      }
    }

    const rootScenes = await this.readFiles(book.looseScenes, settings, true);
    sections.push(...this.joinScenes(rootScenes, settings.sceneSeparator));
    scenes += rootScenes.length;

    if (settings.includeBackMatter) {
      const content = await this.readFiles(book.backMatter, settings, false);
      sections.push(...content);
    }

    const markdown = `${sections.filter(Boolean).join("\n\n").trim()}\n`;
    return { markdown, parts: book.parts.length, chapters, scenes, wordCount: this.countWords(markdown), warnings };
  }

  private async readFiles(files: ScannedBook["frontMatter"], settings: ManuscriptCompilerSettings, titleScenes: boolean): Promise<string[]> {
    return Promise.all(files.map(async (file) => {
      let body = await this.vault.cachedRead(file);
      if (settings.stripYamlFrontmatter) body = this.stripYaml(body);
      body = body.trim();
      if (titleScenes && settings.includeSceneTitles && body) return `### ${file.basename}\n\n${body}`;
      return body;
    }));
  }

  private joinScenes(scenes: string[], separator: string): string[] {
    const nonEmpty = scenes.filter(Boolean);
    const result: string[] = [];
    nonEmpty.forEach((scene, index) => {
      if (index > 0 && separator.trim()) result.push(separator.trim());
      result.push(scene);
    });
    return result;
  }

  private stripYaml(markdown: string): string {
    const normalized = markdown.replace(/^\uFEFF/, "");
    return normalized.replace(/^---[\t ]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/, "");
  }

  private countWords(markdown: string): number {
    const text = markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/^#{1,6}\s+.*$/gm, " ")
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .trim();
    return text ? text.split(/\s+/u).length : 0;
  }
}
