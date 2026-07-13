# Spec: Title Auto-fill And Lock

## Purpose

Save the user from retyping a note title every time — prefill it from the
page they're on, and let them lock the title so it stops following page
navigation once they've set it deliberately.

**Removed 2026-07-10: per-site "context suggestion."** This spec previously
also covered a "Use last: `<value>`" suggestion button, remembering the last
custom title typed on a given hostname (`contextByHost` storage key,
`#contextSuggestion` UI element) and offering it back next time. Removed at
the product owner's explicit direction ("that feature is not needed") — see
[roadmap.md](../plan/roadmap.md). `getCurrentHost()`, the helper it used to
determine the current hostname, was kept — the library's "this site" filter
(see [note-library.md](note-library.md)) depends on it independently.

## Behavior

- On tab activation/navigation (docked) or `sourceTabId` update (standalone),
  `updateTitleFromActiveTab()` auto-fills the title field from the current
  page's title while the note is still empty/unstarted, **unless**:
  - the title is locked (`titleLocked`, persisted as `titleLockEnabled`), or
  - the user has already manually edited the title for this session
    (`userEditedTitle`) — auto-fill should not clobber a title the user
    typed themselves, or
  - the editor already has note content. Once the user has started collecting
    notes, switching tabs should keep the same note identity instead of
    renaming the Markdown file to the newly active page.
- **Title lock** is a toggle, persisted across sessions
  (`chrome.storage.local["titleLockEnabled"]`). While locked, page
  navigation never overwrites the title field.

## Edge cases to preserve

- Auto-fill must not fire after the user has typed a custom title in the
  same session, even if title lock is off — `userEditedTitle` exists
  specifically to prevent auto-fill from stomping a deliberate edit that
  happened without the user remembering to also flip the lock toggle.
- Auto-fill must not fire after the note body has content and the title is
  already non-empty. This preserves the research workflow where one note
  accumulates excerpts from multiple tabs/articles.
- Creating a **New note** must reset the previous note's title-edit tracking
  before auto-fill runs. A custom title on the old note must not make the new
  empty note look user-edited, otherwise the current page title will not be
  captured.
