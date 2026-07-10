# 2026-07-10 — Usability review fixes: onboarding, paste default, link
dialog, shortcuts, and library pin/sort/filter/multi-select/import

Agent/session: Claude Code (Sonnet 5)

## What I did

Ran a structured usability/release-readiness review (five personas,
blockers/quick-wins/feature-gap analysis, targeting a €1.99 Chrome Web
Store release) and then implemented everything the review recommended,
except the two items it explicitly said to skip (a manual dark-mode toggle
— already auto-follows `prefers-color-scheme` — and word-count
goals/reading time, both flagged as scope creep away from "quick notes").

Blockers fixed:

- **No onboarding** — a dismissible first-run banner (`#onboardingHint`,
  gated by the `onboardingHintDismissed` storage key) now explains
  autosave-to-library and points at the Library button.
- **Paste always became a code block** — reverted for plain-text clipboard
  paste (`insertPastedTextAsPlainText` replaces `insertPastedTextAsCodeBlock`
  in the paste listener). Ordinary prose now inserts as prose. Captured
  page selections (`insertSelectionWithLink`) still use a code block — that
  was for a different, still-valid reason (quoted external source + link).
- **No keyboard shortcuts beyond Bold/Italic** — added global shortcuts:
  Cmd/Ctrl+S (Save), Cmd/Ctrl+Shift+S (Save As), Cmd/Ctrl+Alt+N (New note —
  not plain Alt+N, see the macOS dead-key note in architecture.md), Alt+L
  (toggle Library), Escape (link dialog → library → date picker, in that
  priority order).
- **Native `prompt()` for links** — replaced with an in-panel dialog
  (`#linkDialog`) matching the Material 3 UI, keyboard-operable (Enter
  confirms, Escape/backdrop cancels).
- **Search had no hint about what it searches** — placeholder now reads
  "Search title, notes, or visited pages...".

Quick wins: the above onboarding/shortcut/dialog/placeholder items double
as quick wins; additionally bumped the library row Save/Delete buttons from
28px to 36px (touch-target size), and added a `title` tooltip on the
version number summarizing what's new.

Feature gaps built (the review's higher-ROI picks):

- **Insert timestamp** — a new toolbar button inserting `HH:MM — ` at the
  caret.
- **Pin** — `toggleLibraryEntryPinned`; pinned entries always sort first,
  regardless of the active sort mode. Doesn't touch `updatedAt` (a
  display-order preference, not an edit).
- **Sort** — Recently updated (default) / Recently created / Title A–Z,
  client-side over the loaded cache.
- **Per-site filter** — "This site" chip, reuses `getCurrentHost()`.
- **Multi-select + bulk delete** — a "Select" toggle switches rows to
  checkboxes with a bulk-action bar; one confirm for the whole batch, not
  one per note.
- **Import** — `parseImportedNote`/`importLibraryEntryFromFile` reads back
  a file this app itself exported (frontmatter + body) into a new library
  entry. Deliberately scoped to round-tripping Jot it!'s own export format,
  not a general Markdown importer — this was the one feature gap the
  review flagged as actually threatening the "local-first, no cloud
  backup" trade-off, since it's the only way back in after storage
  eviction/uninstall/machine switch.

## Verified

Real Chrome browser (`claude-in-chrome`), local static-file harness
(cache-busted, deleted after use) plus a `chrome.storage.local`/`chrome.tabs`/
`chrome.downloads` stub. All checks passed, zero console errors observed
across the whole pass:

- Onboarding banner shows on first load with the correct copy; dismiss
  hides it (persistence across reload depends on `chrome.storage.local`
  actually persisting, which the harness's in-memory stub doesn't — code
  review of the `init()`/dismiss logic is correct, this is a harness
  limitation, not verified end-to-end).
- Dispatched a synthetic paste event with two lines of plain text — landed
  as `text<br>text`, not `<pre><code>`.
- Link dialog: selected "Meeting", clicked the toolbar Link button, no
  native prompt appeared, typed a URL, clicked Insert — correct `<a>`
  inserted around the selected text.
- Timestamp button inserted `HH:MM — ` at the caret.
- Cmd+S triggered `handleSave` (toast: "Exported to Downloads") with no
  native browser "Save Page As" dialog.
- Cmd+Alt+N cleared the note back to an empty, auto-filled-title editor.
- Alt+L opened the library; Escape closed it back to the editor.
- Pinned a note — jumped to the top of the list with the pinned styling.
- Sort-by-Title-A–Z produced correct alphabetical order with pinned entries
  still first.
- "This site" filter correctly narrowed the list to entries with a matching
  visited page.
- Multi-select: checked 2 notes, bulk-deleted them, confirmed exactly those
  2 were removed and the mode exited cleanly.
- Import: constructed a `File` matching this app's own export shape
  (frontmatter + body, including a page-visited list, bold text, and a
  link), dispatched it through the real `#libraryImportInput` change
  handler, then opened the resulting entry in the editor — title, date/time,
  bold/link rendering, and both visited pages all round-tripped correctly.
- Forced the panel to the real side-panel width (380px) and confirmed no
  horizontal overflow in the header toolbar, formatting toolbar, or the new
  library filters row (sort select + "This site" + "Select" chips).
- `node --check` on all five JS files and `npm test` (79/79) both pass —
  none of this touched `lib/note-utils.js`, so the existing suite is
  unaffected by construction, re-run anyway as a sanity check.

## Docs updated

[docs/architecture.md](../../architecture.md) (new "Global keyboard
shortcuts" section, `pinned` field on the library entry shape,
`onboardingHintDismissed` in the storage-keys table),
[docs/glossary.md](../../glossary.md) (new region-map rows: link dialog,
paste handling, library multi-select/bulk-delete, library import,
onboarding hint), [docs/specs/rich-text-editor.md](../../specs/rich-text-editor.md)
(paste-default reversal with the reasoning, link dialog, timestamp button),
[docs/specs/note-library.md](../../specs/note-library.md) (pinning,
sorting/filtering, multi-select/bulk delete, import — new subsections),
[docs/plan/roadmap.md](../../plan/roadmap.md) (one consolidated Resolved
entry for this whole batch), [README.md](../../../README.md) (feature list
and How To Use steps), [RELEASE_CHECKLIST.md](../../../RELEASE_CHECKLIST.md)
and [GO_LIVE_PLAN.md](../../../GO_LIVE_PLAN.md) (QA items for every new
surface). This file.

## Left for next time

Nothing outstanding from the review's blockers/quick-wins/high-ROI feature
gaps — all implemented. Not committed yet; ask before committing, same as
every session. If a future session wants to go further into the review's
lower-priority feature gaps, none were identified as still open (tags/
folders were considered by the review and explicitly left out of scope to
avoid re-implementing what Obsidian already does — see
[ADR-0006](../../decisions/0006-note-library-via-indexeddb.md)'s Context).
