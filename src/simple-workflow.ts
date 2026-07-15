/**
 * Manuscript Compiler — guided-workspace request and preset resolution.
 *
 * Translates concise author choices into a complete compatibility profile while
 * preserving the workspace plan as authoritative. Called by workspace state and
 * CompilePreparationService; calls no vault or UI APIs.
 */
import type { CompileProfile, DocxStylePreset, ExportTarget, StructuralDisplay, StructurePreset } from "./settings";
import type { ContentPlanItem } from "./content-plan";

/** Controller-owned mutable formatting; centimetres are the canonical UI unit. */
export interface DocxFormatting { font: string; fontSize: number; lineSpacing: number; indentParagraphs: boolean; firstLineIndentCm: number; pageSize: "letter" | "a4"; chapterPageBreak: boolean; titlePage: boolean; }

export const DOCX_FORMATTING_PRESETS: Record<Exclude<DocxStylePreset, "custom">, Readonly<DocxFormatting>> = {
  vellum: { font: "Garamond", fontSize: 12, lineSpacing: 1.15, indentParagraphs: true, firstLineIndentCm: 0.75, pageSize: "a4", chapterPageBreak: true, titlePage: false },
  standard: { font: "Times New Roman", fontSize: 12, lineSpacing: 2, indentParagraphs: true, firstLineIndentCm: 1.27, pageSize: "a4", chapterPageBreak: true, titlePage: false }
};

/** Returns a fresh deterministic preset; Custom copies the caller's values. */
export function docxFormattingForPreset(preset: DocxStylePreset, titlePage = false, current?: DocxFormatting): DocxFormatting {
  if (preset === "custom") return { ...(current ?? DOCX_FORMATTING_PRESETS.standard), titlePage };
  return { ...DOCX_FORMATTING_PRESETS[preset], titlePage };
}

/**
 * Complete author request. Mutable in the workspace, then copied into a prepared
 * session so later UI edits cannot alter reviewed output implicitly.
 */
export interface SimpleCompileRequest {
  manuscriptRoot: string; structurePreset: StructurePreset; includeFrontMatter: boolean; includeBackMatter: boolean;
  exportFolder: string; outputFilename: string; outputFormat: ExportTarget; docxPreset: DocxStylePreset;
  custom?: Partial<CompileProfile>;
  contentPlan?: ContentPlanItem[]; formatting?: DocxFormatting; downloadAfterExport?: boolean;
  tableOfContents?: boolean;
  partDisplay?: StructuralDisplay; chapterDisplay?: StructuralDisplay;
}

export const STRUCTURE_PRESET_NAMES: Record<StructurePreset, string> = {
  "novel-parts": "Novel with Parts", novel: "Novel without Parts", "chapter-notes": "Chapter Notes",
  "short-story": "Short Story", anthology: "Anthology", custom: "Custom"
};

const STRUCTURES: Record<Exclude<StructurePreset, "custom">, Partial<CompileProfile>> = {
  "novel-parts": { useParts: true, chapterSource: "folders", includeSceneTitles: false, partHeadingTemplate: "Part {number}: {name}", chapterHeadingTemplate: "Chapter {number}: {name}", sceneSeparator: "#" },
  novel: { useParts: false, chapterSource: "folders", includeSceneTitles: false, chapterHeadingTemplate: "Chapter {number}: {name}", sceneSeparator: "#" },
  "chapter-notes": { useParts: false, chapterSource: "notes", includeSceneTitles: false, chapterHeadingTemplate: "Chapter {number}: {name}", sceneSeparator: "" },
  "short-story": { useParts: false, chapterSource: "notes", includeSceneTitles: false, partHeadingTemplate: "", chapterHeadingTemplate: "{name}", sceneSeparator: "" },
  anthology: { useParts: true, chapterSource: "notes", includeSceneTitles: false, partHeadingTemplate: "{name}", chapterHeadingTemplate: "{name}", sceneSeparator: "#" }
};

const DOCX: Record<DocxStylePreset, Partial<CompileProfile>> = {
  vellum: { exportTarget: "docx", orderingMethod: "metadata", metadataOrdering: true, stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true, generateTableOfContents: false, keepIntermediateMarkdown: false, blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1, sceneSeparator: "#" },
  standard: { exportTarget: "docx", orderingMethod: "filename", metadataOrdering: false, stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true, generateTableOfContents: false, keepIntermediateMarkdown: false, blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1, sceneSeparator: "* * *" },
  custom: { exportTarget: "docx", stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true, generateTableOfContents: false, keepIntermediateMarkdown: false }
};

