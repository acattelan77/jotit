# 0001. Static, unbundled extension — no build step, no dependencies

Status: Accepted
Date: 2026-07-09 (retroactively documented — reflects the codebase as found)

## Context

Jot it! is a small Chrome MV3 extension. `sidepanel.html` loads
`lib/note-utils.js` and `sidepanel.js` directly as plain `<script>` tags.
`package.json` has no `dependencies`, `devDependencies`, or `scripts`. There
is no webpack/vite/rollup/esbuild config, no linter config, and the
`content_security_policy` in `manifest.json` disallows `unsafe-inline` and
restricts `script-src` to `'self'` — consistent with "load unpacked, ship the
files as-is."

## Decision

No build step. No bundler. No npm dependencies. Source files are exactly
what ships. Loading the extension unpacked in Chrome (`chrome://extensions` →
Load unpacked) requires no prior compilation step.

## Consequences

- **Easier:** zero-friction onboarding (no `npm install`, no build to keep
  green), no dependency-supply-chain surface, no version drift between
  source and shipped artifact, trivial to audit exactly what code runs.
- **Harder:** no ES module syntax (would require either a bundler or
  `type="module"` script tags with import-map/CSP considerations), no
  TypeScript, no tree-shaking, manual duplication instead of shared imports
  in places where `sidepanel.js` and `lib/note-utils.js` need the same
  constants (see [ADR-0005](0005-single-file-sidepanel-controller.md) and the
  known-issues list in [`docs/plan/roadmap.md`](../plan/roadmap.md)).
- **Forecloses (without a new ADR):** adding a framework (React/Vue/etc.),
  adding any npm dependency, or introducing a build/compile step. If a future
  task seems to require one of these, write a new ADR proposing it explicitly
  rather than introducing it incidentally as part of an unrelated feature
  change.
