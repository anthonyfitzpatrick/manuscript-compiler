# Changelog

## 0.9.1 Corrective Release

- Changed manuscript discovery to exclude project, archive, development, dashboard, research, revision, and export material by default while keeping every exclusion visible and overridable.
- Added transparent manuscript containers so folders such as `Manuscript`, `Draft`, and `Content` contribute no exported heading.
- Added template-aware scene-body extraction and structured project-metadata removal, including leaked `Series`, `Book`, `Part`, `Chapter`, `Scene`, character, and editing fields.
- Replaced the generic native Markdown-to-DOCX dump with model-driven fiction DOCX generation using semantic Part, Chapter, body, first-paragraph, scene-break, and matter styles.
- Added the Warden of Silence regression fixture and semantic DOCX XML assertions for content exclusion, pagination, paragraph styles, Unicode, and metadata safety.
- Changed the Export preview to use the exact prepared semantic manuscript model passed to DOCX/Markdown export; included source changes now require **Refresh Preview** before export.
- Added structural DOCX validation plus staged, verified saving with same-folder replacement on local vaults, adapter-compatible recovery, rollback of existing outputs, and conservative stale-temporary cleanup.
- Unified guided, current-book, selected-folder, sample, legacy-profile, validation, Markdown, and DOCX routes behind the authoritative prepared-manuscript service. Existing command IDs are retained, and validation now reports the same final semantic model used by export.

Central export rule: **Only explicitly included publishable content is exported. Vault organisation and project metadata are never manuscript content.**

## 0.8.0 Simplified Beta

- Added a single author-oriented Compile Manuscript window with folder, structure, output, and format choices.
- Added six book-structure presets plus Vellum and Standard DOCX presets.
- Made the built-in DOCX generator the default and removed the obsolete Pandoc runtime implementation.
- Simplified settings, first-run setup, preview, and compile results with progressive disclosure for expert controls.
- Added idempotent migration for 0.7 settings and regression coverage for the simplified workflow.

## 0.7.0 Beta

- Added cancellable, stage-aware compilation and Pandoc termination.
- Added staged desktop output replacement and strict vault-relative path validation.
- Added six golden manuscript fixtures, historical migration coverage, parser/cleaner edge cases, mobile guards, and diagnostics privacy tests.
- Added real Pandoc DOCX archive/XML integration validation.
- Added deterministic release packaging with exact archive-content and version checks.
- Added MIT license, public-beta documentation, migration guarantees, testing strategy, and release checklist.
- Fixed diagnostics path leakage, vault-root output safety, word-number chapter parsing, heading-name cleanup, and concurrent-compilation races.

## 0.6.0 Release Candidate

- Added onboarding and profile wizards, diagnostics, expanded preview controls, sample layouts, accessibility improvements, and release-candidate tests.

## 0.5.0

- Added validation mode, independence/security audit, configuration repair, performance tests, and optional-syntax regression fixtures.

## 0.4.0

- Added optional Pandoc-based DOCX export, reference templates, export history, and compile logs.

## 0.3.0

- Added compile profiles, metadata filters, statistics, template variables, and interactive preview.

## 0.2.0

- Added the manuscript model, parser, ordering, cleaning pipeline, presets, and preview.

## 0.1.0

- Initial Markdown compiler MVP.
