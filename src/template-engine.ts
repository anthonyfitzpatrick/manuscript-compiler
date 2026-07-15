/**
 * Manuscript Compiler — constrained variable expansion.
 *
 * Used by output naming and retained custom heading templates. Unknown variables
 * resolve safely; this is interpolation, not a script runtime.
 * It owns bounded placeholder substitution only and calls no evaluator, vault,
 * filesystem, or network API. Expansion is pure, deterministic, non-throwing,
 * non-cancellable, and platform-neutral. Never add expressions, code execution,
 * environment access, or recursive expansion.
 */
export type TemplateVariables = Record<string, string | number | undefined>;
/** Stateless safe interpolator with no evaluation or side effects. */
export class TemplateEngine {
  render(template: string, variables: TemplateVariables): string {
    const exact = new Map(Object.entries(variables));
    const insensitive = new Map(Object.entries(variables).map(([key, value]) => [key.toLowerCase(), value]));
    return template.replace(/\{([^{}]+)\}/g, (_match, key: string) => String(exact.get(key) ?? insensitive.get(key.toLowerCase()) ?? "")).replace(/\s+:/g, ":").replace(/[ \t]{2,}/g, " ").trim();
  }
}
