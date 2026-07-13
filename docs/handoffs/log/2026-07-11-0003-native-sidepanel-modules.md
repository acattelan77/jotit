# 2026-07-11 — Native side-panel modules

Agent/session: Codex (GPT-5)

## What I did

Refactored the side-panel controller along cohesive boundaries without adding
a build step or dependency. `sidepanel.js` is now a native ES-module entry
point over `panel/state.mjs`, `panel/storage.mjs`, `panel/date-time.mjs`,
`panel/date-picker.mjs`, and `panel/export-service.mjs`. The entry point still
owns DOM/editor/library/lifecycle coordination; the extracted modules own
their explicit state or browser boundary.

Added module-level tests and repository-integrity coverage for the module
script tag and local imports. During extraction, date parsing was made strict
against invalid calendar rollovers, date-grid keyboard navigation was changed
to preserve the selected time, and time-only controls were kept from changing
the selected date.

## Why

The single-file policy had reached its documented revisit threshold: concrete
state/export defects had occurred and the controller had grown beyond 3,000
lines. Native modules improve ownership for human and AI maintainers while
preserving the static, unbundled MV3 architecture. See
[ADR-0009](../../decisions/0009-native-sidepanel-modules.md), which supersedes
[ADR-0005](../../decisions/0005-single-file-sidepanel-controller.md).

## Verified

- `npm test`: 95 tests passed, 0 failed.
- `node --check` passed for the JavaScript entry points and every `panel/*.mjs`
  module.
- `manifest.json` parsed successfully and `git diff --check` passed.
- Automated extension loading was attempted with Playwright, a temporary
  Chrome remote-debug profile, and the connected user Chrome session. Branded
  Chrome did not load the unpacked extension from command-line flags, and
  Chrome automation cannot claim `chrome://extensions/` or extension-origin
  pages, so a real-panel smoke test could not be completed in this session.

## Docs updated

Updated `AGENTS.md`, `README.md`, architecture, glossary/module map, ADR index,
roadmap, and the date/time, draft-persistence, and export specs. Added
ADR-0009 and marked ADR-0005 superseded.

## Left for next time

Manually reload the unpacked extension from `chrome://extensions/`, open the
panel, and smoke-test draft restore/autosave, date-picker navigation, Save,
Save As, library-row export, and Export all. Broken module imports would fail
at panel startup, so this is the remaining release-risk check despite syntax
and import-integrity tests passing.

The working tree also contains the product owner's pre-existing uncommitted
keyboard-command work and the earlier repository-review changes; this session
did not revert or commit them.
