# Architecture

Source of truth for how Jot it! is actually built and how its pieces talk to
each other. If code changes invalidate anything here, update this file in the
same change (see [`AGENTS.md`](../AGENTS.md) ground rules). Line numbers are
approximate as of the last edit to this doc — if they're off, trust the code
and fix this file.

## System shape

Jot it! is a static, unbundled Chrome MV3 extension. No framework, no
bundler, no npm dependencies (see
[ADR-0001](decisions/0001-static-unbundled-extension.md)). Four distinct
runtime contexts, none of which share memory — they only communicate via
`chrome.runtime`/`chrome.tabs` message passing and `chrome.storage.local`.

| Context | File(s) | Lifecycle |
|---|---|---|
| Service worker (background) | `background.js` | Event-driven; Chrome can kill and respawn it at any time. Only `debugEnabled` survives respawn (reloaded from storage); `detachedWindows`, `openPanelTabs`, `debugLogs` are in-memory and lost. See [Known fragility](#known-fragility). |
| Side panel document | `sidepanel.html`, `sidepanel.js`, `lib/note-utils.js` | Loaded either docked (`chrome.sidePanel`) or as a standalone popup window (`chrome.windows.create`) pointed at the same `sidepanel.html?standalone=1&...`. Same code, two presentation modes, branched via `isStandalone` (URL search param). |
| Content script | `content-selection.js` | Declared in `manifest.json` to run on all `http(s)` pages, `all_frames: true`, `document_idle`. Also injected on-demand by background via `chrome.scripting.executeScript` when a `PING_SELECTION` probe gets no response (handles pages loaded before install/update). |
| Standalone window | (no separate file) | Not a traditional `default_popup` — the manifest declares none. The "standalone window" is a `chrome.windows.create({type:"popup"})` loading `sidepanel.html`, functionally a second presentation of the side panel document. |

## Message passing

All cross-context communication goes through `chrome.runtime.sendMessage` /
`chrome.tabs.sendMessage` / `onMessage` listeners in `background.js`. Message
types (all handled centrally in background.js):

| Type | Sender → Receiver | Purpose |
|---|---|---|
| `DETACH_PANEL {tabId}` | panel → background | Disable docked panel for tab, tell content script to close its UI hint. |
| `DETACH_AND_OPEN {tabId}` | panel → background | Full detach: disable docked panel, open standalone window. |
| `REGISTER_DETACH_WINDOW {tabId, windowId}` | panel → background | Record tab↔window mapping for auto-reattach on window close. |
| `PANEL_OPEN {tabId}` / `PANEL_OPEN_ACTIVE` / `PANEL_CLOSE {tabId}` | panel → background | Track which tabs have a visible panel (`openPanelTabs` Set); forwarded to the content script on that tab. |
| `PANEL_STATE` | — | Defined in background.js but never sent by any current caller. Dead code — see [known issues](plan/roadmap.md). |
| `PAGE_SELECTION_CANDIDATE {text, url, title}` | content script → background → panel | Background only re-broadcasts if the panel is actually visible for that tab (checks `openPanelTabs`/detached-window map); otherwise silently drops it. |
| `DEBUG_LOG` / `GET_DEBUG_LOGS` / `CLEAR_DEBUG_LOGS` | any → background | Debug utility channel, gated by `debugLogsEnabled` storage flag. |
| `PING_SELECTION` | background → content script | Liveness probe used to decide whether to inject the content script on-demand. |

**Trust boundary:** `DETACH_PANEL`, `DETACH_AND_OPEN`, `REGISTER_DETACH_WINDOW`,
`PANEL_OPEN`, `PANEL_CLOSE`, and the `DEBUG_LOG*` family are only accepted
from senders whose `sender.id === chrome.runtime.id` and whose URL is the
extension's own origin — i.e., only the side panel document, not arbitrary
web pages. `PAGE_SELECTION_CANDIDATE` is deliberately unrestricted since it
legitimately originates from content scripts on arbitrary sites.

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
is added to `openPanelTabs`, `ensureSelectionScript(tabId)` injects the
content script if needed, `PANEL_OPEN` is sent to that tab's content script.
The panel document itself runs `init()` on load: restores
draft/context/title-lock from storage, updates the title from the active tab
only while the note is still empty/unstarted, and calls
`syncPanelOpenState()` to register itself with background
(belt-and-suspenders alongside the background-side registration).

### Detach → standalone window → reattach
User clicks the detach button → panel sends `DETACH_AND_OPEN {tabId}` →
background disables the docked panel for that tab, tells the content script
to close its UI, opens `sidepanel.html?standalone=1&sourceTabId=<id>&...` as
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
read form data, build a filename (`NoteUtils.buildFilename`), convert the
editor's HTML to Markdown (`htmlToMarkdown`), build the full document
(`buildMarkdown` / `buildYamlFrontmatter`), then rewrite embedded images into
`attachments/<note>-image-N.<ext>` relative paths and collect attachment
blobs (`buildObsidianImageExport`).

- **Save** (`handleSave`): `chrome.downloads.download` with `saveAs:false`
  first; falls back to `saveAs:true` on error.
- **Save As** (`handleSaveAs`): tries `window.showDirectoryPicker()` (File
  System Access API) first and writes files directly if available;
  otherwise falls back to `chrome.downloads.download` with
  `saveAs: !hasAttachments`.

These two paths independently duplicate a fair amount of logic — see
[known issues](plan/roadmap.md).

Every keystroke also independently autosaves the *draft* (not an export) to
`chrome.storage.local["noteDraft"]` via a 300ms-debounced save — unrelated to
the explicit Save/Save As actions above.

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
| `contextByHost` | `{ [hostname]: { value, updatedAt } }`, capped at 100 entries (oldest evicted) | panel | panel |
| `titleLockEnabled` | boolean | panel | panel |
| `debugLogsEnabled` | boolean | any context (debug console) | all three contexts, via `chrome.storage.onChanged` |

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

`sidepanel.js` is a single ~2220-line file with no ES modules — see
[`glossary.md`](glossary.md) for the full region-by-region responsibility
map and line ranges. Read that before adding new top-level functions so new
code lands in the right conceptual region instead of at the bottom of the
file regardless of what it does.

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
(duplicated image-format constants, duplicated save/save-as logic,
in-memory-only background state lost on service-worker eviction, hand-rolled
Markdown converter, global mutable state in `sidepanel.js`, dead
`PANEL_STATE` message type, no-op CI). That list is the working backlog —
don't re-derive it from scratch, extend it.
