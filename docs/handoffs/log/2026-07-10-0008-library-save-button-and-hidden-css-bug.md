# 2026-07-10 — Per-row Save button in the library, and a real `[hidden]` CSS bug

Agent/session: Claude Code (Sonnet 5)

## What I did

The user's request read ambiguously ("saved notes should be displayed in a
new window") against the rest of the same message, which described a
same-panel toggle — asked via `AskUserQuestion` rather than guessing, since
the two readings imply very different amounts of work. Confirmed: same
panel, toggled view (already built in an earlier session). The actual new
requirement was a **Save button on each library row**, in addition to the
existing Delete button.

- Added `exportLibraryEntry(entry)` (`sidepanel.js`): exports a single
  library entry straight to disk without opening it into the editor first.
  Mirrors `handleSave`'s exact single-note behavior (folder only if the
  note has attachments, silent `saveAs:false` download falling back to
  `saveAs:true` on error), operating on a stored entry's data instead of
  the live editor — including the same page-history swap/restore pattern
  already used by `exportAllNotes`. Deliberately a third duplicate of this
  export logic rather than a shared refactor — matches the
  already-accepted duplication in known-issue #2
  (`docs/plan/roadmap.md`), which is explicitly on hold; didn't touch
  `handleSave`/`handleSaveAs` to add this.
- Added the Save button to each row in `renderLibraryList()`, positioned
  before Delete (less-destructive action first, matching the existing
  header's "Save before Save As" convention). Reuses the same download-icon
  SVG as the header's Save button and `libraryExportAllBtn`.

## A real, unrelated bug found while visually verifying the toggle

Screenshotting the default (just-opened) panel state showed the library
view's search bar and export-all button visible *underneath* the editor,
even with no interaction — the `#libraryView` section's `hidden` attribute
wasn't actually hiding it. Root cause: `.library-view { display: flex; }`
(a class selector) and the browser's built-in `[hidden] { display: none; }`
(an attribute selector) have **equal CSS specificity**, so whichever rule
comes later in the cascade wins — and an author stylesheet always comes
after the UA default sheet, so the class rule silently won regardless of
the `hidden` attribute being set. The exact same issue affected `.meta`/
`.notes` (also class-selector `display: flex` rules) when switching *to*
the library view — not yet visibly broken in a screenshot at the point I
checked, but the identical bug, so fixed both at once rather than waiting
to catch it separately. Fixed by adding explicit
`.library-view[hidden], .meta[hidden], .notes[hidden] { display: none; }`
overrides (see `sidepanel.css`) — the standard fix for this well-known
gotcha. Worth remembering for any future toggled/hideable section built the
same way (a `display`-setting class rule + JS toggling the `hidden`
attribute): the class rule needs an explicit `[hidden]` override or it
silently wins.

## Verified

Real Chrome browser (`claude-in-chrome`), fresh copy of the local
static-file harness (deleted after use, cache-busted every script/style tag
this time — no repeat of the stale-cache false signals from earlier
sessions).

- Screenshot of the default panel state: title field, date field, editor
  filling the remaining vertical space, **no** library elements visible —
  confirmed after the `[hidden]` fix (was broken before it).
- Screenshot after clicking "Library": editor/meta sections correctly gone,
  replaced by the search bar, export-all button, and the note list; every
  row shows both a Save (download icon) and Delete (trash icon) button.
- Clicked a row's Save button directly: exactly one download fired with the
  correct single-note filename (no folder, matching `handleSave`'s
  no-attachments behavior, not `exportAllNotes`'s always-folder behavior),
  and the view stayed on the library list — it doesn't open the note into
  the editor first, matching "save without leaving the list."

## Docs updated

[docs/specs/note-library.md](../../specs/note-library.md) (Browsing
section — documents the per-row Save button and the deliberate-duplication
rationale), this file. Didn't touch `docs/architecture.md`'s note-library
section — the per-row Save button is a UI detail of an already-documented
feature, not a new architectural fact; the `[hidden]` CSS gotcha is
captured here rather than in architecture.md since it's a
one-off implementation pitfall, not a standing fact about the system.

## Left for next time

Nothing outstanding for this change. Not committed yet — same as every
session this week, check with the user before committing.
