# Glossary & Module Map

Shared vocabulary so agents describe the same thing the same way across
sessions. If you introduce a new concept, add it here rather than letting
each doc/spec coin its own term for it.

## Terms

- **Draft** — the in-progress note state autosaved to
  `chrome.storage.local["noteDraft"]` on every edit (300ms debounce). It is
  one active note across browser tabs, not a separate note per tab. Not the
  same as an **export**. Losing the draft loses unsaved work; losing an
  export is recoverable by re-saving.
- **Export / Save / Save As** — the explicit user action that writes a
  `.md` file (and optionally an `attachments/` folder) to disk via
  `chrome.downloads` or the File System Access API. Distinct from autosave.
- **Docked panel** — the side panel attached to the browser window via
  `chrome.sidePanel`. The default presentation.
- **Standalone window** — the same `sidepanel.html` document loaded in a
  detached `chrome.windows.create({type:"popup"})` window, distinguished at
  runtime by the `?standalone=1` URL param and a `sourceTabId` that stands in
  for "the active tab" since a detached window has no notion of a Chrome tab
  it's docked to.
- **Panel document** — the same `sidepanel.js` module-driven document whether it's
  docked or standalone; "the panel" in most contexts means this document, not
  the browser-window chrome.
- **Context / context title** — the auto-filled note title, normally derived
  from the active tab's page title, editable and optionally lockable
  (**title lock**) so it stops following page navigation. A related
  per-hostname "remember my last custom title on this site" suggestion
  feature (`contextByHost`) existed briefly and was removed 2026-07-10 at
  the product owner's direction — see
  [context-title-suggestion.md](specs/context-title-suggestion.md).
- **Page selection candidate** — text the user selected on a web page,
  captured by the content script and offered to the panel as a
  not-yet-inserted suggestion (**pending page selection**). Requires an
  explicit **Add selection** click to actually land in the note.
- **Panel-open state** — background's tracking (`openPanelTabs` Set) of
  which tabs currently have a visible panel, used to decide whether to
  forward a page-selection candidate or silently drop it.
- **Extension command** — a named Chrome-managed shortcut declared in
  `manifest.json`, user-configurable at `chrome://extensions/shortcuts`.
  `open-jot-it` opens the panel; every other stable command is relayed to an
  already-open panel as `RUN_PANEL_COMMAND`. See
  [keyboard-shortcuts.md](specs/keyboard-shortcuts.md).
- **Attachment** — an image embedded in a note, exported as a file under
  `attachments/` (relative to the note) rather than inlined as a data URI in
  the Markdown.
- **Frontmatter** — the YAML block at the top of an exported note
  (`title`, `date`, `time`, `datetime`, `pages_visited`).
- **Note library** — an IndexedDB store (`note-library.js`,
  `window.NoteLibrary`) of every note with real content the user has
  written, scoped to the panel document, enabling browse/search/reopen/
  bulk-export from inside the extension. Kept up to date automatically by
  the same autosave that persists the draft — not tied to exporting (see
  [ADR-0007](decisions/0007-autosave-to-library.md)). Distinct from the
  **draft** (the single currently-open note's `chrome.storage.local` copy)
  and from an exported `.md` file on disk, which a library entry may or may
  not have one of at any given time. Deliberately excludes note-to-note
  linking — see
  [ADR-0006](decisions/0006-note-library-via-indexeddb.md) and
  [note-library.md](specs/note-library.md).
- **NoteUtils** — the shared pure-function library (`lib/note-utils.js`)
  used for filename building and Markdown↔HTML conversion. It is loaded as a
  classic script and exposed as `window.NoteUtils` before the side-panel module
  entry point runs.

## Side-panel module map

`sidepanel.js` is the native-module entry point, not the owner of every panel
concern. The split is responsibility-based and deliberately shallow; see
[ADR-0009](decisions/0009-native-sidepanel-modules.md).

| Module | Responsibility |
|---|---|
| `sidepanel.js` | Entry point and cross-feature coordination: DOM references, status/toasts, title/page context, caret/editor/toolbar behavior, draft/library orchestration, incoming messages, tab listeners, Chrome commands, and `init()`. |
| `panel/state.mjs` | `createPanelState()` and the nested mutable state domains: `title`, `page`, `editor`, `library`, plus initialization/debug/queue state. Add state to its owning domain instead of creating an unrelated top-level `let`. |
| `panel/storage.mjs` | `createStorage()` Promise wrappers around `chrome.storage.local`, plus the cancellable `debounce()` used for autosave/UI work. |
| `panel/date-time.mjs` | Strict parsing and local date/time conversion with no DOM or Chrome dependency. |
| `panel/date-picker.mjs` | Picker-owned state, 42-cell month rendering, displayed value, open/close behavior, keyboard navigation, and time adjustment. It receives DOM elements and callbacks from the entry point. |
| `panel/export-service.mjs` | Deterministic frontmatter/Markdown construction, embedded-image rewriting, capped remote-image fetches, attachment packaging, downloads, and File System Access writes. It receives `NoteUtils`, `chrome.downloads`, and `fetch` explicitly. |
| `lib/note-utils.js` | General pure helpers shared with Node tests: filename, URL, image metadata, and Markdown↔HTML conversion. |
| `note-library.js` | Browser-only IndexedDB access behind `window.NoteLibrary`; storage mechanics only, not library UI. |

Keep feature orchestration in the entry point and move reusable cohesive logic
to the module that owns it. Avoid circular imports and one-function files.

## `background.js` responsibilities

- Panel lifecycle: `openSidePanelFromActionClick`, `openDetachedPanelWindowForTab`,
  `ensurePanelOptions`.
- Extension commands: `chrome.commands.onCommand`, `PANEL_COMMANDS`, and
  `sendPanelCommand`; see [keyboard-shortcuts.md](specs/keyboard-shortcuts.md).
- Content-script injection: `ensureSelectionScript` (on-demand injection via
  `chrome.scripting.executeScript` when `PING_SELECTION` gets no response).
- Message routing: the central `onMessage` listener and its sender-trust
  check (see [architecture.md](architecture.md#message-passing)).
- Tab↔window bookkeeping for detach/reattach (`detachedWindows`,
  `openPanelTabs`) — in-memory only, see
  [known fragility](architecture.md#known-fragility).
- Debug log buffer (`debugLogs`, gated by `debugLogsEnabled`).

## `content-selection.js` responsibilities

- Listens for `selectionchange`/`mouseup`/`keyup`, debounces, trims, dedupes,
  and reports selections as `PAGE_SELECTION_CANDIDATE`.
- Responds to `PING_SELECTION` (liveness check). Panel lifecycle messages stay
  between the panel document and background.
