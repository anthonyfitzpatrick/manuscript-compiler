/**
 * Manuscript Compiler — semantic parser.
 *
 * Reads a content-plan-rewritten scan, parses metadata, cleans notes, and builds
 * the Book/Part/Chapter/Scene model. Called by ManuscriptCompiler; calls content
 * cleaning, metadata filters, and ordering.
 *
 * Invariants: metadata never becomes prose, zero numbering is never invented,
 * and cancellation stops queued reads rather than returning a partial Book.
 */
import { parseYaml, TFile, Vault } from "obsidian";
import { ContentCleaningPipeline } from "./filters";
import { MetadataFilterEngine, normalizeKey } from "./metadata-filter";
import type { Book, Chapter, DocumentMetadata, ManuscriptDocument, Part, Scene } from "./model";
import { extractNumber, sortDocuments, sortParts, titleName } from "./ordering";
import type { CompileOptions, CompileProfile } from "./settings";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";
import { throwIfCancelled } from "./cancellation";

/** Vault-bound parser; each parse call owns caches, warnings, and cancellation. */
export class ManuscriptParser {
  private readonly cleaner = new ContentCleaningPipeline();
  private readonly metadataFilter = new MetadataFilterEngine();
  filterDurationMs = 0;
  constructor(private readonly vault: Vault) {}

