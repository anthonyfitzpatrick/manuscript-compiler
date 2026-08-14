/**
 * Saved Compilations persistence contract. This dormant module owns only
 * JSON-safe schema-1 state, repair, and recipe comparison; it reads no vault
 * content and is not yet connected to UI, preparation, or export.
 */
import { normalizePath } from "obsidian";
import type { ContentRole } from "./content-plan";
import type { ExportFormat } from "./export-types";
import type { DocxFormatting } from "./simple-workflow";
import type { CleaningSettings, DocxStylePreset, MetadataFilterRule, StructuralDisplay, StructurePreset } from "./settings";
import { clampCentimetres } from "./measurements";
import { isUnknownRecord } from "./type-guards";

export const SAVED_COMPILATIONS_SCHEMA_VERSION = 1;
export const MAX_SAVED_COMPILATIONS = 500;
export const MAX_SAVED_COMPILATION_REFERENCES = 10_000;
export const MAX_SAVED_COMPILATION_ORDER_ENTRIES = 10_000;
const MAX_ID = 160; const MAX_PATH = 4_096; const MAX_NAME = 200;
const ROLES: readonly ContentRole[] = ["front-matter", "transparent", "part", "chapter", "scene", "back-matter", "ignore"];
const FORMATS: readonly ExportFormat[] = ["docx", "odt", "epub", "html", "markdown", "xml"];
const PRESETS: readonly StructurePreset[] = ["novel-parts", "novel", "chapter-notes", "short-story", "anthology", "custom"];
const DOCX_PRESETS: readonly DocxStylePreset[] = ["vellum", "standard", "custom"];
const DISPLAYS: readonly StructuralDisplay[] = ["word", "numeric", "word-title", "numeric-title", "title", "custom"];

export type SavedCompilationItemKind = "folder" | "note";
export interface SavedCompilationRootReference { path: string; }
export interface SavedCompilationFileReference { path: string; parentPath: string; name: string; kind: SavedCompilationItemKind; expectedRole: ContentRole; fingerprint?: string; }
export interface SavedCompilationOverride { reference: SavedCompilationFileReference; included: boolean; role: ContentRole; }
export interface SavedCompilationManualOrder { parentPath: string; childPaths: string[]; }
export interface SavedCompilationRecipe {
  overrides: SavedCompilationOverride[]; manualOrders: SavedCompilationManualOrder[];
  structurePreset: StructurePreset; includeFrontMatter: boolean; includeBackMatter: boolean; includeSceneTitles: boolean;
  cleaning: CleaningSettings; metadataFilters: MetadataFilterRule[]; useParts: boolean; chapterSource: "folders" | "notes";
  orderingMethod: "filename" | "metadata"; metadataOrdering: boolean; partHeadingTemplate: string; chapterHeadingTemplate: string;
  blankLinesBetweenSections: number; blankLinesBetweenChapters: number;
}
export interface SavedCompilationOutputConfiguration {
  format: ExportFormat; filename: string; docxPreset: DocxStylePreset; title: string; author: string; tableOfContents: boolean;
  sceneSeparator: string; partDisplay: StructuralDisplay; chapterDisplay: StructuralDisplay; titlePage: boolean;
  typography?: DocxFormatting; profileOriginId?: string;
}
export interface SavedCompilationObservedSource { sourceFingerprint?: string; inputSignature?: string; references: SavedCompilationFileReference[]; }
export interface SavedCompilationExportFacts { timestamp: number; format: ExportFormat; sourceFingerprint: string; inputSignature: string; recipeSignature: string; }
export interface SavedCompilation {
  id: string; name: string; description?: string; createdAt: number; modifiedAt: number; lastOpenedAt?: number;
  root: SavedCompilationRootReference; recipe: SavedCompilationRecipe; output: SavedCompilationOutputConfiguration;
  observedSource: SavedCompilationObservedSource; lastSuccessfulExport?: SavedCompilationExportFacts;
}
export interface SavedCompilationsStorage { schemaVersion: number; entries: SavedCompilation[]; }
export interface SavedCompilationRepairResult { storage: SavedCompilationsStorage; repaired: number; dropped: number; unsupportedSchema: boolean; }

/** Generates a local collision-resistant practical identifier without a dependency. */
export function savedCompilationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return "saved-" + crypto.randomUUID();
  return "saved-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
}
export function emptySavedCompilationsStorage(): SavedCompilationsStorage { return { schemaVersion: SAVED_COMPILATIONS_SCHEMA_VERSION, entries: [] }; }

/** Normalizes one vault-relative root association without querying the vault. */
export function normaliseSavedCompilationRootPath(value: unknown): string | undefined { return pathValue({ path: value }, "path"); }

