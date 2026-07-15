/**
 * Manuscript Compiler — portable download filename policy.
 *
 * Converts author templates into a leaf filename with the selected format's
 * exact extension. It owns no path resolution or filesystem access. Called by
 * preparation, Create file, and ExportCoordinator. The transform is pure,
 * deterministic, platform-neutral, and must continue rejecting path segments,
 * control characters, reserved device names, and misleading extensions.
 */
import { EXPORT_FORMAT_DETAILS, type ExportFormat } from "./export-types";

/**
 * Resolves a safe portable leaf filename.
 * @param value Author-entered template or filename; path components are discarded.
 * @param format Selected format whose canonical extension replaces any old one.
 * @param fallback Safe title used when the resolved stem is empty.
 * @returns A path-free filename suitable for an anchor `download` property.
 * @remarks Pure and non-throwing; performs no filesystem or vault operation.
 */
export function exportFilename(value: string, format: ExportFormat, fallback = "Manuscript"): string {
  const resolved = value.replace(/\{BookTitle\}/gi, fallback);
  const leaf = resolved.replace(/^.*[\\/]/, "").replace(/(?:\.(?:docx|odt|epub|html?|md|markdown|xml))+$/i, "");
  let safe = replaceUnsafeFilenameCharacters(leaf).trim().replace(/[. ]+$/g, "") || fallback;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) safe = `_${safe}`;
  return `${safe}.${EXPORT_FORMAT_DETAILS[format].extension}`;
}

function replaceUnsafeFilenameCharacters(value: string): string { return [...value].map((character) => { const code = character.charCodeAt(0); return code <= 0x1f || code === 0x7f || '\\/:*?"<>|'.includes(character) ? "-" : character; }).join(""); }
