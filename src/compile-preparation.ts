/**
 * Manuscript Compiler — authoritative preparation boundary.
 *
 * Vault → scanner → content plan → parser/cleaner → semantic Book
 *       → statistics/warnings/fingerprints → PreparedCompileSession
 *
 * Every preview, validation, Markdown export, and DOCX export crosses this
 * boundary. Called by CompileCommandService; calls VaultScanner, content-plan
 * rewriting, ManuscriptCompiler, and output-path calculation. Scanner-to-parser
 * or scanner-to-export shortcuts are forbidden because they bypass author roles
 * and safe exclusions.
 */
import { normalizePath, TFile, TFolder, type Vault } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { applyContentPlan, classifyContentPlan, createContentPlan, isPlanItemIncluded, type ContentPlanItem } from "./content-plan";
import type { Book, CompileResult, CompileWarning, ManuscriptDocument, ManuscriptStatistics } from "./model";
import type { CompileProfile, StructurePreset } from "./settings";
import { inchesToCentimetres } from "./measurements";
import { applyContentPlanAuthority, applyWorkspacePlanAuthority, inferStructurePreset, resolveSimpleCompileRequest, type SimpleCompileRequest } from "./simple-workflow";
import type { ScannedBook } from "./types";
import { VaultScanner } from "./vault-scanner";
import { exportFilename } from "./export-filename";

/** Prose-free explanation of an item absent from the final Book. */
export interface PreparedExclusion { path: string; name: string; reason: string; }
export type CompilePurpose = "preview" | "compile" | "validation";
export type CompileRoute = "guided" | "current-book" | "selected-folder" | "legacy-profile" | "sample" | "validation";
/**
 * Route-neutral input accepted by the authoritative service. Guided callers
 * provide an edited plan; compatibility routes omit it and receive safe inference.
 */
export interface CompilePreparationRequest {
  manuscriptRoot: string;
  profile: CompileProfile;
  structurePreset?: StructurePreset;
  contentPlan?: ContentPlanItem[];
  simpleRequest?: SimpleCompileRequest;
  purpose: CompilePurpose;
  route: CompileRoute;
}
/**
 * Immutable-in-practice snapshot owned by its requesting command/workspace.
 * Consumers retain references rather than mutating or reconstructing fields.
 * `book` is the exact object used by preview and export; fingerprints bind that
 * object to both source files and author-controlled inputs.
 */
export interface PreparedCompileSession {
  request: SimpleCompileRequest;
  contentPlan: ContentPlanItem[];
  profile: CompileProfile;
  scannedBook: ScannedBook;
  book: Book;
  statistics: ManuscriptStatistics;
  warnings: CompileWarning[];
  exclusions: PreparedExclusion[];
  result: CompileResult;
  variables: Record<string, string | number | undefined>;
  outputPaths: string[];
  sourcePaths: string[];
  sourceFingerprint: string;
  inputSignature: string;
  purpose: CompilePurpose;
  route: CompileRoute;
}

/**
 * Sole root-to-semantic-Book service. Instances are vault-bound and stateless
 * between calls. Preparation performs reads and computation but no output writes.
 * AbortSignal cancellation propagates through parsing before a session is returned.
 */
export class CompilePreparationService {
  constructor(private readonly vault: Vault, private readonly baseProfile: CompileProfile, private readonly wordsPerMinute: number) {}

  /** Prepares an edited three-stage workspace request without altering its plan. */
  async prepare(request: SimpleCompileRequest, contentPlan: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    return this.prepareAuthoritative({ manuscriptRoot: request.manuscriptRoot, profile: this.baseProfile, structurePreset: request.structurePreset, contentPlan, simpleRequest: request, purpose: "preview", route: "guided" }, signal);
  }

