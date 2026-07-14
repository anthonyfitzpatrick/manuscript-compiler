# 0.9.2 Release Readiness

## Current status

Version 0.9.2 remains a release candidate. Live Obsidian/Vellum testing exposed a nested-container hierarchy and matter-classification defect; Step 8 corrects it with exact File Explorer root selection, structural-ancestor reconstruction, matter aliases, and a realistic regression fixture. The updated DOCX has not yet been manually re-imported into Vellum, so application-level confirmation remains required.

## Supported workflow

- Select a book root in the four-step Compile Manuscript workspace.
- Or right-click the exact File Explorer folder and choose **Compile manuscript from this folder**.
- Review roles, inclusion, exclusions, transparent containers, and manual order.
- Select Vellum, Standard Manuscript, or supported Custom DOCX formatting.
- Review the exact prepared semantic manuscript.
- Create a native DOCX, save it to the vault, and use platform result actions where supported.
- Use the retained current-book, selected-folder, validation, sample, Markdown, and legacy-profile command routes through the same preparation service.

## Automated release gates completed

- `npm run typecheck` — passed
- `npm test` — 103 tests passed, including traversal-before-normalisation, equal-size stale-source detection, diagnostics/log privacy, malformed persistence repair, repository hygiene, and the real-vault nested-container/matter-role regression
- `npm run test:safe-writer` — 18 tests passed
- `npm run test:docx` — passed; original and real-vault Warden semantic structures inspected
- `npm run benchmark:large` — 500 Chapters, 2,000 Scenes, and 2,000,000 words in 484 ms locally: parse/clean/Book 209 ms, statistics 114 ms, Markdown 37 ms, DOCX/ZIP 125 ms; timing is informational
- `npm run build` — passed
- `npm run package` — passed
- `npm run package:validate` — passed
- `npm audit` — 0 vulnerabilities
- `git diff --check` — passed

The release archive must be `release/manuscript-compiler-0.9.2.zip` and contain exactly `main.js`, `manifest.json`, and `styles.css`.

## Independence and runtime assumptions

Manuscript Compiler performs no network requests, telemetry, cloud sync, shell execution, child-process execution, or community-plugin API access. Pandoc and other external executables are not invoked. Obsidian provides the host API. The only production npm dependency is bundled `fflate`, used to create and inspect ZIP-based DOCX packages offline.

Local filesystem vaults receive the strongest same-folder staged replacement path. Other adapters use verified staged output and recovery where supported. Open, reveal, browser download, and platform share/save behaviour depends on the available Obsidian platform APIs.

## Known limitations

- Word TOC fields require an update in Word or LibreOffice.
- Complex nested Markdown, tables, embedded media, and advanced page layout are outside the fiction-manuscript renderer.
- Ordinary blockquotes are preserved by cleaning but rendered as readable paragraphs rather than a dedicated Word quotation style.
- Vellum recognition and visual pagination require application-level confirmation.
- Matter inference covers documented aliases and ancestry; unusual names still require author review in Contents.
- Mobile and non-filesystem adapter recovery cannot promise filesystem-atomic replacement.

## Manual gates still required

Complete every applicable unchecked item in `MANUAL_TESTING.md`, especially real-book detection, stale-preview blocking, overwrite recovery, Word/LibreOffice pagination, Vellum structure recognition, and available desktop/mobile platforms.

## Remaining blockers before 1.0.0

- Complete and record live Obsidian desktop testing on supported operating systems.
- Complete Word or LibreOffice visual inspection and Vellum import testing.
- Exercise mobile/non-filesystem save and recovery on real supported devices.
- Resolve any defects discovered by those manual checks and repeat the automated release gates.
