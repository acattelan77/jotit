# 2026-07-13 — Detach closes the docked panel

Agent/session: Codex (GPT-5)

## What I did

Fixed detach behavior so that after the standalone popup window is created, the
docked side-panel document saves its draft, unregisters itself as open for the
source tab, and calls `window.close()`. This prevents the user from ending up
with both the docked side panel and detached popup visible after clicking the
detach control.

## Why

`chrome.sidePanel.setOptions({enabled:false})` prevents the side panel from
being reopened for a tab, but it does not close a side panel document that
Chrome is already showing. The previous implementation therefore opened the
standalone popup while leaving the original side panel visible, violating the
documented one-presentation invariant.

## Verified

- `node --check sidepanel.js`: passed.
- `npm test`: 95 tests passed, 0 failed.
- `jq empty manifest.json`: passed.
- `git diff --check`: passed.

## Docs updated

Updated `docs/specs/panel-detach-reattach.md` to state that the docked panel
closes itself after background confirms the popup exists, and to clarify why
disabling the side panel alone is not enough.

## Left for next time

Manual Chrome verification is still needed: reload the unpacked extension,
click detach from the real side panel, and confirm the docked panel closes
while the standalone popup remains usable. Then close the popup and confirm the
implicit reattach fallback still opens the side panel for the source tab.
