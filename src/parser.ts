import { parseYaml, TFile, Vault } from "obsidian";
import { ContentCleaningPipeline } from "./filters";
import { MetadataFilterEngine, normalizeKey } from "./metadata-filter";
import type { Book, Chapter, DocumentMetadata, ManuscriptDocument, Part, Scene } from "./model";
import { extractNumber, sortDocuments, sortParts, titleName } from "./ordering";
import type { CompileOptions } from "./settings";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";

export class ManuscriptParser {
  private readonly cleaner = new ContentCleaningPipeline();
  private readonly metadataFilter = new MetadataFilterEngine();
  constructor(private readonly vault: Vault) {}

  async parse(scan: ScannedBook, settings: CompileOptions): Promise<Book> {
    const warnings = [...scan.warnings];
    const unreadable = new Map<string, string>();
    const cache = new Map<string, ManuscriptDocument>();
    for (const file of scan.allMarkdown) {
      try { cache.set(file.path, await this.parseDocument(file, settings)); }
      catch (error) { const message = error instanceof Error ? error.message : String(error); unreadable.set(file.path, message); warnings.push(`Unreadable file “${file.path}”: ${message}`); }
    }
    const documents = (files: TFile[]): ManuscriptDocument[] => files.map((file) => cache.get(file.path)).filter((document): document is ManuscriptDocument => document !== undefined);
    const frontDocuments = documents(scan.frontMatter);
    const backDocuments = documents(scan.backMatter);
    const parts = scan.parts.map((part) => this.createPart(part, documents, settings));
    const orphanScenes = documents(scan.looseScenes) as Scene[];
    sortDocuments(frontDocuments, settings.metadataOrdering);
    sortDocuments(backDocuments, settings.metadataOrdering);
    sortDocuments(orphanScenes, settings.metadataOrdering);
    sortParts(parts, settings.metadataOrdering);

    this.addStructuralWarnings(parts, orphanScenes, warnings);
    this.addDuplicateFilenameWarnings(scan.allMarkdown, warnings);
    const allDocuments = [...frontDocuments, ...parts.flatMap((part) => [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)]), ...orphanScenes, ...backDocuments];
    for (const document of allDocuments) if (!document.excluded && document.content.trim().length === 0) warnings.push(`Empty scene file: “${document.file.path}”.`);
    const excludedFiles = allDocuments.filter((document) => document.excluded).map((document) => ({ file: document.file, reason: document.exclusionReason ?? "Excluded" }));
    unreadable.forEach((reason, path) => { const file = scan.allMarkdown.find((candidate) => candidate.path === path); if (file) excludedFiles.push({ file, reason: `Unreadable: ${reason}` }); });
    if (!settings.includeFrontMatter) frontDocuments.forEach((document) => excludedFiles.push({ file: document.file, reason: "Front matter disabled" }));
    if (!settings.includeBackMatter) backDocuments.forEach((document) => excludedFiles.push({ file: document.file, reason: "Back matter disabled" }));
    const uniqueExclusions = new Map(excludedFiles.map((entry) => [entry.file.path, entry]));
    const excludedPaths = new Set(uniqueExclusions.keys());
    const includedFiles = allDocuments.map((document) => document.file).filter((file) => !excludedPaths.has(file.path));
    return {
      root: scan.root, title: scan.root.name,
      frontMatter: { kind: "front", title: "Front Matter", documents: frontDocuments },
      parts, orphanScenes, backMatter: { kind: "back", title: "Back Matter", documents: backDocuments },
      includedFiles, excludedFiles: [...uniqueExclusions.values()], warnings, issues: []
    };
  }

  private async parseDocument(file: TFile, settings: CompileOptions): Promise<ManuscriptDocument> {
    const rawContent = await this.vault.cachedRead(file);
    const metadata = this.readMetadata(rawContent);
    const statusExcluded = metadata.editingStatus?.trim().toLowerCase() === "excluded";
    const filter = this.metadataFilter.matches(metadata, settings.metadataFilters);
    const excluded = statusExcluded || !filter.included;
    const exclusionReason = statusExcluded ? "Editing Status is Excluded" : filter.failedRule ? `${filter.failedRule.field} ${filter.failedRule.operator === "equals" ? "==" : "!="} ${filter.failedRule.value} did not match` : undefined;
    return { file, title: file.basename, number: settings.metadataOrdering ? extractNumber(metadata.scene) ?? extractNumber(file.basename) : extractNumber(file.basename), metadata, rawContent, content: this.cleaner.clean(rawContent, settings).trim(), excluded, exclusionReason };
  }

  private readMetadata(markdown: string): DocumentMetadata {
    const match = markdown.replace(/^\uFEFF/, "").match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/);
    if (!match) return { values: {} };
    let yaml: unknown;
    try { yaml = parseYaml(match[1]); } catch { return { values: {} }; }
    if (!yaml || typeof yaml !== "object" || Array.isArray(yaml)) return { values: {} };
    const normalizedValues = Object.fromEntries(Object.entries(yaml as Record<string, unknown>).map(([key, value]) => [normalizeKey(key), value]));
    const scalar = (key: string): string | number | undefined => { const value = normalizedValues[key]; return typeof value === "string" || typeof value === "number" ? value : undefined; };
    const order = extractNumber(scalar("order"));
    const editingStatus = scalar("editingstatus");
    return { part: scalar("part"), chapter: scalar("chapter"), scene: scalar("scene"), order, editingStatus: editingStatus === undefined ? undefined : String(editingStatus), values: normalizedValues };
  }

  private createPart(scanned: ScannedPart, documents: (files: TFile[]) => ManuscriptDocument[], settings: CompileOptions): Part {
    const orphanScenes = documents(scanned.looseScenes) as Scene[];
    const chapters = scanned.chapters.map((chapter) => this.createChapter(chapter, documents, settings));
    const representative = [...orphanScenes, ...chapters.flatMap((chapter) => chapter.scenes)].find((scene) => scene.metadata.part !== undefined);
    const metadataNumber = extractNumber(representative?.metadata.part);
    return { title: scanned.folder.name, name: titleName(scanned.folder.name), number: settings.metadataOrdering ? metadataNumber ?? extractNumber(scanned.folder.name) : extractNumber(scanned.folder.name), path: scanned.folder.path, order: metadataNumber, chapters, orphanScenes };
  }
  private createChapter(scanned: ScannedChapter, documents: (files: TFile[]) => ManuscriptDocument[], settings: CompileOptions): Chapter {
    const scenes = documents(scanned.scenes) as Scene[];
    const representative = scenes.find((scene) => scene.metadata.chapter !== undefined);
    const metadataNumber = extractNumber(representative?.metadata.chapter);
    return { title: scanned.folder.name, name: titleName(scanned.folder.name), number: settings.metadataOrdering ? metadataNumber ?? extractNumber(scanned.folder.name) : extractNumber(scanned.folder.name), path: scanned.folder.path, order: metadataNumber, scenes, orphan: false };
  }

  private addStructuralWarnings(parts: Part[], rootOrphans: Scene[], warnings: string[]): void {
    const partNumbers = parts.map((part) => part.number).filter((number): number is number => number !== undefined);
    this.warnDuplicates(partNumbers, "part", warnings);
    for (const part of parts) {
      const chapterNumbers = part.chapters.map((chapter) => chapter.number).filter((number): number is number => number !== undefined);
      this.warnDuplicates(chapterNumbers, `chapter in “${part.title}”`, warnings);
      part.chapters.forEach((chapter) => {
        if (chapter.number === undefined) warnings.push(`Missing chapter number: “${chapter.path}”.`);
        const sceneNumbers = chapter.scenes.filter((scene) => !scene.excluded).map((scene) => extractNumber(scene.metadata.scene) ?? scene.number).filter((number): number is number => number !== undefined);
        this.warnDuplicates(sceneNumbers, `scene in “${chapter.title}”`, warnings);
        chapter.scenes.filter((scene) => !scene.excluded && (extractNumber(scene.metadata.scene) ?? scene.number) === undefined).forEach((scene) => warnings.push(`Missing scene number: “${scene.file.path}”.`));
      });
    }
    [...rootOrphans, ...parts.flatMap((part) => part.orphanScenes)].forEach((scene) => { if (!scene.excluded) warnings.push(`Orphan scene: “${scene.file.path}”.`); });
  }
  private warnDuplicates(numbers: number[], label: string, warnings: string[]): void {
    const seen = new Set<number>(); const duplicates = new Set<number>();
    numbers.forEach((number) => { if (seen.has(number)) duplicates.add(number); seen.add(number); });
    duplicates.forEach((number) => warnings.push(`Duplicate ${label} number: ${number}.`));
  }
  private addDuplicateFilenameWarnings(files: TFile[], warnings: string[]): void {
    const groups = new Map<string, TFile[]>();
    files.forEach((file) => { const key = file.name.toLowerCase(); groups.set(key, [...(groups.get(key) ?? []), file]); });
    groups.forEach((matches, name) => { if (matches.length > 1) warnings.push(`Duplicate filename “${name}”: ${matches.map((file) => file.path).join(", ")}.`); });
  }
}
