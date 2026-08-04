# 2026-08-03 — Context-menu v3: no detached fallback, storage.session queue

Agent/session: Kimi Code CLI

## What I did

Third iteration of the context-menu feature (after
[`0001`](2026-08-03-0001-context-menu-send-selection.md) and
[`0002`](2026-08-03-0002-context-menu-double-insert-fix.md)). The product
owner's retest of v2: with the docked sidebar already open, clicking the
menu item **still opened a detached window** alongside it.

Root cause, two layers:

1. v2 decided "is a panel visible?" via the in-memory
   `openPanelTabs`/`detachedWindows` maps — which are wiped on every
   service-worker eviction (~30s idle, roadmap known-issue #1). With the
   docked panel open but the maps empty, the click took the queue+open
   path.
2. On the owner's machine, `chrome.sidePanel.open()` from a
   `contextMenus.onClicked` event is rejected even when called
   synchronously (whether gesture or variant — can't confirm from here),
   so the open attempts failed and the action-click path's **detached
   fallback** opened the unwanted second window.

Changes:

- `background.js`: back to **probe-first** delivery — `sendMessage` to the
  panel, which accurately detects a live panel document regardless of
  in-memory state. Only on "receiving end does not exist" does it queue.
  Queueing now persists payloads to
  `chrome.storage.session["pendingContextMenuSelections"]` (survives SW
  restarts) and makes a **best-effort `sidePanel.open()` with no detached
  fallback** — if the open is rejected, nothing visible happens and the
  payload waits. `PANEL_OPEN*` flush now merges the memory queue with the
  persisted one. Payloads carry `queuedAt`.
- `sidepanel.js`: handler extracted to `handleContextMenuSelection()`
  (same trusted-sender gate at the listener), now also dropping payloads
  older than 15 min (`QUEUED_CONTEXT_MENU_SELECTION_TTL_MS`). New
  `consumeQueuedContextMenuSelections()` runs in `init()` right after
  `syncPanelOpenState()` and drains the storage.session key, so a payload
  queued while the panel was closed is inserted the next time the panel
  loads even if the service worker (and its memory queue) died in between.
  The 5s identical-text dedupe from v2 covers the flush+consume double
  delivery.

## Why

The owner explicitly does not want the detached window from this flow, and
their machine demonstrably rejects `sidePanel.open()` from context-menu
events — so the flow no longer depends on opening anything. Trade-off,
stated plainly: on machines where the open is rejected and the panel is
closed, clicking the menu item gives **no immediate feedback**; the text
appears the next time the panel opens. That's the honest behavior given
the platform constraint.

## Verified

- `node --check` on both files; all 101 Node tests pass.
- NOT yet browser-verified — needs the owner to reload the extension and
  retest the exact reported scenario: docked panel open, right-click
  selection → text inserted in the docked panel, no extra window.

## Docs updated

- `docs/architecture.md`: context-menu flow section rewritten for v3;
  `pendingContextMenuSelections` added to the storage-keys table (flagged
  as storage.session).

## Left for next time

- Owner retest (see above). If double inserts ever reappear, enable debug
  logs (`JotDebug.enable()`) — every branch of this flow is logged.
- Residual known gaps (unchanged from v2 handoff): two docked panels in
  two browser windows both insert; `detachedWindows` staleness after SW
  eviction can briefly defeat `detachedForTab` exclusivity.
- The 0002 handoff's "synchronous open preserves the gesture" theory
  turned out insufficient on the owner's machine — treat
  `sidePanel.open()` from context-menu events as unreliable there.
