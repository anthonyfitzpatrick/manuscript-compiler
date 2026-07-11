# Manuscript Compiler

Manuscript Compiler is an Obsidian publishing-workflow plugin that turns a folder-based book into deterministic, clean Markdown for Vellum and other publishing tools. Source notes are read-only and are never modified.

## Stage 3

### Compile profiles

Every compile option now belongs to a named profile. Profiles independently store the manuscript root, export folder, output filename template, headings, scene separator, spacing, ordering method, front/back matter choices, cleaning options, variables, and metadata filters.

The settings tab supports creating, renaming, duplicating, deleting, selecting, and choosing a default profile. Profiles can be exported as JSON, validated and imported from JSON, or reset to the built-in Default and Vellum profiles. Existing Stage 2 settings are automatically migrated into a profile the first time version 0.3 loads.

### Interactive preview

Before writing output, the preview displays an expandable tree of front matter, parts, chapters, scenes, and back matter. Status markers identify included, excluded, and warning-bearing nodes. Selecting a scene displays its vault path, cleaned word count, normalized YAML metadata, and compile status without displaying manuscript prose.

The preview and compile report include:

- Total words, chapters, and scenes
- Average chapter and scene length
- Longest and shortest chapters
- Longest and shortest scenes
- Estimated reading time
- Issues grouped as Information, Warning, or Error

Preview visibility, initial tree expansion, statistics, reading speed, and minimum warning level are configurable globally.

### Metadata filters

Profiles can contain multiple simple metadata rules. All rules must match for a document to compile. Supported operators are:

- `equals` (`==`)
- `not-equals` (`!=`)

Field matching is case-insensitive and ignores spaces, underscores, and hyphens. Example rules include `Editing Status != Excluded`, `Editing Status == Complete`, `POV == Elin`, and `Plotline == First Contact`. The existing special handling for `Editing Status: Excluded` remains active for backward compatibility.

### Templates and variables

A shared template engine is used for headings and output filenames. It supports structural placeholders and compile variables:

- `{title}`, `{name}`, `{number}`
- `{BookTitle}`, `{Series}`, `{Author}`
- `{Date}`, `{Year}`, `{WordCount}`, `{ChapterCount}`

Placeholder names are matched case-insensitively. Unknown variables resolve to an empty string.

### Warnings

Stage 3 detects duplicate titles and numbers, missing metadata and numbering, empty scenes/chapters/parts, chapters without scenes, orphan scenes, missing matter folders, unreadable files, duplicate filenames, invalid profile/filter settings, and output paths inside the manuscript root. Issues are deduplicated and assigned a severity.

## Compilation pipeline

```text
Vault
  → Scanner
  → Parser
  → Manuscript Model
  → Metadata Filters
  → Ordering
  → Content Cleaners
  → Statistics and Warnings
  → Template Engine
  → Markdown Generator
  → Exporter
```

The exporter contract is format-neutral. Only `MarkdownExporter` is implemented; future DOCX, HTML, EPUB, and PDF exporters can implement the same interface without changing compiler logic.

## Book structure

```text
Book/
├── Ebook Front Matter/
├── Part 1/
│   ├── Chapter 1/
│   │   ├── Scene 1.md
│   │   └── Scene 2.md
│   └── Chapter 2/
├── Part 2/
└── Ebook Back Matter/
```

Front Matter, Ebook Front Matter, Print Front Matter, Back Matter, Ebook Back Matter, and Print Back Matter are recognised case-insensitively. Unknown visible folders are traversed, hidden items are ignored, and only Markdown files are compiled.

## Metadata example

```yaml
---
Part: 1
Chapter: 2
Scene: 3
Order: 10
Editing Status: Complete
POV: Elin
Plotline: First Contact
---
```

## Commands

- **Manuscript Compiler: Compile Current Book** uses the active profile’s root, falling back to book detection above the active note.
- **Manuscript Compiler: Compile Selected Folder** compiles a folder selected from the vault using the active profile.

The original Stage 1 command IDs and overwrite protection remain unchanged.

## Markdown generation

Profiles configure scene separators, section blank lines, chapter blank lines, scene headings, and heading templates. Generation removes trailing whitespace, uses exact configured spacing, emits one final newline, and uses stable model ordering so identical source, profile, and date variables produce identical output.

Optional independent cleaners remove YAML frontmatter, Obsidian comments, HTML comments, Dataview and DataviewJS blocks, callout syntax, and Obsidian internal links. Ordinary Markdown links and ordinary blockquotes are retained.

## Development

```bash
npm install
npm run typecheck
npm run build
```

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/manuscript-compiler/` in a test vault, then enable the plugin.

DOCX, Pandoc, EPUB, PDF, live editing, cloud sync, AI editing, and collaboration are intentionally reserved for later stages.
