import { parseYaml, TAbstractFile, TFile, TFolder, type Vault } from "obsidian";
import type { CompileProfile, StructurePreset } from "./settings";
import type { ScannedBook, ScannedChapter, ScannedPart } from "./types";
import { cleanManuscriptContent, hasProjectMetadataLeakage } from "./filters";

export type ContentRole = "front-matter" | "transparent" | "part" | "chapter" | "scene" | "back-matter" | "ignore";
export interface ContentPlanItem { path: string; parentPath: string; name: string; kind: "folder" | "note"; role: ContentRole; included: boolean; order: number; exclusionReason?: string; warning?: string; userOverride?: boolean; }

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const frontPattern = /^(?:ebook |print )?front matter$/i;
const backPattern = /^(?:ebook |print )?back matter$/i;
const excludedFolders = new Set(["archive", "archives", "development", "export", "exports", "research", "notes", "revision notes", "planning", "characters", "locations", "plotlines", "dashboards", "templates", "attachments", "images", "deleted", "trash", "previous drafts", "old drafts"]);
const transparentFolders = new Set(["manuscript", "draft", "drafts", "book", "content", "chapters"]);
const excludedYamlKinds = new Set(["dashboard", "character", "location", "plotline", "research", "planning", "revision"]);
const matterOrder: Record<string, number> = { "title page": 10, copyright: 20, dedication: 30, epigraph: 40, contents: 50, preface: 60, prologue: 70, acknowledgements: 100, "about the author": 110, "also by the author": 120, newsletter: 130, "copyright notes": 140 };

