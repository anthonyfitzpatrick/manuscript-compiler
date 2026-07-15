# Contributing

Use Node.js 24 and install the locked development dependencies with `npm ci`.

- `npm run dev` watches the production source and rebuilds `main.js` for local testing.
- `npm run typecheck` checks strict TypeScript.
- `npm run lint` runs the official Obsidian ESLint configuration.
- `npm test` runs the main regression suite.
- `npm run test:exports` runs all native-export and download tests.
- `npm run build` creates a minified production bundle without a source map.
- `npm run package` creates the optional local ZIP.
- `npm run package:validate` verifies the release allowlist and individual GitHub assets.

Behavior changes need focused regression coverage. A release tag must exactly equal the version in `manifest.json` without a `v` prefix, and the GitHub release must attach `main.js`, `manifest.json`, and `styles.css` individually.
