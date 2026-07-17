/** Narrow untrusted API/YAML values before enumerating their properties. */
export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
