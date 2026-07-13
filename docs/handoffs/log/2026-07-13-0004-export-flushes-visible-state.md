# 2026-07-13 — Export flushes visible editor state

Agent/session: Codex (GPT-5)

## What I did

Fixed explicit export flows so they flush the visible editor state through the
normal autosave path before preparing/writing Markdown:

- `Save` calls `saveDraft()` before reading form data for export.
- `Save As` keeps `showDirectoryPicker()` first to preserve Chrome's
  user-gesture requirement, then calls `saveDraft()` before preparing the
  file.
- `Export all` calls `saveDraft()` before listing library entries, so the
  current note's latest edits are included in the bulk export.

Added an integrity test that guards this orchestration.

## Why

A user reported a split state: a file saved to `_inbox` contained newer note
body content, while the extension and a later Downloads export showed an older
body. The two supplied files confirmed the body mismatch: the `_inbox` note had
the later "Dashboard:" section/Data Studio link, while the visible extension
state and Downloads file did not.

The cause was that export paths read current DOM state directly but did not
force the same state into `chrome.storage.local` and the IndexedDB library.
If the user exported immediately after editing, the exported file could contain
newer content while the extension later reloaded the previous draft/library
state.

## Verified

- `node --test test/repository-integrity.test.js`: 6 tests passed, 0 failed.
- `node --check sidepanel.js`: passed.
- `node --check panel/state.mjs`: passed.
- `npm test`: 97 tests passed, 0 failed.
- `jq empty manifest.json`: passed.
- `git diff --check`: passed.

## Docs updated

Updated `docs/specs/export-and-save.md` to clarify that Save/Save As are still
disk-export actions, but must flush pending autosave state before export
construction. Also documented the folder-picker ordering constraint.

## Left for next time

Manual Chrome verification: edit a note, immediately use Save As to write into
an external folder, close/reopen the extension, and confirm the extension,
library row export, and exported file all show the same latest body content.
