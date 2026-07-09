# Spec: Note Library

**Status: not yet implemented.** This spec is written ahead of the code
(see [ADR-0006](../decisions/0006-note-library-via-indexeddb.md), Status:
Proposed) specifically to fix scope before implementation starts, per
[`AGENTS.md`](../../AGENTS.md). Once built, remove this notice and correct
anything that changed during implementation — a spec that describes
intent instead of reality is worse than no spec.

## Purpose

Let the user find and reopen notes they've already saved, without digging
through their Downloads folder or Obsidian vault — and give them a single
command to get everything back out again at once (backup / migration /
bulk-import into a vault). This is the "Evernote" gap: today, once a note is
exported (see [export-and-save.md](export-and-save.md)), the extension has
no memory of it and no way to act on "all my notes" as a group. This spec
closes that gap with a flat, searchable list plus a bulk-export command —
**deliberately not** linking, backlinks, tags, or a graph view; those were
considered and dropped (see [ADR-0006](../decisions/0006-note-library-via-indexeddb.md)
Context) in favor of staying a fast-capture tool that feeds Obsidian, rather
than reimplementing what Obsidian already does well.

## Behavior

### What creates a library entry

- Clicking **Save** or **Save As** creates or updates a library entry, in
  addition to (not instead of) writing the `.md` file to disk. The disk
  export remains unchanged and is still the durable copy — see
  [ADR-0006](../decisions/0006-note-library-via-indexeddb.md).
- The autosaved draft (see [draft-persistence.md](draft-persistence.md))
  does **not** create or update a library entry. Only an explicit
  Save/Save As does. This keeps the library meaning "notes I've finished and
  exported," not "every keystroke."
- Re-saving a note that was opened from the library updates that same
  entry (matched by internal id) rather than creating a duplicate.

### What's stored per entry

Full reconstructable note content: title, date/time, Markdown body, page
history (`pages_visited`), and any image attachments (as Blobs) — enough to
reopen the note in the editor exactly as it was, without needing to re-read
the exported file from disk.

### Browsing

- A list view, separate from the editor, reachable via a toggle in the
  panel UI. Reverse-chronological by default (most recently saved/updated
  first) — matches the Evernote/Apple Notes mental model of "what did I
  just work on."
- Each row shows: title, date, and a short plain-text snippet of the body
  (not a rendered-Markdown preview — reuse the existing plain-text handling
  rather than building a second renderer).
- **Search** is a single text filter box, matching substrings against title,
  body text, and visited-page titles. No fielded/advanced search, no
  ranking beyond simple recency-ordering of matches, in this version.

### Opening a note from the library

- Clicking a list entry loads it into the editor for viewing/further
  editing, replacing whatever's currently in the editor. If the current
  editor has unsaved changes (i.e., the draft differs from its last saved
  state), prompt before discarding — don't silently blow away in-progress
  work, consistent with how [draft-persistence.md](draft-persistence.md)
  treats the draft as something worth protecting.
- Editing and re-saving a note opened this way updates its existing library
  entry (see above), not a new one.

### Deleting

- The user can remove an entry from the library. This only removes the
  in-app index entry — it does **not** touch (and cannot touch) the already
  -exported file sitting on disk. Make this distinction clear in the UI
  copy so users don't think "delete" destroys their exported file.

### Export all (bulk export)

A command, added once the library above exists — it has nothing to export
until then. Purpose: a one-click way to get every stored note back onto
disk at once, for backup, migrating to a new machine, or bulk-importing into
an Obsidian vault, without opening and re-saving each note individually.

- Reuses the existing per-note export mechanics
  ([export-and-save.md](export-and-save.md)) applied in a loop over every
  library entry — same Markdown/frontmatter construction, same filename
  scheme (`buildFilename`), same image-attachment handling. No new export
  format; this is "do Save As for everything," not a new serialization.
- Preferred path: `window.showDirectoryPicker()` (File System Access API,
  already used by `handleSaveAs` — see
  [export-and-save.md](export-and-save.md)). The user picks one destination
  folder once, and every note gets written under it as
  `<slugified-title>/<filename>.md` (+ `attachments/` where needed), exactly
  as a single Save As would, just repeated per entry.
- Fallback where the directory-picker API isn't available: looping
  `chrome.downloads.download` per note. **Known risk to design around:**
  Chrome shows a "this site is trying to download multiple files" warning
  once a page triggers more than a handful of downloads in quick succession
  — a library of dozens/hundreds of notes would hit this. Mitigate with a
  small delay between each download call, and prefer the directory-picker
  path whenever it's available (it doesn't have this limitation, since it's
  one picker grant plus in-process file writes, not N separate download
  events).
- **Non-goal:** no zip/archive bundling. Producing a real `.zip` without a
  dependency (see [ADR-0001](../decisions/0001-static-unbundled-extension.md))
  is nontrivial to hand-roll correctly; a plain folder tree via the
  directory picker achieves the same backup/migration goal without it. If a
  future need specifically requires a single archive file, that's a new ADR
  decision (accept a zip-writing dependency or hand-roll one), not an
  assumed part of this feature.

## Non-goals (explicit)

- No note-to-note linking, wiki-links, backlinks, or graph view.
- No tags or folders/notebooks in this version.
- No full-text search ranking or fuzzy matching — plain substring match is
  sufficient at the expected scale (an individual user's saved notes, not a
  shared corpus).
- No cross-device sync — this is per-Chrome-profile local storage,
  consistent with [ADR-0004](../decisions/0004-local-first-no-telemetry.md).
- No re-reading of arbitrarily-chosen on-disk files — the library is
  self-contained in IndexedDB, it does not depend on the exported file
  still existing at its original path.

## Open questions to resolve during implementation

(Left open deliberately — resolve and update this section, don't guess and
delete it.)

- Exact IndexedDB schema (object store shape, indexes needed for the
  reverse-chronological + substring-search queries).
- ~~Storage-quota behavior in practice~~ — resolved, see
  [ADR-0006](../decisions/0006-note-library-via-indexeddb.md): IndexedDB
  without `unlimitedStorage` is bounded by free disk space (commonly
  hundreds of MB to several GB), not a small fixed cap. Still call
  `navigator.storage.persist()` at implementation time to reduce eviction
  risk, and confirm/record whether Chrome actually granted it.
- What happens in the UI if a save to the library fails (the disk export
  should still succeed independently — a library-write failure must not
  block or corrupt the actual export).
- Where the list/search UI lives in the existing 380px panel layout (a
  toggle view vs. a slide-over vs. something else) — this is a design pass,
  not just an implementation detail.