export function normalizedProjectName(value: string): string { return value.replace(/\.[^.]+$/, "").replace(/^\s*\d+[\s._—–-]*/, "").replace(/[_.—–-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }

export function createContentPlan(root: TFolder, preset: StructurePreset): ContentPlanItem[] {
  const items: ContentPlanItem[] = [];
  const visit = (folder: TFolder, semanticDepth: number, inheritedMatter?: "front-matter" | "back-matter"): void => {
    const children = folder.children.filter((item) => !item.name.startsWith(".") && (item instanceof TFolder || item instanceof TFile && item.extension.toLowerCase() === "md")).sort((a, b) => inheritedMatter ? (matterOrder[normalizedProjectName(a.name)] ?? 1000) - (matterOrder[normalizedProjectName(b.name)] ?? 1000) || collator.compare(a.name, b.name) : collator.compare(a.name, b.name));
    children.forEach((child, order) => {
      const kind = child instanceof TFolder ? "folder" : "note";
      const suggestion = inheritedMatter ? { role: inheritedMatter } : inferredRole(child, semanticDepth, preset); const excluded = suggestion.role === "ignore";
      items.push({ path: child.path, parentPath: folder.path, name: kind === "note" ? (child as TFile).basename : child.name, kind, role: suggestion.role, included: !excluded, order, exclusionReason: suggestion.reason });
      if (child instanceof TFolder) visit(child, semanticDepth + (suggestion.role === "transparent" || suggestion.role === "front-matter" || suggestion.role === "back-matter" || suggestion.role === "ignore" ? 0 : 1), suggestion.role === "front-matter" || suggestion.role === "back-matter" ? suggestion.role : inheritedMatter);
    });
  };
  visit(root, 0);
  return items;
}

function inferredRole(item: TAbstractFile, semanticDepth: number, preset: StructurePreset): { role: ContentRole; reason?: string } {
  const normalized = normalizedProjectName(item.name); const isFolder = item instanceof TFolder;
  if (isFolder && frontPattern.test(normalized)) return { role: "front-matter" };
  if (isFolder && backPattern.test(normalized)) return { role: "back-matter" };
  if (isFolder && excludedFolders.has(normalized)) return { role: "ignore", reason: `Project folder “${item.name}” is excluded by default.` };
  if (isFolder && transparentFolders.has(normalized)) return { role: "transparent" };
  if (!isFolder && /dashboard/i.test(item.name)) return { role: "ignore", reason: "Dashboard/index note excluded by default." };
  if (!isFolder && (/^_/.test(item.name) || normalized === "revision notes")) return { role: "ignore", reason: normalized === "revision notes" ? "Revision note excluded by default." : "Underscore-prefixed project note excluded by default." };
  if (!isFolder) return { role: preset === "chapter-notes" || preset === "short-story" || preset === "anthology" ? "chapter" : "scene" };
  if (/^part\b/i.test(normalized)) return { role: "part" };
  if (/^(?:chapter\b|\d+\s+chapter\b)/i.test(normalized)) return { role: "chapter" };
  if (semanticDepth === 0 && (preset === "novel-parts" || preset === "anthology")) return { role: "part" };
  return { role: "chapter" };
}

export async function classifyContentPlan(vault: Vault, plan: ContentPlanItem[]): Promise<ContentPlanItem[]> {
  await Promise.all(plan.filter((item) => item.kind === "note" && item.role !== "ignore").map(async (item) => {
    const file = vault.getAbstractFileByPath(item.path); if (!(file instanceof TFile)) return; const raw = await vault.cachedRead(file);
    const yaml = frontmatter(raw); const kind = [yaml.type, yaml["note type"], yaml.category].find((value) => typeof value === "string"); const normalizedKind = typeof kind === "string" ? normalizedProjectName(kind) : "";
    if (excludedYamlKinds.has(normalizedKind)) { item.role = "ignore"; item.included = false; item.exclusionReason = `YAML classifies this as ${kind}.`; return; }
    const cleaned = cleanManuscriptContent(raw, ["Scene", "Manuscript", "Text", "Draft", "Body"]);
    if (!cleaned.trim()) { item.role = "ignore"; item.included = false; item.exclusionReason = "No manuscript body remains after cleaning."; }
    else if (hasProjectMetadataLeakage(cleaned)) item.warning = "Recognised project metadata remains outside the removable metadata regions.";
  }));
  return plan;
}
export function isPlanItemIncluded(item: ContentPlanItem, plan: ContentPlanItem[], rootPath: string): boolean { const byPath = new Map(plan.map((candidate) => [candidate.path, candidate])); let current: ContentPlanItem | undefined = item; while (current) { if (!current.included || current.role === "ignore") return false; if (current.parentPath === rootPath) break; current = byPath.get(current.parentPath); } return true; }

function frontmatter(markdown: string): Record<string, unknown> { const match = markdown.replace(/^\uFEFF/, "").match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/); if (!match) return {}; try { const value = parseYaml(match[1]); if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [normalizedProjectName(key), item])); } catch { return {}; } }

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
  const rank = (path: string): number => byPath.get(path)?.order ?? Number.MAX_SAFE_INTEGER;
  const sortFiles = (files: TFile[]): TFile[] => [...files].filter(enabled).sort((a, b) => rank(a.path) - rank(b.path) || collator.compare(a.name, b.name));
  const roleFor = (path: string): ContentRole | undefined => byPath.get(path)?.role;
  const itemEnabled = (item: ContentPlanItem): boolean => isPlanItemIncluded(item, plan, scan.root.path);
  const ancestorWithRole = (path: string, role: ContentRole): string | undefined => {
    let current = path;
    while (current !== scan.root.path) { if (roleFor(current) === role) return current; const slash = current.lastIndexOf("/"); if (slash < 0) return; current = current.slice(0, slash); }
    return;
  };
  const files = scan.allMarkdown.filter(enabled);
  const frontMatter = sortFiles(files.filter((file) => roleFor(file.path) === "front-matter" || ancestorWithRole(file.path, "front-matter")));
  const backMatter = sortFiles(files.filter((file) => roleFor(file.path) === "back-matter" || ancestorWithRole(file.path, "back-matter")));
  const body = files.filter((file) => !frontMatter.includes(file) && !backMatter.includes(file));
  const chapterFolders = plan.filter((item) => item.kind === "folder" && item.role === "chapter" && itemEnabled(item)).map((item) => folders.get(item.path)).filter((folder): folder is TFolder => folder !== undefined);
  const chapter = (folder: TFolder): ScannedChapter => ({ folder, scenes: sortFiles(body.filter((file) => file.path.startsWith(`${folder.path}/`) && !chapterFolders.some((nested) => nested.path !== folder.path && nested.path.startsWith(`${folder.path}/`) && file.path.startsWith(`${nested.path}/`)))) });
  let parts: ScannedPart[];
  let looseScenes: TFile[];
  if (profile.useParts) {
    const partFolders = plan.filter((item) => item.kind === "folder" && item.role === "part" && itemEnabled(item)).sort((a, b) => a.order - b.order).map((item) => folders.get(item.path)).filter((folder): folder is TFolder => folder !== undefined);
    parts = partFolders.map((folder) => { const chapters = chapterFolders.filter((candidate) => candidate.path.startsWith(`${folder.path}/`) && !partFolders.some((nested) => nested.path !== folder.path && candidate.path.startsWith(`${nested.path}/`))).sort((a, b) => rank(a.path) - rank(b.path)).map(chapter); const chapterPaths = chapters.map((item) => item.folder.path); const loose = sortFiles(body.filter((file) => file.path.startsWith(`${folder.path}/`) && !chapterPaths.some((path) => file.path.startsWith(`${path}/`)))); return { folder, chapters, looseScenes: loose }; });
    const partPaths = partFolders.map((folder) => folder.path); looseScenes = sortFiles(body.filter((file) => !partPaths.some((path) => file.path.startsWith(`${path}/`))));
  } else {
    parts = chapterFolders.sort((a, b) => rank(a.path) - rank(b.path)).map((folder) => ({ folder, chapters: [], looseScenes: chapter(folder).scenes }));
    const chapterPaths = chapterFolders.map((folder) => folder.path); looseScenes = sortFiles(body.filter((file) => !chapterPaths.some((path) => file.path.startsWith(`${path}/`))));
  }
  return { ...scan, frontMatter, backMatter, parts, looseScenes, allMarkdown: [...frontMatter, ...body, ...backMatter], warnings: scan.warnings.filter((warning) => !/orphan scene|front matter folder|back matter folder/i.test(warning)) };
}
