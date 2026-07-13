import { TFile, TFolder, type Vault } from "obsidian";
import { ManuscriptCompiler } from "./compiler";
import { applyContentPlan, classifyContentPlan, createContentPlan, isPlanItemIncluded, type ContentPlanItem } from "./content-plan";
import { MarkdownExporter, type ExportProgressStage, type ExportRequest } from "./exporter";
import type { Book, CompileResult, CompileWarning, ManuscriptStatistics } from "./model";
import type { CompileProfile, StructurePreset } from "./settings";
import { applyContentPlanAuthority, applyWorkspacePlanAuthority, inferStructurePreset, resolveSimpleCompileRequest, type SimpleCompileRequest } from "./simple-workflow";
import type { ScannedBook } from "./types";
import { VaultScanner } from "./vault-scanner";

export interface PreparedExclusion { path: string; name: string; reason: string; }
export type CompilePurpose = "preview" | "compile" | "validation";
export type CompileRoute = "guided" | "current-book" | "selected-folder" | "legacy-profile" | "sample" | "validation";
export interface CompilePreparationRequest {
  manuscriptRoot: string;
  profile: CompileProfile;
  structurePreset?: StructurePreset;
  contentPlan?: ContentPlanItem[];
  simpleRequest?: SimpleCompileRequest;
  purpose: CompilePurpose;
  route: CompileRoute;
}
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

export class CompilePreparationService {
  constructor(private readonly vault: Vault, private readonly baseProfile: CompileProfile, private readonly wordsPerMinute: number) {}

  async prepare(request: SimpleCompileRequest, contentPlan: ContentPlanItem[], signal?: AbortSignal): Promise<PreparedCompileSession> {
    return this.prepareAuthoritative({ manuscriptRoot: request.manuscriptRoot, profile: this.baseProfile, structurePreset: request.structurePreset, contentPlan, simpleRequest: request, purpose: "preview", route: "guided" }, signal);
  }

  async prepareAuthoritative(request: CompilePreparationRequest, signal?: AbortSignal): Promise<PreparedCompileSession> {
    const folder = this.vault.getAbstractFileByPath(request.manuscriptRoot);
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
    const compiler = new ManuscriptCompiler(this.vault);
    const book = await compiler.buildModel(scannedBook, profile, signal);
    const preparedAt = new Date(); const preliminary = compiler.compile(book, profile, "", this.wordsPerMinute, preparedAt, signal);
    const variables = { ...profile.variables, BookTitle: profile.variables.BookTitle || book.title, Date: preparedAt.toISOString().slice(0, 10), Year: preparedAt.getFullYear(), WordCount: preliminary.statistics.totalWordCount, ChapterCount: preliminary.statistics.chapterCount };
    const paths = outputPaths(new MarkdownExporter(this.vault), profile, variables);
    const result = compiler.compile(book, profile, paths[0] ?? "", this.wordsPerMinute, preparedAt, signal);
    const planWarnings: CompileWarning[] = plan.filter((item) => isPlanItemIncluded(item, plan, folder.path) && item.warning).map((item) => ({ severity: "warning", code: "content-plan-warning", message: `${item.name}: ${item.warning}`, path: item.path }));
    const warnings = [...result.issues, ...planWarnings];
    const exclusions = collectExclusions(plan, book, folder.path);
    const sourcePaths = plan.filter((item) => item.kind === "note" && isPlanItemIncluded(item, plan, folder.path)).map((item) => item.path).sort();
    const sourceFingerprint = await calculateSourceFingerprint(this.vault, sourcePaths);
    return { request: requestSnapshot, contentPlan: requestSnapshot.contentPlan ?? [], profile, scannedBook, book, statistics: result.statistics, warnings, exclusions, result: { ...result, issues: warnings, warnings: warnings.map((item) => item.message) }, variables, outputPaths: paths, sourcePaths, sourceFingerprint, inputSignature: compileInputSignature(requestSnapshot, plan), purpose: request.purpose, route: request.route };
  }
}

export async function calculateSourceFingerprint(vault: Vault, sourcePaths: string[]): Promise<string> {
  const entries: string[] = [];
  for (const path of [...sourcePaths].sort()) {
    const file = vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) { entries.push(`${path}:missing`); continue; }
    const stat = file.stat;
    if (stat && Number.isFinite(stat.mtime)) entries.push(`${path}:${stat.mtime}:${stat.size}`);
    else entries.push(`${path}:content:${hash(await vault.cachedRead(file))}`);
  }
  return hash(entries.join("\n"));
}

