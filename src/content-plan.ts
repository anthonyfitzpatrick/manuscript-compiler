/**
 * Manuscript Compiler — author-controlled structural plan.
 *
 * Bridges mechanical vault discovery and semantic parsing. It infers safe
 * defaults, records explicit author overrides, and rewrites ScannedBook so only
 * authoritative roles, inclusion, and order reach the parser. Called by
 * CompilePreparationService and the Contents workspace; calls content cleaning
 * for note classification.
 *
 * Invariants: the selected root is absent, transparent containers emit no
 * heading, explicit choices beat inference, and flattening retains the nearest
 * Part/Chapter relationship.
 */
import { parseYaml, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import type { CompileProfile, StructurePreset } from "./settings";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";
import { cleanManuscriptContent, hasProjectMetadataLeakage } from "./filters";
import { isUnknownRecord } from "./type-guards";

export type ContentRole = "front-matter" | "transparent" | "part" | "chapter" | "scene" | "back-matter" | "ignore";
/**
 * Mutable workspace record for one discovered item. `detectedRole` remembers
 * inference while `role` is authoritative; `userOverride` protects explicit
 * choices from later parent-role propagation. Preparation copies supplied plans.
 */
export interface ContentPlanItem { path: string; parentPath: string; name: string; kind: "folder" | "note"; role: ContentRole; detectedRole?: ContentRole; included: boolean; order: number; exclusionReason?: string; warning?: string; userOverride?: boolean; }

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const frontPattern = /^(?:ebook |e book |print )?front matter$/i;
const backPattern = /^(?:(?:ebook|e book|print) )?(?:back matter|end matter|backmatter)$/i;
const mixedMatterFolders = new Set(["font and back matter", "front and back matter", "front & back matter"]);
const copyrightContainerPattern = /^copyright notices?$/i;
const excludedFolders = new Set(["archive", "archives", "development", "export", "exports", "research", "notes", "revision notes", "planning", "characters", "locations", "plotlines", "dashboards", "templates", "attachments", "images", "deleted", "trash", "previous drafts", "old drafts"]);
const transparentFolders = new Set(["manuscript", "draft", "drafts", "book", "content", "chapters"]);
const excludedYamlKinds = new Set(["dashboard", "character", "location", "plotline", "research", "planning", "revision"]);
const matterOrder: Record<string, number> = { "title page": 10, copyright: 20, "copyright notice": 20, "copyright notices": 20, dedication: 30, epigraph: 40, contents: 50, "table of contents": 50, foreword: 60, preface: 65, prologue: 70, "a note from elin": 90, acknowledgment: 100, acknowledgments: 100, acknowledgement: 100, acknowledgements: 100, "about the author": 110, "also by": 120, "also by the author": 120, newsletter: 130, "back cover blurb": 140, "reader note": 150, "author note": 160, "connect with the author": 170 };

/**
 * Normalises a vault item name for conservative classification comparisons.
 * @param value File or folder display name.
 * @returns Lowercase punctuation/number-prefix-insensitive comparison text.
 * @remarks Pure and non-throwing; never use the result as an exported title.
 */
export function normalizedProjectName(value: string): string { return value.replace(/\.[^.]+$/, "").replace(/^\s*\d+[\s._—–-]*/, "").replace(/[_.—–-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }

/**
 * Creates deterministic initial roles from path/ancestry without reading notes.
 * @param root Exact manuscript root; it is deliberately absent from the result.
 * @param preset Broad inference policy selected by the author.
 * @returns Mutable plan ordered by deterministic sibling traversal.
 * @remarks Reads the in-memory Obsidian tree only; no vault mutation or cancellation.
 */
export function createContentPlan(root: TFolder, preset: StructurePreset): ContentPlanItem[] {
  const items: ContentPlanItem[] = [];
  const normalizedRootName = normalizedProjectName(root.name);
  const visit = (folder: TFolder, semanticDepth: number, inheritedMatter?: "front-matter" | "back-matter"): void => {
    const children = folder.children.filter((item) => !item.name.startsWith(".") && (item instanceof TFolder || item instanceof TFile && item.extension.toLowerCase() === "md")).sort((a, b) => inheritedMatter ? (matterOrder[normalizedProjectName(a.name)] ?? 1000) - (matterOrder[normalizedProjectName(b.name)] ?? 1000) || collator.compare(a.name, b.name) : collator.compare(a.name, b.name));
    children.forEach((child, order) => {
      const kind = child instanceof TFolder ? "folder" : "note";
      const suggestion = inheritedMatter ? { role: inheritedMatter } : inferredRole(child, semanticDepth, preset, normalizedRootName); const excluded = suggestion.role === "ignore";
      items.push({ path: child.path, parentPath: folder.path, name: child instanceof TFile ? child.basename : child.name, kind, role: suggestion.role, detectedRole: suggestion.role, included: !excluded, order, exclusionReason: suggestion.reason });
      if (child instanceof TFolder) {
        const childMatter = matterContext(child, suggestion.role, inheritedMatter);
        visit(child, semanticDepth + (suggestion.role === "transparent" || suggestion.role === "front-matter" || suggestion.role === "back-matter" || suggestion.role === "ignore" ? 0 : 1), childMatter);
      }
    });
  };
  visit(root, 0);
  return items;
}

function inferredRole(item: TAbstractFile, semanticDepth: number, preset: StructurePreset, normalizedRootName: string): { role: ContentRole; reason?: string } {
  const normalized = normalizedProjectName(item.name); const isFolder = item instanceof TFolder;
  if (isFolder && frontPattern.test(normalized)) return { role: "front-matter" };
  if (isFolder && backPattern.test(normalized)) return { role: "back-matter" };
  if (isFolder && (mixedMatterFolders.has(normalized) || copyrightContainerPattern.test(normalized))) return { role: "transparent" };
  if (isFolder && excludedFolders.has(normalized)) return { role: "ignore", reason: `Project folder “${item.name}” is excluded by default.` };
  if (isFolder && (transparentFolders.has(normalized) || normalized === normalizedRootName || isNestedBookContainer(item, normalized))) return { role: "transparent" };
  if (!isFolder && /dashboard/i.test(item.name)) return { role: "ignore", reason: "Dashboard/index note excluded by default." };
  if (!isFolder && (/^_/.test(item.name) || normalized === "revision notes")) return { role: "ignore", reason: normalized === "revision notes" ? "Revision note excluded by default." : "Underscore-prefixed project note excluded by default." };
  if (!isFolder && isFrontMatterNote(normalized)) return { role: "front-matter" };
  if (!isFolder && isBackMatterNote(normalized)) return { role: "back-matter" };
  if (!isFolder) return { role: preset === "chapter-notes" || preset === "short-story" || preset === "anthology" ? "chapter" : "scene" };
  if (/^part\b/i.test(normalized)) return { role: "part" };
  if (/^(?:chapter\b|\d+\s+chapter\b)/i.test(normalized)) return { role: "chapter" };
  if (semanticDepth === 0 && (preset === "novel-parts" || preset === "anthology")) return { role: "part" };
  return { role: "chapter" };
}

function matterContext(folder: TFolder, role: ContentRole, inherited?: "front-matter" | "back-matter"): "front-matter" | "back-matter" | undefined {
  if (role === "front-matter" || role === "back-matter") return role;
  const normalized = normalizedProjectName(folder.name);
  if (copyrightContainerPattern.test(normalized)) return "front-matter";
  if (mixedMatterFolders.has(normalized)) return undefined;
  return inherited;
}

function isNestedBookContainer(folder: TFolder, normalized: string): boolean {
  if (!/^book(?:\s+\d+)?(?:\s|$)/i.test(normalized)) return false;
  return folder.children.some((child) => child instanceof TFolder && /^(?:part|chapter)\b/i.test(normalizedProjectName(child.name)));
}

function isFrontMatterNote(normalized: string): boolean {
  return /^(?:title page|copyright|dedication|epigraph|foreword|preface|prologue|contents|table of contents)(?:\s|$)/i.test(normalized);
}

function isBackMatterNote(normalized: string): boolean {
  return /^(?:a note from elin|about the author|acknowledg(?:e)?ments?|also by|back cover blurb|newsletter|reader note|author note|connect with the author)(?:\s|$)/i.test(normalized);
}

/**
 * Enriches inferred note roles using YAML type and cleaned body presence.
 * @param vault Obsidian read boundary.
 * @param plan Mutable plan produced by `createContentPlan`.
 * @returns The same plan reference after asynchronous classification.
 * @throws Propagates vault read failures; performs no writes and has no partial rollback.
 * @remarks Content is used only for classification and is never logged.
 */
export async function classifyContentPlan(vault: Vault, plan: ContentPlanItem[]): Promise<ContentPlanItem[]> {
  await Promise.all(plan.filter((item) => item.kind === "note" && item.role !== "ignore").map(async (item) => {
    const file = vault.getAbstractFileByPath(item.path); if (!(file instanceof TFile)) return; const raw = await vault.cachedRead(file);
    const yaml = frontmatter(raw); const kind = [yaml.type, yaml["note type"], yaml.category].find((value) => typeof value === "string"); const normalizedKind = typeof kind === "string" ? normalizedProjectName(kind) : "";
    if (excludedYamlKinds.has(normalizedKind)) { item.role = "ignore"; item.detectedRole = "ignore"; item.included = false; item.exclusionReason = `YAML classifies this as ${kind}.`; return; }
    const cleaned = cleanManuscriptContent(raw, ["Scene", "Manuscript", "Text", "Draft", "Body"]);
    if (!cleaned.trim()) { item.role = "ignore"; item.detectedRole = "ignore"; item.included = false; item.exclusionReason = "No manuscript body remains after cleaning."; }
    else if (hasProjectMetadataLeakage(cleaned)) item.warning = "Recognised project metadata remains outside the removable metadata regions.";
  }));
  return plan;
}

/**
 * Propagates a changed matter role to untouched descendant notes.
 * @remarks Mutates only `plan`; explicit author overrides remain authoritative.
 */
export function applyMatterRoleInheritance(plan: ContentPlanItem[], folderPath: string, role: ContentRole, previousRole?: ContentRole): void {
  const matterRole = role === "front-matter" || role === "back-matter" ? role : undefined;
  const wasMatter = previousRole === "front-matter" || previousRole === "back-matter";
  if (!matterRole && !wasMatter) return;
  plan.filter((item) => item.kind === "note" && item.path.startsWith(`${folderPath}/`) && !item.userOverride).forEach((item) => {
    item.role = matterRole ?? item.detectedRole ?? item.role;
    item.exclusionReason = item.role === "ignore" ? item.exclusionReason : undefined;
  });
}
/**
 * Resolves effective inclusion through ancestors to the exact root.
 * @returns `false` when the item or any represented ancestor is excluded/ignored.
 * @remarks Pure; missing ancestors do not invent an exclusion.
 */
export function isPlanItemIncluded(item: ContentPlanItem, plan: ContentPlanItem[], rootPath: string): boolean { const byPath = new Map(plan.map((candidate) => [candidate.path, candidate])); let current: ContentPlanItem | undefined = item; while (current) { if (!current.included || current.role === "ignore") return false; if (current.parentPath === rootPath) break; current = byPath.get(current.parentPath); } return true; }

function frontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.replace(/^\uFEFF/, "").match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/);
  if (!match) return {};
  try {
    const value: unknown = parseYaml(match[1]);
    if (!isUnknownRecord(value)) return {};
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) normalized[normalizedProjectName(key)] = item;
    return normalized;
  } catch { return {}; }
}

