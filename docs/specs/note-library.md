# Spec: Note Library

Implemented 2026-07-10. See [ADR-0006](../decisions/0006-note-library-via-indexeddb.md)
(Status: Accepted) for the storage decision and
[architecture.md](../architecture.md#note-library-indexeddb) for the schema.

## Purpose

Let the user find and reopen notes they've written, without digging through
their Downloads folder or Obsidian vault — and give them a single command
to get everything back out onto disk at once (backup / migration /
bulk-import into a vault). This is the "Evernote" gap: notes need to be
findable and actionable as a group inside the extension, not just
individually exportable. This spec closes that gap with a flat, searchable
list plus a bulk-export command — **deliberately not** linking, backlinks,
tags, or a graph view; those were considered and dropped (see
[ADR-0006](../decisions/0006-note-library-via-indexeddb.md) Context) in
favor of staying a fast-capture tool that feeds Obsidian, rather than
reimplementing what Obsidian already does well.

## Behavior

### What creates a library entry

**Every note with real content, automatically — no explicit action
required.** See [ADR-0007](../decisions/0007-autosave-to-library.md) (this
supersedes the original "only on explicit Save/Save As" design in
ADR-0006).

- The same debounced autosave that already writes the draft to
  `chrome.storage.local` (see [draft-persistence.md](draft-persistence.md))
  also keeps the library entry up to date — one write path, not two.
- "Real content" excludes an editor that only has an auto-filled title
  (from the active tab) and no body text — otherwise opening the panel on
  any page would spawn an empty library entry. Text, formatting blocks, and
  embedded images all count as body content. See `hasRealNoteContent()`
  in [architecture.md](../architecture.md#note-library-indexeddb).
- **Save and Save As do not touch the library.** They are pure disk-export
  actions — build the `.md` file, download/write it, done. The library
  entry already exists (or will, from the next autosave) independent of
  whether the user ever clicks either button.
- Re-saving a note that was opened from the library updates that same
  entry (matched by internal id) rather than creating a duplicate — this
  part is unchanged from the original design, only *when* a new id gets
  minted changed.
- Switching away from the current note (New note, or opening a different
  library entry) triggers one immediate, non-debounced library write for
  whatever's in the editor first, so there's no dependency on the
  autosave's ~300ms timing right when the content is about to be replaced.
  See `flushLibrarySync()`.

### What's stored per entry

Full reconstructable note content: title, date/time, Markdown body, and page
history — enough to reopen the note in the editor exactly as it was, without
needing to re-read the exported file from disk. The stored Markdown is the
same pre-export shape the draft already uses (`getFormData()`'s `notes`
field): data-URI images inline in the text, remote images as plain URL
references. **Not** stored as separate image Blobs — see
[ADR-0006](../decisions/0006-note-library-via-indexeddb.md)'s "images as
Blobs" deviation note for why that turned out to be unnecessary complexity.

### Browsing

- A list view, separate from the editor, reachable via a toggle in the
  panel UI (`setLibraryViewOpen`). Reverse-chronological by default (most
  recently saved/updated first) — matches the Evernote/Apple Notes mental
  model of "what did I just work on."
- **Every action that changes which note is in the editor must also switch
  the view back to the editor** if the library view happens to be open —
  New note and opening a library entry both do this
  (`setLibraryViewOpen(false)`). Easy to miss when adding a new such action:
  the note-state change still happens correctly underneath, but the user
  sees no visible response at all, since the library list stays on screen.
  This exact bug shipped for "New note" (`handleClear`) and was reported as
  "the + button does not work" before being fixed — safe to call
  `setLibraryViewOpen(false)` unconditionally, it's a no-op when already on
  the editor view.
- Each row shows: title, date, a short plain-text snippet of the body (not
  a rendered-Markdown preview — reuse the existing plain-text handling
  rather than building a second renderer), and two per-row actions — a
  **Save** button and a **Delete** button (see below).
- **Save** (per row) exports that single note straight to disk without
  opening it into the editor first — same single-note behavior as the main
  Save button (folder only if the note has image attachments, silent
  download falling back to a save dialog on error), just reading a stored
  entry's data instead of the live editor
  (`exportLibraryEntry`/`sidepanel.js`). Deliberately a separate,
  duplicated implementation rather than a shared refactor with
  `handleSave`/`handleSaveAs`/`exportAllNotes` — see known-issue #2 in
  `docs/plan/roadmap.md`, which already covers this duplication and is
  explicitly on hold.
- **Search** is a single text filter box, matching substrings against title,
  body text, and visited-page titles. No fielded/advanced search, no
  ranking beyond simple recency-ordering of matches, in this version.

### Opening a note from the library

- Clicking a list entry loads it into the editor for viewing/further
  editing, replacing whatever's currently in the editor — **no
  confirmation prompt.** Under [ADR-0007](../decisions/0007-autosave-to-library.md),
  nothing is discarded: the note currently in the editor is already
  autosaved to its own entry, or gets one final flush write
  (`flushLibrarySync()`) immediately before the switch. An earlier version
  of this app had a "discard unsaved changes?" dialog here, built to guard
  against exactly the data loss that autosave-to-library makes impossible
  — removed for the same reason it existed in the first place.
- Editing and re-saving a note opened this way updates its existing library
  entry (see above), not a new one.

### Pinning

- Any entry can be pinned (`toggleLibraryEntryPinned`, a star/pin icon on
  each row, replaced by a checkbox in multi-select mode — see below).
  Pinned entries always render first, ahead of every sort mode described
  below; within the pinned group and the unpinned group separately, the
  active sort mode still applies.
- Pinning/unpinning does **not** change the note's `updatedAt` — it's a
  display-order preference, not an edit. See
  [architecture.md](../architecture.md#note-library-indexeddb).
- Later content autosaves preserve the pin state instead of replacing the
  entry with a shape that omits `pinned`.

### Sorting and filtering

- A sort control (`#librarySortSelect`) offers three orders: Recently
  updated (the default — the same reverse-chronological order the
  IndexedDB cursor already returns), Recently created (`createdAt`, no
  schema change needed since it was already stored), and Title A–Z. Sorting
  happens client-side over the already-loaded cache, same reasoning as
  substring search (personal-notes scale, not corpus scale).
- A "This site" filter chip narrows the list to entries whose `pageHistory`
  contains a visited page on the same hostname as the currently active tab
  — reuses `getCurrentHost()`, the same helper the context-suggestion
  feature already relies on. Combines with search and sort; does not
  override pinning order.

### Multi-select and bulk delete

- A "Select" toggle (`#libraryMultiSelectBtn`) switches every row from its
  normal pin/Save/Delete controls to a checkbox, and shows a bulk-action bar
  with a live selected-count and Delete/Cancel. Deleting is one
  `window.confirm` for the whole batch (same "this only removes it from
  Jot it!, not any exported file" wording as the single-entry delete), not
  one confirm per note — the single-entry flow already existed and was
  fine at 5-10 notes; bulk delete exists specifically for cleaning up a
  much larger library in one pass. Exiting multi-select mode (Cancel,
  closing the library view, or finishing a bulk delete) always clears the
  selection — there's no "remember my selection" behavior.

### Import

- `#libraryImportBtn` opens a file picker (a hidden `<input type="file"
  accept=".md,text/markdown">`, triggered programmatically); the chosen
  file is parsed (`parseImportedNote`) and inserted as a brand-new library
  entry with a fresh id, `createdAt`/`updatedAt` set to import time.
- **Deliberately scoped to round-tripping Jot it!'s own export format** —
  the YAML frontmatter (`title`/`date`/`time`/`pages_visited`) and the
  `# <title>\n\n<body>` structure `buildMarkdown` produces — not a general
  Markdown or frontmatter importer. A file that doesn't start with a `---`
  frontmatter block is rejected with an error toast; a file that does but
  is missing an individual field degrades gracefully (falls back to
  reasonable defaults) rather than rejecting the whole import, since a
  partially-recovered note is more useful than none.
- Exists specifically to de-risk the "local-first, no cloud backup" trade-off
  the rest of this feature accepts: the library normally only grows via
  autosave and only shrinks via explicit delete or browser storage
  eviction/uninstall — import is the one path back in, for a user who
  cleared storage, switched machines, or is consolidating notes they'd
  already exported before this feature existed.

### Deleting

- The user can remove an entry from the library, individually or in bulk
  (see above). This only removes the in-app index entry — it does **not**
  touch (and cannot touch) the already-exported file sitting on disk. Make
  this distinction clear in the UI copy so users don't think "delete"
  destroys their exported file.

### Export all (bulk export)

A command, added once the library above exists — it has nothing to export
until then. Purpose: a one-click way to get every stored note back onto
disk at once, for backup, migrating to a new machine, or bulk-importing into
an Obsidian vault, without opening and re-saving each note individually.

- Reuses the existing per-note export mechanics
  ([export-and-save.md](export-and-save.md)) applied in a loop over every
  library entry — same Markdown/frontmatter construction, same filename
  scheme (`buildFilename`), same image-attachment handling. No new export
  format; this is "do Save As for everything," not a new serialization. Each
  note's `pages_visited` frontmatter must reflect *that note's own* page
  history, not whatever's currently loaded in the live editor.
  `buildMarkdown`/`buildYamlFrontmatter` receive the entry's history
  explicitly, so asynchronous export work never mutates live editor state.
  Verified directly: exporting two
  library entries with different page histories produces two files with
  correctly distinct `pages_visited` blocks, and the live editor's own
  history is intact afterward.
- Preferred path: `window.showDirectoryPicker()` (File System Access API,
  already used by `handleSaveAs` — see
  [export-and-save.md](export-and-save.md)). The user picks one destination
  folder once, and **every** note gets written under it as
  `<slugified-title>/<filename>.md` (+ `attachments/` where needed) — unlike
  a single Save As, this always creates a per-note folder regardless of
  whether that note has images, since many notes are landing in one shared
  destination and need distinguishable paths to avoid collisions.
- Fallback where the directory-picker API isn't available (or the user
  cancels — treated as an abort, not a fallback trigger): looping
  `chrome.downloads.download` per note, with the same per-note-folder
  filename prefix and a 400ms delay between calls to stay under Chrome's
  "this site is trying to download multiple files" threshold. Both paths
  verified in a real browser with a small multi-note library — correct
  per-note folder structure in both, and the throttled fallback path didn't
  trigger Chrome's multi-download warning.
- Failures are per-note and non-fatal to the batch: one note failing to
  export is reported (`reportError`) and the loop continues; the final
  toast reports `"Exported N of M notes"`.
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

## Resolved during implementation (2026-07-10)

- **IndexedDB schema** — database `"jotit-library"`, one object store
  `"notes"` (`keyPath: "id"`), one index `"updatedAt"` for the
  reverse-chronological cursor query. Substring search runs in JS over the
  full list already loaded for display (no dedicated search index) — the
  expected scale (one user's saved notes) doesn't need one. Full shape in
  [architecture.md](../architecture.md#note-library-indexeddb).
- **Storage-quota behavior** — resolved, see
  [ADR-0006](../decisions/0006-note-library-via-indexeddb.md): IndexedDB
  without `unlimitedStorage` is bounded by free disk space (commonly
  hundreds of MB to several GB, confirmed via `navigator.storage.estimate()`
  in testing), not a small fixed cap. `navigator.storage.persist()` is
  called once per session; tested and confirmed it correctly logs a denial
  on a fresh low-engagement origin (`persisted: false`) rather than failing
  silently or throwing.
- **Save-to-library failure handling** — caught and reported softly
  (`reportError`, no `window.alert`, no throw) in `saveNoteToLibrary`,
  independent of the draft-storage write it runs alongside in `saveDraft()`
  (own try/catch either way — one failing doesn't block or hide the
  other). Since [ADR-0007](../decisions/0007-autosave-to-library.md), this
  is no longer coupled to a disk export at all — it's a step in the normal
  autosave path.
- **Where the UI lives** — a toggle button in the header
  (`#libraryToggleBtn`) swaps the entire panel body between the normal
  editor view and a new `#libraryView` section (search box + list +
  bulk-export button), rather than a slide-over or split view — simplest
  fit for the fixed 380px width, and consistent with how detach/reattach
  already swap visibility of header buttons based on mode.

## Non-goals confirmed unaffected by implementation

The image-storage approach (inline in Markdown, not separate Blobs — see
[ADR-0006](../decisions/0006-note-library-via-indexeddb.md)) and the
always-per-note-folder bulk-export structure are both deliberate deviations
from earlier phrasing in this spec; the [ADR](../decisions/0006-note-library-via-indexeddb.md)
and [architecture.md](../architecture.md#note-library-indexeddb) are the
sources of truth for exact behavior going forward — this section is a
pointer, not a duplicate.
