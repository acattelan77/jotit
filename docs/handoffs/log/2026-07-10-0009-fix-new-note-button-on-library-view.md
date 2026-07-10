# 2026-07-10 — Fix: "New note" button silently did nothing while on the library view

Agent/session: Claude Code (Sonnet 5)

## What I did

User report: "the + button does not work" while on the library page. Root
cause: `handleClear` (the "+" / New note button) correctly cleared the
draft/editor state, but never called `setLibraryViewOpen(false)` — so if
the library list was showing, it stayed showing, and the note-clear
happened invisibly underneath it. The feature wasn't broken, the UI just
never reflected it. Fixed with one line: `setLibraryViewOpen(false);` in
`handleClear`, right after the editor reset (matches the same call
`openLibraryEntry` already makes for the same reason).

## Verified

Real Chrome browser (`claude-in-chrome`), local static-file harness
(cache-busted, deleted after use). Wrote a note, switched to the library
view, clicked "+" — confirmed the view switches back to a clean empty
editor (title/date/body all empty, library view hidden), and separately
confirmed the note that was open before clicking "+" is still safely in the
library (found by title, correct content) — the fix doesn't touch the
existing flush-before-clear behavior, only the view-switching.

## Docs updated

[docs/specs/note-library.md](../../specs/note-library.md) — added a note in
the Browsing section that *any* action changing which note is in the editor
must also call `setLibraryViewOpen(false)`, specifically flagging this bug
as the reason, so the next agent adding a similar action doesn't repeat it.
This file.

## Left for next time

Nothing outstanding. Not committed yet.
