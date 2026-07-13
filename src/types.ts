/**
 * Manuscript Compiler — scanner transfer types.
 *
 * Physical discovery records passed from VaultScanner to content-plan rewriting
 * and then ManuscriptParser. They are separate from the semantic model.
 * Production exporters must never accept these types.
 */
import type { TFile, TFolder } from "obsidian";
/** Relative-path-only orphan context safe for diagnostic logs. */
export interface HierarchyDiagnostic { scenePath: string; inferredRole: string; parentPath: string; parentRole: string; nearestStructuralAncestor: string; transparentReparenting: boolean; parentExcluded: boolean; }
/** Mutable physical scan rewritten by ContentPlan before parsing. */
export interface ScannedBook { root: TFolder; frontMatter: TFile[]; parts: ScannedPart[]; looseScenes: TFile[]; backMatter: TFile[]; allMarkdown: TFile[]; warnings: string[]; hierarchyDiagnostics?: HierarchyDiagnostic[]; }
export interface ScannedPart { folder: TFolder; chapters: ScannedChapter[]; looseScenes: TFile[]; }
export interface ScannedChapter { folder: TFolder; scenes: TFile[]; }
