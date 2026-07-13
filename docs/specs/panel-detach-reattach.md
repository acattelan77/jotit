# Spec: Panel Detach / Reattach

## Purpose

Let the user pop the note editor out of the docked side panel into its own
floating window — useful for repositioning relative to a video call or
another window — and bring it back later without losing draft state.

## Behavior

- **Detach:** clicking the detach control sends `DETACH_AND_OPEN {tabId}`.
  Background disables the docked panel for that tab
  (`sidePanel.setOptions({enabled:false})`) and opens a
  `chrome.windows.create({type:"popup"})`
  window at `sidepanel.html?standalone=1&sourceTabId=<id>&sourceTitle=...&sourceUrl=...`.
  After background confirms the popup exists, the docked panel saves its draft,
  unregisters itself as open for the source tab, and closes itself. Disabling
  the side panel prevents reopening for that tab, but does not by itself close
  a side panel document that Chrome is already showing.
- **Standalone document behavior:** detects `isStandalone` from the URL
  params. Title/URL auto-fill and tab-change listeners key off
  `sourceTabId` (via `chrome.tabs.get`/`chrome.tabs.onUpdated`) instead of
  `chrome.tabs.query({active:true})` — a standalone window has no "active
  tab" concept of its own; it tracks the tab it detached from, even if the
  user switches focus to other tabs.
- **Reattach (explicit):** clicking the reattach control in the standalone
  window directly calls `chrome.sidePanel.setOptions`/`open` for the source
  tab, then `window.close()`.
- **Reattach (implicit, window closed without clicking reattach):**
  `chrome.windows.onRemoved` in background best-effort re-enables and
  reopens the docked panel for the tab that was mapped to that window
  (`detachedWindows`). This is a fallback, not the primary path — don't
  assume it always fires in time if the service worker was evicted (see
  [known fragility](../architecture.md#known-fragility)).
- The draft (autosaved state) is shared regardless of presentation — it's
  the same `chrome.storage.local["noteDraft"]` whether docked or standalone,
  so detaching/reattaching does not lose in-progress text.

## Invariants

- Only one presentation (docked or standalone) should be usable at a time
  for a given source tab — detaching disables the docked panel for that tab
  specifically, it doesn't just open a second window alongside it.
- A standalone window must never silently fall back to treating "whatever
  tab is active in the browser" as its source — that would leak page-title
  auto-fill or selection capture from the wrong page. Always route through
  `sourceTabId`.

## Known fragility

`detachedWindows` (the tabId↔windowId map enabling implicit reattach) is
in-memory only in the service worker and does not survive worker eviction —
see [ADR-0002](../decisions/0002-storage-local-shared-state.md). If this
causes real user-visible bugs (implicit reattach failing after the panel
sat idle), the fix is promoting this map to `chrome.storage.session`; that
would need a new ADR, not a silent patch.
