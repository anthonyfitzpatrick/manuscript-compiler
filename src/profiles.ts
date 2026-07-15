/**
 * Manuscript Compiler — settings migration, repair, and profile utilities.
 *
 * Called during plugin load and advanced profile editing. Migration preserves
 * old data while repair supplies safe current defaults and warnings. Both must
 * be idempotent and must not overwrite explicit user choices.
 * This module owns schema evolution/normalisation, not saving, UI state, compile
 * execution, or obsolete tool activation. Functions are synchronous and
 * non-cancellable; malformed input is repaired or reported rather than trusted.
 * Preserve compatibility fields as inert data and identical mobile behavior.
 */
import type { CompileProfile, ManuscriptCompilerSettings } from "./settings";
import { DEFAULT_OPTIONS } from "./settings";
import { clampCentimetres, inchesToCentimetres } from "./measurements";
import { repairCompileLogs, repairExportHistory } from "./history-storage";

const VELLUM_OPTIONS = { ...DEFAULT_OPTIONS, orderingMethod: "metadata" as const, metadataOrdering: true, partHeadingTemplate: "Part {number}: {name}", chapterHeadingTemplate: "Chapter {number}: {name}", removeHtmlComments: true, removeDataviewBlocks: true, removeCallouts: true, stripInternalLinks: true };
export function profileId(): string { return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function profile(name: string, options = DEFAULT_OPTIONS, firstLineIndentCm = 1.27): CompileProfile { return { ...options, metadataFilters: options.metadataFilters.map((rule) => ({ ...rule })), id: profileId(), name, manuscriptRoot: "", exportFolder: "", outputFilename: "{BookTitle}.docx", variables: { BookTitle: "", Series: "", Author: "" }, exportTarget: "docx", referenceDocx: "", pandocMetadataFile: "", additionalPandocArguments: "", generateTableOfContents: false, keepIntermediateMarkdown: false, docxIndentParagraphs: true, docxFirstLineIndentCm: firstLineIndentCm, docxPageSize: "a4" }; }
/** Creates fresh profiles; callers may mutate them without sharing nested arrays. */
export function createDefaultProfiles(): CompileProfile[] { return [profile("Default"), profile("Vellum", VELLUM_OPTIONS, 0.75)]; }
/** Copies mutable nested profile values and assigns a new stable identity. */
export function duplicateProfile(source: CompileProfile, name = `${source.name} Copy`): CompileProfile { return { ...source, id: profileId(), name, metadataFilters: source.metadataFilters.map((rule) => ({ ...rule })), variables: { ...source.variables } }; }
/** Applies historical schema upgrades once while retaining compatibility data. */
export function migrateSettings(settings: ManuscriptCompilerSettings): ManuscriptCompilerSettings {
  if (settings.profiles.length > 0) { settings.profiles = settings.profiles.map((item) => ({ ...item, exportTarget: item.exportTarget ?? settings.defaultExportFormat ?? "markdown", referenceDocx: item.referenceDocx ?? settings.defaultReferenceDocx ?? "", pandocMetadataFile: item.pandocMetadataFile ?? "", additionalPandocArguments: item.additionalPandocArguments ?? "", generateTableOfContents: item.generateTableOfContents ?? false, keepIntermediateMarkdown: item.keepIntermediateMarkdown ?? settings.keepTemporaryMarkdown ?? false, docxIndentParagraphs: item.docxIndentParagraphs ?? true })); return settings; }
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
/** Repairs malformed/current fields after migration and records configuration warnings. */
export function repairSettings(settings: ManuscriptCompilerSettings): ManuscriptCompilerSettings {
  const warnings: string[] = [];
  if (!Array.isArray(settings.profiles)) { settings.profiles = []; warnings.push("Invalid profile storage was recovered with default profiles."); }
  else settings.profiles = settings.profiles.map((candidate, index) => {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
    warnings.push(`Invalid profile entry ${index + 1} was recovered.`);
    return createDefaultProfiles()[0];
  });
  const repaired = migrateSettings(settings);
  const activeForMigration = repaired.profiles.find((item) => item.id === repaired.activeProfileId) ?? repaired.profiles[0];
  repaired.defaultStructurePreset ??= activeForMigration ? (activeForMigration.useParts ? (activeForMigration.chapterSource === "notes" ? "anthology" : "novel-parts") : activeForMigration.chapterSource === "notes" ? "chapter-notes" : "novel") : "novel-parts";
  repaired.defaultDocxStyle ??= repaired.defaultCompilePreset === "vellum" || /vellum/i.test(activeForMigration?.name ?? "") ? "vellum" : "standard";
  if (!(repaired.defaultDocxStyle === "vellum" || repaired.defaultDocxStyle === "standard")) repaired.defaultDocxStyle = "standard";
  repaired.defaultExportFormat ??= "docx"; repaired.warnBeforeOverwrite ??= true; repaired.openAfterCompile ??= false; repaired.includeTitlePageByDefault ??= false; repaired.includeTableOfContentsByDefault ??= activeForMigration?.generateTableOfContents ?? false; repaired.showAdvancedOptions ??= false; repaired.defaultIndentParagraphs = typeof repaired.defaultIndentParagraphs === "boolean" ? repaired.defaultIndentParagraphs : true;
  repaired.saveToVaultByDefault = repaired.saveToVaultByDefault === true; repaired.rememberExternalSaveFolder = repaired.rememberExternalSaveFolder === true; repaired.revealAfterCompile = repaired.revealAfterCompile === true; if (typeof repaired.lastExternalSaveFolder !== "string") repaired.lastExternalSaveFolder = "";
  if (!["docx", "odt", "epub", "html", "markdown", "xml"].includes(repaired.defaultDownloadFormat)) repaired.defaultDownloadFormat = "docx";
  repaired.defaultDocxPageSize = activeForMigration?.docxPageSize === "letter" || activeForMigration?.docxPageSize === "a4" ? activeForMigration.docxPageSize : repaired.defaultDocxPageSize === "letter" ? "letter" : "a4";
  const migratedDefaultIndent = activeForMigration?.docxFirstLineIndentCm ?? (typeof activeForMigration?.docxFirstLineIndent === "number" ? inchesToCentimetres(activeForMigration.docxFirstLineIndent) : repaired.defaultDocxStyle === "vellum" ? 0.75 : 1.27);
  repaired.defaultDocxFirstLineIndentCm = clampCentimetres(migratedDefaultIndent, 0, 3.81, repaired.defaultDocxStyle === "vellum" ? 0.75 : 1.27);
  if (!Array.isArray(repaired.exportHistory)) { repaired.exportHistory = []; warnings.push("Invalid export history was reset."); }
  if (!Array.isArray(repaired.compileLogs)) { repaired.compileLogs = []; warnings.push("Invalid compile logs were reset."); }
  if (!Number.isFinite(repaired.readingWordsPerMinute) || repaired.readingWordsPerMinute <= 0) { repaired.readingWordsPerMinute = 250; warnings.push("Reading speed was repaired to 250 words per minute."); }
  if (!Number.isInteger(repaired.maximumExportHistoryEntries) || repaired.maximumExportHistoryEntries <= 0) { repaired.maximumExportHistoryEntries = 50; warnings.push("Maximum export history was repaired to 50 entries."); }
  repaired.exportHistory = repairExportHistory(repaired.exportHistory).slice(0, repaired.maximumExportHistoryEntries);
  repaired.compileLogs = repairCompileLogs(repaired.compileLogs).slice(0, repaired.maximumExportHistoryEntries);
  repaired.profiles = repaired.profiles.map((candidate, index) => {
    const item = candidate;
    const defaults = createDefaultProfiles()[0];
    const variables = item.variables && typeof item.variables === "object" && !Array.isArray(item.variables) ? item.variables : {};
    const merged = { ...defaults, ...item, variables: { ...defaults.variables, ...variables }, metadataFilters: Array.isArray(item.metadataFilters) ? item.metadataFilters : [] };
    const validation = validateProfile(merged); if (validation.errors.length) warnings.push(`Profile “${item.name || index + 1}” has configuration issues: ${validation.errors.join(" ")}`);
    if (!merged.id) { merged.id = profileId(); warnings.push(`Profile ${index + 1} was assigned a new identifier.`); }
    if (!merged.name?.trim()) { merged.name = `Recovered Profile ${index + 1}`; warnings.push(`Profile ${index + 1} was assigned a recovery name.`); }
    if (!["markdown", "docx", "markdown-docx", "odt", "epub", "html", "xml"].includes(merged.exportTarget)) { merged.exportTarget = "docx"; warnings.push(`Profile “${merged.name}” export target was repaired to DOCX.`); }
    for (const key of ["includeFrontMatter", "includeBackMatter", "includeSceneTitles", "metadataOrdering", "stripYamlFrontmatter", "removeObsidianComments", "removeHtmlComments", "removeDataviewBlocks", "removeCallouts", "stripInternalLinks", "generateTableOfContents", "keepIntermediateMarkdown", "useParts"] as const) if (typeof merged[key] !== "boolean") { (merged[key] as boolean) = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    if (merged.chapterSource !== "folders" && merged.chapterSource !== "notes") { merged.chapterSource = "folders"; warnings.push(`Profile “${merged.name}” chapter source was repaired to folders.`); }
    for (const key of ["manuscriptRoot", "exportFolder", "outputFilename", "partHeadingTemplate", "chapterHeadingTemplate", "sceneSeparator", "referenceDocx", "pandocMetadataFile", "additionalPandocArguments"] as const) if (typeof merged[key] !== "string") { (merged[key] as string) = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    for (const key of ["BookTitle", "Series", "Author"] as const) if (typeof merged.variables[key] !== "string") { merged.variables[key] = defaults.variables[key]; warnings.push(`Profile “${merged.name}” variable ${key} was repaired.`); }
    const validFilters = merged.metadataFilters.filter((rule) => !!rule && typeof rule === "object" && typeof rule.field === "string" && rule.field.trim() && typeof rule.value === "string" && (rule.operator === "equals" || rule.operator === "not-equals"));
    if (validFilters.length !== merged.metadataFilters.length) warnings.push(`Profile “${merged.name}” contained invalid metadata filters, which were removed.`);
    merged.metadataFilters = validFilters.map((rule) => ({ ...rule, id: typeof rule.id === "string" && rule.id ? rule.id : profileId() }));
    if (!Array.isArray(merged.bodySectionAliases) || merged.bodySectionAliases.some((value) => typeof value !== "string")) { merged.bodySectionAliases = [...(defaults.bodySectionAliases ?? [])]; warnings.push(`Profile “${merged.name}” body-section aliases were repaired.`); }
    else merged.bodySectionAliases = merged.bodySectionAliases.map((value) => value.trim().slice(0, 100)).filter(Boolean).slice(0, 50);
    for (const key of ["blankLinesBetweenSections", "blankLinesBetweenChapters"] as const) if (!Number.isInteger(merged[key]) || merged[key] < 0) { merged[key] = defaults[key]; warnings.push(`Profile “${merged.name}” setting ${key} was repaired.`); }
    const profileIndentDefault = /vellum/i.test(item.name ?? "") ? 0.75 : defaults.docxFirstLineIndentCm ?? 1.27;
    const metricIndent = typeof item.docxFirstLineIndentCm === "number" ? item.docxFirstLineIndentCm : typeof item.docxFirstLineIndent === "number" ? inchesToCentimetres(item.docxFirstLineIndent) : profileIndentDefault;
    merged.docxIndentParagraphs = typeof item.docxIndentParagraphs === "boolean" ? item.docxIndentParagraphs : true;
    merged.docxFirstLineIndentCm = clampCentimetres(metricIndent, 0, 3.81, profileIndentDefault);
    merged.docxPageSize = item.docxPageSize === "letter" || item.docxPageSize === "a4" ? item.docxPageSize : "a4";
    return merged;
  });
  if (!repaired.profiles.some((item) => item.id === repaired.activeProfileId)) { repaired.activeProfileId = repaired.profiles[0].id; warnings.push("Active profile selection was repaired."); }
  if (!repaired.profiles.some((item) => item.id === repaired.defaultProfileId)) { repaired.defaultProfileId = repaired.profiles[0].id; warnings.push("Default profile selection was repaired."); }
  repaired.configurationWarnings = [...(Array.isArray(repaired.configurationWarnings) ? repaired.configurationWarnings.filter((value): value is string => typeof value === "string") : []), ...warnings].slice(-100);
  return repaired;
}
/** Resolves active/default profile safely and creates defaults when necessary. */
export function activeProfile(settings: ManuscriptCompilerSettings): CompileProfile {
  return settings.profiles.find((item) => item.id === settings.activeProfileId) ?? settings.profiles.find((item) => item.id === settings.defaultProfileId) ?? settings.profiles[0];
}
/** Validates imported profile data without mutating settings or accepting code. */
export function validateProfile(value: unknown): { profile?: CompileProfile; errors: string[] } {
  const errors: string[] = []; if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: ["Profile must be a JSON object."] };
  const item = value as Partial<CompileProfile>;
  if (typeof item.name !== "string" || !item.name.trim()) errors.push("Profile name is required.");
  for (const key of ["exportFolder", "outputFilename", "partHeadingTemplate", "chapterHeadingTemplate", "sceneSeparator"] as const) if (typeof item[key] !== "string") errors.push(`${key} must be a string.`);
  if (typeof item.outputFilename === "string" && !item.outputFilename.trim()) errors.push("outputFilename is required.");
  for (const key of ["includeFrontMatter", "includeBackMatter", "includeSceneTitles", "metadataOrdering", "stripYamlFrontmatter", "removeObsidianComments", "removeHtmlComments", "removeDataviewBlocks", "removeCallouts", "stripInternalLinks", "useParts"] as const) if (item[key] !== undefined && typeof item[key] !== "boolean") errors.push(`${key} must be boolean.`);
  if (item.chapterSource !== undefined && item.chapterSource !== "folders" && item.chapterSource !== "notes") errors.push("chapterSource is invalid.");
  for (const key of ["blankLinesBetweenSections", "blankLinesBetweenChapters"] as const) if (item[key] !== undefined && (!Number.isInteger(item[key]) || (item[key] ?? -1) < 0)) errors.push(`${key} must be a non-negative integer.`);
  if (item.orderingMethod !== undefined && item.orderingMethod !== "filename" && item.orderingMethod !== "metadata") errors.push("orderingMethod is invalid.");
  if (item.exportTarget !== undefined && !["markdown", "docx", "markdown-docx", "odt", "epub", "html", "xml"].includes(item.exportTarget)) errors.push("exportTarget is invalid.");
  for (const key of ["referenceDocx", "pandocMetadataFile", "additionalPandocArguments"] as const) if (item[key] !== undefined && typeof item[key] !== "string") errors.push(`${key} must be a string.`);
  for (const key of ["generateTableOfContents", "keepIntermediateMarkdown", "docxIndentParagraphs"] as const) if (item[key] !== undefined && typeof item[key] !== "boolean") errors.push(`${key} must be boolean.`);
  if (item.variables !== undefined && (typeof item.variables !== "object" || item.variables === null || Array.isArray(item.variables))) errors.push("variables must be an object.");
  if (!Array.isArray(item.metadataFilters)) errors.push("metadataFilters must be an array.");
  else item.metadataFilters.forEach((rule, index) => {
    if (!rule || typeof rule !== "object" || typeof rule.field !== "string" || !rule.field.trim()) errors.push(`metadataFilters[${index}].field is required.`);
    if (rule?.operator !== "equals" && rule?.operator !== "not-equals") errors.push(`metadataFilters[${index}].operator is invalid.`);
    if (typeof rule?.value !== "string") errors.push(`metadataFilters[${index}].value must be a string.`);
  });
  if (errors.length > 0) return { errors };
  const base = profile(item.name?.trim() ?? "Imported");
  const imported: CompileProfile = { ...base, ...item, id: profileId(), variables: { ...base.variables, ...(item.variables ?? {}) }, metadataFilters: (item.metadataFilters ?? []).map((rule) => ({ ...rule, id: typeof rule.id === "string" ? rule.id : profileId() })) };
  return { profile: imported, errors };
}
