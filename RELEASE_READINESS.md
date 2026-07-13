# 0.9.2 Release Readiness

## Current status

Version 0.9.2 is an automated release candidate. On 2026-07-13, TypeScript checking, 80 core/release tests, 18 safe-writer tests, semantic Warden DOCX inspection, the large-manuscript benchmark, production build, release packaging, archive-content validation, and `git diff --check` completed successfully. An earlier `npm audit` run reported zero vulnerabilities; the final retry could not resolve `registry.npmjs.org`, so the registry-dependent check should be repeated before release. Live Obsidian, Word/LibreOffice, Vellum, desktop, and mobile checks remain manual and are not represented as complete.

## Supported workflow

- Select a book root in the four-step Compile Manuscript workspace.
- Review roles, inclusion, exclusions, transparent containers, and manual order.
- Select Vellum, Standard Manuscript, or supported Custom DOCX formatting.
- Review the exact prepared semantic manuscript.
- Create a native DOCX, save it to the vault, and use platform result actions where supported.
- Use the retained current-book, selected-folder, validation, sample, Markdown, and legacy-profile command routes through the same preparation service.

## Automated release gates completed

- `npm run typecheck` — passed
- `npm test` — 80 tests passed
- `npm run test:safe-writer` — 18 tests passed
- `npm run test:docx` — passed; Warden regression DOCX generated and semantically inspected
- `npm run benchmark:large` — 500 Chapters, 2,000 Scenes, and 2,000,000 words measured locally; timing is informational
- `npm run build` — passed
- `npm run package` — passed
- `npm run package:validate` — passed
- `npm audit` — an earlier run reported 0 vulnerabilities; the final retry failed with `getaddrinfo ENOTFOUND registry.npmjs.org`
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
- Mobile and non-filesystem adapter recovery cannot promise filesystem-atomic replacement.

## Manual gates still required

Complete every applicable unchecked item in `MANUAL_TESTING.md`, especially real-book detection, stale-preview blocking, overwrite recovery, Word/LibreOffice pagination, Vellum structure recognition, and available desktop/mobile platforms.

## Remaining blockers before 1.0.0

- Complete and record live Obsidian desktop testing on supported operating systems.
- Complete Word or LibreOffice visual inspection and Vellum import testing.
- Exercise mobile/non-filesystem save and recovery on real supported devices.
- Resolve any defects discovered by those manual checks and repeat the automated release gates.