/**
 * Reconstructs scanner output using nearest included structural ancestors. This
 * is the transparent-container flattening boundary and must preserve source paths,
 * manual order, explicit roles, and uniqueness of descendants.
 * @param scan Mechanical scanner output for one root.
 * @param plan Authoritative corrected plan.
 * @param profile Resolved structural profile.
 * @returns A new scan shape suitable for the parser; source objects are not changed.
 * @remarks Pure with respect to the vault. It does not read note content or cancel.
 */
export function applyContentPlan(scan: ScannedBook, plan: ContentPlanItem[], profile: CompileProfile): ScannedBook {
  if (!plan.length) return scan;
  const byPath = new Map(plan.map((item) => [item.path, item]));
  const folders = new Map<string, TFolder>();
  const collectFolders = (folder: TFolder): void => { folders.set(folder.path, folder); folder.children.forEach((child) => { if (child instanceof TFolder) collectFolders(child); }); };
  collectFolders(scan.root);
  const enabled = (file: TFile): boolean => {
    let path = file.path;
    while (path.startsWith(scan.root.path) && path !== scan.root.path) { const item = byPath.get(path); if (item && (!item.included || item.role === "ignore")) return false; const slash = path.lastIndexOf("/"); if (slash < 0) break; path = path.slice(0, slash); }
    return true;
  };
  const globalRanks = new Map((profile.contentOrder ?? []).map((path, index) => [path, index]));
  const rank = (path: string): number => globalRanks.get(path) ?? byPath.get(path)?.order ?? Number.MAX_SAFE_INTEGER;
  const sortFiles = (files: TFile[]): TFile[] => [...files].filter(enabled).sort((a, b) => rank(a.path) - rank(b.path) || collator.compare(a.name, b.name));
  const roleFor = (path: string): ContentRole | undefined => byPath.get(path)?.role;
  const itemEnabled = (item: ContentPlanItem): boolean => isPlanItemIncluded(item, plan, scan.root.path);
  const nearestAncestorWithRole = (path: string, role: ContentRole): string | undefined => {
    let current = byPath.get(path)?.parentPath ?? parentPath(path);
    while (current && current !== scan.root.path) {
      const item = byPath.get(current);
      if (item && item.role === role && itemEnabled(item)) return current;
      current = item?.parentPath ?? parentPath(current);
    }
    return;
  };
  const files = scan.allMarkdown.filter(enabled);
  const frontMatter = sortFiles(files.filter((file) => roleFor(file.path) === "front-matter" || nearestAncestorWithRole(file.path, "front-matter")));
  const backMatter = sortFiles(files.filter((file) => roleFor(file.path) === "back-matter" || nearestAncestorWithRole(file.path, "back-matter")));
  const body = files.filter((file) => !frontMatter.includes(file) && !backMatter.includes(file));
  const chapterFolders = plan.filter((item) => item.kind === "folder" && item.role === "chapter" && itemEnabled(item)).sort((a, b) => rank(a.path) - rank(b.path)).map((item) => folders.get(item.path)).filter((folder): folder is TFolder => folder !== undefined);
  const chapter = (folder: TFolder): ScannedChapter => ({ folder, scenes: sortFiles(body.filter((file) => nearestAncestorWithRole(file.path, "chapter") === folder.path)) });
  let parts: ScannedPart[];
  let looseScenes: TFile[];
  if (profile.useParts) {
    const partFolders = plan.filter((item) => item.kind === "folder" && item.role === "part" && itemEnabled(item)).sort((a, b) => rank(a.path) - rank(b.path)).map((item) => folders.get(item.path)).filter((folder): folder is TFolder => folder !== undefined);
    parts = partFolders.map((folder) => {
      const chapters = chapterFolders.filter((candidate) => nearestAncestorWithRole(candidate.path, "part") === folder.path).map(chapter);
      const loose = sortFiles(body.filter((file) => nearestAncestorWithRole(file.path, "part") === folder.path && nearestAncestorWithRole(file.path, "chapter") === undefined));
      return { folder, chapters, looseScenes: loose };
    });
    looseScenes = sortFiles(body.filter((file) => nearestAncestorWithRole(file.path, "part") === undefined && nearestAncestorWithRole(file.path, "chapter") === undefined));
  } else {
    parts = chapterFolders.sort((a, b) => rank(a.path) - rank(b.path)).map((folder) => ({ folder, chapters: [], looseScenes: chapter(folder).scenes }));
    const chapterPaths = chapterFolders.map((folder) => folder.path); looseScenes = sortFiles(body.filter((file) => !chapterPaths.some((path) => file.path.startsWith(`${path}/`))));
  }
  const potentialOrphans: TFile[] = [];
  if (profile.chapterSource === "folders") {
    potentialOrphans.push(...looseScenes);
    for (const part of parts) potentialOrphans.push(...part.looseScenes);
  }
  const hierarchyDiagnostics = potentialOrphans.map((file) => hierarchyDiagnostic(file, scan.root.path, byPath, itemEnabled, nearestAncestorWithRole));
  return { ...scan, frontMatter, backMatter, parts, looseScenes, allMarkdown: [...frontMatter, ...body, ...backMatter], warnings: scan.warnings.filter((warning) => !/orphan scene|front matter folder|back matter folder/i.test(warning)), hierarchyDiagnostics };
}

function hierarchyDiagnostic(file: TFile, rootPath: string, byPath: ReadonlyMap<string, ContentPlanItem>, included: (item: ContentPlanItem) => boolean, nearest: (path: string, role: ContentRole) => string | undefined) {
  const item = byPath.get(file.path); const parent = item ? byPath.get(item.parentPath) : undefined;
  const nearestChapter = nearest(file.path, "chapter"); const nearestPart = nearest(file.path, "part");
  let current = item?.parentPath; let transparentReparenting = false;
  while (current && current !== rootPath) { const ancestor = byPath.get(current); if (ancestor?.role === "transparent") transparentReparenting = true; current = ancestor?.parentPath ?? parentPath(current); }
  const relative = (value: string | undefined): string => !value ? "none" : value === rootPath ? "." : value.startsWith(`${rootPath}/`) ? value.slice(rootPath.length + 1) : value;
  return { scenePath: relative(file.path), inferredRole: item?.detectedRole ?? item?.role ?? "unknown", parentPath: relative(item?.parentPath), parentRole: parent?.role ?? "book-root", nearestStructuralAncestor: relative(nearestChapter ?? nearestPart), transparentReparenting, parentExcluded: parent ? !included(parent) : false };
}

function parentPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}
