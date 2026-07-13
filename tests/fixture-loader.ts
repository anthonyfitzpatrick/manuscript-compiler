/**
 * Filesystem-to-Obsidian fixture adapter for integration tests. It constructs
 * TFolder/TFile-shaped trees and a readable fake vault without replacing
 * production preparation or parsing code.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ScannedBook, ScannedChapter, ScannedPart } from "../src/types";
import { TFile, TFolder } from "obsidian";

interface FixtureFile { path: string; name: string; basename: string; extension: string; absolutePath: string; }
interface FixtureFolder { path: string; name: string; }
const frontNames = new Set(["front matter", "ebook front matter", "print front matter"]); const backNames = new Set(["back matter", "ebook back matter", "print back matter"]);
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export async function loadFixtureScan(rootPath: string): Promise<{ scan: ScannedBook; vault: { cachedRead(file: FixtureFile): Promise<string> } }> {
  const rootAbsolute = path.resolve(rootPath); const root = folder(rootAbsolute, rootAbsolute); const entries = await visibleEntries(rootAbsolute); const folders = entries.filter((entry) => entry.isDirectory()); const front = folders.filter((entry) => frontNames.has(entry.name.toLowerCase())); const back = folders.filter((entry) => backNames.has(entry.name.toLowerCase())); const structural = folders.filter((entry) => !front.includes(entry) && !back.includes(entry));
  const frontMatter = (await Promise.all(front.map((entry) => collectMarkdown(rootAbsolute, path.join(rootAbsolute, entry.name))))).flat(); const backMatter = (await Promise.all(back.map((entry) => collectMarkdown(rootAbsolute, path.join(rootAbsolute, entry.name))))).flat(); const parts = await Promise.all(structural.map((entry) => scanPart(rootAbsolute, path.join(rootAbsolute, entry.name)))); const looseScenes = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => file(rootAbsolute, path.join(rootAbsolute, entry.name)));
  const allMarkdown = [...frontMatter, ...parts.flatMap((part) => [...part.looseScenes, ...part.chapters.flatMap((chapter) => chapter.scenes)]), ...looseScenes, ...backMatter] as never[];
  return { scan: { root: root as never, frontMatter: frontMatter as never, parts, looseScenes: looseScenes as never, backMatter: backMatter as never, allMarkdown, warnings: [] }, vault: { cachedRead: async (item) => readFile(item.absolutePath, "utf8") } };
}
async function scanPart(root: string, absolute: string): Promise<ScannedPart> { const entries = await visibleEntries(absolute); const looseScenes = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => file(root, path.join(absolute, entry.name))); const chapters: ScannedChapter[] = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({ folder: folder(root, path.join(absolute, entry.name)) as never, scenes: await collectMarkdown(root, path.join(absolute, entry.name)) as never }))); return { folder: folder(root, absolute) as never, looseScenes: looseScenes as never, chapters }; }
async function collectMarkdown(root: string, absolute: string): Promise<FixtureFile[]> { const result: FixtureFile[] = []; for (const entry of await visibleEntries(absolute)) { const child = path.join(absolute, entry.name); if (entry.isDirectory()) result.push(...await collectMarkdown(root, child)); else if (entry.name.toLowerCase().endsWith(".md")) result.push(file(root, child)); } return result; }
async function visibleEntries(absolute: string) { return (await readdir(absolute, { withFileTypes: true })).filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("Icon")).sort((a, b) => natural.compare(a.name, b.name)); }
function file(root: string, absolute: string): FixtureFile { const name = path.basename(absolute); return { path: path.relative(root, absolute).split(path.sep).join("/"), name, basename: name.replace(/\.md$/i, ""), extension: "md", absolutePath: absolute }; }
function folder(root: string, absolute: string): FixtureFolder { return { path: path.relative(root, absolute).split(path.sep).join("/") || path.basename(absolute), name: path.basename(absolute) }; }

export async function loadFixtureTree(rootPath: string): Promise<{ root: TFolder; vault: { cachedRead(file: TFile): Promise<string>; getAbstractFileByPath(value: string): TFile | TFolder | null }; setContent(path: string, value: string): void }> {
  const rootAbsolute = path.resolve(rootPath); const entries = new Map<string, TFile | TFolder>(); const content = new Map<string, string>();
  const visit = async (absolute: string, vaultPath: string): Promise<TFolder> => { const current = Object.assign(new TFolder(), { name: path.basename(absolute), path: vaultPath, children: [] as Array<TFile | TFolder> }); entries.set(vaultPath, current); for (const entry of await visibleEntries(absolute)) { const childAbsolute = path.join(absolute, entry.name); const childPath = `${vaultPath}/${entry.name}`; if (entry.isDirectory()) current.children.push(await visit(childAbsolute, childPath)); else if (entry.name.toLowerCase().endsWith(".md")) { const item = Object.assign(new TFile(), { name: entry.name, basename: entry.name.replace(/\.md$/i, ""), extension: "md", path: childPath, parent: current }); entries.set(childPath, item); content.set(childPath, await readFile(childAbsolute, "utf8")); current.children.push(item); } } return current; };
  const rootName = path.basename(rootAbsolute); const root = await visit(rootAbsolute, rootName); const assignParents = (folder: TFolder): void => { folder.children.forEach((child) => { Object.assign(child, { parent: folder }); if (child instanceof TFolder) assignParents(child); }); }; assignParents(root);
  return { root, vault: { cachedRead: async (file) => content.get(file.path) ?? "", getAbstractFileByPath: (value) => entries.get(value) ?? null }, setContent: (value, next) => { content.set(value, next); } };
}
