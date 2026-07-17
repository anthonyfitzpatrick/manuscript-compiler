/** Narrow untrusted API/YAML values before enumerating their properties. */
export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves and binds an optional no-argument method at a version-dependent
 * external API boundary. Non-callable or absent members are rejected before
 * invocation, and the original object remains the method receiver.
 */
export function optionalNoArgMethod(value: unknown, name: string): (() => void) | undefined {
  if (!isUnknownRecord(value)) return undefined;
  const member = value[name];
  return typeof member === "function" ? () => { Reflect.apply(member, value, []); } : undefined;
}