  /**
   * Builds one semantic Book from an already authoritative scan.
   *
   * File reads may run concurrently, but the returned hierarchy and ordering are
   * deterministic. Cancellation rejects the whole parse; callers must never use
   * partially populated caches as a manuscript.
   */
  async parse(scan: ScannedBook, settings: CompileOptions, signal?: AbortSignal): Promise<Book> {
    const warnings = [...scan.warnings];
    if (scan.hierarchyDiagnostics?.length) console.warn(`Manuscript Compiler found ${scan.hierarchyDiagnostics.length} hierarchy diagnostic(s).`);
    const unreadable = new Map<string, string>();
    const cache = new Map<string, ManuscriptDocument>();
    this.filterDurationMs = 0;
    await mapConcurrent(scan.allMarkdown, 16, async (file) => { throwIfCancelled(signal); try { cache.set(file.path, await this.parseDocument(file, settings)); } catch (error) { if (signal?.aborted) throw error; const message = "Obsidian could not read this note."; unreadable.set(file.path, message); warnings.push(`Unreadable file “${file.path}”. ${message}`); } }, signal);
    const documents = (files: TFile[]): ManuscriptDocument[] => files.map((file) => cache.get(file.path)).filter((document): document is ManuscriptDocument => document !== undefined);
    const frontDocuments = documents(scan.frontMatter);
    const backDocuments = documents(scan.backMatter);
    const rootDocuments = documents(scan.looseScenes);
    const parts = settings.useParts ? scan.parts.map((part) => this.createPart(part, documents, settings)) : [this.createPartlessBook(scan, rootDocuments, documents, settings)];
    const orphanScenes = settings.useParts ? rootDocuments : [];
    sortDocuments(frontDocuments, settings.metadataOrdering);
    sortDocuments(backDocuments, settings.metadataOrdering);
    sortDocuments(orphanScenes, settings.metadataOrdering);
    sortParts(parts, settings.metadataOrdering);
    this.applyManualOrder(parts, frontDocuments, backDocuments, orphanScenes, (settings as CompileProfile).contentOrder);

    this.addStructuralWarnings(parts, orphanScenes, warnings);
    this.addDuplicateFilenameWarnings(scan.allMarkdown, warnings);
    const allDocuments = [...frontDocuments, ...parts.flatMap((part) => [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)]), ...orphanScenes, ...backDocuments];
    for (const document of allDocuments) if (!document.excluded && document.content.trim().length === 0) warnings.push(`Empty scene file: “${document.file.path}”.`);
    for (const document of allDocuments) if (document.metadataError) warnings.push(`Invalid metadata in “${document.file.path}”: ${document.metadataError}`);
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
      includedFiles, excludedFiles: [...uniqueExclusions.values()], warnings, hierarchyDiagnostics: scan.hierarchyDiagnostics
    };
  }

  private applyManualOrder(parts: Part[], front: ManuscriptDocument[], back: ManuscriptDocument[], orphans: Scene[], order?: string[]): void {
    if (!order?.length) return; const ranks = new Map(order.map((path, index) => [path, index])); const rank = (path: string): number => ranks.get(path) ?? Number.MAX_SAFE_INTEGER;
    const documents = (items: ManuscriptDocument[]): void => { items.sort((a, b) => rank(a.file.path) - rank(b.file.path)); };
    documents(front); documents(back); documents(orphans); parts.sort((a, b) => rank(a.path) - rank(b.path));
    parts.forEach((part) => { documents(part.orphanScenes); part.chapters.sort((a, b) => rank(a.path) - rank(b.path)); part.chapters.forEach((chapter) => documents(chapter.scenes)); });
  }

  private async parseDocument(file: TFile, settings: CompileOptions): Promise<ManuscriptDocument> {
    const rawContent = await this.vault.cachedRead(file);
    const parsed = this.readMetadata(rawContent); const metadata = parsed.metadata;
    const explicitlyIncluded = (settings as CompileProfile).explicitlyIncludedPaths?.includes(file.path) === true; const statusExcluded = !explicitlyIncluded && metadata.editingStatus?.trim().toLowerCase() === "excluded";
    const filterStarted = performance.now(); const filter = this.metadataFilter.matches(metadata, settings.metadataFilters); this.filterDurationMs += performance.now() - filterStarted;
    const excluded = statusExcluded || !explicitlyIncluded && !filter.included;
    const exclusionReason = statusExcluded ? "Editing Status is Excluded" : filter.failedRule ? `Excluded by metadata filter “${filter.failedRule.field}”.` : undefined;
    return { file, title: file.basename, number: settings.metadataOrdering ? extractNumber(metadata.scene) ?? extractNumber(file.basename) : extractNumber(file.basename), metadata, content: this.cleaner.clean(rawContent, settings).trim(), excluded, exclusionReason, metadataError: parsed.error };
  }

  private readMetadata(markdown: string): { metadata: DocumentMetadata; error?: string } {
    const match = markdown.replace(/^\uFEFF/, "").match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/);
    if (!match) return { metadata: { values: {} } };
    let yaml: unknown;
    try { yaml = parseYaml(match[1]); } catch { return { metadata: { values: {} }, error: "YAML frontmatter could not be parsed." }; }
    if (!yaml || typeof yaml !== "object" || Array.isArray(yaml)) return { metadata: { values: {} }, error: "YAML frontmatter must be a mapping." };
    const normalizedValues = Object.fromEntries(Object.entries(yaml as Record<string, unknown>).map(([key, value]) => [normalizeKey(key), value]));
    const scalar = (key: string): string | number | undefined => { const value = normalizedValues[key]; return typeof value === "string" || typeof value === "number" ? value : undefined; };
    const order = extractNumber(scalar("order"));
    const editingStatus = scalar("editingstatus");
    return { metadata: { part: scalar("part"), chapter: scalar("chapter"), scene: scalar("scene"), order, editingStatus: editingStatus === undefined ? undefined : String(editingStatus), values: normalizedValues } };
  }

  private createPart(scanned: ScannedPart, documents: (files: TFile[]) => ManuscriptDocument[], settings: CompileOptions): Part {
    const direct = documents(scanned.looseScenes);
    const noteChapters = settings.chapterSource === "notes" ? direct.map((scene) => this.chapterFromDocument(scene, settings)) : [];
    const orphanScenes = settings.chapterSource === "folders" ? direct : [];
    const chapters = [...noteChapters, ...scanned.chapters.map((chapter) => this.createChapter(chapter, documents, settings))];
    const representative = [...orphanScenes, ...chapters.flatMap((chapter) => chapter.scenes)].find((scene) => scene.metadata.part !== undefined);
    const metadataNumber = extractNumber(representative?.metadata.part);
    return { title: scanned.folder.name, name: titleName(scanned.folder.name), number: settings.metadataOrdering ? metadataNumber ?? extractNumber(scanned.folder.name) : extractNumber(scanned.folder.name), path: scanned.folder.path, order: metadataNumber, chapters, orphanScenes };
  }
  private createPartlessBook(scan: ScannedBook, rootDocuments: Scene[], documents: (files: TFile[]) => ManuscriptDocument[], settings: CompileOptions): Part {
    const rootChapters = settings.chapterSource === "notes" ? rootDocuments.map((scene) => this.chapterFromDocument(scene, settings)) : [];
    const folderChapters = scan.parts.map((folder) => { const scenes = [...documents(folder.looseScenes), ...folder.chapters.flatMap((chapter) => documents(chapter.scenes))]; const representative = scenes.find((scene) => scene.metadata.chapter !== undefined); const metadataNumber = extractNumber(representative?.metadata.chapter); return { title: folder.folder.name, name: titleName(folder.folder.name), number: settings.metadataOrdering ? metadataNumber ?? extractNumber(folder.folder.name) : extractNumber(folder.folder.name), path: folder.folder.path, order: metadataNumber, scenes, orphan: false }; });
    return { title: scan.root.name, name: scan.root.name, path: scan.root.path, chapters: [...rootChapters, ...folderChapters], orphanScenes: settings.chapterSource === "folders" ? rootDocuments : [], synthetic: true };
  }
  private chapterFromDocument(scene: Scene, settings: CompileOptions): Chapter { const metadataNumber = extractNumber(scene.metadata.chapter); return { title: scene.title, name: titleName(scene.title), number: settings.metadataOrdering ? metadataNumber ?? scene.number : scene.number, path: scene.file.path, order: metadataNumber ?? scene.metadata.order, scenes: [scene], orphan: false }; }
  private createChapter(scanned: ScannedChapter, documents: (files: TFile[]) => ManuscriptDocument[], settings: CompileOptions): Chapter {
    const scenes = documents(scanned.scenes);
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

/**
 * Applies an asynchronous action with bounded workers and cancellation checkpoints.
 * @param items Ordered work items; action completion order is not guaranteed.
 * @param concurrency Maximum active workers, clamped to at least one.
 * @param action Per-item operation; rejection stops the aggregate promise.
 * @param signal Optional cancellation source checked before work acquisition.
 * @throws The action error or `CompilationCancelledError`; never returns partial success metadata.
 */
export async function mapConcurrent<T>(items: T[], concurrency: number, action: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let next = 0; const worker = async (): Promise<void> => { while (next < items.length) { throwIfCancelled(signal); const index = next; next += 1; await action(items[index]); } };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker()));
}
