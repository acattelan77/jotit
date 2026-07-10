# 2026-07-10 — Note library implemented (storage, browse/search, bulk export)

Agent/session: Claude Code (Sonnet 5)

## What I did

Implemented the note library scoped in earlier sessions —
[ADR-0006](../../decisions/0006-note-library-via-indexeddb.md) and
[note-library.md](../../specs/note-library.md) — end to end: storage,
browsable/searchable list, open/delete, and bulk export.

- **`note-library.js`** (new file, root level like `background.js`/
  `content-selection.js` — browser-only, not portable to Node like
  `lib/note-utils.js`, so it doesn't belong in `lib/`): thin IndexedDB
  wrapper exposing `window.NoteLibrary` — `openDb`, `putEntry`, `getEntry`,
  `deleteEntry`, `listEntries` (reverse-chronological via an `updatedAt`
  index cursor), `generateId`, and a best-effort
  `navigator.storage.persist()` call.
- **`sidepanel.html`**: a "Library" header toggle button, a new
  `#libraryView` section (search input, "Export all" button, list, empty
  state), `id`s added to the meta/notes sections so JS can hide them when
  the library view is active, and the new script tag.
- **`sidepanel.css`**: styling for the toggle view, search input, and list
  rows, matching the existing Material 3 tokens.
- **`sidepanel.js`**: `currentLibraryEntryId` module state (persisted in the
  draft so it survives a reload); `saveNoteToLibrary()` called from
  `handleSave`/`handleSaveAs` after the disk export succeeds (never blocks
  or corrupts it on failure); `openLibraryEntry()` with an unsaved-changes
  confirm; `deleteLibraryEntryPrompt()`; `renderLibraryList()`/
  `loadLibraryList()`/search filtering; `setLibraryViewOpen()`; and
  `exportAllNotes()` for the bulk-export command.

## A real bug found and fixed during implementation

`exportAllNotes` loops over every library entry and calls the existing
`buildMarkdown`/`buildYamlFrontmatter` — but those read page-visit history
off the **module-level `pageHistory` variable** (the currently-open note's),
not from an argument. My first draft would have stamped every exported
note's `pages_visited` frontmatter with whichever note happened to be open
in the live editor at the time, not that entry's own history. Fixed by
swapping `pageHistory` to each entry's own history for the duration of its
export and restoring the live editor's actual history in a `finally` block
regardless of how the loop exits. Verified directly (see below) — this
would have been a genuinely confusing, silent data-correctness bug to debug
later (every bulk-exported note showing the same, wrong source links) had
it shipped.

## Verified

All end-to-end in a real Chrome tab (via `claude-in-chrome`, not the
static-preview harness used in earlier sessions — that tool wasn't
available this session; see "Tooling note" below), against the same
temporary local static-file harness pattern (jotit served via
`python -m http.server`, minimal `chrome.*` stub, deleted after use):

- Save creates a library entry with all expected fields; re-saving the same
  open note updates that entry in place (`count` stays 1, `createdAt`
  unchanged, `updatedAt` bumped) rather than duplicating.
- "New note" correctly resets `currentLibraryEntryId`, so the next save
  creates a fresh entry instead of overwriting the previous one.
- Toggling the library view correctly swaps visibility (editor sections
  hidden, library shown) and renders rows with correct title/date/snippet,
  reverse-chronological.
- Search filters correctly against **body text**, not just titles (typed
  "spacex," which only appeared in a note's body, and got exactly that one
  row back).
- Opening an entry loads it back into the editor correctly (title + body),
  switches back to the editor view, and re-saving it updates the same
  entry rather than creating a third one.
- Delete removes the entry from both IndexedDB and the rendered list, and
  only that entry.
- Bulk export, **both paths**: the `chrome.downloads` fallback (stubbed
  `showDirectoryPicker` away) produced 3 correctly-named files each in
  their own `<slug>/<filename>.md` subfolder; the directory-handle path
  (stubbed `showDirectoryPicker` to return a fake in-memory handle
  implementing `getDirectoryHandle`/`getFileHandle`/`createWritable`)
  produced the identical folder structure. Read the actual file content
  back out of both and confirmed correct frontmatter, including that the
  `pages_visited`-vs-live-editor-state bug above is actually fixed (one
  note's own visited page showed up correctly, a separately-seeded note
  with empty history correctly showed `pages_visited: []`, not a leaked
  value) — and confirmed the live editor's own page history was intact
  after the export loop finished.
- `navigator.storage.persist()` actually runs and logs its outcome
  (confirmed via console message inspection): denied on a fresh
  low-engagement test origin (`persisted: false`), exactly the "not
  guaranteed" case ADR-0006 anticipated. `navigator.storage.estimate()`
  showed a ~10GB quota on the test machine, consistent with the
  "hundreds of MB to several GB, not a small fixed cap" claim.

**Not independently re-verified this session:** the exact "unsaved changes"
prompt-skip behavior on a *truly* empty editor — testing surfaced that
`hasUnsavedEditorContent()` (reusing `handleClear`'s own heuristic
verbatim) can still see the editor as "non-empty" briefly after "New note"
because the title auto-fills from the active tab almost immediately. This
is the same behavior `handleClear`'s own confirm dialog already has today,
not a new defect — documented as expected in
[note-library.md](../../specs/note-library.md) rather than chased further.

## Tooling note

The `mcp__Claude_Preview__*` tools used for browser verification in every
prior session this week weren't available in this session's toolset;
`claude-in-chrome` (a real connected Chrome browser) filled in instead and
worked, but was noticeably less stable for this task — two mid-session
extension disconnects (one right after a `window.confirm`-triggering click,
though a delete via the same path worked cleanly on retry, so it may not
actually be related) and one case of multiple browsers being connected
simultaneously, requiring `AskUserQuestion` to disambiguate. If this
recurs, worth checking whether `Claude_Preview` is expected to be present
and isn't, rather than assuming `claude-in-chrome` is now the standard path.

## Docs updated

[ADR-0006](../../decisions/0006-note-library-via-indexeddb.md) (Status →
Accepted, schema section, resolved the "images as Blobs" deviation),
[docs/decisions/README.md](../../decisions/README.md) (status),
[docs/architecture.md](../../architecture.md) (new "Note library
(IndexedDB)" section, module map),
[docs/glossary.md](../../glossary.md) (term + region map),
[docs/specs/note-library.md](../../specs/note-library.md) (implemented
notice, corrected the image-storage and bulk-export-folder-structure
claims, resolved all "Open questions"),
[docs/specs/README.md](../../specs/README.md), `docs/plan/roadmap.md`
(moved to Resolved, updated "Now"), this file.

## Left for next time

Nothing outstanding for this feature — it's fully implemented, verified,
and documented as shipped. Not committed yet this session; per the running
pattern this week, check with the user before committing/pushing. Next
roadmap items are on hold per explicit user direction this session (syntax
highlighting, tech-debt backlog) — don't start those without being asked.
