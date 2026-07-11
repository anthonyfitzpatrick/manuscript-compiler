export type TemplateVariables = Record<string, string | number | undefined>;
export class TemplateEngine {
  render(template: string, variables: TemplateVariables): string {
    const exact = new Map(Object.entries(variables));
    const insensitive = new Map(Object.entries(variables).map(([key, value]) => [key.toLowerCase(), value]));
    return template.replace(/\{([^{}]+)\}/g, (_match, key: string) => String(exact.get(key) ?? insensitive.get(key.toLowerCase()) ?? "")).replace(/\s+:/g, ":").replace(/[ \t]{2,}/g, " ").trim();
  }
}
