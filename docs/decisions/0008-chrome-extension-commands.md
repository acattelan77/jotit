# 0008. Chrome extension commands for configurable shortcuts

Status: Accepted
Date: 2026-07-11

## Context

Page-level `keydown` listeners proved unreliable for app-wide shortcuts on a
real macOS/Chrome setup: operating-system, browser, and other-app bindings can
intercept the key before the side-panel document sees it. Only the browser's
native contenteditable Bold/Italic behavior was dependable.

Jot it! needs configurable shortcuts without claiming familiar Chrome/macOS
bindings. Chrome's `commands` API is designed for extension shortcuts, but it
allows at most four suggested defaults. It also cannot give a useful global
meaning to every dynamic control (for example, "delete this particular library
row"), and a command event cannot safely transfer the panel-local user gesture
required by a file picker.

## Decision

Register every stable, non-file-picker command in `manifest.json`. Supply four
suggested defaults for high-frequency app-wide actions: open Jot it!, new note,
export note, and open library. Leave the remaining commands unbound so the user
can choose them in `chrome://extensions/shortcuts`.

The service worker receives `chrome.commands.onCommand` and forwards all
panel-local commands as a trusted `RUN_PANEL_COMMAND` runtime message. Open
Jot it!, New note, and Open library can open the panel first; other contextual
commands require an already-open panel. Keyboard Save As uses the Chrome
Downloads Save As dialog rather than `showDirectoryPicker()`, because the
latter requires a direct panel click.

## Consequences

Shortcuts are registered by Chrome rather than depending on a side-panel
keydown listener, so they can be inspected and remapped in one standard place.
The exact active shortcut remains user/profile dependent: Chrome may leave a
conflicting suggestion unassigned.

The user must open Jot it! before using formatting, date controls, and other
contextual commands. File import and actions whose target is a specific library
row remain mouse/tap controls. Any new stable command must be added to both the
manifest and the service worker's forwarding allow-list.
