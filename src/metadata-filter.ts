import type { DocumentMetadata } from "./model";
import type { MetadataFilterRule, MetadataOperator } from "./settings";
export interface FilterOperator { id: MetadataOperator; matches(actual: unknown, expected: string): boolean; }
const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const OPERATORS: Record<MetadataOperator, FilterOperator> = {
  equals: { id: "equals", matches: (actual, expected) => normalize(actual) === normalize(expected) },
  "not-equals": { id: "not-equals", matches: (actual, expected) => normalize(actual) !== normalize(expected) }
};
export class MetadataFilterEngine {
  matches(metadata: DocumentMetadata, rules: MetadataFilterRule[]): { included: boolean; failedRule?: MetadataFilterRule } {
    for (const rule of rules) { const actual = metadata.values[normalizeKey(rule.field)]; const operator = OPERATORS[rule.operator]; if (!operator || !operator.matches(actual, rule.value)) return { included: false, failedRule: rule }; }
    return { included: true };
  }
}
export function normalizeKey(key: string): string { return key.toLowerCase().replace(/[ _-]/g, ""); }
