import type { TFile, TFolder } from "obsidian";
export interface HierarchyDiagnostic { scenePath: string; inferredRole: string; parentPath: string; parentRole: string; nearestStructuralAncestor: string; transparentReparenting: boolean; parentExcluded: boolean; }
export interface ScannedBook { root: TFolder; frontMatter: TFile[]; parts: ScannedPart[]; looseScenes: TFile[]; backMatter: TFile[]; allMarkdown: TFile[]; warnings: string[]; hierarchyDiagnostics?: HierarchyDiagnostic[]; }
export interface ScannedPart { folder: TFolder; chapters: ScannedChapter[]; looseScenes: TFile[]; }
export interface ScannedChapter { folder: TFolder; scenes: TFile[]; }
