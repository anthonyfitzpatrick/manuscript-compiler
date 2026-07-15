/** Portable, path-free filenames shared by every download format. */
import { EXPORT_FORMAT_DETAILS, type ExportFormat } from "./export-types";

export function exportFilename(value: string, format: ExportFormat, fallback = "Manuscript"): string {
  const resolved = value.replace(/\{BookTitle\}/gi, fallback);
  const leaf = resolved.replace(/^.*[\\/]/, "").replace(/(?:\.(?:docx|odt|epub|html?|md|markdown|xml))+$/i, "");
  let safe = replaceUnsafeFilenameCharacters(leaf).trim().replace(/[. ]+$/g, "") || fallback;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) safe = `_${safe}`;
  return `${safe}.${EXPORT_FORMAT_DETAILS[format].extension}`;
}

function replaceUnsafeFilenameCharacters(value: string): string { return [...value].map((character) => { const code = character.charCodeAt(0); return code <= 0x1f || code === 0x7f || '\\/:*?"<>|'.includes(character) ? "-" : character; }).join(""); }
