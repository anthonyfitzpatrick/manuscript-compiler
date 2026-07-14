# 0.9.2 Release Readiness

## Current status

Version 0.9.2 remains a prerelease candidate. Automated gates cover the shared prepared Book, six native generators, format validators, browser-download cleanup, privacy, migration, and release allowlist. Live interoperability and platform download testing remain release blockers; this document does not claim they were performed.

## Supported workflow

- Select the exact book root through File Explorer, command palette, or settings.
- Review the compact outline and use Correct structure only when needed.
- Choose DOCX, ODT, PDF, EPUB, HTML, or XML.
- Use only the formatting controls meaningful for that format.
- Generate and validate bytes in memory, then start the host browser download/share flow.

No completed export is written into the Obsidian vault. There is no vault fallback, Electron path, external executable, network request, telemetry, or dependency on another community plugin. The host controls the final destination and the plugin cannot verify that external filesystem copy after download dispatch.

## Automated gates

Run and record current output before publishing:

- `npm run typecheck`
- `npm test`
- `npm run test:docx`
- `npm run test:odt`
- `npm run test:pdf`
- `npm run test:epub`
- `npm run test:html`
- `npm run test:xml`
- `npm run test:exports`
- `npm run benchmark:large`
- `npm run build`
- `npm run package`
- `npm run package:validate`
- `npm audit`
- `git diff --check`

The release archive must be `release/manuscript-compiler-0.9.2.zip` and contain exactly `main.js`, `manifest.json`, and `styles.css`.

## Runtime dependencies

Obsidian supplies the host API. `fflate` is the sole bundled runtime package and is used for DOCX, ODT, and EPUB ZIP generation plus structural inspection. PDF, HTML, XML, filename handling, and download delivery add no runtime package.

## Known limitations

- Browser/host save prompts differ across Windows, macOS, Linux, and mobile.
- Download dispatch is observable; final external persistence is not.
- Internal PDF validation is structural, not a claim of full standards conformance.
- Native PDF uses the built-in WinAnsi font repertoire with NFC normalisation and an exact ToUnicode map. Characters outside that repertoire use an intentional `?` fallback reported once as information; live viewer checks remain required.
- Native PDF wrapping uses built-in Times-Roman/Helvetica metrics and verified A4/Letter point geometry. Automated layout checks do not replace visual inspection in Preview, Acrobat, browser, and Linux PDF viewers.
- EPUB structural tests do not replace EPUBCheck and reader interoperability.
- Word, LibreOffice, Vellum, PDF viewers, EPUB readers, browsers, and XML tools may expose application-specific behaviour not visible to byte-level tests.
- Complex Markdown layout and embedded media remain outside the fiction-manuscript model.

## Manual blockers before 1.0

- Complete all applicable items in `MANUAL_TESTING.md`.
- Test download delivery on Windows, macOS, Linux, and mobile.
- Inspect DOCX in Word/LibreOffice and import it into Vellum.
- Inspect ODT in LibreOffice.
- Inspect PDF and EPUB in at least two independent applications each.
- Inspect standalone HTML offline in multiple browsers and XML in XML-aware tools.
- Test a large real-world Unicode manuscript and confirm no vault output or Blob URL leak.
- Resolve discovered defects and repeat every automated gate.
