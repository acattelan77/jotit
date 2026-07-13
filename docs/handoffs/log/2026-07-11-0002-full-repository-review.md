# 2026-07-11 — Full repository review and correctness fixes

Agent/session: Codex (GPT-5)

## What I did

Reviewed the documented architecture, recent handoffs, all extension runtime
files, UI markup/styles, and tests. Fixed autosave/library races that could
create duplicate entries or leave a new entry id out of the draft, preserved
pin metadata on content autosave, and made image-only notes count as real
library content.

Made export construction take each note's page history explicitly instead of
temporarily replacing live module state. Consolidated shared export-package
construction and image metadata, fetched each remote image once with a
streaming 20 MB limit, and chose its attachment extension from the validated
response MIME type. Hardened IndexedDB open retry/version-change behavior,
cached the word segmenter, guarded title/tab refreshes until draft restore is
complete, removed dead/no-op message paths, and raised the manifest floor to
Chrome 116 because `sidePanel.open()` starts there.

Added unit coverage for image metadata and library-entry updates, direct tests
for the IndexedDB wrapper (including transient-open retry), and package
integrity tests for manifest files, side-panel DOM ids, and command allow-list
drift. The pre-existing uncommitted Chrome-command work was preserved and
reviewed in place.

## Why

The bugs could silently duplicate or partially lose library state, unpin notes
after editing, omit image-only notes, corrupt exported `pages_visited` data
during concurrent activity, or install on a Chrome version missing a required
API. The consolidations remove already-documented divergence risks without
changing the static, dependency-free architecture or adding a build step.

## Verified

- `node --check` on all five runtime JavaScript files.
- `jq empty manifest.json`.
- `npm test`: 89/89 passing (previously 79).
- `git diff --check`.
- Static package tests verify all manifest-referenced files, every
  `getElementById` reference, and manifest/background command consistency.

Real Chrome verification was not performed in this session. Reload the
unpacked extension before release and exercise autosave/reload, pin-then-edit,
image-only autosave, remote-image export, Save/Save As, bulk export, selection
capture, detach/reattach, and the newly added Chrome-managed commands.

## Docs updated

- `docs/architecture.md`
- `docs/glossary.md`
- `docs/plan/roadmap.md`
- `docs/specs/export-and-save.md`
- `docs/specs/note-library.md`
- `docs/specs/panel-detach-reattach.md`
- `docs/specs/rich-text-editor.md`
- `README.md` (Chrome 116 minimum)

## Left for next time

The documented service-worker eviction fragility remains: `detachedWindows`,
`openPanelTabs`, and debug logs are memory-only. Moving lifecycle state to
`chrome.storage.session` needs a new ADR and real-browser lifecycle testing,
so it was not folded into this otherwise scoped review. The hand-rolled
Markdown/YAML limitations, global side-panel controller state, and manual
three-file version synchronization also remain documented backlog items.

The current working tree already contained a large, uncommitted keyboard-
command change before this review. No commit was created.