/** Repairs unknown persisted data into bounded schema-1 state; malformed entries are isolated. */
export function repairSavedCompilationsStorage(value: unknown): SavedCompilationRepairResult {
  if (!isUnknownRecord(value)) return { storage: emptySavedCompilationsStorage(), repaired: value === undefined ? 0 : 1, dropped: 0, unsupportedSchema: false };
  if (value.schemaVersion !== SAVED_COMPILATIONS_SCHEMA_VERSION) {
    return { storage: emptySavedCompilationsStorage(), repaired: 1, dropped: Array.isArray(value.entries) ? value.entries.length : 0, unsupportedSchema: typeof value.schemaVersion === "number" && value.schemaVersion > SAVED_COMPILATIONS_SCHEMA_VERSION };
  }
  if (!Array.isArray(value.entries)) return { storage: emptySavedCompilationsStorage(), repaired: 1, dropped: 0, unsupportedSchema: false };
  const ids = new Set<string>(); const entries: SavedCompilation[] = []; let repaired = 0; let dropped = 0;
  for (const candidate of value.entries.slice(0, MAX_SAVED_COMPILATIONS)) {
    const entry = repairSavedCompilation(candidate, ids);
    if (!entry) { dropped += 1; continue; }
    if (stableStringify(candidate) !== stableStringify(entry)) repaired += 1;
    ids.add(entry.id); entries.push(entry);
  }
  dropped += Math.max(0, value.entries.length - MAX_SAVED_COMPILATIONS);
  return { storage: { schemaVersion: SAVED_COMPILATIONS_SCHEMA_VERSION, entries }, repaired, dropped, unsupportedSchema: false };
}

/** Repairs one entry; absent identity, root, or output is unsafe and drops only that entry. */
export function repairSavedCompilation(value: unknown, usedIds: ReadonlySet<string> = new Set<string>()): SavedCompilation | undefined {
  if (!isUnknownRecord(value)) return undefined;
  const rootPath = pathValue(value.root, "path"); const name = text(value.name, MAX_NAME); const output = repairOutput(value.output);
  if (!rootPath || !name || !output) return undefined;
  const createdAt = timestamp(value.createdAt, 0);
  return {
    id: repairedId(value.id, usedIds), name, description: optionalText(value.description, 2_000), createdAt, modifiedAt: timestamp(value.modifiedAt, createdAt),
    lastOpenedAt: optionalTimestamp(value.lastOpenedAt), root: { path: rootPath }, recipe: repairRecipe(value.recipe), output,
    observedSource: repairObserved(value.observedSource), lastSuccessfulExport: repairExport(value.lastSuccessfulExport)
  };
}

/** Canonical comparison used later for dirty state; observed state and timestamps are excluded. */
export function savedCompilationRecipeSignature(value: Pick<SavedCompilation, "root" | "recipe" | "output">): string {
  return hash(canonicalRecipe(value));
}
export function savedCompilationRecipeEquals(left: Pick<SavedCompilation, "root" | "recipe" | "output">, right: Pick<SavedCompilation, "root" | "recipe" | "output">): boolean {
  return canonicalRecipe(left) === canonicalRecipe(right);
}
/** Produces a clean JSON-safe envelope containing only supported schema-1 fields. */
export function serialiseSavedCompilations(storage: SavedCompilationsStorage): SavedCompilationsStorage { return repairSavedCompilationsStorage(storage).storage; }

