# 0002. `chrome.storage.local` as the only cross-context shared state

Status: Accepted
Date: 2026-07-09 (retroactively documented)

## Context

Jot it! has four runtime contexts (service worker, docked panel, standalone
window, content script) that share no memory. The service worker can be
killed and respawned by Chrome at any time, so anything that must survive
that needs to live outside its in-memory globals. See
[`docs/architecture.md`](../architecture.md#message-passing) for the message
types used alongside storage.

## Decision

`chrome.storage.local` is the single persistence layer for everything that
needs to survive a reload/respawn or be visible across contexts: the note
draft (`noteDraft`), per-host context suggestions (`contextByHost`), the
title-lock flag (`titleLockEnabled`), and the debug-logging flag
(`debugLogsEnabled`). Ephemeral, session-only coordination state
(`detachedWindows`, `openPanelTabs` tab↔window/tab bookkeeping in
`background.js`) stays in plain in-memory `Map`/`Set` objects, not storage.

## Consequences

- **Easier:** one mental model for "where does this live," no IndexedDB or
  external sync service to reason about, `chrome.storage.onChanged` gives a
  free pub/sub mechanism across contexts (used for `debugLogsEnabled`
  propagation).
- **Harder:** the ephemeral in-memory state in `background.js`
  (`detachedWindows`, `openPanelTabs`) does *not* survive service-worker
  eviction, which can happen mid-session after ~30s of inactivity. This is a
  known, accepted tradeoff, not an oversight — see the fragility note in
  [`docs/architecture.md`](../architecture.md#known-fragility) and the
  backlog item in [`docs/plan/roadmap.md`](../plan/roadmap.md). The panel
  document partially mitigates this by re-announcing its open state on
  focus/visibility changes.
- **If this changes:** promoting `detachedWindows`/`openPanelTabs` to
  `chrome.storage.session` (MV3's ephemeral-but-persistent-across-worker-restarts
  storage) would close this gap. That's a real candidate future change — see
  the roadmap — but hasn't been done, and doing it should update this ADR's
  status to Superseded rather than silently changing behavior.
