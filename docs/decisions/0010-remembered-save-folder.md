# 0010. Save writes to a remembered folder chosen with File System Access

Status: Accepted
Date: 2026-10-23

## Context

`chrome.downloads.download()` can only write inside the browser's Downloads
directory (`filename` is relative and cannot leave it). Users who file notes
straight into a vault or inbox folder (e.g. `~/42/_inbox`) had to move every
export by hand or use Save As and pick the folder each time.

A previous Settings panel with `showDirectoryPicker()` + an IndexedDB-stored
handle was removed on 2026-07-10 (see
[handoff](../handoffs/log/2026-07-10-0004-settings-removal-and-design-system.md))
because it was unreliable: stale handles and a **silent fallthrough to
Downloads** when access was lost. Options considered:

1. Change Chrome's global download directory — affects every download.
2. Symlink a Downloads subfolder to the target — platform-specific, Chrome
   behaviour with symlinked targets is not guaranteed, no in-app control.
3. Remember a `FileSystemDirectoryHandle` and write through it, with
   explicit, visible handling of every failure mode.

## Decision

Option 3, scoped to fix the old failure modes:

- A footer control ("Save to: <folder>") picks the folder with
  `showDirectoryPicker({ mode: "readwrite" })`; a reset button returns to
  Downloads. The handle is stored in its own IndexedDB database
  (`"jotit-save-folder"`, store `"handles"`, key `"saveFolder"`) so the note
  library schema ([ADR-0006](0006-note-library-via-indexeddb.md)) is untouched.
  Logic lives in `panel/save-folder.mjs`.
- **Save** and the library row export write into the folder when one is set,
  using the same layout and `uniquify` behaviour as Downloads
  (`exportService.writeNoteToDirectory`). Save As and Export all keep their
  picker, opened in the remembered folder (`startIn`).
- Write access is checked (`queryPermission`) and, if needed, requested
  (`requestPermission`) **before** `saveDraft()`, while the click's user
  gesture is still valid.
- **No silent fallback.** Denied access, a missing gesture (Chrome command
  shortcut) or a write error (folder moved/deleted) is reported with a toast
  or alert naming the folder; nothing is redirected to Downloads. The note
  is never lost because the library autosaves independently
  ([ADR-0007](0007-autosave-to-library.md)).

## Consequences

- Notes land directly in the chosen folder; Downloads remains the default
  when no folder is set, so existing users see no change.
- Chrome may ask to re-allow access after a browser restart (unless the user
  picks "Allow on every visit"). With the keyboard shortcut the prompt cannot
  appear: the user is told to click Save once.
- Only the folder name is shown — the File System Access API does not expose
  absolute paths.
- Requires a Chromium browser with File System Access; elsewhere the footer
  control reports that choosing a folder is unsupported and Save keeps using
  Downloads.
