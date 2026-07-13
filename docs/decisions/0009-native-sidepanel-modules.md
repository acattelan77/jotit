# 0009. Native modules for cohesive side-panel responsibilities

Status: Accepted
Date: 2026-07-11
Supersedes: [ADR-0005](0005-single-file-sidepanel-controller.md)

## Context

ADR-0005 kept all panel behavior in one file until state coupling caused real
bugs rather than aesthetic discomfort. That threshold has been crossed:
autosave/library identifiers, pin metadata, live page history during export,
and initialization/title state have all produced concrete defects. At the
same time, `sidepanel.js` grew past 3,000 lines and its documented region map
became a substitute for enforceable module ownership.

The extension must remain static, unbundled, dependency-free, and easy to load
as an unpacked MV3 extension under ADR-0001. Browser-native ES modules satisfy
those constraints and are supported by the Chrome 116 minimum version.

## Decision

Load `sidepanel.js` as `type="module"` and split only cohesive responsibilities
whose dependencies can be explicit:

- `panel/state.mjs` owns the mutable panel state shape.
- `panel/storage.mjs` owns Promise-based `chrome.storage.local` wrappers and
  the shared debounce helper.
- `panel/date-time.mjs` owns pure local-date parsing/formatting helpers.
- `panel/date-picker.mjs` owns date-picker rendering, state, commands, and DOM
  listeners.
- `panel/export-service.mjs` owns deterministic Markdown/frontmatter and image
  package construction plus low-level disk/download adapters.
- `sidepanel.js` remains the browser-facing bootstrap/controller: DOM lookup,
  feature coordination, editor behavior, library UI, panel lifecycle, and
  command routing.

Modules use explicit constructor arguments for browser APIs and UI callbacks
where practical. Pure helpers remain directly testable. Do not split small
functions into one-file-per-function fragments, introduce circular imports,
or add a bundler merely because modules now exist.

## Consequences

- **Easier:** ownership is visible from filenames and imports; export and date
  behavior can be tested without booting the full panel; mutable state has one
  documented shape; diffs touch fewer unrelated concerns; humans and agents
  can load only the module relevant to a task.
- **Harder:** module loading is asynchronous and broken imports fail during
  panel startup; tests and package validation must include `.mjs` files;
  constructor dependencies add some wiring in `sidepanel.js`.
- **Guardrails:** keep the module graph shallow and one-directional, retain
  `sidepanel.js` as the obvious entry point, document module responsibility in
  architecture/glossary, and require syntax/import tests for every module.
