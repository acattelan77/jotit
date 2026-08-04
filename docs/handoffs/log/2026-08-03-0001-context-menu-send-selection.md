# 2026-08-03 — Context-menu "Send selection to Jot it!"

Agent/session: Kimi Code CLI

## What I did

Added a browser context-menu item, **Send selection to Jot it!**, that
appears when right-clicking selected page text and inserts the selection
directly into the panel's note editor.

- `manifest.json`: added the `contextMenus` permission.
- `background.js`: registers the menu on install/update
  (`contexts: ["selection"]`); `contextMenus.onClicked` trims/truncates the
  text (4000 chars, same cap as `content-selection.js`) and forwards a new
  `CONTEXT_MENU_SELECTION {text, url, title, tabId}` message to the panel.
  If no panel is listening, the payload is queued in
  `pendingContextMenuSelections`, the panel is opened via the existing
  `openSidePanelFromActionClick()` path, and the queue is flushed from the
  `PANEL_OPEN` / `PANEL_OPEN_ACTIVE` handlers.
- `sidepanel.js`: new `CONTEXT_MENU_SELECTION` branch in the message
  listener (trusted-sender check identical to `RUN_PANEL_COMMAND`;
  standalone windows filter by `sourceTabId`). Insertion reuses a new
  `insertPageSelectionIntoNote()` helper extracted from
  `addPendingPageSelection()` — behavior of the existing "Add selection"
  button is unchanged.

## Why

Product owner request: select text on a page → right-click → send it to the
extension's text area. Unlike the passive `PAGE_SELECTION_CANDIDATE`
capture (which shows a preview bar and waits for "Add selection"), the menu
click is itself the user's confirmation, so the panel inserts immediately —
same code-block-plus-source-link shape, plus `recordPageVisit`, clearing any
pending-selection preview for the same text, and a debounced draft save. No
new ADR: this extends the existing message-forwarding pattern rather than
changing the protocol's structure, and `contextMenus` is now listed in the
architecture doc's permissions section (Chrome Web Store justification will
be needed at next publish, same as any permission change).

## Verified

- `node --check` passes on `background.js`, `sidepanel.js`,
  `content-selection.js`.
- `npm test` — all 101 tests pass (including the manifest/background
  integrity suites).
- Not yet verified in a real browser: menu registration after reload, the
  open-if-closed path, and insertion at the caret all need a manual pass
  (load unpacked, reload the extension so `onInstalled` re-registers the
  menu, select text on an http(s) page, right-click).

## Docs updated

- `docs/architecture.md`: message table row for `CONTEXT_MENU_SELECTION`,
  trust-boundary paragraph, new "Sending a selection via the browser
  context menu" flow section, `contextMenus` added to the permissions
  section.
- `docs/plan/roadmap.md`: Resolved entry.

## Left for next time

- Manual browser verification (see above).
- The pending-selection queue is in-memory, same known service-worker
  eviction fragility as `pendingPanelCommands`/`openPanelTabs` (roadmap
  known issue #1).
- Next release needs the `contextMenus` permission justification in the
  Web Store listing (see `RELEASE_CHECKLIST.md`).
