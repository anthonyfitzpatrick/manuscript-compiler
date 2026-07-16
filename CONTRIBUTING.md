# Contributing <img src="logo.svg" alt="Manuscript Compiler logo" width="48" align="right">

Thank you for helping maintain Manuscript Compiler. Read [ARCHITECTURE.md](ARCHITECTURE.md) and [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) before changing production code. This project prioritises semantic correctness, privacy, deterministic output, accessibility, and long-term maintenance over feature breadth.

## Development setup

Use Node.js 24 and install the locked dependency graph:

```bash
npm ci
```

Useful commands:

- `npm run dev` watches production source and rebuilds ignored `main.js`.
- `npm run typecheck` checks strict TypeScript.
- `npm run lint` runs the official Obsidian ESLint configuration with zero-warning enforcement.
- `npm test` runs the main regression suite.
- `npm run test:exports` runs all native exporter, validator, and browser-download tests.
- `npm run benchmark:large` checks large-manuscript behavior without a machine-specific threshold.
- `npm run build` creates the minified production bundle.
- `npm run package` creates the optional release ZIP.
- `npm run package:validate` verifies the release allowlist and individual release assets.

## Architecture rules

- The prepared semantic `Book` is the only source for preview, validation, and export.
- Exporters must not receive vault, scanner, parser, or source-note access.
- `SemanticDocument` projects the prepared Book; it must not become a second parser.
- All exports remain in memory until `BrowserDownloadService` initiates one host download.
- No manuscript export, temporary export, or recovery copy is written into the vault.
- No network, telemetry, Electron, Node filesystem, shell, external executable, conversion tool, or another-plugin dependency is permitted.
- Registries for formats and validators remain exhaustive.
- Migration and repair remain idempotent and preserve explicit user choices.

If a proposed change conflicts with one of these rules, open a design discussion before implementation.

## Coding style

- Follow strict TypeScript and the official Obsidian lint rules.
- Prefer small, explicit boundaries and pure helpers for transformations.
- Treat persisted values and external errors as `unknown` until validated.
- Use documented Obsidian APIs and component/event lifecycle ownership.
- Use sentence-case UI labels, scoped CSS, visible focus, and keyboard-operable native controls.
- Keep output deterministic and security-sensitive escaping local and testable.
- Avoid broad refactors in product fixes.
- Do not add inline UI styles or unsafe `innerHTML`.

## Comments and documentation

Production files begin with an architectural header describing purpose, ownership, boundaries, callers/callees, invariants, failure/cancellation behavior, mobile concerns, and maintenance constraints where relevant. Exported classes and functions require professional JSDoc.

Comments should explain why a boundary or algorithm exists. Do not narrate syntax or add filler. Update user documentation for visible changes and developer documentation for architecture, extension, migration, security, dependency, or release changes.

## Testing expectations

Every behavioral fix needs a regression that fails before the fix. New exporter behavior requires complete generated-output assertions, not only isolated helper tests. Migration changes require first-pass and idempotent second-pass coverage. UI changes require keyboard, focus, accessibility, and narrow-layout consideration.

Before requesting review, run the relevant focused suites and the complete matrix in [RELEASE_READINESS.md](RELEASE_READINESS.md). Application interoperability checks remain manual and must not be marked complete unless performed.

## Branch and commit strategy

- Branch from the current default branch.
- Use a short topic branch such as `fix/stale-preview` or `docs/user-guide`.
- Keep commits cohesive and reviewable.
- Use imperative commit subjects that describe the outcome.
- Do not mix formatting churn, generated artifacts, personal vault state, or unrelated cleanup into a product change.
- Never commit `.test-build/`, `release/`, `main.js`, `data.json`, private notes, or diagnostics.

History rewriting and force-pushing shared branches require explicit maintainer agreement.

## Pull requests

A pull request should explain:

- what changed and why;
- affected architecture boundaries;
- user-visible impact;
- security/privacy/dependency impact;
- tests and manual checks performed;
- checks still outstanding;
- screenshots for visible UI changes.

Keep the PR focused. Address review comments with new commits unless the maintainer requests a rebase or squash. Do not mark manual tests as passed based solely on structural test output.

## Dependencies

`fflate` is the sole production dependency. Any dependency proposal must demonstrate that existing platform APIs and repository code cannot meet the need, and must include security, maintenance, bundle-size, licence, offline, and mobile analysis. Development dependency updates also require lockfile review and a clean audit.

## Releases

A release tag must exactly equal the version in `manifest.json`, without a `v` prefix. Attach `main.js`, `manifest.json`, `styles.css`, and `logo.svg` individually. The optional ZIP must contain exactly those four files. Follow [RELEASE_READINESS.md](RELEASE_READINESS.md) and preserve every unchecked manual gate in [MANUAL_TESTING.md](MANUAL_TESTING.md) until it is actually completed.