export function sessionMatchesBook(session: PreparedCompileSession, book: Book): boolean { return session.book === book; }
export function createPreparedExportRequest(session: PreparedCompileSession, outputPath: string, keepTemporaryMarkdown: boolean, signal?: AbortSignal, onCommit?: () => void, onProgress?: (stage: ExportProgressStage) => void): ExportRequest { return { book: session.book, profile: session.profile, markdown: session.result.markdown, outputPath, variables: session.variables, keepTemporaryMarkdown, signal, onCommit, onProgress }; }
export function compileInputSignature(request: SimpleCompileRequest, plan: ContentPlanItem[]): string { return hash(JSON.stringify({ root: request.manuscriptRoot, preset: request.structurePreset, front: request.includeFrontMatter, back: request.includeBackMatter, format: request.outputFormat, docx: request.docxPreset, formatting: request.formatting, partDisplay: request.partDisplay, chapterDisplay: request.chapterDisplay, custom: request.custom, exportFolder: request.exportFolder, outputFilename: request.outputFilename, plan: plan.map(({ path, role, included, order, userOverride }) => ({ path, role, included, order, userOverride })) })); }
export function preparedSessionMatchesInputs(session: PreparedCompileSession, request: SimpleCompileRequest, plan: ContentPlanItem[]): boolean { return session.inputSignature === compileInputSignature(request, plan); }

function outputPaths(exporter: MarkdownExporter, profile: CompileProfile, variables: Record<string, string | number | undefined>): string[] {
  const markdown = exporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".md");
  const docx = exporter.getOutputPath(profile.exportFolder, profile.outputFilename, variables, ".docx");
  return profile.exportTarget === "markdown-docx" ? [markdown, docx] : [profile.exportTarget === "docx" ? docx : markdown];
}

function collectExclusions(plan: ContentPlanItem[], book: Book, rootPath: string): PreparedExclusion[] {
  const values = new Map<string, PreparedExclusion>();
  plan.filter((item) => !isPlanItemIncluded(item, plan, rootPath)).forEach((item) => values.set(item.path, { path: item.path, name: item.name, reason: item.exclusionReason ?? "Excluded from the manuscript." }));
  book.excludedFiles.forEach((item) => values.set(item.file.path, { path: item.file.path, name: item.file.basename, reason: item.reason }));
  for (const document of allDocuments(book)) if (!document.excluded && !document.content.trim()) values.set(document.file.path, { path: document.file.path, name: document.title, reason: "No manuscript body remains after cleaning." });
  return [...values.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function allDocuments(book: Book) { return [...book.frontMatter.documents, ...book.parts.flatMap((part) => [...part.orphanScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)]), ...book.orphanScenes, ...book.backMatter.documents]; }
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
    custom: { ...profile, variables: { ...profile.variables }, metadataFilters: profile.metadataFilters.map((item) => ({ ...item })), bodySectionAliases: [...(profile.bodySectionAliases ?? ["Scene", "Manuscript", "Text", "Draft", "Body"])] },
    contentPlan: plan,
    formatting: {
      font: profile.docxFont ?? "Times New Roman",
      fontSize: profile.docxFontSize ?? 12,
      lineSpacing: profile.docxLineSpacing ?? 2,
      firstLineIndent: profile.docxFirstLineIndent ?? 0.5,
      pageSize: profile.docxPageSize ?? "letter",
      chapterPageBreak: profile.docxChapterPageBreak ?? true,
      titlePage: profile.docxTitlePage ?? true
    },
    downloadAfterExport: profile.downloadAfterExport,
    partDisplay: profile.partDisplay,
    chapterDisplay: profile.chapterDisplay
  };
}
function cloneRequest(request: SimpleCompileRequest, contentPlan: ContentPlanItem[]): SimpleCompileRequest { return { ...request, custom: request.custom ? { ...request.custom, variables: request.custom.variables ? { ...request.custom.variables } : undefined, bodySectionAliases: request.custom.bodySectionAliases ? [...request.custom.bodySectionAliases] : undefined } : undefined, formatting: request.formatting ? { ...request.formatting } : undefined, contentPlan: contentPlan.map((item) => ({ ...item })) }; }
function hash(value: string): string { let result = 2166136261; for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); } return (result >>> 0).toString(16).padStart(8, "0"); }
