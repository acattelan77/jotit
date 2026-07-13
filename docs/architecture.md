# Architecture

Source of truth for how Jot it! is actually built and how its pieces talk to
each other. If code changes invalidate anything here, update this file in the
same change (see [`AGENTS.md`](../AGENTS.md) ground rules).

## System shape

Jot it! is a static, unbundled Chrome MV3 extension requiring Chrome 116+.
It uses no framework, bundler, or npm dependencies (see
[ADR-0001](decisions/0001-static-unbundled-extension.md)). Four distinct
runtime contexts, none of which share memory — they only communicate via
`chrome.runtime`/`chrome.tabs` message passing and `chrome.storage.local`.

| Context | File(s) | Lifecycle |
|---|---|---|
| Service worker (background) | `background.js` | Event-driven; Chrome can kill and respawn it at any time. Only `debugEnabled` survives respawn (reloaded from storage); `detachedWindows`, `openPanelTabs`, `debugLogs` are in-memory and lost. See [Known fragility](#known-fragility). |
| Side panel document | `sidepanel.html`, `sidepanel.js`, `panel/*.mjs`, `lib/note-utils.js`, `note-library.js` | Loaded either docked (`chrome.sidePanel`) or as a standalone popup window (`chrome.windows.create`) pointed at the same `sidepanel.html?standalone=1&...`. `NoteUtils` and `NoteLibrary` are classic-script globals loaded before the module entry point; `sidepanel.js` and `panel/*.mjs` are native ES modules. The two presentation modes branch via `isStandalone` (URL search param). |
| Content script | `content-selection.js` | Declared in `manifest.json` to run on all `http(s)` pages, `all_frames: true`, `document_idle`. Also injected on-demand by background via `chrome.scripting.executeScript` when a `PING_SELECTION` probe gets no response (handles pages loaded before install/update). |
| Standalone window | (no separate file) | Not a traditional `default_popup` — the manifest declares none. The "standalone window" is a `chrome.windows.create({type:"popup"})` loading `sidepanel.html`, functionally a second presentation of the side panel document. |

## Message passing

All cross-context communication goes through `chrome.runtime.sendMessage` /
`chrome.tabs.sendMessage` / `onMessage` listeners in `background.js`. Message
types (all handled centrally in background.js):

| Type | Sender → Receiver | Purpose |
|---|---|---|
| `DETACH_AND_OPEN {tabId}` | panel → background | Full detach: disable docked panel, open standalone window. |
| `REGISTER_DETACH_WINDOW {tabId, windowId}` | panel → background | Record tab↔window mapping for auto-reattach on window close. |
| `PANEL_OPEN {tabId}` / `PANEL_OPEN_ACTIVE` / `PANEL_CLOSE {tabId}` | panel → background | Track which tabs have a visible panel (`openPanelTabs` Set). `PANEL_OPEN*` also flushes a command queued while the panel was opening. |
| `PAGE_SELECTION_CANDIDATE {text, url, title}` | content script → background → panel | Background only re-broadcasts if the panel is actually visible for that tab (checks `openPanelTabs`/detached-window map); otherwise silently drops it. |
| `RUN_PANEL_COMMAND {command}` | background → open panel | Forward a named `chrome.commands` shortcut to the open panel document. The panel accepts it only from the extension origin. |
| `DEBUG_LOG` / `GET_DEBUG_LOGS` / `CLEAR_DEBUG_LOGS` | any → background | Debug utility channel, gated by `debugLogsEnabled` storage flag. |
| `PING_SELECTION` | background → content script | Liveness probe used to decide whether to inject the content script on-demand. |

**Trust boundary:** `DETACH_AND_OPEN`, `REGISTER_DETACH_WINDOW`,
`PANEL_OPEN`, `PANEL_OPEN_ACTIVE`, `PANEL_CLOSE`, and the `DEBUG_LOG*` family are only accepted
by background from senders whose `sender.id === chrome.runtime.id` and whose
URL is the extension's own origin — i.e., only the side panel document, not
arbitrary web pages. `RUN_PANEL_COMMAND` is likewise accepted by the panel
only from the extension-origin service worker. `PAGE_SELECTION_CANDIDATE` is
deliberately unrestricted since it legitimately originates from content
scripts on arbitrary sites.

## Key flows

### Opening the panel
`chrome.action.onClicked` → `openSidePanelFromActionClick(tab)` in
background.js → `chrome.sidePanel.open({windowId})` when the window id is
available (fires immediately, before awaiting anything, to preserve the
user-gesture context Chrome requires). Opening at window scope keeps one
docked panel presentation visible while the user browses across tabs. If a
Chromium variant rejects the window-scoped open, background falls back to a
tab-scoped open; on continued failure (e.g. a competing sidebar in some
Chromium variants), it opens a standalone window. On success: the active tab
is added to `openPanelTabs` and `ensureSelectionScript(tabId)` injects the
content script if needed.
The panel document itself runs `init()` on load: restores
draft/context/title-lock from storage, updates the title from the active tab
only while the note is still empty/unstarted, and calls
`syncPanelOpenState()` to register itself with background
(belt-and-suspenders alongside the background-side registration).

### Detach → standalone window → reattach
User clicks the detach button → panel sends `DETACH_AND_OPEN {tabId}` →
background disables the docked panel for that tab and opens
`sidepanel.html?standalone=1&sourceTabId=<id>&...` as
a popup window, and records the mapping in `detachedWindows`. The standalone
document detects `isStandalone` from the URL and drives its title/URL updates
off `sourceTabId` (via `chrome.tabs.get`/`onUpdated`) instead of querying the
active tab. Reattach: clicking the reattach button directly calls
`chrome.sidePanel.setOptions/open` then `window.close()`. If the user just
closes the standalone window without clicking reattach, `chrome.windows.onRemoved`
in background.js best-effort re-enables and reopens the docked panel for the
mapped tab.

### Capturing a page selection
`content-selection.js` listens for `selectionchange`/`mouseup`/`keyup`,
debounces (200ms), trims/truncates (4000 chars), dedupes identical text sent
within 1s, and sends `PAGE_SELECTION_CANDIDATE`. Background drops it unless
the panel is visible for that tab; otherwise re-broadcasts it. The panel's
listener dedupes and — in standalone mode — filters by `sourceTabId`. Nothing
is inserted automatically: the panel shows a preview bar with **Add
selection** / dismiss. Clicking **Add selection** inserts the text as a code
block with the clickable source link as its own paragraph directly below the
block, at the last known caret position.

### Save / Save As (export)
Entirely local to the panel document — no messaging involved. Both handlers:
read form data, then delegate deterministic Markdown/frontmatter, filename,
image rewriting, and attachment collection to the export service in
`panel/export-service.mjs`.

- **Save** (`handleSave`): `chrome.downloads.download` with `saveAs:false`
  first; falls back to `saveAs:true` on error.
- **Save As** (`handleSaveAs`): tries `window.showDirectoryPicker()` (File
  System Access API) first and writes files directly if available;
  otherwise falls back to `chrome.downloads.download` with
  `saveAs: !hasAttachments`.

Both handlers share `exportService.prepareNoteExport()`; only their
disk-writing and fallback mechanisms differ.

Every keystroke also independently autosaves the *draft* (not an export) to
`chrome.storage.local["noteDraft"]` via a 300ms-debounced save — unrelated to
the explicit Save/Save As actions above. That same autosave is also what
keeps the [note library](#note-library-indexeddb) up to date — see
[ADR-0007](decisions/0007-autosave-to-library.md); Save/Save As have no
library-related effect at all.

### Keyboard shortcuts

Jot it! declares its shortcuts through Chrome's `commands` API, not a
page-level `keydown` listener. That lets Chrome expose all stable commands in
`chrome://extensions/shortcuts` and resolve extension conflicts itself. The
four suggested defaults are Command/Ctrl+Shift+Y (Open Jot it!), U (New note),
K (Export note), and L (Open library); all other commands begin unassigned and
are user-configurable. They are browser-scoped, so they work while Chrome has
focus. Open Jot it!, New note, and Open library open the panel if necessary;
the remaining panel-local commands require it to already be open. See
[keyboard-shortcuts.md](specs/keyboard-shortcuts.md) and
[ADR-0008](decisions/0008-chrome-extension-commands.md).

Bold and Italic also retain their normal contenteditable Cmd/Ctrl+B/I behavior.
Escape closes the date picker if open. The earlier page-level shortcut attempts
remain historical context in the 2026-07-10 handoff entries; do not add new
page-level shortcut handling.

## Data model

### Note draft — `chrome.storage.local["noteDraft"]`

```js
{
  meetingName: string,       // raw #meetingName input value
  meetingDate: string,       // "YYYY-MM-DDTHH:MM", local time, no timezone
  notes: string,              // Markdown, converted from editor HTML via htmlToMarkdown()
  notesText: string,          // plain-text fallback (editor textContent)
  pageUrl: string,
  pageTitle: string,
  pageHistory: Array<{        // visited source pages for this draft, max 100
    url: string,
    title: string,
    visitedAt: number,
  }>,
  cursorOffset: number|null,  // caret offset in flattened editor text, for restore
  editorFocused: boolean,
}
```

The editor's contenteditable HTML is round-tripped through
`htmlToMarkdown`/`markdownToHtml` (`lib/note-utils.js`) on every save/load —
storage always holds Markdown, never raw HTML. Pasted images become
`![alt](src)`; on reload, data-URI images become real `<img>` tags, remote-URL
images become a non-editable `<figure class="image-attachment">` placeholder.
`pageHistory` is saved with the draft so one note can accumulate source pages
across tab switches and still export the same `pages_visited` list after a
panel reload.

### Other storage keys

| Key | Shape | Written by | Read by |
|---|---|---|---|
| `noteDraft` | see above | panel | panel |
| `titleLockEnabled` | boolean | panel | panel |
| `debugLogsEnabled` | boolean | any context (debug console) | all three contexts, via `chrome.storage.onChanged` |
| `onboardingHintDismissed` | boolean | panel | panel |

### Note library (IndexedDB)

A second, separate persistence layer from everything above — see
[ADR-0006](decisions/0006-note-library-via-indexeddb.md) (storage) and
[ADR-0007](decisions/0007-autosave-to-library.md) (when entries are
created — autosave, not explicit Save/Save As). Browsable/searchable
history of the user's notes, scoped entirely to the panel document
(`note-library.js`, exposing `window.NoteLibrary`, loaded before
`sidepanel.js`). No manifest permission, no background/content-script
involvement.

- **Database:** `"jotit-library"`, version 1.
- **Object store:** `"notes"`, `keyPath: "id"` (a `crypto.randomUUID()`).
- **Index:** `"updatedAt"` (non-unique) — entries are listed by opening a
  cursor on this index with direction `"prev"`, giving reverse-chronological
  order without loading and sorting in JS.

Entry shape:

```js
{
  id: string,               // uuid
  title: string,
  meetingDate: string,      // "YYYY-MM-DDTHH:MM", same shape as the draft
  notes: string,             // pre-export Markdown — same shape getFormData()
                              // builds for the draft: data-URI images inline,
                              // remote images as plain URL references. NOT
                              // the attachments/-rewritten export form (see
                              // ADR-0006's "images as Blobs" deviation note).
  pageHistory: [{url, title, visitedAt}],
  createdAt: number,        // ms epoch, set once
  updatedAt: number,        // ms epoch, bumped on every save
  pinned: boolean,          // optional — added 2026-07-10, absent on older
                              // entries (falsy read, treated as unpinned)
}
```

`pinned` is toggled independently of everything else (`toggleLibraryEntryPinned`,
`sidepanel.js`) and deliberately does **not** bump `updatedAt` — pinning is a
display-order preference, not an edit to the note. Pinned entries always
render first in the library list regardless of the active sort mode; no new
IndexedDB index was needed since the library re-sorts client-side over the
already-loaded cache (see [note-library.md](specs/note-library.md)).
Normal autosaves preserve the existing `pinned` field.

- **Written by:** `saveNoteToLibrary()`, called from `saveDraft()` — the
  same debounced (300ms) autosave that writes `chrome.storage.local`'s
  draft — whenever `hasRealNoteContent()` is true. Also called once from
  `init()` for a restored draft that already has real content (covers a
  draft written before this existed, or one never edited again after a
  reload), and from `flushLibrarySync()` for an immediate, non-debounced
  write right before the editor's content is about to be replaced (New
  note, opening a different library entry). **Save and Save As never call
  it** — they're pure disk-export actions, see
  [export-and-save.md](specs/export-and-save.md). A library-write failure
  is caught and reported softly (`reportError`, no `window.alert`) and
  never affects the draft write it runs alongside.
- **`hasRealNoteContent()`** gates all of the above: real note-body text,
  or a title the user *deliberately* typed/edited (`userEditedTitle`) —
  not just the title auto-filling from the active tab on panel open (see
  [context-title-suggestion.md](specs/context-title-suggestion.md)), which
  would otherwise spawn an empty library entry from simply opening the
  panel on any page.
- **Read/updated by:** `openLibraryEntry()` (flushes the current note first,
  then loads the target entry back into the editor via
  `setFormData`/`markdownToHtml` — no special reconstruction needed, see the
  `notes` field note above, and no confirmation prompt — nothing is
  discarded, see ADR-0007), `renderLibraryList()` / `loadLibraryList()` (the
  list/search UI), `exportAllNotes()` (bulk export, reuses the normal
  per-note export path in a loop).
- **`state.library.currentEntryId`** (`panel/state.mjs`) tracks which
  entry, if any, the open editor content corresponds to; persisted in the
  draft (`noteDraft.libraryEntryId`) so it survives a panel reload. Further
  autosaves update that same entry rather than creating a duplicate; "New
  note" flushes the current note (if any) then resets it to `null`, so the
  next autosave with real content starts a fresh entry.
- **`navigator.storage.persist()`** is requested once per session
  (`note-library.js`, best-effort — logs the outcome via `console.info`,
  never throws). Confirmed in testing: on a fresh, low-engagement origin
  Chrome denies the grant (`persisted: false`) — expected, not a bug; see
  [ADR-0006](decisions/0006-note-library-via-indexeddb.md).

### Exported Markdown

```markdown
---
title: "<meeting name, JSON-string-escaped>"
date: 2026-07-09
time: "14:45"
datetime: "2026-07-09T14:45"
pages_visited:
  - "[Page Title](https://example.com/page)"
---

# <meeting name>

<note body markdown>
```

`pages_visited` entries are single markdown-link strings (`"[title](url)"`),
not nested `{title, url}` objects — Obsidian's frontmatter Properties panel
only renders text/list-of-scalar properties as clickable links; nested object
arrays fall back to an unstyled raw-JSON display. Don't reintroduce the
nested form without checking that constraint first.

`pages_visited: []` is emitted when no pages were visited. All scalar
frontmatter values go through `toYamlString`, which is `JSON.stringify` —
this happens to produce valid YAML for the strings this codebase actually
emits, but it is not a general-purpose YAML encoder (see
[ADR-0003](decisions/0003-hand-rolled-markdown-conversion.md)).

Filenames: `"YYYY-MM-DD - hHH:MM - <safe title>.md"`
(`NoteUtils.buildFilename`). Notes with images export as a folder:
`<slugified-title>/<filename>.md` + `<slugified-title>/attachments/<note>-image-N.<ext>`.

## Module map

The side-panel module graph is intentionally shallow and one-directional:
`sidepanel.js` imports `panel/*.mjs`; panel modules do not import the entry
point or each other except for the date picker importing pure date helpers.
See [ADR-0009](decisions/0009-native-sidepanel-modules.md).

| Module | Responsibility |
|---|---|
| `sidepanel.js` | Module entry point, DOM lookup, editor and library UI orchestration, panel lifecycle, message/command routing, and initialization. |
| `panel/state.mjs` | The single nested mutable state shape for title, page, editor, library, and queued work. |
| `panel/storage.mjs` | Promise wrappers for `chrome.storage.local` and the shared cancellable debounce helper. |
| `panel/date-time.mjs` | Pure strict parsing and local date/time formatting. |
| `panel/date-picker.mjs` | Date-picker state, rendering, keyboard/pointer commands, and picker-owned listeners. |
| `panel/export-service.mjs` | Markdown/frontmatter and attachment package construction plus low-level download/File System Access adapters. |
| `lib/note-utils.js` | Pure filename, URL, and Markdown conversion helpers exposed as the classic-script `window.NoteUtils` global. |
| `note-library.js` | Browser-only IndexedDB wrapper exposed as the classic-script `window.NoteLibrary` global. |

The classic-script globals are retained to keep Node tests and browser loading
simple without a build step. New cohesive panel behavior should go in the
module that owns it; coordination across features stays in `sidepanel.js`.

## Permissions (manifest.json)

`sidePanel`, `storage`, `downloads`, `tabs`, `scripting`, plus
`host_permissions: ["http://*/*", "https://*/*"]`. Each maps to a specific
runtime need — see the permission table in
[ADR-0001](decisions/0001-static-unbundled-extension.md) if you're
considering adding or removing one; permission changes need a Chrome Web
Store review justification, don't add one speculatively.

## Design system reference

`design-system/` (mockups, `tokens.css`, `DESIGN_SYSTEM.md`) is **static
reference material, not live code** — nothing in `sidepanel.html/css/js` or
`manifest.json` loads it. `tokens.css` documents values that were manually
copied into `sidepanel.css`'s `:root` block; there is no automatic sync.
Excluded from release packaging (see `RELEASE_CHECKLIST.md`).

## Known fragility

See [`docs/plan/roadmap.md`](plan/roadmap.md) for the full, prioritized list
(in-memory-only background state lost on service-worker eviction, hand-rolled
Markdown conversion/frontmatter, and manual version synchronization). That
list is the working backlog —
don't re-derive it from scratch, extend it.
