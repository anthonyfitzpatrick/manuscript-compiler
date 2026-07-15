import tsparser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig(
  globalIgnores([
    "node_modules",
    ".test-build",
    "release",
    "tests",
    "main.js",
    "esbuild.*.mjs",
    "scripts",
  ]),
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ["tests/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": ["warn", {
        acronyms: ["DOCX", "ODT", "EPUB", "HTML", "XML", "JSON", "YAML", "A4"],
        brands: ["Manuscript Compiler", "File Explorer", "Obsidian", "Vellum", "LibreOffice", "Markdown", "Garamond", "Arial", "Georgia", "Times New Roman", "centimetres"],
        enforceCamelCaseLower: true,
      }],
    },
  },
  {
    files: ["src/ui.ts"],
    rules: {
      // Obsidian <1.13 requires display() and lacks setDestructive().
      "@typescript-eslint/no-deprecated": "off",
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
);
