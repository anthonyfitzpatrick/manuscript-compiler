# Changelog

## 0.9.2 Release Candidate

### Universal export workflow

- Added native DOCX, ODT, PDF, EPUB 3, standalone HTML, and versioned manuscript XML exporters over one shared projection of the prepared semantic Book.
- Added one validator registry and blocked browser delivery whenever the selected format fails structural validation.
- Replaced every active vault/external-path output route with one platform-neutral Blob download service that removes temporary anchors and always revokes object URLs.
- Removed completed-export vault writes, output folders, overwrite/open/reveal actions, Electron compatibility code, and the obsolete staged vault writer. Historical fields remain migration-only.
- Added portable cross-format filename repair, accurate MIME types, per-format progressive formatting controls, format/download history flags, individual format test commands, and a six-format large-manuscript benchmark.
- Added native ODT and EPUB ZIP structures using the existing `fflate` runtime dependency; HTML and XML use built-in UTF-8 encoding; PDF is generated internally without another package or executable.
- Kept version 0.9.2 and preserved the existing manuscript detection, correction, cleaning, prepared-session, Vellum DOCX, privacy, and stale-preview behaviour.

### Fixed

- Repaired native PDF text rendering: the generator no longer sends Unicode code units through an unembedded identity glyph map. It now emits deterministic WinAnsi glyph codes with an exact ToUnicode map, binary-safe stream lengths and xref offsets, and one informational fallback for unsupported characters.
- Replaced the PDF generator's fixed-width `0.52em` wrapping estimate with the emitted Times-Roman/Helvetica 1000-unit glyph metrics, corrected A4 point dimensions, full-width margin math, block-aware pagination, one-line paragraph indentation, centred headings/scene breaks, and explicit Part/Chapter spacing.
- Enlarged Contents folder disclosure chevrons to 21 px with a 30 × 30 px native-button target without changing note markers, ordering arrows, keyboard operation, focus, or ARIA state.
- Rejected `.` and `..` output segments before adapter path normalisation so traversal cannot be collapsed into an apparently safe vault path.
- Changed stale-preview verification to hash source contents, detecting equal-size edits even when file timestamps do not change.
- Removed tracked local plugin state from release sources and ignored future `data.json` files.
- Repaired malformed profile, history, and log entries before migration or UI rendering.
- Replaced the deprecated Electron version probe with Obsidian's documented API version, then removed the desktop-only export bridge.
- Removed stale hard-coded plugin version metadata from generated DOCX packages.
- Fixed a real-vault hierarchy failure where a nested folder repeating the book name became a second Part, leaving valid Chapter Scenes orphaned and producing a zero Chapter count.
- Transparent containers now reparent descendants to their nearest included structural ancestor without losing hierarchy, order, source paths, or explicit choices.
- Mixed front/back matter, copyright containers, and common back-matter note names no longer become manuscript Parts, Chapters, or Scenes.
- Added a folder-only File Explorer action, **Compile manuscript from this folder**, which opens the existing workspace with the exact clicked folder as the authoritative root.
- Preview, validation, Markdown, and DOCX export now consume one prepared semantic `Book`; export never rebuilds the manuscript after preview.
- Source or compile-choice changes after preview block stale export and keep **Refresh Preview** available.
- Every compile command uses the same authoritative content plan, transparent-container rules, project-folder exclusions, dashboard/revision classification, and body cleaning.
- Legacy command routes can no longer bypass Archive, Development, Exports, dashboard, Synopsis, Revision Notes, metadata-leakage, or zero-number protections.
- DOCX bytes are structurally validated before browser download dispatch.
- Chapter page breaks obey the active setting; Part and Chapter transitions no longer depend on synthetic blank break paragraphs.
- Scene separators occur only between included Scenes, and the following prose uses First Paragraph styling.
- Table-of-contents selection reaches a genuine Word TOC field.
- Callouts are described accurately as conversion to plain text, preserving body text while removing the marker and title.
- Removed the unused Subtitle Word style and the unused generic Markdown-to-DOCX production compatibility route.
- Separated orchestration, workspace state, history, result actions, operation state, and step rendering without changing command IDs.
- Contents role and inclusion edits now preserve scroll position and keyboard focus by updating existing rows instead of rebuilding the tree.
- Excluded folders collapse automatically without clearing descendant inclusion choices or manual order.
- Native DOCX scene breaks preserve the selected `#`, `*`, `***`, `* * *`, blank-line, or custom value instead of normalising it to another separator.
- Native DOCX XML now removes XML 1.0-forbidden control characters while preserving escaped punctuation and valid Unicode in titles, author metadata, headings, separators, fonts, and prose.
- Persisted history and compile-log repair now whitelists bounded record fields, redacts historical absolute paths, and discards unknown private payloads; malformed nested profile variables, filters, and body aliases are repaired before use.
- Shareable diagnostics now redact the active profile name in addition to paths, filter values, warning details, and manuscript content.
- Download filenames reject or repair paths, control characters, trailing dots/spaces, duplicate/wrong extensions, and Windows device names.

### Improved

- Simplified the authoritative workspace to **Manuscript → Contents → Create file**, with a compact collapsed outline, focused ignored/warning reviews, and full item controls retained behind **Correct structure**.
- Combined format selection, applicable formatting, warnings, resolved filename, and readiness in the final Create file stage; advanced formatting, templates, profiles, and records remain available through disclosures.
- Added conservative metadata/folder title resolution, author fallback, privacy-safe warning categories, and platform-specific alternate-save wording without adding another compile or parse path.
- Grouped removed manuscript metadata into one informational detail that does not inflate warning counts, and compacted ignored folders without discarding child choices.
- Made universal browser download the only completed-export delivery path on desktop and mobile; no hidden or compatibility vault copy is created.
- Preparation now calculates statistics and renders Markdown once, records real scan/parse/cleaning/generation timings, and no longer retains a duplicate raw-prose copy for every parsed note.
- Compile logs persist structural warning-code summaries and shareable diagnostics omit legacy warning details that may contain private metadata.
- Release packaging now uses the audited `fflate` ZIP implementation already required by DOCX generation instead of maintaining a second ZIP writer and parser.
- Added privacy-safe orphan hierarchy diagnostics and a realistic nested-container/mixed-matter Warden regression.
- Final-model preview now shows the exact exported outline, statistics, warnings, exclusions, filename, and destination.
- Output verification, rollback guidance, cancellation boundaries, partial-result handling, and history sequencing have stronger automated coverage.
- Vellum, Standard Manuscript, and supported Custom formatting resolve deterministically and are inspected semantically in generated Word XML.
- Architecture, release documentation, performance coverage, and the manual release checklist now describe the actual native-DOCX product.
- New Vellum and Standard requests default to A4 and metric indentation; existing Letter and legacy inch-based choices migrate without visual formatting drift.

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
