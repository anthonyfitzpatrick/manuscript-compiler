export interface ManuscriptCompilerSettings {
  defaultManuscriptFolder: string;
  defaultExportFolder: string;
  includeFrontMatter: boolean;
  includeBackMatter: boolean;
  stripYamlFrontmatter: boolean;
  includeSceneTitles: boolean;
  sceneSeparator: string;
}

export const DEFAULT_SETTINGS: ManuscriptCompilerSettings = {
  defaultManuscriptFolder: "",
  defaultExportFolder: "Manuscript Exports",
  includeFrontMatter: true,
  includeBackMatter: true,
  stripYamlFrontmatter: true,
  includeSceneTitles: false,
  sceneSeparator: "#"
};
