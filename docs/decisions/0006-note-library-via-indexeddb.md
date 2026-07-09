# 0006. Local note library, stored in IndexedDB, scoped to the panel document

Status: Proposed
Date: 2026-07-09

## Context

Today the extension persists exactly one thing beyond preferences: the
single in-progress draft, in `chrome.storage.local["noteDraft"]` (see
[ADR-0002](0002-storage-local-shared-state.md)). Once a note is exported
(Save/Save As), the extension has no further memory of it — it exists only
as a `.md` file (plus optional `attachments/`) on disk. There is no way to
browse, search, or reopen a past note from inside the extension.

The product goal (see [`docs/plan/roadmap.md`](../plan/roadmap.md)) is to
close that gap — closer to Evernote's "your notes live in the app and you
can find them again" — **without** taking on Obsidian-style linking,
backlinks, or a graph view. That scope was explicitly decided against: once
a note is exported, Obsidian is a better place to link/browse it than a
reimplementation inside a 380px extension panel. This ADR covers storage +
a flat, searchable list only.

Two storage mechanisms were considered:

- **`chrome.storage.local` at larger scale** — would require the
  `unlimitedStorage` permission to escape the ~10MB default quota (a new
  permission-dialog disclosure), is JSON-only (no native Blob storage, so
  image attachments would need base64 re-encoding, bloating size further),
  and is a key-value store, not well suited to querying/sorting a growing
  list of records.
- **IndexedDB** — no extra manifest permission required (it's a standard
  web API, available to the panel document like any web page), governed by
  the browser's general per-origin storage quota management rather than a
  flat 10MB cap, and natively supports storing Blobs (image attachments)
  without base64 inflation. It's also queryable/indexable, which a growing
  note list needs.

**Storage capacity (verified 2026-07-09):** `chrome.storage.local`'s 10MB
cap and the `unlimitedStorage` permission are specific to that API (and to
Cache Storage / Origin Private File System). IndexedDB, without
`unlimitedStorage`, is *not* subject to that 10MB figure — it uses Chrome's
shared per-origin quota manager (the standard Storage API,
`navigator.storage.estimate()`), sized dynamically against the user's free
disk space. In practice that's commonly hundreds of MB to several GB — far
beyond what markdown text notes plus occasional pasted images will realistically
use. The tradeoff: that quota is "best-effort" and can be evicted under
heavy disk pressure (rare, but real) unless the origin has been granted
*persistent* storage. Mitigation: call `navigator.storage.persist()` at
implementation time — it's a runtime API call, not a manifest permission, so
it triggers no new install/update permission-dialog entry, unlike
`unlimitedStorage`. Given [ADR-0004](0004-local-first-no-telemetry.md)'s
local-first/trust positioning, prefer `navigator.storage.persist()` over
requesting `unlimitedStorage` — the latter buys eviction-immunity we don't
need at the cost of a permission disclosure we'd rather avoid for no other
benefit here. See
[Chrome's storage-and-cookies docs](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)
and the [`chrome.storage` API reference](https://developer.chrome.com/docs/extensions/reference/api/storage)
for the underlying source.

On the "what actually threatens data loss" question raised in the roadmap:
normal browser "clear cache" (cached images/files) does not touch extension
storage of either kind. What does clear it is the user clearing "cookies and
other site data" with extension data included, or uninstalling the
extension. Given that, the exported `.md` file on disk remains the durable
source of truth regardless of what this ADR decides — this note library is
positioned as a **convenience index for browsing/search inside the
extension**, not the sole copy of the user's data. That framing simplifies
the design: if the IndexedDB store is ever lost, the user has lost a
convenience feature, not their notes.

## Decision

1. Store a note library in **IndexedDB**, in a database scoped to the panel
   document (no new manifest permission, no background/content-script
   involvement — same pattern as the panel document already using
   `chrome.downloads`/File System Access APIs directly for export).
2. A library entry is created/updated **only on explicit Save or Save As**
   — never from the autosaved draft. This matches the existing mental model
   (draft = scratch, export = deliberate "this is a finished note") and
   keeps the library's semantics simple: it's your export history, not a
   version history of every edit.
3. Re-saving a note that was opened from the library **updates that same
   entry** (matched by an internal id, not by filename) rather than creating
   a duplicate. On-disk export/filename behavior is unchanged — this ADR
   does not alter [export-and-save.md](../specs/export-and-save.md)'s
   existing Save/Save As mechanics, it only adds a side-effect write to the
   library alongside them.
4. Each entry stores the full note content (frontmatter fields + Markdown
   body) and any image attachments as Blobs — enough to fully reconstruct
   and reopen the note in the editor without re-reading the exported file
   from disk (the extension generally can't re-read arbitrary
   downloaded-file paths later anyway).
5. **Explicitly out of scope for this ADR:** note-to-note linking (wiki
   links, backlinks, graph view), tags, full-text search ranking/indexing
   beyond simple substring matching, multi-device sync. See
   [`docs/specs/note-library.md`](../specs/note-library.md) for the
   behavior spec.

## Consequences

- **Easier:** notes become browsable/searchable/reopenable inside the
  extension without a new permission-dialog entry, without touching
  `background.js` or the message-passing protocol at all, and without
  conflicting with [ADR-0001](0001-static-unbundled-extension.md) (IndexedDB
  is a browser-native API, not a dependency).
- **Harder:** two persistence mechanisms now exist in the codebase
  (`chrome.storage.local` for draft/preferences, IndexedDB for the library)
  where there was one — a future agent needs to know which one a given piece
  of state belongs in. This ADR is that record; `docs/architecture.md`
  should be updated to document the IndexedDB schema once implemented.
- **Resolved (see Context above):** storage capacity is effectively bounded
  by the user's free disk space (typically hundreds of MB to several GB in
  practice), not a small fixed cap — no `unlimitedStorage` permission
  needed. Remaining implementation-time task: actually call
  `navigator.storage.persist()` and record in `docs/architecture.md` whether
  Chrome granted it (persistence grants aren't guaranteed to succeed for
  every profile/usage pattern) — don't just assume the call succeeds
  silently.
- **Forecloses (without a superseding ADR):** treating this library as the
  primary/only copy of a note (it isn't — the exported file is), and adding
  linking/graph/tagging features on top of it without revisiting the
  explicitly-out-of-scope list above.
