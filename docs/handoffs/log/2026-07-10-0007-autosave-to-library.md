# 2026-07-10 — Autosave to library; Save/Save As become disk-export-only

Agent/session: Claude Code (Sonnet 5)

## What I did

Reversed one core decision from the note-library work shipped earlier the
same day: library entries used to require an explicit Save/Save As click.
The product owner asked for the opposite — every note should already be in
the library as the user writes it, with no separate action, and Save/Save
As should mean only "download this note." Wrote
[ADR-0007](../../decisions/0007-autosave-to-library.md), which formally
supersedes decision point 2 of
[ADR-0006](../../decisions/0006-note-library-via-indexeddb.md) (marked
in place with strikethrough + a pointer, not rewritten — the rest of
ADR-0006 still holds).

- `saveDraft()` (the existing 300ms-debounced autosave that already writes
  `chrome.storage.local`'s draft) now also calls `saveNoteToLibrary()`,
  gated by a new `hasRealNoteContent()` check.
- **`hasRealNoteContent()`** is deliberately stricter than "editor isn't
  empty": real note-body text, or a title the user *deliberately*
  typed/edited (`userEditedTitle`) — not just the title auto-filling from
  the active tab, which happens on every panel open and would otherwise
  spawn an empty library entry from doing nothing.
- **`handleSave`/`handleSaveAs` no longer call `saveNoteToLibrary` at all**
  — removed the calls added earlier the same day. They're pure disk-export
  now.
- **Removed two confirmation dialogs** that no longer protect against
  anything real: `openLibraryEntry`'s "discard unsaved changes?" and
  `handleClear`'s "clear this note?". Both existed specifically to guard
  against data loss that autosave-to-library makes impossible — the note
  being switched away from is already saved to its own library entry (or
  about to be). Added `flushLibrarySync()`, called at the start of both
  functions: one immediate, non-debounced library write for whatever's in
  the editor, removing any dependency on the 300ms debounce's timing right
  when the content is about to be replaced.
- `init()` gets a one-time migration sync for a draft restored with real
  content, covering a note written before this feature existed (or one
  never edited again after a reload).

## A real bug found via testing, fixed before it mattered

My first version of the `init()` migration sync used `hasRealNoteContent()`
(title-inclusive) — testing in a real browser caught that this spawned an
empty library entry (title "Test Page", no body) on nearly every reload.
Root cause: `init()` sets `userEditedTitle = Boolean(meetingNameInput.value.trim())`
for *any* restored non-empty title, including one that was only ever
auto-filled before the reload — so my content gate trusted a signal that
isn't trustworthy in that specific context. Fixed by checking
`notesInput.textContent.trim()` directly in `init()`'s migration-sync call,
not the full `hasRealNoteContent()` (which is still correct and unchanged
everywhere it's used in response to a live edit — the title signal is only
inaccurate immediately after a reload).

## A second, separate pre-existing bug found and *not* fixed

While isolating the above, found that a restored draft's title can get
silently overwritten by the active tab's title on load, even though
`userEditedTitle` should protect it. Root cause: `init()` restores the
title asynchronously (`await storageGetMultiple(...)`) before setting
`userEditedTitle`; a `window` `"focus"` event listener elsewhere in
`sidepanel.js` also calls `updateTitleFromActiveTab()`, and if that event
fires during the async gap, `userEditedTitle` is still at its module-load
default (`false`), so the auto-fill wins. Reproduced reliably via full-page
reloads in the test harness; whether this happens in the real docked
side-panel context (which may not receive an equivalent `focus` event the
same way) is unconfirmed. This is a **pre-existing bug, unrelated to
today's work** — logged as known-issue #10 in `docs/plan/roadmap.md`, not
fixed here. Fixing it would mean understanding the whole auto-fill state
machine (`shouldAutoUpdateTitle`, the four-plus call sites of
`updateTitleFromActiveTab`) properly, which is out of scope for a session
about save/library behavior.

## Verified

All in a real Chrome browser (`claude-in-chrome`, same as the note-library
session — `Claude_Preview` still unavailable this session), against a
fresh copy of the local static-file harness (deleted after use). Learned
the hard way, again, that the test harness needs cache-busting query
params on **every** script tag it injects (not just the CSS) — an earlier
false signal in this session (a bogus library entry appearing to persist
across a "fixed" reload) turned out to be the browser executing a stale
cached `sidepanel.js`, not a real bug; re-verified against the actual
current file via `fetch(..., {cache: "no-store"})` before concluding
anything from an unexpected result going forward.

- Typing into the editor with no Save click creates a library entry
  (`downloadCount: 0`, entry present with the typed content).
- A reload with a restored draft that has a title but empty body does not
  create a new library entry (count unchanged before/after).
- Clicking Save: exactly one download fires, library entry count is
  unchanged (the entry already existed from autosave).
- New note: zero `window.confirm` calls, the note that was just cleared is
  still present in the library with its full content, editor correctly
  empty afterward.
- Opening a different library entry while the editor has unsaved-looking
  content: zero `window.confirm` calls, the previous note's content is
  correctly flushed to its own library entry before the switch, the target
  note loads correctly.
- Deliberately typing only a title (no body) still creates a library entry
  — the intended exception, confirmed working (not accidentally blocked by
  the stricter gate).

## Docs updated

[ADR-0007](../../decisions/0007-autosave-to-library.md) (new),
[ADR-0006](../../decisions/0006-note-library-via-indexeddb.md) (in-place
strikethrough + pointer at the superseded decision point, not rewritten),
[docs/decisions/README.md](../../decisions/README.md) (index + a note about
partial-ADR-supersession as a pattern for future agents),
[docs/architecture.md](../../architecture.md) (note-library section,
Save/Save As flow section),
[docs/glossary.md](../../glossary.md) (term + region map),
[docs/specs/note-library.md](../../specs/note-library.md) (rewrote "What
creates a library entry" and "Opening a note from the library"),
[docs/specs/draft-persistence.md](../../specs/draft-persistence.md) (Purpose
+ New note bullet), [docs/specs/export-and-save.md](../../specs/export-and-save.md)
(Purpose — disk-only, explicit warning against reintroducing the old
behavior), `docs/plan/roadmap.md` (new Resolved entry, new known-issue #10
for the title-race bug), this file.

## Left for next time

- **Known-issue #10** (title auto-fill race on load) needs its own
  investigation — don't fix it as a drive-by part of unrelated work.
- Everything else about this change is complete and verified. Not
  committed yet this session — check with the user before committing.