  /**
   * Runs the complete production preparation pipeline for every route. Throws for
   * an invalid root/read/parse failure and never returns a partially prepared session.
   */
  async prepareAuthoritative(request: CompilePreparationRequest, signal?: AbortSignal): Promise<PreparedCompileSession> {
    const preparationStarted = performance.now();
    const scanStarted = performance.now();
    const folder = this.vault.getAbstractFileByPath(normalizePath(request.manuscriptRoot));
    if (!(folder instanceof TFolder)) throw new Error("The manuscript folder does not exist.");
    const suppliedPlan = request.contentPlan;
    const plan = suppliedPlan === undefined
      ? await classifyContentPlan(this.vault, createContentPlan(folder, request.structurePreset ?? inferStructurePreset(request.profile)))
      : suppliedPlan.map((item) => ({ ...item }));
    const simple = request.simpleRequest ?? simpleRequestFromProfile(request, plan);
    const requestSnapshot = cloneRequest({ ...simple, manuscriptRoot: folder.path }, plan);
    const resolved = resolveSimpleCompileRequest(requestSnapshot, request.profile);
    const profile = request.simpleRequest
      ? applyWorkspacePlanAuthority(resolved, requestSnapshot)
      : applyContentPlanAuthority(resolved, folder.path, plan);
    const scannedBook = applyContentPlan(new VaultScanner().scan(folder), plan, profile);
    const scanMs = performance.now() - scanStarted;
    const compiler = new ManuscriptCompiler(this.vault);
    const book = await compiler.buildModel(scannedBook, profile, signal);
    const preparedAt = new Date();
    const statistics = compiler.calculateStatistics(book, profile, this.wordsPerMinute);
    const variables = {
      ...profile.variables,
      BookTitle: profile.variables.BookTitle || book.title,
      Date: preparedAt.toISOString().slice(0, 10),
      Year: preparedAt.getFullYear(),
      WordCount: statistics.totalWordCount,
      ChapterCount: statistics.chapterCount
    };
    const paths = [exportFilename(profile.outputFilename, "docx", String(variables.BookTitle ?? book.title))];
    const result = compiler.compile(book, profile, paths[0] ?? "", this.wordsPerMinute, preparedAt, signal, statistics);
    result.timings = {
      totalMs: performance.now() - preparationStarted,
      scanMs,
      parseMs: Math.max(0, compiler.timings.parseDurationMs - compiler.timings.filterDurationMs),
      filterMs: compiler.timings.filterDurationMs,
      generationMs: compiler.timings.generationDurationMs,
      exportMs: 0
    };
    const planWarnings: CompileWarning[] = plan
      .filter((item) => isPlanItemIncluded(item, plan, folder.path) && item.warning)
      .map((item) => ({ severity: "warning", code: "content-plan-warning", message: `${item.name}: ${item.warning}`, path: item.path }));
    const warnings = [...result.issues, ...planWarnings];
    const exclusions = collectExclusions(plan, book, folder.path);
    const sourcePaths = plan
      .filter((item) => item.kind === "note" && isPlanItemIncluded(item, plan, folder.path))
      .map((item) => item.path)
      .sort();
    const sourceFingerprint = await calculateSourceFingerprint(this.vault, sourcePaths);
    return {
      request: requestSnapshot, contentPlan: requestSnapshot.contentPlan ?? [], profile, scannedBook, book,
      statistics: result.statistics, warnings, exclusions,
      result: { ...result, issues: warnings, warnings: warnings.map((item) => item.message) },
      variables, outputPaths: paths, sourcePaths, sourceFingerprint,
      inputSignature: compileInputSignature(requestSnapshot, plan), purpose: request.purpose, route: request.route
    };
  }
}

/** Hashes source contents so equal-size edits or coarse adapter timestamps cannot pass as current. */
export async function calculateSourceFingerprint(vault: Vault, sourcePaths: string[]): Promise<string> {
  const paths = [...sourcePaths].sort();
  const entries = new Array<string>(paths.length); let next = 0;
  const worker = async (): Promise<void> => {
    while (next < paths.length) {
      const index = next; next += 1; const path = paths[index];
      const file = vault.getAbstractFileByPath(path);
      entries[index] = file instanceof TFile ? `${path}:content:${hash(await vault.cachedRead(file))}` : `${path}:missing`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, paths.length) }, () => worker()));
  return hash(entries.join("\n"));
}

