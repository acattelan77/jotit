# 2026-08-03 — Context-menu fix: double insert + unwanted detached window

Agent/session: Kimi Code CLI

## What I did

Follow-up to [`2026-08-03-0001-context-menu-send-selection.md`](2026-08-03-0001-context-menu-send-selection.md).
The product owner's first real-browser test reported: the selection landed
in the editor **twice**, and a **detached window** opened instead of the
docked panel.

- `background.js`: `contextMenus.onClicked` now checks panel visibility
  first (`openPanelTabs` / `detachedWindows`, same bookkeeping as
  `PAGE_SELECTION_CANDIDATE`). If no panel is visible it queues the payload
  and calls `openSidePanelFromActionClick()` **synchronously in the click
  handler** — the old code probed with `sendMessage` first, and by the time
  its async callback ran the click's transient user activation could be
  gone, so `chrome.sidePanel.open()` got rejected and the flow fell through
  to the detached-window fallback. The probe path is kept only for the
  panel-known-visible case (as a safety net if the tracking state is
  stale). Payload now also carries `detachedForTab`.
- `sidepanel.js`: the `CONTEXT_MENU_SELECTION` handler now dedupes
  identical text+URL inserts within 5s (`CONTEXT_MENU_DEDUPE_MS`), reusing
  `state.editor.lastInsertedSelection` / `lastInsertedAt` — the same
  mechanism the candidate flow already used. A docked panel also skips the
  insert when `detachedForTab` is set (the detached window owning the tab
  will insert), so a broadcast reaching both documents can't double-insert.

## Why

Most plausible repro for "twice": with the panel closed, the first click
queued the payload and started opening the panel; a second click on the
menu item (the first appears to do nothing while the window opens)
delivered directly — and then the queued payload flushed on `PANEL_OPEN*`,
inserting a second copy. Nothing deduped `CONTEXT_MENU_SELECTION`. The
detached window came from the gesture being spent on the probe round-trip
before `sidePanel.open()` was attempted.

## Verified

- `node --check` on `background.js` / `sidepanel.js`; all 101 Node tests
  pass.
- Not yet re-verified in a real browser — needs the product owner to
  reload the extension and retry: single insert, docked panel (not a
  detached window) opening when the panel was closed.

## Docs updated

- `docs/architecture.md`: the "Sending a selection via the browser context
  menu" section now describes the visibility check, synchronous open,
  5s dedupe, and `detachedForTab` exclusivity.

## Left for next time

- If the user's Chromium variant rejects `sidePanel.open()` from
  context-menu events even with the gesture intact, the detached fallback
  will still trigger — that would be a platform limitation, not a bug
  (the fallback exists for exactly that case, see the Atlas comment in
  `openSidePanelFromActionClick`).
- Known residual gap: two docked panels in two different browser windows
  would both insert (no cross-window exclusivity); judged rare enough to
  not warrant window-id plumbing.
- Stale `openPanelTabs` after service-worker eviction: payload queues and
  is delivered when the panel next announces (e.g. on focus). Same known
  fragility class as roadmap known-issue #1.