function repairRecipe(value: unknown): SavedCompilationRecipe {
  const item = isUnknownRecord(value) ? value : {};
  return {
    overrides: unique(repairArray(item.overrides, MAX_SAVED_COMPILATION_REFERENCES, repairOverride), (entry) => entry.reference.path),
    manualOrders: unique(repairArray(item.manualOrders, MAX_SAVED_COMPILATION_ORDER_ENTRIES, repairOrder), (entry) => entry.parentPath),
    structurePreset: member(PRESETS, item.structurePreset) ? item.structurePreset : "novel-parts",
    includeFrontMatter: item.includeFrontMatter !== false, includeBackMatter: item.includeBackMatter !== false, includeSceneTitles: item.includeSceneTitles === true,
    cleaning: repairCleaning(item.cleaning), metadataFilters: repairFilters(item.metadataFilters), useParts: item.useParts !== false,
    chapterSource: item.chapterSource === "notes" ? "notes" : "folders", orderingMethod: item.orderingMethod === "metadata" ? "metadata" : "filename",
    metadataOrdering: item.metadataOrdering === true, partHeadingTemplate: text(item.partHeadingTemplate, 500) || "{title}",
    chapterHeadingTemplate: text(item.chapterHeadingTemplate, 500) || "{title}",
    blankLinesBetweenSections: integer(item.blankLinesBetweenSections, 1, 0, 20), blankLinesBetweenChapters: integer(item.blankLinesBetweenChapters, 1, 0, 20)
  };
}
function repairOverride(value: unknown): SavedCompilationOverride | undefined {
  if (!isUnknownRecord(value) || typeof value.included !== "boolean" || !member(ROLES, value.role)) return undefined;
  const reference = repairReference(value.reference); return reference ? { reference, included: value.included, role: value.role } : undefined;
}
function repairOrder(value: unknown): SavedCompilationManualOrder | undefined {
  if (!isUnknownRecord(value) || !Array.isArray(value.childPaths)) return undefined;
  const parentPath = pathValue(value, "parentPath"); const childPaths = strings(value.childPaths, MAX_SAVED_COMPILATION_REFERENCES, MAX_PATH, true);
  return parentPath && childPaths.length ? { parentPath, childPaths } : undefined;
}
function repairReference(value: unknown): SavedCompilationFileReference | undefined {
  if (!isUnknownRecord(value) || (value.kind !== "folder" && value.kind !== "note") || !member(ROLES, value.expectedRole)) return undefined;
  const path = pathValue(value, "path"); const parentPath = pathValue(value, "parentPath"); const name = text(value.name, 255);
  return path && parentPath && name ? { path, parentPath, name, kind: value.kind, expectedRole: value.expectedRole, fingerprint: fingerprint(value.fingerprint) } : undefined;
}
function repairOutput(value: unknown): SavedCompilationOutputConfiguration | undefined {
  if (!isUnknownRecord(value) || !member(FORMATS, value.format)) return undefined;
  const filename = validFilename(value.filename); if (!filename) return undefined;
  return {
    format: value.format, filename, docxPreset: member(DOCX_PRESETS, value.docxPreset) ? value.docxPreset : "standard",
    title: text(value.title, 1_000), author: text(value.author, 1_000), tableOfContents: value.tableOfContents === true,
    sceneSeparator: text(value.sceneSeparator, 100), partDisplay: member(DISPLAYS, value.partDisplay) ? value.partDisplay : "word-title",
    chapterDisplay: member(DISPLAYS, value.chapterDisplay) ? value.chapterDisplay : "word-title", titlePage: value.titlePage === true,
    typography: repairTypography(value.typography), profileOriginId: identifier(value.profileOriginId)
  };
}
function repairTypography(value: unknown): DocxFormatting | undefined {
  if (!isUnknownRecord(value)) return undefined;
  const font = text(value.font, 100); if (!font) return undefined;
  return { font, fontSize: number(value.fontSize, 12, 8, 36), lineSpacing: number(value.lineSpacing, 1, 1, 3),
    indentParagraphs: value.indentParagraphs === true, firstLineIndentCm: clampCentimetres(numberOrUndefined(value.firstLineIndentCm), 0, 3.81, 0.75),
    pageSize: value.pageSize === "letter" ? "letter" : "a4", chapterPageBreak: value.chapterPageBreak === true, titlePage: value.titlePage === true };
}
function repairCleaning(value: unknown): CleaningSettings {
  const item = isUnknownRecord(value) ? value : {};
  return { stripYamlFrontmatter: item.stripYamlFrontmatter !== false, removeObsidianComments: item.removeObsidianComments !== false,
    removeHtmlComments: item.removeHtmlComments === true, removeDataviewBlocks: item.removeDataviewBlocks === true, removeCallouts: item.removeCallouts === true,
    stripInternalLinks: item.stripInternalLinks === true, bodySectionAliases: strings(item.bodySectionAliases, 50, 100, false) };
}
function repairFilters(value: unknown): MetadataFilterRule[] {
  if (!Array.isArray(value)) return []; const repaired: MetadataFilterRule[] = [];
  for (const item of value.slice(0, 100)) {
    if (!isUnknownRecord(item) || (item.operator !== "equals" && item.operator !== "not-equals")) continue;
    const field = text(item.field, 100); const filterValue = text(item.value, 1_000); if (!field || !filterValue) continue;
    repaired.push({ id: identifier(item.id) ?? "filter-" + (repaired.length + 1), field, operator: item.operator, value: filterValue });
  }
  return unique(repaired, (item) => item.id);
}
function repairObserved(value: unknown): SavedCompilationObservedSource {
  const item = isUnknownRecord(value) ? value : {};
  return { sourceFingerprint: fingerprint(item.sourceFingerprint), inputSignature: fingerprint(item.inputSignature),
    references: unique(repairArray(item.references, MAX_SAVED_COMPILATION_REFERENCES, repairReference), (entry) => entry.path) };
}
function repairExport(value: unknown): SavedCompilationExportFacts | undefined {
  if (!isUnknownRecord(value) || !member(FORMATS, value.format)) return undefined;
  const sourceFingerprint = fingerprint(value.sourceFingerprint); const inputSignature = fingerprint(value.inputSignature); const recipeSignature = fingerprint(value.recipeSignature);
  return sourceFingerprint && inputSignature && recipeSignature ? { timestamp: timestamp(value.timestamp, 0), format: value.format, sourceFingerprint, inputSignature, recipeSignature } : undefined;
}
function repairedId(value: unknown, used: ReadonlySet<string>): string {
  const preferred = identifier(value); if (preferred && !used.has(preferred)) return preferred;
  const base = preferred ?? "recovered-saved"; for (let index = 2; index < 10_000; index += 1) { const candidate = (base + "-" + index).slice(0, MAX_ID); if (!used.has(candidate)) return candidate; }
  return savedCompilationId();
}
function identifier(value: unknown): string | undefined { const candidate = text(value, MAX_ID); return candidate && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(candidate) ? candidate : undefined; }
function pathValue(value: unknown, key: string): string | undefined {
  if (!isUnknownRecord(value) || typeof value[key] !== "string") return undefined;
  const raw = value[key]; if (raw.length > MAX_PATH || hasControlCharacter(raw) || /^(?:[\\/]|[A-Za-z]:)/.test(raw)) return undefined;
  const normalized = normalizePath(raw.trim()); return normalized && normalized !== "." && !normalized.split("/").some((segment) => !segment || segment === "." || segment === "..") ? normalized : undefined;
}
function validFilename(value: unknown): string | undefined { const candidate = text(value, 255); return candidate && !/[\\/]/.test(candidate) && !hasControlCharacter(candidate) && !/^(?:[A-Za-z]:|\.)/.test(candidate) ? candidate : undefined; }
function text(value: unknown, maximum: number): string { return typeof value === "string" && value.length <= maximum ? value.trim() : ""; }
function optionalText(value: unknown, maximum: number): string | undefined { const candidate = text(value, maximum); return candidate || undefined; }
function timestamp(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback; }
function optionalTimestamp(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined; }
function integer(value: unknown, fallback: number, minimum: number, maximum: number): number { return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback; }
function number(value: unknown, fallback: number, minimum: number, maximum: number): number { return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback; }
function numberOrUndefined(value: unknown): number | undefined { return typeof value === "number" ? value : undefined; }
function fingerprint(value: unknown): string | undefined { const candidate = text(value, 128); return candidate && /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : undefined; }
function repairArray<T>(value: unknown, maximum: number, repair: (entry: unknown) => T | undefined): T[] { if (!Array.isArray(value)) return []; const result: T[] = []; for (const entry of value.slice(0, maximum)) { const item = repair(entry); if (item) result.push(item); } return result; }
function strings(value: unknown, maximum: number, stringMaximum: number, path: boolean): string[] { if (!Array.isArray(value)) return []; const result: string[] = []; for (const item of value.slice(0, maximum)) { if (typeof item !== "string") continue; const candidate = path ? pathValue({ path: item }, "path") : text(item, stringMaximum); if (candidate) result.push(candidate); } return unique(result, (item) => item); }
function hasControlCharacter(value: string): boolean { for (let index = 0; index < value.length; index += 1) if (value.charCodeAt(index) < 32) return true; return false; }
function unique<T>(values: T[], key: (item: T) => string): T[] { const seen = new Set<string>(); return values.filter((item) => { const candidate = key(item); if (seen.has(candidate)) return false; seen.add(candidate); return true; }); }
function member<T extends string>(values: readonly T[], value: unknown): value is T { return typeof value === "string" && values.includes(value as T); }
function normalRecipe(recipe: SavedCompilationRecipe): SavedCompilationRecipe { return { ...recipe, overrides: [...recipe.overrides].sort((a, b) => a.reference.path.localeCompare(b.reference.path)), manualOrders: [...recipe.manualOrders].sort((a, b) => a.parentPath.localeCompare(b.parentPath)), metadataFilters: [...recipe.metadataFilters].sort((a, b) => a.id.localeCompare(b.id)) }; }
function canonicalRecipe(value: Pick<SavedCompilation, "root" | "recipe" | "output">): string { return stableStringify({ root: value.root, recipe: normalRecipe(value.recipe), output: value.output }); }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]"; if (isUnknownRecord(value)) return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}"; return JSON.stringify(value); }
function hash(value: string): string { let result = 2166136261; for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); } return (result >>> 0).toString(16).padStart(8, "0"); }
