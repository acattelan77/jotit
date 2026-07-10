# Glossary & Module Map

Shared vocabulary so agents describe the same thing the same way across
sessions. If you introduce a new concept, add it here rather than letting
each doc/spec coin its own term for it.

## Terms

- **Draft** — the in-progress note state autosaved to
  `chrome.storage.local["noteDraft"]` on every edit (300ms debounce). Not the
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
- **Panel document** — the same `sidepanel.js`-driven document whether it's
  docked or standalone; "the panel" in most contexts means this document, not
  the browser-window chrome.
- **Context / context title** — the auto-filled note title, normally derived
  from the active tab's page title, editable and optionally lockable
  (**title lock**) so it stops following page navigation.
- **Context suggestion** — a remembered custom title value per hostname
  (`contextByHost` storage key), offered back to the user next time they're
  on that host.
- **Page selection candidate** — text the user selected on a web page,
  captured by the content script and offered to the panel as a
  not-yet-inserted suggestion (**pending page selection**). Requires an
  explicit **Add selection** click to actually land in the note.
- **Panel-open state** — background's tracking (`openPanelTabs` Set) of
  which tabs currently have a visible panel, used to decide whether to
  forward a page-selection candidate or silently drop it.
- **Attachment** — an image embedded in a note, exported as a file under
  `attachments/` (relative to the note) rather than inlined as a data URI in
  the Markdown.
- **Frontmatter** — the YAML block at the top of an exported note
  (`title`, `date`, `time`, `datetime`, `pages_visited`).
- **Note library** *(proposed, not yet implemented — see
  [ADR-0006](decisions/0006-note-library-via-indexeddb.md))* — an IndexedDB
  store of previously exported notes, scoped to the panel document, enabling
  browse/search of past notes from inside the extension. Distinct from the
  **draft** (single in-progress note) and from the exported `.md` file on
  disk (which remains the durable source of truth). Deliberately excludes
  note-to-note linking — see [note-library.md](specs/note-library.md).
- **NoteUtils** — the shared pure-function library (`lib/note-utils.js`)
  used by `sidepanel.js` for filename building and Markdown↔HTML conversion.
  Anything that doesn't touch `chrome.*` APIs or the DOM and could plausibly
  be unit tested belongs here, not in `sidepanel.js`.

## `sidepanel.js` region map

Single flat file, no ES modules. Regions below are ordered as they appear in
the file; line numbers are approximate — if you find they've drifted,
correct them here rather than leaving them stale.

| Region | Responsibility |
|---|---|
| DOM references + globals/constants | `STORAGE_KEY`, all `getElementById` lookups, `NoteUtils` destructure, module-level mutable state |
| Toast/status notifications | `showToast`, `setStatus`, `reportError` — single `#statusMessage` element, variants `default`/`error`/`ambient` |
| Storage helpers | `storageGet`/`storageGetMultiple`/`storageSet`/`storageRemove` — Promise wrappers around `chrome.storage.local` |
| Title-lock + context-suggestion state | `setTitleLocked`, `updateContextSuggestion`, `rememberContextForHost` |
| Page-visit history | `recordPageVisit`, `getVisitedPagesForFrontmatter` — in-memory `pageHistory` array (max 100), feeds `pages_visited` frontmatter |
| Caret/selection persistence | `getCaretOffset`, `restoreCaretOffset`, `ensureSelectionInNotes`, `storeNotesSelection`, `getInsertRange` — needed because the contenteditable loses selection on blur/re-render |
| Title auto-fill from active tab | `shouldAutoUpdateTitle`, `updateTitleFromActiveTab` — branches on standalone vs docked |
| Panel-open state sync with background | `announcePanelOpen`, `setPanelTabId`, `syncPanelOpenState` |
| Rich-text formatting / toolbar | `applyFormat` (bold/italic/heading/lists/code/codeblock/highlight/link via `execCommand` + manual DOM surgery), `insertBlockElement` (shared block-insertion/parent-splitting helper used by heading and codeblock), `updateToolbarState`, keyboard shortcuts, Enter-in-code-block handling (in the `notesInput` keydown listener) |
| Word/char stats | `countWords` (uses `Intl.Segmenter` if available), `updateEditorStats` |
| Image handling (paste/drop/insert) | Local duplicates of note-utils image constants/helpers, `readFileAsDataUrl`, `dataUrlToBlob`, `createRemoteImagePlaceholder`, `insertImageIntoEditor`, `buildObsidianImageExport` |
| Markdown/YAML export construction | `toYamlString`, `buildYamlFrontmatter`, `buildMarkdown`, `getFormData`/`getDraftData` |
| Draft persistence | `setFormData`, `saveDraft`, `debouncedSaveDraft`, `resetEditorFormatting` |
| Download / Save / Save As | `downloadMarkdown`, `downloadBlob`, `fetchRemoteAttachmentBlob`, `downloadImageAttachments`, File System Access helpers, `handleSave`, `handleSaveAs`, `handleClear` |
| Incoming selection-candidate handling | `onMessage` listener for `PAGE_SELECTION_CANDIDATE`, `addPendingPageSelection`, `insertSelectionWithLink` |
| Tab-change listeners | `attachTabListeners` — different listener sets for standalone vs docked |
| Date/time picker | `parseDateValue`, `updateMeetingDateDisplay`, `setMeetingDateValue`, `renderDatePicker`, `adjustTime`, open/close + keyboard nav |
| `init()` bootstrap | Loads draft/context/title-lock from storage, restores caret, wires up title/panel state |
| Event listener wiring | All `addEventListener` calls, `window.JotDebug` debug console API, final `init()` call |

If you add a new top-level function, place it in the region it conceptually
belongs to (or add a new region here with its line range) rather than
appending to the end of the file regardless of responsibility — the file is
already large enough that region drift makes it hard to navigate.

## `background.js` responsibilities

- Panel lifecycle: `openSidePanelFromActionClick`, `openDetachedPanelWindowForTab`,
  `ensurePanelOptions`.
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
- Responds to `PING_SELECTION` (liveness check), `PANEL_OPEN`/`PANEL_CLOSE`
  (UI hint toggling).
