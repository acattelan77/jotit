# 2026-07-10 — Stable draft while switching tabs

Agent/session: Codex (GPT-5)

## What I did

Changed the docked side-panel workflow so one active note stays stable while
the user browses across Chrome tabs:

- `background.js` now prefers `chrome.sidePanel.open({ windowId })` for the
  normal docked open path, with the existing tab-scoped retry/standalone
  fallback still available if a Chromium variant rejects the window-scoped
  call.
- `PANEL_OPEN` / `PANEL_OPEN_ACTIVE` no longer call tab-specific
  `sidePanel.setOptions()` during ordinary tab tracking. They still track the
  active tab for selection capture and content-script injection.
- `sidepanel.js` now stops auto-updating the title once the editor has note
  content, unless the title is still empty. This keeps the Markdown note
  identity anchored after the user starts collecting material.
- `pageHistory` is now normalized and persisted inside `noteDraft`, so the
  exported `pages_visited` list survives panel reloads and can represent
  multiple tabs in one note.

## Why

User-reported workflow mismatch: opening the extension on one tab, then
moving across other research tabs, made the writing area/context appear to
change as though notes were tied to individual tabs. The intended workflow is
one MD note that can collect excerpts and source pages from multiple articles
in the same browsing session.

## Verified

Ran syntax checks:

- `node --check sidepanel.js`
- `node --check background.js`

No automated browser test exists for Chrome side-panel lifetime behavior in
this repo, so the Chrome-specific window-scoped behavior still needs manual
extension verification after reload.

## Docs updated

- `docs/architecture.md`
- `docs/specs/context-title-suggestion.md`
- `docs/specs/draft-persistence.md`
- `docs/glossary.md`
- `docs/plan/roadmap.md`
- This handoff entry

## Left for next time

Manually reload the unpacked extension in Chrome and verify: open Jot it! on
tab A, type or paste a note, switch to tab B/C, confirm the same editor
content/title remains visible, then add selections from multiple tabs and
export to confirm all source pages appear in `pages_visited`.
