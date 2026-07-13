import { unzipSync } from "fflate";

export interface DocxValidationResult { valid: boolean; errors: string[]; }

const REQUIRED = ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"] as const;

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

export function assertValidDocx(bytes: Uint8Array, context = "DOCX"): void { const result = validateDocxBytes(bytes); if (!result.valid) throw new Error(`${context} validation failed: ${result.errors.join(" ")}`); }
