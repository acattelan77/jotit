# 2026-07-13 — New note title auto-fill

Agent/session: Codex (GPT-5)

## What I did

Fixed **New note** so it resets the previous note's title auto-fill tracking
before asking Chrome for the current page title. A title typed or restored on
the previous note no longer makes the fresh empty note look user-edited.

Added a state-module regression test for the reset behavior.

## Why

`handleClear()` emptied the title input but left `state.title.userEdited`
unchanged. If the previous note had a title, `updateTitleFromActiveTab()` would
refuse to auto-fill the fresh note's title, so creating a note could leave the
current page title uncaptured.

## Verified

- `node --test test/panel-modules.test.js`: 6 tests passed, 0 failed.
- `node --check sidepanel.js`: passed.
- `node --check panel/state.mjs`: passed.
- `npm test`: 96 tests passed, 0 failed.
- `jq empty manifest.json`: passed.
- `git diff --check`: passed.

## Docs updated

Updated `docs/specs/context-title-suggestion.md` to document that New note
must clear previous title-edit tracking before auto-fill runs.

## Left for next time

Manual Chrome verification: open a page with a recognizable title, create a
custom-titled note, click New note, and confirm the fresh note captures the
currently open page title.
