# 0007. Note library entries are created automatically on autosave, not only on explicit Save/Save As

Status: Accepted
Date: 2026-07-10

Supersedes decision point 2 of
[ADR-0006](0006-note-library-via-indexeddb.md) ("A library entry is
created/updated only on explicit Save or Save As — never from the autosaved
draft"). Everything else in ADR-0006 (IndexedDB, schema, scoped to the panel
document, no linking) is unaffected and still applies.

## Context

ADR-0006 deliberately tied library-entry creation to the explicit Save/Save
As buttons, reasoning that this "keeps the library's semantics simple: it's
your export history, not a version history of every edit." In practice, the
product owner wants the opposite mental model: every note the user writes
should already be in the library the moment they start writing it, with no
separate "save to library" action required — the Save/Save As buttons should
mean exactly one thing, "download this note as a `.md` file," nothing more.

## Decision

1. Every note with real content is kept in the library automatically, via
   the same debounced autosave that already writes the draft to
   `chrome.storage.local` (`saveDraft()`, `sidepanel.js`) — no separate
   trigger, no separate debounce timer. "Real content" is deliberately
   stricter than "the editor isn't empty": it requires either actual note
   -body text, or a title the user *deliberately* typed/edited
   (`userEditedTitle`), specifically so the title auto-filling from the
   active tab on panel open doesn't by itself spawn an empty library entry
   (`hasRealNoteContent()`).
2. **Save and Save As no longer touch the library at all.** They are pure
   disk-export actions — build the Markdown, write the `.md` file (+
   attachments), nothing else. This is a real behavior change from
   ADR-0006's decision point 3, which had Save/Save As perform the
   library write as a side effect; that side effect is removed, not just
   made redundant.
3. A library entry is still matched by internal id
   (`currentLibraryEntryId`), not by filename or content — unchanged from
   ADR-0006. What changes is *when* a new id gets minted: the first
   autosave with real content after a "New note" or after opening a
   different library entry, rather than the first explicit Save.
4. Switching away from the current note (New note, or opening a different
   library entry) no longer needs a "you'll lose unsaved changes"
   confirmation, because nothing is lost — the current note is already
   autosaved to its own entry, or gets one final synchronous flush
   (`flushLibrarySync()`) immediately before the switch, closing any race
   with the draft's 300ms debounce. Both `handleClear` ("New note") and
   `openLibraryEntry` had `window.confirm` dialogs built specifically to
   guard against data loss that, under this decision, can no longer happen
   — removing them isn't a UX simplification tacked on for its own sake, it
   directly follows from the premise those dialogs existed to protect
   changing.
5. A draft restored on panel load that already has real content (e.g. one
   written before this feature existed, or one from a session where the
   user never edited again after a reload) gets a one-time library sync in
   `init()`, so it isn't left stranded outside the library until the user's
   next edit.

## Consequences

- **Easier:** matches how Notion/Google Docs/Apple Notes/Evernote all
  behave — nothing to remember to click, the library is just "everything
  you've written." Removes two now-inaccurate confirmation dialogs.
- **Changes the risk profile ADR-0006 described.** ADR-0006 positioned the
  library as "a convenience index... not the sole copy of the user's data,"
  reasoning that the exported `.md` file is always the durable copy. That
  was true when a library entry only existed *after* an explicit export.
  Under this decision, a note the user writes and never exports still gets
  a library entry — meaning it's possible to accumulate notes that exist
  **only** in IndexedDB, never on disk, subject to the same eviction/
  uninstall risks ADR-0006 already flagged for the library as a whole (see
  its Context section). This is an accepted tradeoff of the requested
  behavior, not an oversight — but it's a real change in what's actually at
  stake if the library is ever lost, worth being honest about rather than
  quietly inheriting ADR-0006's older framing. A natural (not yet
  requested, not implemented) follow-up would be surfacing which library
  entries have never been exported, or nudging toward the existing bulk
  "Export all notes" command — noted here as a possible future item, not
  committed to.
- **Harder:** IndexedDB now receives a write roughly as often as
  `chrome.storage.local` does (every ~300ms of active editing, per the
  shared debounce) rather than only on explicit Save. Not expected to be a
  real performance concern at this app's scale (personal text notes,
  occasional images), but it's a different write pattern than ADR-0006's
  original "write on explicit save" assumption, worth knowing if IndexedDB
  write volume is ever a debugging concern.
- **Forecloses (without a superseding ADR):** reintroducing an explicit
  "save to library" gesture, or having Save/Save As resume any
  library-writing responsibility — those are exactly what this ADR removed.
