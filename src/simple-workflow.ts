import type { CompileProfile, DocxStylePreset, ExportTarget, StructurePreset } from "./settings";

export interface SimpleCompileRequest {
  manuscriptRoot: string; structurePreset: StructurePreset; includeFrontMatter: boolean; includeBackMatter: boolean;
  exportFolder: string; outputFilename: string; outputFormat: ExportTarget; docxPreset: DocxStylePreset;
  custom?: Partial<CompileProfile>;
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
  vellum: { exportTarget: "docx", orderingMethod: "metadata", metadataOrdering: true, stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true, generateTableOfContents: false, keepIntermediateMarkdown: false, blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1 },
  standard: { exportTarget: "docx", orderingMethod: "filename", metadataOrdering: false, stripYamlFrontmatter: true, removeObsidianComments: true, removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true, generateTableOfContents: false, keepIntermediateMarkdown: false, blankLinesBetweenSections: 1, blankLinesBetweenChapters: 1 }
};

export function resolveSimpleCompileRequest(request: SimpleCompileRequest, base: CompileProfile): CompileProfile {
  const structure = request.structurePreset === "custom" ? request.custom ?? {} : STRUCTURES[request.structurePreset];
  return { ...base, ...DOCX[request.docxPreset], ...structure, ...(request.structurePreset === "custom" ? request.custom : {}),
    id: base.id, name: `${STRUCTURE_PRESET_NAMES[request.structurePreset]} · ${request.docxPreset === "vellum" ? "Vellum" : "Standard DOCX"}`,
    manuscriptRoot: request.manuscriptRoot.trim(), exportFolder: request.exportFolder.trim(), outputFilename: request.outputFilename.trim(),
    exportTarget: request.outputFormat, includeFrontMatter: request.includeFrontMatter, includeBackMatter: request.includeBackMatter,
    variables: { ...base.variables }, metadataFilters: base.metadataFilters.map((rule) => ({ ...rule })), referenceDocx: "", pandocMetadataFile: "", additionalPandocArguments: ""
  };
}

export function validateSimpleCompileRequest(request: SimpleCompileRequest): string[] {
  const errors: string[] = [];
  if (!request.manuscriptRoot.trim()) errors.push("Choose a manuscript folder.");
  if (!request.outputFilename.trim()) errors.push("Enter an output filename.");
  if (/[\\/:*?"<>|]/.test(request.outputFilename.replace(/\.(?:docx|md)$/i, ""))) errors.push("The output filename contains characters that are not allowed.");
  if (/[/\\]/.test(request.outputFilename)) errors.push("The output filename must not contain a folder path.");
  return errors;
}

export function inferStructurePreset(profile: CompileProfile): StructurePreset {
  if (profile.useParts && profile.chapterSource === "notes") return "anthology";
  if (profile.useParts) return "novel-parts";
  if (profile.chapterSource === "notes") return "chapter-notes";
  return "novel";
}
