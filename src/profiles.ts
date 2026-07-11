import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";
import { DEFAULT_OPTIONS } from "./settings";

const VELLUM_OPTIONS = { ...DEFAULT_OPTIONS, orderingMethod: "metadata" as const, metadataOrdering: true, partHeadingTemplate: "Part {number}: {name}", chapterHeadingTemplate: "Chapter {number}: {name}", removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true };
export function profileId(): string { return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function profile(name: string, options = DEFAULT_OPTIONS): CompileProfile { return { ...options, metadataFilters: options.metadataFilters.map((rule) => ({ ...rule })), id: profileId(), name, manuscriptRoot: "", exportFolder: "Manuscript Exports", outputFilename: "{BookTitle} Manuscript.md", variables: { BookTitle: "", Series: "", Author: "" }, exportTarget: "markdown", referenceDocx: "", pandocMetadataFile: "", additionalPandocArguments: "", generateTableOfContents: false, keepIntermediateMarkdown: false }; }
export function createDefaultProfiles(): CompileProfile[] { return [profile("Default"), profile("Vellum", VELLUM_OPTIONS)]; }
export function duplicateProfile(source: CompileProfile, name = `${source.name} Copy`): CompileProfile { return { ...source, id: profileId(), name, metadataFilters: source.metadataFilters.map((rule) => ({ ...rule })), variables: { ...source.variables } }; }
export function migrateSettings(settings: ManuscriptCompilerSettings): ManuscriptCompilerSettings {
  if (settings.profiles.length > 0) { settings.profiles = settings.profiles.map((item) => ({ ...item, exportTarget: item.exportTarget ?? settings.defaultExportFormat ?? "markdown", referenceDocx: item.referenceDocx ?? settings.defaultReferenceDocx ?? "", pandocMetadataFile: item.pandocMetadataFile ?? "", additionalPandocArguments: item.additionalPandocArguments ?? "", generateTableOfContents: item.generateTableOfContents ?? false, keepIntermediateMarkdown: item.keepIntermediateMarkdown ?? settings.keepTemporaryMarkdown ?? false })); return settings; }
  const profiles = createDefaultProfiles(); const active = profiles[settings.defaultCompilePreset === "vellum" ? 1 : 0];
  Object.assign(active, {
    manuscriptRoot: settings.defaultManuscriptFolder, exportFolder: settings.defaultExportFolder,
    includeFrontMatter: settings.includeFrontMatter, includeBackMatter: settings.includeBackMatter, includeSceneTitles: settings.includeSceneTitles,
    metadataOrdering: settings.metadataOrdering, orderingMethod: settings.metadataOrdering ? "metadata" : "filename",
    partHeadingTemplate: settings.partHeadingTemplate, chapterHeadingTemplate: settings.chapterHeadingTemplate, sceneSeparator: settings.sceneSeparator,
    stripYamlFrontmatter: settings.stripYamlFrontmatter, removeObsidianComments: settings.removeObsidianComments,
    removeHtmlComments: settings.removeHtmlComments, removeDataviewBlocks: settings.removeDataviewBlocks,
    removeCallouts: settings.removeCallouts, stripInternalLinks: settings.stripInternalLinks
  });
  return { ...settings, profiles, activeProfileId: active.id, defaultProfileId: active.id };
}
export function repairSettings(settings: ManuscriptCompilerSettings): ManuscriptCompilerSettings {
  const warnings: string[] = []; if (!Array.isArray(settings.profiles)) { settings.profiles = []; warnings.push("Invalid profile storage was recovered with default profiles."); } const repaired = migrateSettings(settings);
  if (!Array.isArray(repaired.exportHistory)) { repaired.exportHistory = []; warnings.push("Invalid export history was reset."); }
  if (!Array.isArray(repaired.compileLogs)) { repaired.compileLogs = []; warnings.push("Invalid compile logs were reset."); }
  if (!Number.isFinite(repaired.readingWordsPerMinute) || repaired.readingWordsPerMinute <= 0) { repaired.readingWordsPerMinute = 250; warnings.push("Reading speed was repaired to 250 words per minute."); }
  if (!Number.isInteger(repaired.maximumExportHistoryEntries) || repaired.maximumExportHistoryEntries <= 0) { repaired.maximumExportHistoryEntries = 50; warnings.push("Maximum export history was repaired to 50 entries."); }
  repaired.profiles = repaired.profiles.map((candidate, index) => {
    const item = candidate && typeof candidate === "object" ? candidate : createDefaultProfiles()[0]; if (item !== candidate) warnings.push(`Invalid profile entry ${index + 1} was recovered.`);
    const defaults = createDefaultProfiles()[0]; const merged = { ...defaults, ...item, variables: { ...defaults.variables, ...(item.variables ?? {}) }, metadataFilters: Array.isArray(item.metadataFilters) ? item.metadataFilters : [] };
    const validation = validateProfile(merged); if (validation.errors.length) warnings.push(`Profile “${item.name || index + 1}” has configuration issues: ${validation.errors.join(" ")}`);
    if (!merged.id) { merged.id = profileId(); warnings.push(`Profile ${index + 1} was assigned a new identifier.`); }
    if (!merged.name?.trim()) { merged.name = `Recovered Profile ${index + 1}`; warnings.push(`Profile ${index + 1} was assigned a recovery name.`); }
    if (!["markdown", "docx", "markdown-docx"].includes(merged.exportTarget)) { merged.exportTarget = "markdown"; warnings.push(`Profile “${merged.name}” export target was repaired to Markdown.`); }
    for (const key of ["includeFrontMatter", "includeBackMatter", "includeSceneTitles", "metadataOrdering", "stripYamlFrontmatter", "removeObsidianComments", "removeHtmlComments", "removeDataviewBlocks", "removeCallouts", "stripInternalLinks", "generateTableOfContents", "keepIntermediateMarkdown"] as const) if (typeof merged[key] !== "boolean") { (merged[key] as boolean) = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    for (const key of ["manuscriptRoot", "exportFolder", "outputFilename", "partHeadingTemplate", "chapterHeadingTemplate", "sceneSeparator", "referenceDocx", "pandocMetadataFile", "additionalPandocArguments"] as const) if (typeof merged[key] !== "string") { (merged[key] as string) = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    for (const key of ["blankLinesBetweenSections", "blankLinesBetweenChapters"] as const) if (!Number.isInteger(merged[key]) || merged[key] < 0) { merged[key] = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    return merged;
  });
  if (!repaired.profiles.some((item) => item.id === repaired.activeProfileId)) { repaired.activeProfileId = repaired.profiles[0].id; warnings.push("Active profile selection was repaired."); }
  if (!repaired.profiles.some((item) => item.id === repaired.defaultProfileId)) { repaired.defaultProfileId = repaired.profiles[0].id; warnings.push("Default profile selection was repaired."); }
  repaired.configurationWarnings = [...(Array.isArray(repaired.configurationWarnings) ? repaired.configurationWarnings : []), ...warnings].slice(-100);
  return repaired;
}
export function activeProfile(settings: ManuscriptCompilerSettings): CompileProfile {
  return settings.profiles.find((item) => item.id === settings.activeProfileId) ?? settings.profiles.find((item) => item.id === settings.defaultProfileId) ?? settings.profiles[0];
}
export function validateProfile(value: unknown): { profile?: CompileProfile; errors: string[] } {
  const errors: string[] = []; if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: ["Profile must be a JSON object."] };
  const item = value as Partial<CompileProfile>;
  if (typeof item.name !== "string" || !item.name.trim()) errors.push("Profile name is required.");
  for (const key of ["exportFolder", "outputFilename", "partHeadingTemplate", "chapterHeadingTemplate", "sceneSeparator"] as const) if (typeof item[key] !== "string") errors.push(`${key} must be a string.`);
  if (typeof item.outputFilename === "string" && !item.outputFilename.trim()) errors.push("outputFilename is required.");
  for (const key of ["includeFrontMatter", "includeBackMatter", "includeSceneTitles", "metadataOrdering", "stripYamlFrontmatter", "removeObsidianComments", "removeHtmlComments", "removeDataviewBlocks", "removeCallouts", "stripInternalLinks"] as const) if (item[key] !== undefined && typeof item[key] !== "boolean") errors.push(`${key} must be boolean.`);
  for (const key of ["blankLinesBetweenSections", "blankLinesBetweenChapters"] as const) if (item[key] !== undefined && (!Number.isInteger(item[key]) || (item[key] ?? -1) < 0)) errors.push(`${key} must be a non-negative integer.`);
  if (item.orderingMethod !== undefined && item.orderingMethod !== "filename" && item.orderingMethod !== "metadata") errors.push("orderingMethod is invalid.");
  if (item.exportTarget !== undefined && !["markdown", "docx", "markdown-docx"].includes(item.exportTarget)) errors.push("exportTarget is invalid.");
  for (const key of ["referenceDocx", "pandocMetadataFile", "additionalPandocArguments"] as const) if (item[key] !== undefined && typeof item[key] !== "string") errors.push(`${key} must be a string.`);
  for (const key of ["generateTableOfContents", "keepIntermediateMarkdown"] as const) if (item[key] !== undefined && typeof item[key] !== "boolean") errors.push(`${key} must be boolean.`);
  if (item.variables !== undefined && (typeof item.variables !== "object" || item.variables === null || Array.isArray(item.variables))) errors.push("variables must be an object.");
  if (!Array.isArray(item.metadataFilters)) errors.push("metadataFilters must be an array.");
  else item.metadataFilters.forEach((rule, index) => {
    if (!rule || typeof rule !== "object" || typeof rule.field !== "string" || !rule.field.trim()) errors.push(`metadataFilters[${index}].field is required.`);
    if (rule?.operator !== "equals" && rule?.operator !== "not-equals") errors.push(`metadataFilters[${index}].operator is invalid.`);
    if (typeof rule?.value !== "string") errors.push(`metadataFilters[${index}].value must be a string.`);
  });
  if (errors.length > 0) return { errors };
  const base = profile(item.name?.trim() ?? "Imported");
  const imported = { ...base, ...item, id: profileId(), variables: { ...base.variables, ...(item.variables ?? {}) }, metadataFilters: (item.metadataFilters ?? []).map((rule) => ({ ...rule, id: typeof rule.id === "string" ? rule.id : profileId() })) } as CompileProfile;
  return { profile: imported, errors };
}
