# 2026-07-10 — Remove context suggestion + link toolbar button, add
per-command keyboard shortcuts

Agent/session: Claude Code (Sonnet 5)

## What I did

Direct follow-up feedback from the user reacting to screenshots of the
just-shipped usability-review work (handoff 0010), not part of the review
itself:

1. **Removed the "Use last: `<value>`" context/title suggestion entirely**
   ("that feature is not needed"). Deleted the `#contextSuggestion` button,
   its CSS, the `CONTEXT_KEY`/`contextByHost` storage key and state,
   `updateContextSuggestion`/`rememberContextForHost`/
   `debouncedRememberContext`, every call site, and the
   `chrome.storage.onChanged`/`init()` plumbing that kept it in sync.
   **Kept** `getCurrentHost()` — the library's "this site" filter (added a
   few minutes earlier in handoff 0010) depends on it independently and has
   nothing to do with the removed feature.
2. **Removed the toolbar Link button** ("remove the link icon to leave room
   for the clock") — the 10-icon toolbar (Bold/Italic/Heading/Bullets/
   Numbered/Code/Codeblock/Highlight/Link/Timestamp) visibly overflowed the
   panel at its real width once the timestamp button was added. Rather than
   leave the link-dialog feature from handoff 0010 as unreachable dead code,
   removed it completely: `#linkDialog`/`#linkDialogBackdrop` markup, their
   CSS, `openLinkDialog`/`closeLinkDialog`/`confirmLinkDialog`, the `"link"`
   case in `applyFormat`, the Escape-chain entry, and the listener wiring.
   There is now no toolbar link-insert control at all — a link only ends up
   in a note via page-selection insertion, or by typing literal
   `[text](url)` Markdown that converts to a real `<a>` the next time the
   note round-trips through `markdownToHtml` (reload / reopen from
   library).
3. **Added a keyboard shortcut for every remaining toolbar command, shown
   on hover** ("Add shortcut for the commands in the toolbar and show the
   shortcut on hover over the icons"): Cmd/Ctrl+E (inline code),
   Cmd/Ctrl+Shift+H (heading), Cmd/Ctrl+Shift+K (code block),
   Cmd/Ctrl+Shift+8 (bullet list), Cmd/Ctrl+Shift+7 (numbered list —
   deliberately matching Google Docs), Cmd/Ctrl+Shift+9 (highlight),
   Cmd/Ctrl+Shift+; (timestamp). The digit/semicolon combos check
   `event.code` (e.g. `"Digit8"`) rather than `event.key`, since a
   Shift+digit `key` is the shifted character (`"*"` for Shift+8) and is
   layout-dependent. Every toolbar button's `title`/`data-label` now
   includes its shortcut, so it shows in both the native tooltip and the
   app's own instant hover-pill tooltip.

## Verified

Real Chrome browser (`claude-in-chrome`), fresh local static-file harness
(cache-busted, deleted after use).

- Toolbar renders as 9 icons (Link gone), zero horizontal overflow at the
  real ~380px side-panel width — checked both by a forced-width DOM
  assertion (`scrollWidth === clientWidth` on `.toolbar`) and a zoomed
  screenshot.
- Hovering Bold shows "Bold (Cmd+B)"; hovering Code block shows "Code block
  (Cmd+Shift+K)" — tooltip text confirmed via screenshot.
- Functionally triggered every new shortcut via synthetic `KeyboardEvent`s
  (matching real accelerator semantics, `metaKey`/`ctrlKey`/`shiftKey`/
  `code`) and inspected the resulting DOM: Cmd+Shift+9 → `<mark>`,
  Cmd+Shift+8 → `<ul><li>`, Cmd+E → `<code>`, Cmd+Shift+H → `<h2>`,
  Cmd+Shift+7 → `<ol><li>`, Cmd+Shift+; → `HH:MM — ` text inserted. Also
  confirmed Cmd+B (no shift) still bolds normally — the new `!e.shiftKey`
  guard on Bold/Italic/Code doesn't break the existing behavior.
- No "Use last" suggestion UI visible anywhere; opened the library and
  confirmed it still works end-to-end (search/sort/filter/pin/multi-select
  UI all present and functional) — none of that code was touched this
  round.
- No console errors across the whole pass. `node --check` on all touched
  files and `npm test` (79/79) both pass.

## Docs updated

[docs/specs/context-title-suggestion.md](../../specs/context-title-suggestion.md)
(retitled "Title Auto-fill And Lock," removed the per-site suggestion
behavior/edge-case, added a removal notice),
[docs/specs/rich-text-editor.md](../../specs/rich-text-editor.md) (Links
section rewritten for no-toolbar-control, full shortcut list added),
[docs/architecture.md](../../architecture.md) (new "Toolbar-command keyboard
shortcuts" section, Escape-chain description fixed, `contextByHost` removed
from the storage-keys table), [docs/glossary.md](../../glossary.md) (Context
suggestion term folded into the Context/context-title term with a removal
note, Link dialog region row removed), [docs/specs/README.md](../../specs/README.md)
and [docs/specs/context-title-suggestion.md](../../specs/context-title-suggestion.md)
index descriptions, [docs/plan/roadmap.md](../../plan/roadmap.md) (edited the
handoff-0010 Resolved entry's link-dialog bullet in place since it was
superseded minutes later in the same uncommitted session, and added a new
Resolved entry for this round), [README.md](../../../README.md) and
[PRIVACY.md](../../../PRIVACY.md) (removed context-suggestion mentions,
updated the formatting/shortcuts bullets), [RELEASE_CHECKLIST.md](../../../RELEASE_CHECKLIST.md)
and [GO_LIVE_PLAN.md](../../../GO_LIVE_PLAN.md) (QA items updated to match).
This file.

## Left for next time

Nothing outstanding. Not committed yet — ask before committing, same as
every session.
