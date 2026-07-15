/**
 * Manuscript Compiler — focused DOCX package validation.
 *
 * Checks the minimum ZIP and WordprocessingML structure before any save can be
 * trusted. Called before browser download dispatch. This is intentionally not
 * a full OOXML conformance validator.
 * It owns a bounded structural verdict, not repair, generation, or compatibility
 * promises for every word processor. Validation is synchronous, non-cancellable,
 * read-only, and platform-neutral; malformed ZIP/XML returns errors rather than
 * manuscript data. Keep checks aligned with the native package contract.
 */
import { unzipSync } from "fflate";

/** Reusable structural verdict suitable for technical logs and tests. */
export interface DocxValidationResult { valid: boolean; errors: string[]; }

const REQUIRED = ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"] as const;

/** Performs read-only minimum package validation and never throws for bad bytes. */
export function validateDocxBytes(bytes: Uint8Array): DocxValidationResult {
  const errors: string[] = [];
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { valid: false, errors: ["The generated DOCX is not a readable ZIP package."] };
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(bytes); } catch { return { valid: false, errors: ["The generated DOCX ZIP package could not be read."] }; }
  for (const path of REQUIRED) if (!entries[path]) errors.push(`The DOCX package is missing a required component: ${path}.`);
  const decoded = new Map<string, string>();
  for (const path of REQUIRED) {
    const entry = entries[path]; if (!entry) continue;
    try { decoded.set(path, new TextDecoder("utf-8", { fatal: true }).decode(entry)); } catch { errors.push(`A required DOCX component could not be decoded as UTF-8 text: ${path}.`); }
  }
  const document = decoded.get("word/document.xml") ?? "";
  if (!document.trim()) errors.push("The DOCX document content is empty.");
  else {
    if (!/<w:document(?:\s|>)/.test(document)) errors.push("The DOCX document root is missing.");
    if (!/<w:body(?:\s|>)/.test(document)) errors.push("The DOCX document body is missing.");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Enforces the structural DOCX verdict for callers that require an exception.
 * @throws Error containing bounded validator messages when bytes are invalid.
 * @remarks Performs no mutation, repair, I/O, or manuscript logging.
 */
export function assertValidDocx(bytes: Uint8Array, context = "DOCX"): void { const result = validateDocxBytes(bytes); if (!result.valid) throw new Error(`${context} validation failed: ${result.errors.join(" ")}`); }
