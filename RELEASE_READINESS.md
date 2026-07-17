# Release Readiness <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

## Current status

The current manifest version remains a prerelease candidate until every applicable gate is complete. Automated gates cover the shared prepared Book, six native generators, format validators, browser-download cleanup, privacy, migration, and release allowlist. Live interoperability and platform download testing remain release blockers; this document does not claim they were performed.

Maintainer and author documentation is provided in `ARCHITECTURE.md`, `DEVELOPER_GUIDE.md`, `USER_GUIDE.md`, `SECURITY.md`, and `CONTRIBUTING.md`. Screenshot placeholders in the user guide remain publication work and are not claims of completed manual testing.

## Supported workflow

- Select the exact book root through File Explorer, command palette, or settings.
- Review the compact outline and use Correct structure only when needed.
- Choose DOCX, ODT, EPUB, HTML, Markdown, or XML.
- Use only the formatting controls meaningful for that format.
- For DOCX, ODT, EPUB, or HTML, choose whether later body paragraphs use the configured first-line indent; first paragraphs after headings and scene breaks remain unindented. Markdown exposes a portability note instead, and XML delegates presentation to its consumer.
- Generate and validate bytes in memory, then start the host browser download/share flow.

No completed export is written into the Obsidian vault. There is no vault fallback, Electron path, external executable, background network request, telemetry, or dependency on another community plugin. User-selected support links may open an external website. The host controls the final destination and the plugin cannot verify that external filesystem copy after download dispatch.

## Automated gates

Run and record current output before publishing:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:docx`
- `npm run test:odt`
- `npm run test:epub`
- `npm run test:html`
- `npm run test:markdown`
- `npm run test:xml`
- `npm run test:exports`
- `npm run benchmark:large`
- `npm run build`
- `npm run package`
- `npm run package:validate`
- `npm audit`
- `git diff --check`

The release archive must be `release/manuscript-compiler-<version>.zip` and contain exactly `main.js`, `manifest.json`, and `styles.css`.

The three runtime assets are `main.js`, `manifest.json`, and `styles.css`. GitHub Artifact Attestations cover those files. The release tag must exactly match `manifest.json`, without a `v` prefix; the ZIP is optional and is not an installation dependency.

`logo.svg` remains the master editable artwork in the repository for branding and documentation. The build bundles its SVG text into `main.js`, so neither the release package nor an installed plugin needs a separate logo file.

## Runtime dependencies

Obsidian supplies the host API. `fflate` is the sole bundled runtime package and is used for DOCX, ODT, and EPUB ZIP generation plus structural inspection. HTML, Markdown, XML, filename handling, and download delivery add no runtime package.

## Known limitations

- Browser/host save prompts differ across Windows, macOS, Linux, and mobile.
- Download dispatch is observable; final external persistence is not.
- EPUB structural tests do not replace EPUBCheck and reader interoperability.
- Word, LibreOffice, Vellum, EPUB readers, text editors, browsers, and XML tools may expose application-specific behaviour not visible to byte-level tests.
- Complex Markdown layout and embedded media remain outside the fiction-manuscript model.
- Raw Markdown source displays heading markers, not rendered bold text; verify heading appearance in a Markdown rendering view.
- Markdown has no portable first-line indentation setting, and XML intentionally contains no presentation preference; their Create file notes make these limits explicit.

## Manual blockers before 1.0

- Complete all applicable items in `MANUAL_TESTING.md`.
- Test download delivery on Windows, macOS, Linux, and mobile.
- Inspect DOCX in Word/LibreOffice and import it into Vellum.
- Inspect ODT in LibreOffice.
- Inspect DOCX, ODT, EPUB, and HTML with **Indent first line of paragraphs** enabled and disabled, including first paragraphs after Chapter headings and scene breaks plus a copyright/front-matter page with indentation disabled.
- Inspect bold structural headings and normal-weight prose in ODT and in at least two independent EPUB applications.
- Inspect bold structural headings and normal-weight prose in standalone HTML offline in multiple browsers, rendered Markdown in a Markdown viewer, and presentation-neutral XML in XML-aware tools.
- Test a large real-world Unicode manuscript and confirm no vault output or Blob URL leak.
- Resolve discovered defects and repeat every automated gate.
