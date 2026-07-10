# Spec: Context / Title Suggestion

## Purpose

Save the user from retyping a note title every time — prefill it from the
page they're on, remember what they've called notes on that site before, and
let them lock the title so it stops following page navigation once they've
set it deliberately.

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
- **Context suggestions:** when the user sets a custom title on a given
  hostname, it's remembered (`contextByHost[host] = {value, updatedAt}`) and
  offered as a suggestion next time they're on that host. Capped at 100
  entries — oldest (`updatedAt`) evicted first when exceeded.

## Edge cases to preserve

- Auto-fill must not fire after the user has typed a custom title in the
  same session, even if title lock is off — `userEditedTitle` exists
  specifically to prevent auto-fill from stomping a deliberate edit that
  happened without the user remembering to also flip the lock toggle.
- Auto-fill must not fire after the note body has content and the title is
  already non-empty. This preserves the research workflow where one note
  accumulates excerpts from multiple tabs/articles.
- Context suggestions are per-hostname, not per-URL — don't change the
  granularity without considering that most users' mental model here is
  "this site," not "this exact page."
- The 100-entry cap and its eviction-by-`updatedAt` behavior exist to bound
  storage growth over long-term use — preserve some cap if changing this,
  don't remove it outright.
