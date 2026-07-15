/**
 * Manuscript Compiler — optional frontmatter inclusion rules.
 *
 * Evaluates persisted equality filters against parser-normalised metadata.
 * Called by ManuscriptParser. Explicit workspace inclusion remains authoritative.
 */
import type { DocumentMetadata } from "./model";
import type { MetadataFilterRule, MetadataOperator } from "./settings";
export interface FilterOperator { id: MetadataOperator; matches(actual: unknown, expected: string): boolean; }
const normalize = (value: unknown): string => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value).trim().toLowerCase() : "";
const OPERATORS: Record<MetadataOperator, FilterOperator> = {
  equals: { id: "equals", matches: (actual, expected) => normalize(actual) === normalize(expected) },
  "not-equals": { id: "not-equals", matches: (actual, expected) => normalize(actual) !== normalize(expected) }
};
/** Stateless evaluator; matching never mutates document metadata or filter rules. */
export class MetadataFilterEngine {
  matches(metadata: DocumentMetadata, rules: MetadataFilterRule[]): { included: boolean; failedRule?: MetadataFilterRule } {
    for (const rule of rules) { const actual = metadata.values[normalizeKey(rule.field)]; const operator = OPERATORS[rule.operator]; if (!operator || !operator.matches(actual, rule.value)) return { included: false, failedRule: rule }; }
    return { included: true };
  }
}
export function normalizeKey(key: string): string { return key.toLowerCase().replace(/[ _-]/g, ""); }
