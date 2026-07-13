# Spec: Keyboard shortcuts

## Purpose

Give users configurable keyboard access to Jot it! actions without relying on
the side-panel document receiving page-level key events. Chrome owns the
bindings and presents them in `chrome://extensions/shortcuts`.

## User flow

After installing or reloading the extension, the user can press a registered
shortcut while Chrome is focused. They can inspect, assign, remove, or remap
every listed command at `chrome://extensions/shortcuts`. A conflicting default
may appear unassigned; Jot it! must not silently substitute a different key.

The four suggested defaults are:

| Action | macOS | Windows/Linux |
|---|---|---|
| Open Jot it! | Cmd+Shift+Y | Ctrl+Shift+Y |
| New note | Cmd+Shift+U | Ctrl+Shift+U |
| Export note | Cmd+Shift+K | Ctrl+Shift+K |
| Open library | Cmd+Shift+L | Ctrl+Shift+L |

Chrome permits only four suggested extension shortcuts. Every other registered
command starts unbound and is deliberately user-configurable.

## Commands and scope

**Open Jot it!**, **New note**, and **Open library** open the panel if needed
(using the existing standalone fallback if necessary). All other commands
operate only when a docked or standalone panel is already open; a command
pressed with no listening panel is a no-op.

The manifest registers commands for these stable UI actions:

- Header and metadata: new note, Save, Save As, library, detach/reattach,
  context-title lock, date-picker open, and set date/time to now.
- Date-picker controls: previous/next month, today, close, and each hour/minute
  increment or decrement.
- Pending page selection: add or dismiss.
- Formatting: bold, italic, heading, bullet list, numbered list, inline code,
  code block, highlight, and timestamp.
- Library: focus search, export all, toggle current-site filter, toggle
  multi-select, and delete the selected notes.

Bold and Italic also retain Chrome's ordinary contenteditable Cmd/Ctrl+B/I
behavior. Escape still closes the date picker.

Save As invoked by a shortcut uses Chrome's Downloads Save As dialog. The
directory picker is intentionally reserved for a direct click because the File
System Access API requires that panel-local user gesture.

There is no command for **Import** (it opens a file chooser) or for per-row
library actions such as pin/open/delete, because those need a direct file-picker
gesture or a specific row target. Date-grid day selection remains keyboard
accessible with the existing arrow-key navigation after opening the picker.

## Implementation boundary

`background.js` receives `chrome.commands.onCommand`; it opens the panel and
queues a command when needed for `open-jot-it`, `new-note`, or `open-library`,
otherwise relays `RUN_PANEL_COMMAND {command}` to the open panel. The panel
rejects messages not sent from the extension origin before calling
`runPanelCommand()`. Add a stable UI action to both `manifest.json` and
background's `PANEL_COMMANDS` allow-list, then document it here.

See [ADR-0008](../decisions/0008-chrome-extension-commands.md) for the design
trade-offs.
