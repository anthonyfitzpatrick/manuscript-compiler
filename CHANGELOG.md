# Changelog

## 0.9.2 Release Candidate

### Fixed

- Preview, validation, Markdown, and DOCX export now consume one prepared semantic `Book`; export never rebuilds the manuscript after preview.
- Source or compile-choice changes after preview block stale export and keep **Refresh Preview** available.
- Every compile command uses the same authoritative content plan, transparent-container rules, project-folder exclusions, dashboard/revision classification, and body cleaning.
- Legacy command routes can no longer bypass Archive, Development, Exports, dashboard, Synopsis, Revision Notes, metadata-leakage, or zero-number protections.
- DOCX saving is staged, structurally validated, read back, verified, recoverable on overwrite failure, and reported successful only after final validation.
- Chapter page breaks obey the active setting; Part and Chapter transitions no longer depend on synthetic blank break paragraphs.
- Scene separators occur only between included Scenes, and the following prose uses First Paragraph styling.
- Table-of-contents selection reaches a genuine Word TOC field.
- Callouts are described accurately as conversion to plain text, preserving body text while removing the marker and title.
- Removed the unused Subtitle Word style and the unused generic Markdown-to-DOCX production compatibility route.
- Separated orchestration, workspace state, history, result actions, operation state, and step rendering without changing command IDs.

### Improved

- Final-model preview now shows the exact exported outline, statistics, warnings, exclusions, filename, and destination.
- Output verification, rollback guidance, cancellation boundaries, partial-result handling, and history sequencing have stronger automated coverage.
- Vellum, Standard Manuscript, and supported Custom formatting resolve deterministically and are inspected semantically in generated Word XML.
- Architecture, release documentation, performance coverage, and the manual release checklist now describe the actual native-DOCX product.

### Compatibility

- Existing settings, profiles, history, logs, Chapter-break preferences, title-page choices, TOC preferences, formatting values, metadata filters, and command IDs remain supported through idempotent migration.
- No other Obsidian community plugin is required. Pandoc and external executables are neither required nor invoked.
- DOCX creation remains offline; obsolete Pandoc fields are retained only so older saved data can be loaded safely.

## 0.9.1 Corrective Release

- Changed manuscript discovery to exclude project, archive, development, dashboard, research, revision, and export material by default while keeping every exclusion visible and overridable.
- Added transparent manuscript containers so folders such as `Manuscript`, `Draft`, and `Content` contribute no exported heading.
- Added template-aware scene-body extraction and structured project-metadata removal, including leaked `Series`, `Book`, `Part`, `Chapter`, `Scene`, character, and editing fields.
- Replaced the generic native Markdown-to-DOCX dump with model-driven fiction DOCX generation using semantic Part, Chapter, body, first-paragraph, scene-break, and matter styles.
- Added the Warden of Silence regression fixture and semantic DOCX XML assertions for content exclusion, pagination, paragraph styles, Unicode, and metadata safety.
- Changed the Export preview to use the exact prepared semantic manuscript model passed to DOCX/Markdown export; included source changes now require **Refresh Preview** before export.
- Added structural DOCX validation plus staged, verified saving with same-folder replacement on local vaults, adapter-compatible recovery, rollback of existing outputs, and conservative stale-temporary cleanup.
- Unified guided, current-book, selected-folder, sample, legacy-profile, validation, Markdown, and DOCX routes behind the authoritative prepared-manuscript service. Existing command IDs are retained, and validation now reports the same final semantic model used by export.
- Separated plugin composition, command orchestration, workspace state, step rendering, export coordination, operation state, history, and platform result actions; removed unregistered legacy settings classes and their unreachable post-return block.

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
