/**
 * Manuscript Compiler — native semantic Markdown export.
 *
 * Renders publication-ready UTF-8 Markdown only from the shared SemanticDocument.
 * It owns canonical headings, inline emphasis/link text, blank-line policy, and
 * final newline. ExportCoordinator calls the exporter; MarkdownValidator checks
 * the bytes. It does not scan, parse, clean, reorder, write files, or simulate
 * visual indentation. Generation is deterministic, side-effect free, effectively
 * synchronous despite the exporter interface, and identical on desktop/mobile.
 */
import { strToU8 } from "fflate";
import { EXPORT_FORMAT_DETAILS, type GeneratedExport, type ManuscriptExporter, type ManuscriptExportContext } from "./export-types";
import type { SemanticBlock, SemanticDocument, SemanticInline, SemanticSection } from "./semantic-document";

/**
 * Stateless adapter from the common exporter contract to semantic Markdown.
 * Lifecycle is one `generate` call per export; no data survives the call and no
 * cancellation checkpoint is needed because rendering is an in-memory transform.
 */
export class MarkdownExporter implements ManuscriptExporter {
  readonly format = "markdown" as const;

  async generate(context: ManuscriptExportContext): Promise<GeneratedExport> {
    return {
      format: this.format,
      filename: context.filename,
      mimeType: EXPORT_FORMAT_DETAILS.markdown.mimeType,
      bytes: strToU8(renderSemanticMarkdown(context.document)),
      warnings: []
    };
  }
}

/** Canonical renderer used by generation and context-aware validation. */
/**
 * Renders canonical Markdown from an already ordered semantic document.
 * @param document Shared projection of the prepared Book.
 * @returns Deterministic Markdown with no duplicate blank lines and one final newline.
 * @remarks Pure; never adds YAML, presentation CSS, indentation workarounds, or paths.
 */
export function renderSemanticMarkdown(document: SemanticDocument): string {
  const output: string[] = [];
  const add = (value: string): void => {
    const clean = value.replace(/[\t ]+$/gm, "").trim();
    if (!clean) return;
    if (isHeading(clean) && isHeading(output.at(-1) ?? "") && headingText(clean) === headingText(output.at(-1) ?? "")) return;
    output.push(clean);
  };
  for (const section of document.sections) renderSection(section, add);
  return `${output.join("\n\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/g, "")}\n`;
}

function renderSection(section: SemanticSection, add: (value: string) => void): void {
  const blocks = [...section.blocks];
  if (section.kind === "title") {
    const title = takeHeading(blocks, "title"); const author = takeHeading(blocks, "author");
    if (title) add(`# ${inlineText(title.inlines)}`);
    if (author && inlineText(author.inlines).trim()) add(inlineText(author.inlines));
  } else if (section.kind === "part") {
    if (section.number !== 0) addStructuralHeading(blocks, ["part-number", "part-title"], 1, add);
  } else if (section.kind === "chapter") {
    if (section.number !== 0) addStructuralHeading(blocks, ["chapter-number", "chapter-title"], 2, add);
    else removeHeadingStyles(blocks, ["chapter-number", "chapter-title"]);
  } else if (section.kind === "front-matter" || section.kind === "back-matter") {
    const style = section.kind;
    const heading = takeHeading(blocks, style);
    if (heading) add(`# ${inlineText(heading.inlines)}`);
  }
  blocks.forEach((block) => renderBlock(block, add));
}

function addStructuralHeading(blocks: SemanticBlock[], styles: Array<Extract<SemanticBlock, { kind: "heading" }>["style"]>, level: number, add: (value: string) => void): void {
  const lines = styles.map((style) => takeHeading(blocks, style)).filter((block): block is Extract<SemanticBlock, { kind: "heading" }> => Boolean(block)).map((block) => inlineText(block.inlines).trim()).filter(Boolean);
  const unique = lines.filter((line, index) => lines.findIndex((other) => headingText(other) === headingText(line)) === index);
  if (unique.length) add(`${"#".repeat(level)} ${unique.join(" — ")}`);
}

function renderBlock(block: SemanticBlock, add: (value: string) => void): void {
  if (block.kind === "page-break") return;
  if (block.kind === "scene-break") { add(block.text.trim() || "* * *"); return; }
  if (block.kind === "paragraph") { add(inlineText(block.inlines)); return; }
  const levels: Partial<Record<Extract<SemanticBlock, { kind: "heading" }>["style"], number>> = { "body-heading": 3, "front-matter": 1, "back-matter": 1 };
  const level = levels[block.style];
  if (level) add(`${"#".repeat(level)} ${inlineText(block.inlines)}`);
}

function inlineText(inlines: SemanticInline[]): string {
  return inlines.map((inline) => {
    let value = inline.text;
    if (inline.bold && inline.italic) value = `***${value}***`;
    else if (inline.bold) value = `**${value}**`;
    else if (inline.italic) value = `*${value}*`;
    if (inline.href) value = `[${value}](${inline.href})`;
    return value;
  }).join("");
}

function takeHeading(blocks: SemanticBlock[], style: Extract<SemanticBlock, { kind: "heading" }>["style"]): Extract<SemanticBlock, { kind: "heading" }> | undefined {
  const index = blocks.findIndex((block) => block.kind === "heading" && block.style === style);
  if (index < 0) return;
  return blocks.splice(index, 1)[0] as Extract<SemanticBlock, { kind: "heading" }>;
}
function removeHeadingStyles(blocks: SemanticBlock[], styles: Array<Extract<SemanticBlock, { kind: "heading" }>["style"]>): void { for (let index = blocks.length - 1; index >= 0; index -= 1) { const block = blocks[index]; if (block.kind === "heading" && styles.includes(block.style)) blocks.splice(index, 1); } }
function isHeading(value: string): boolean { return /^#{1,6}\s+\S/.test(value); }
function headingText(value: string): string { return value.replace(/^#{1,6}\s+/, "").trim().toLocaleLowerCase(); }