/** Creates exporter input while retaining `session.book` by reference. */
export function createPreparedExportRequest(session: PreparedCompileSession, outputPath: string, keepTemporaryMarkdown: boolean, signal?: AbortSignal, onCommit?: () => void, onProgress?: (stage: string) => void) {
  return { book: session.book, profile: session.profile, markdown: session.result.markdown, outputPath, variables: session.variables, keepTemporaryMarkdown, signal, onCommit, onProgress };
}
/** Fingerprints all author inputs that can change model or output preparation. */
export function compileInputSignature(request: SimpleCompileRequest, plan: ContentPlanItem[]): string {
  return hash(JSON.stringify({
    root: request.manuscriptRoot, preset: request.structurePreset, front: request.includeFrontMatter,
    back: request.includeBackMatter, docx: request.docxPreset,
    formatting: request.formatting, tableOfContents: request.tableOfContents, partDisplay: request.partDisplay, chapterDisplay: request.chapterDisplay,
    custom: request.custom,
    plan: plan.map(({ path, role, included, order, userOverride }) => ({ path, role, included, order, userOverride }))
  }));
}
/**
 * Tests whether current semantic inputs still match a prepared session.
 * @returns `true` only when the deterministic input signature is unchanged.
 * @remarks Pure; source-content freshness is checked separately and asynchronously.
 */
export function preparedSessionMatchesInputs(session: PreparedCompileSession, request: SimpleCompileRequest, plan: ContentPlanItem[]): boolean { return session.inputSignature === compileInputSignature(request, plan); }

function collectExclusions(plan: ContentPlanItem[], book: Book, rootPath: string): PreparedExclusion[] {
  const values = new Map<string, PreparedExclusion>();
  for (const item of plan) if (!isPlanItemIncluded(item, plan, rootPath)) values.set(item.path, { path: item.path, name: item.name, reason: item.exclusionReason ?? "Excluded from the manuscript." });
  for (const item of book.excludedFiles) values.set(item.file.path, { path: item.file.path, name: item.file.basename, reason: item.reason });
  for (const document of allDocuments(book)) {
    if (!document.excluded && !document.content.trim()) values.set(document.file.path, { path: document.file.path, name: document.title, reason: "No manuscript body remains after cleaning." });
  }
  return [...values.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function allDocuments(book: Book): ManuscriptDocument[] {
  const documents: ManuscriptDocument[] = [...book.frontMatter.documents];
  for (const part of book.parts) {
    documents.push(...part.orphanScenes);
    for (const chapter of part.chapters) documents.push(...chapter.scenes);
  }
  documents.push(...book.orphanScenes, ...book.backMatter.documents);
  return documents;
}
function simpleRequestFromProfile(request: CompilePreparationRequest, plan: ContentPlanItem[]): SimpleCompileRequest {
  const profile = request.profile;
  return {
    manuscriptRoot: request.manuscriptRoot,
    structurePreset: "custom",
    includeFrontMatter: profile.includeFrontMatter,
    includeBackMatter: profile.includeBackMatter,
    exportFolder: profile.exportFolder,
    outputFilename: profile.outputFilename,
    outputFormat: profile.exportTarget,
    docxPreset: "standard",
    custom: {
      ...profile, variables: { ...profile.variables },
      metadataFilters: profile.metadataFilters.map((item) => ({ ...item })),
      bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])]
    },
    contentPlan: plan,
    formatting: {
      font: profile.docxFont ?? "Times New Roman",
      fontSize: profile.docxFontSize ?? 12,
      lineSpacing: profile.docxLineSpacing ?? 2,
      indentParagraphs: profile.docxIndentParagraphs ?? true,
      firstLineIndentCm: profile.docxFirstLineIndentCm ?? inchesToCentimetres(profile.docxFirstLineIndent ?? 0.5),
      pageSize: profile.docxPageSize ?? "a4",
      chapterPageBreak: profile.docxChapterPageBreak ?? true,
      titlePage: profile.docxTitlePage ?? true
    },
    tableOfContents: profile.generateTableOfContents,
    downloadAfterExport: profile.downloadAfterExport,
    partDisplay: profile.partDisplay,
    chapterDisplay: profile.chapterDisplay
  };
}
function cloneRequest(request: SimpleCompileRequest, contentPlan: ContentPlanItem[]): SimpleCompileRequest {
  return { ...request, custom: request.custom ? { ...request.custom, variables: request.custom.variables ? { ...request.custom.variables } : undefined, bodySectionAliases: request.custom.bodySectionAliases ? [...request.custom.bodySectionAliases] : undefined } : undefined, formatting: request.formatting ? { ...request.formatting } : undefined, contentPlan: contentPlan.map((item) => ({ ...item })) };
}
function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(16).padStart(8, "0");
}
