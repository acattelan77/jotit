# 2026-07-15 — Library list-spacing round-trip fix

Agent/session: Codex (GPT-5)

## What I did

Fixed Markdown-to-HTML list reconstruction so newline separators between
consecutive bullet or numbered items do not become `<br>` elements inside the
list. The converter also accepts multiple separators, repairing notes whose
Markdown already contains blank lines introduced by the old behavior.

Added exact HTML and Markdown round-trip regression tests for unordered and
ordered lists, plus a test for affected saved Markdown.

## Why

Opening a note from the Library passes its saved Markdown through
`markdownToHtml()`. The old list wrapper retained the newline between each
generated `<li>`, and the converter's later global newline pass changed it to
`<br>`. Those breaks appeared as extra vertical lines in the editor and were
then written back as blank Markdown lines by the immediate draft autosave.

## Verified

- `npm test`: 100 tests passed, 0 failed.
- `node --check sidepanel.js`: passed.
- `node --check lib/note-utils.js`: passed.
- `node --check background.js`: passed.
- `jq empty manifest.json`: passed.
- `git diff --check`: passed.

## Docs updated

- Updated `docs/specs/rich-text-editor.md` with the list-separator invariant
  and repair behavior.
- Added the fix to `docs/plan/roadmap.md` Resolved.

## Left for next time

Reload the unpacked extension, reopen an affected Library note, and confirm
both bullet and numbered lists render compactly and stay compact after another
Library close/reopen cycle.
