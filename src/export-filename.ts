/** Portable, path-free filenames shared by every download format. */
import { EXPORT_FORMAT_DETAILS, type ExportFormat } from "./export-types";

export function exportFilename(value: string, format: ExportFormat, fallback = "Manuscript"): string {
  const resolved = value.replace(/\{BookTitle\}/gi, fallback);
  const leaf = resolved.replace(/^.*[\\/]/, "").replace(/(?:\.(?:docx|odt|pdf|epub|html?|xml))+$/i, "");
  let safe = leaf.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "-").trim().replace(/[. ]+$/g, "") || fallback;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) safe = `_${safe}`;
  return `${safe}.${EXPORT_FORMAT_DETAILS[format].extension}`;
}
