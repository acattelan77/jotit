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
- **Panel document** — the same `sidepanel.js`-driven document whether it's
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
| Page-visit history | `recordPageVisit`, `normalizePageHistory`, `getVisitedPagesForFrontmatter` — `pageHistory` array (max 100) persisted inside `noteDraft`, feeds `pages_visited` frontmatter |
| Caret/selection persistence | `getCaretOffset`, `restoreCaretOffset`, `ensureSelectionInNotes`, `storeNotesSelection`, `getInsertRange` — needed because the contenteditable loses selection on blur/re-render |
| Title auto-fill from active tab | `shouldAutoUpdateTitle`, `updateTitleFromActiveTab` — branches on standalone vs docked |
| Panel-open state sync with background | `announcePanelOpen`, `setPanelTabId`, `syncPanelOpenState` |
| Rich-text formatting / toolbar | `applyFormat` (bold/italic/heading/lists/code/codeblock/highlight/timestamp via `execCommand` + manual DOM surgery), `insertBlockElement` (shared block-insertion/parent-splitting helper used by heading and codeblock), `updateToolbarState` — no toolbar Link button as of 2026-07-10, see [rich-text-editor.md](specs/rich-text-editor.md#links). Only Bold/Italic have keyboard shortcuts (in the `notesInput` keydown listener, alongside Enter-in-code-block handling) — every other shortcut tried was removed after real-world collisions, see [architecture.md](architecture.md#keyboard-shortcuts) |
| Paste handling | `insertPastedTextAsPlainText` (plain-text paste inserts as ordinary prose — text + `<br>` per line — not a code block; see [rich-text-editor.md](specs/rich-text-editor.md)), wired into the `notesInput` `paste` listener alongside the pre-existing image-paste branches |
| Word/char stats | `countWords` (uses `Intl.Segmenter` if available), `updateEditorStats` |
| Image handling (paste/drop/insert) | Local duplicates of note-utils image constants/helpers, `readFileAsDataUrl`, `dataUrlToBlob`, `createRemoteImagePlaceholder`, `insertImageIntoEditor`, `buildObsidianImageExport` |
| Markdown/YAML export construction | `toYamlString`, `buildYamlFrontmatter`, `buildMarkdown`, `getFormData`/`getDraftData` |
| Draft persistence | `setFormData`, `saveDraft` (also syncs the note library — see below), `debouncedSaveDraft`, `resetEditorFormatting` |
| Note library | `saveNoteToLibrary` (called from `saveDraft`/`init`/`flushLibrarySync`, never from `handleSave`/`handleSaveAs` — see [ADR-0007](decisions/0007-autosave-to-library.md)), `hasRealNoteContent`, `flushLibrarySync`, `openLibraryEntry`, `deleteLibraryEntryPrompt`, `toggleLibraryEntryPinned`, `sortLibraryEntries`, `entryMatchesCurrentSite`, `renderLibraryList`, `loadLibraryList`, `setLibraryViewOpen`, `exportAllNotes`, `exportLibraryEntry`, `noteSnippet` — talks to `window.NoteLibrary` (`note-library.js`), see [architecture.md](architecture.md#note-library-indexeddb) |
| Library multi-select / bulk delete | `exitLibraryMultiSelectMode`, `updateLibraryBulkBar`, `deleteSelectedLibraryEntries` — `libraryMultiSelectMode`/`librarySelectedIds` module state, toggled via `#libraryMultiSelectBtn` |
| Library import | `parseYamlScalarString`, `parseImportedNote`, `importLibraryEntryFromFile` — reads back a file this app itself exported (frontmatter + body) into a new library entry; not a general Markdown/YAML importer, see [note-library.md](specs/note-library.md) |
| Onboarding hint | A dismissible one-time banner (`#onboardingHint`) explaining autosave-to-library on first open, gated by the `onboardingHintDismissed` storage key — shown/hidden in `init()`, dismissed via `onboardingHintDismiss` |
| Download / Save / Save As | `downloadMarkdown`, `downloadBlob`, `fetchRemoteAttachmentBlob`, `downloadImageAttachments`, File System Access helpers, `handleSave`, `handleSaveAs`, `handleClear` — `handleSave`/`handleSaveAs` are pure disk-export, no note-library involvement (see [ADR-0007](decisions/0007-autosave-to-library.md)); `handleClear` flushes the current note to the library before clearing |
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
