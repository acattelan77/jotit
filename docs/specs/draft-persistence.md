# Spec: Draft Persistence

## Purpose

The user should never lose in-progress note text to a closed panel, browser
restart, or accidental navigation. Autosave is separate from and unrelated to
explicit export (see [export-and-save.md](export-and-save.md)).

## Behavior

- Every edit to the note (title, date, editor content) triggers
  `debouncedSaveDraft()` — a 300ms debounce, not instant — before writing to
  `chrome.storage.local["noteDraft"]`.
- The draft shape is documented in
  [`../architecture.md`](../architecture.md#note-draft--chromestoragelocalnotedraft).
  It stores the editor content as **Markdown**, not HTML — every save/load
  round-trips through `htmlToMarkdown`/`markdownToHtml`.
- On panel load (`init()`), the last saved draft is restored: title, date,
  editor content, visited-page history, and caret position (`cursorOffset`)
  if the editor previously had focus (`editorFocused`).
- Draft save failures are reported via `reportError`, not silently swallowed
  — but they don't block the user from continuing to type (autosave failure
  isn't fatal to the editing session, only to that one persistence attempt).
- **New note** (`handleClear`) clears the draft and resets the editor to an
  empty state. This is a destructive, un-undoable action from the user's
  perspective — it does not first prompt to export first. (If changing this,
  update this spec and consider whether it should.)

## Non-goals

- No version history / undo-beyond-clear. Only one draft slot exists at a
  time; starting a new note overwrites it.
- No cross-device sync — `chrome.storage.local` is local to the Chrome
  profile on that machine.

## Tab browsing behavior

- The draft is one active note, not one note per browser tab. Opening the
  side panel and collecting material across multiple tabs should keep the
  same editor content and title.
- The active tab can still contribute source context: `pageHistory` is
  persisted in the draft and later feeds `pages_visited` during export.

## Edge cases to preserve

- Draft restore must not clobber a draft update that's mid-flight from a
  different presentation of the panel (docked vs. standalone) — in practice
  this is naturally avoided because only one presentation is ever open at a
  time (detaching disables the docked panel; see
  [panel-detach-reattach.md](panel-detach-reattach.md)), but a future change
  that allows both simultaneously would need to address draft-write races.
- Caret restore (`restoreCaretOffset`) must degrade gracefully if the saved
  `cursorOffset` no longer maps to valid content (e.g. content changed
  externally) — don't throw, just fall back to no restore.
