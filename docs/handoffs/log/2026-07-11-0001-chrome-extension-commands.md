# 2026-07-11 — Chrome-managed, configurable keyboard commands

Agent/session: Codex (GPT-5)

## What I did

Registered 34 named Chrome extension commands in `manifest.json`. Four have
suggested defaults: Open Jot it! (Cmd/Ctrl+Shift+Y), New note (U), Export note
(K), and Open library (L). All other stable toolbar, date-picker, selection,
detach/reattach, and library actions are initially unbound and can be assigned
at `chrome://extensions/shortcuts`.

Added service-worker routing from `chrome.commands.onCommand` to trusted
`RUN_PANEL_COMMAND` messages, plus panel-side command execution. Open Jot it!,
New note, and Open library open the panel when necessary; all other contextual
commands require an existing panel. Keyboard Save As deliberately uses Chrome's
Downloads Save As flow instead of the File System Access directory picker.

## Why

The former page-level shortcut attempts repeatedly failed on the product
owner's real macOS/Chrome setup even after synthetic and real-keypress checks.
Chrome's extension-command system puts conflict resolution and per-user remaps
in Chrome, rather than depending on the panel document receiving the key.
See [ADR-0008](../../decisions/0008-chrome-extension-commands.md).

## Verified

- `node --check background.js`
- `node --check sidepanel.js`
- `jq empty manifest.json`
- A manifest/allow-list consistency check: 34 manifest commands and exactly
  four suggested defaults.
- `npm test`: 79 passing tests.
- `git diff --check`.

I could not programmatically inspect or reload Chrome's internal
`chrome://extensions/shortcuts` page: the available Chrome bridge cannot claim
internal Chrome pages. After reloading the unpacked extension manually, test
the four defaults and at least one user-assigned formatting, date, and library
command with real physical keypresses, as called out in the release checklist.

## Docs updated

- `docs/architecture.md`
- `docs/glossary.md`
- `docs/specs/keyboard-shortcuts.md` (new)
- `docs/specs/rich-text-editor.md`
- `docs/specs/export-and-save.md`
- `docs/specs/README.md`
- `docs/decisions/0008-chrome-extension-commands.md` (new) and index
- `docs/plan/roadmap.md`
- `README.md`, `RELEASE_CHECKLIST.md`, and `GO_LIVE_PLAN.md`

## Left for next time

No code work is intentionally left. The user must reload the unpacked
extension in Chrome for the new manifest commands to appear, then perform the
real-keypress validation above. File import and per-library-row actions remain
mouse/tap-only by design because they need a file-picker user gesture or a
specific row target.
