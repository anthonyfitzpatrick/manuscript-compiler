# Manuscript Compiler

Manuscript Compiler is an Obsidian plugin that recursively compiles a book folder into one clean Markdown file for later import into tools such as Vellum.

## Stage 1 features

- Compiles front matter, parts, chapters, scenes, and back matter in natural filename order.
- Optionally removes YAML frontmatter and includes scene titles.
- Uses a configurable separator between scenes.
- Creates the export folder when needed and confirms before overwriting.
- Reports structural counts, word count, and warnings without modifying source notes.

## Development

```bash
npm install
npm run build
```

Copy `manifest.json`, `main.js`, and (if present) `styles.css` to `.obsidian/plugins/manuscript-compiler/` in a test vault, then enable the plugin in Obsidian.

## Book structure

The selected book folder may contain `Ebook Front Matter`, part folders containing chapter folders and Markdown scene files, and `Ebook Back Matter`. Hidden files and folders are ignored. Files and folders are sorted using natural, case-insensitive filename order.