/** Resolves one request into a new profile snapshot without mutating the base. */
export function resolveSimpleCompileRequest(request: SimpleCompileRequest, base: CompileProfile): CompileProfile {
  const structure = request.structurePreset === "custom" ? request.custom ?? {} : STRUCTURES[request.structurePreset];
  const formatting = request.formatting ?? docxFormattingForPreset(request.docxPreset, base.docxTitlePage === true);
  return { ...base, ...DOCX[request.docxPreset], ...structure, ...(request.structurePreset === "custom" ? request.custom : {}),
    id: base.id, name: `${STRUCTURE_PRESET_NAMES[request.structurePreset]} · ${request.docxPreset === "vellum" ? "Vellum" : request.docxPreset === "standard" ? "Standard DOCX" : "Custom DOCX"}`,
    manuscriptRoot: request.manuscriptRoot.trim(), exportFolder: request.exportFolder.trim(), outputFilename: request.outputFilename.trim(),
    exportTarget: request.outputFormat, includeFrontMatter: request.includeFrontMatter, includeBackMatter: request.includeBackMatter,
    sceneSeparator: request.docxPreset === "custom" ? request.custom?.sceneSeparator ?? structure.sceneSeparator ?? base.sceneSeparator : DOCX[request.docxPreset].sceneSeparator ?? base.sceneSeparator,
    generateTableOfContents: request.outputFormat !== "markdown" && request.tableOfContents === true,
    variables: { ...base.variables, ...(request.custom?.variables ?? {}) }, metadataFilters: base.metadataFilters.map((rule) => ({ ...rule })), referenceDocx: "", pandocMetadataFile: "", additionalPandocArguments: "",
    contentOrder: request.contentPlan?.filter((item) => item.included && item.role !== "ignore").map((item) => item.path),
    docxFont: formatting.font, docxFontSize: formatting.fontSize, docxLineSpacing: formatting.lineSpacing,
    docxIndentParagraphs: formatting.indentParagraphs, docxFirstLineIndentCm: formatting.firstLineIndentCm, docxPageSize: formatting.pageSize,
    docxChapterPageBreak: formatting.chapterPageBreak, docxTitlePage: formatting.titlePage, downloadAfterExport: request.downloadAfterExport, skipLegacyPreview: request.contentPlan !== undefined,
    partDisplay: request.partDisplay ?? "word-title", chapterDisplay: request.chapterDisplay ?? "word-title", explicitlyIncludedPaths: request.contentPlan?.filter((item) => item.userOverride && item.included).map((item) => item.path), bodySectionAliases: request.custom?.bodySectionAliases ?? base.bodySectionAliases
  };
}

/** Ensures an edited workspace plan wins after compatibility-profile resolution. */
export function applyWorkspacePlanAuthority(profile: CompileProfile, request: SimpleCompileRequest): CompileProfile {
  const plan = request.contentPlan;
  if (!plan) return profile;
  return applyContentPlanAuthority(profile, request.manuscriptRoot, plan);
}

/** Applies structural choices from a content plan without consulting legacy profile inference. */
export function applyContentPlanAuthority(profile: CompileProfile, manuscriptRoot: string, plan: ContentPlanItem[]): CompileProfile {
  const byPath = new Map(plan.map((item) => [item.path, item]));
  const included = (item: ContentPlanItem): boolean => {
    let current: ContentPlanItem | undefined = item;
    while (current) {
      if (!current.included || current.role === "ignore") return false;
      if (current.parentPath === manuscriptRoot) break;
      current = byPath.get(current.parentPath);
    }
    return true;
  };
  profile.useParts = plan.some((item) => item.kind === "folder" && item.role === "part" && included(item));
  profile.chapterSource = plan.some((item) => item.kind === "note" && item.role === "chapter" && included(item)) ? "notes" : "folders";
  profile.metadataOrdering = false;
  profile.orderingMethod = "filename";
  const children = new Map<string, ContentPlanItem[]>();
  plan.forEach((item) => children.set(item.parentPath, [...(children.get(item.parentPath) ?? []), item]));
  const order: string[] = [];
  const visit = (parent: string): void => { [...(children.get(parent) ?? [])].sort((a, b) => a.order - b.order || a.path.localeCompare(b.path)).forEach((item) => { if (included(item)) order.push(item.path); visit(item.path); }); };
  visit(manuscriptRoot);
  profile.contentOrder = order;
  profile.explicitlyIncludedPaths = plan.filter((item) => item.kind === "note" && item.userOverride && included(item)).map((item) => item.path);
  return profile;
}

/** Returns author-facing input errors without touching the vault. */
export function validateSimpleCompileRequest(request: SimpleCompileRequest): string[] {
  const errors: string[] = [];
  if (!request.manuscriptRoot.trim()) errors.push("Choose a manuscript folder.");
  if (!request.outputFilename.trim()) errors.push("Enter an output filename.");
  if (/[\\/:*?"<>|]/.test(request.outputFilename.replace(/\.(?:docx|md)$/i, ""))) errors.push("The output filename contains characters that are not allowed.");
  if (/[/\\]/.test(request.outputFilename)) errors.push("The output filename must not contain a folder path.");
  return errors;
}

/** Maps legacy structural settings to the closest safe automatic-plan preset. */
export function inferStructurePreset(profile: CompileProfile): StructurePreset {
  if (profile.useParts && profile.chapterSource === "notes") return "anthology";
  if (profile.useParts) return "novel-parts";
  if (profile.chapterSource === "notes") return "chapter-notes";
  return "novel";
}
