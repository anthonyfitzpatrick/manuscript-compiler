/** UI-neutral conversions for the single saved/new preparation route. */
import type { CompileWorkspaceOrigin } from "./workspace/workspace-types";
import type { SavedCompilation } from "./saved-compilations";
import { savedCompilationRecipeSignature } from "./saved-compilations";
import type { SimpleCompileRequest } from "./simple-workflow";

/** Restores resolved saved choices without mutating defaults or profiles. */
export function savedCompilationRequest(compilation: SavedCompilation): SimpleCompileRequest {
  const recipe = compilation.recipe; const output = compilation.output;
  return { manuscriptRoot: compilation.root.path, structurePreset: recipe.structurePreset, includeFrontMatter: recipe.includeFrontMatter, includeBackMatter: recipe.includeBackMatter, exportFolder: "", outputFilename: output.filename, outputFormat: output.format, docxPreset: output.docxPreset, formatting: output.typography ? { ...output.typography } : undefined, tableOfContents: output.tableOfContents, partDisplay: output.partDisplay, chapterDisplay: output.chapterDisplay, custom: { ...recipe.cleaning, includeSceneTitles: recipe.includeSceneTitles, metadataOrdering: recipe.metadataOrdering, orderingMethod: recipe.orderingMethod, metadataFilters: recipe.metadataFilters.map((item) => ({ ...item })), useParts: recipe.useParts, chapterSource: recipe.chapterSource, partHeadingTemplate: recipe.partHeadingTemplate, chapterHeadingTemplate: recipe.chapterHeadingTemplate, blankLinesBetweenSections: recipe.blankLinesBetweenSections, blankLinesBetweenChapters: recipe.blankLinesBetweenChapters, sceneSeparator: output.sceneSeparator, variables: { BookTitle: output.title, Series: "", Author: output.author } } };
}
export function savedWorkspaceOrigin(compilation: SavedCompilation): CompileWorkspaceOrigin { return { kind: "saved", compilationId: compilation.id, name: compilation.name, persistedRecipeSignature: savedCompilationRecipeSignature(compilation) }; }
