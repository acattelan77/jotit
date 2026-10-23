# 2026-10-23 — Remembered save folder

Agent/session: Claude Code (Opus 5.5), fork `viviana-collab/jotit`

## What I did

- Added a footer "Save to: <folder>" control (+ reset ×) that remembers a
  `FileSystemDirectoryHandle` in IndexedDB (`panel/save-folder.mjs`).
- Save and the library row export write into that folder when set
  (`exportService.writeNoteToDirectory`, same layout and uniquify behaviour
  as Downloads). Save As / Export all open their picker there (`startIn`).
- Tests for folder writes (layout, uniquify) and permission handling;
  relaxed the `handleSave` regex in the integrity test, which now checks
  folder access before `saveDraft()`.

## Why

Users wanted exports to land directly in a fixed folder (e.g. `~/42/_inbox`);
`chrome.downloads` cannot write outside Downloads. The 2026-07-10 removal of
the old folder setting was about unreliable handles and silent fallback, so
this version reports every failure explicitly. See
[ADR-0010](../../decisions/0010-remembered-save-folder.md).

## Verified

- `npm test`: all tests pass.
- Not verified in a real Chrome with the unpacked extension yet: folder
  picker, permission prompt after browser restart, command-shortcut path.

## Docs updated

`docs/decisions/0010-remembered-save-folder.md` (new) + index,
`docs/architecture.md`, `docs/glossary.md`, `docs/specs/export-and-save.md`,
`docs/plan/roadmap.md`.

## Left for next time

- Manual check in Chrome of the flows listed under Verified.
- Version bump / release notes left to the maintainer.
