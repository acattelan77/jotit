# 2026-07-10 — Fix real-world keyboard-shortcut collisions (Cmd+E, Cmd+Shift+;)

Agent/session: Claude Code (Sonnet 5)

## What I did

Direct bug report from the user testing handoff 0011's shortcuts on their
actual machine: **"cmd+shift+; doesn't work"** and **"cmd+e opens claude"**.
Both are real OS/app-level collisions that my earlier verification
(dispatching synthetic `KeyboardEvent`s and checking the resulting DOM)
could not have caught — a synthetic dispatch goes straight to the page's
event listeners, bypassing the actual hardware/OS/browser capture chain
that a real keypress goes through. Cmd+E was already claimed by something
else on the user's machine (activated a different app instead of ever
reaching the page); Cmd+Shift+; simply never arrived either.

Remapped every non-Bold/Italic toolbar shortcut from
Cmd/Ctrl+Shift+<digit/letter/;> to Cmd/Ctrl+Alt+<letter> — the same
low-collision pattern New note already used successfully
(Cmd/Ctrl+Alt+N, unaffected by this bug and unchanged):

| Command | Old (broken/reverted) | New |
|---|---|---|
| Heading | Cmd/Ctrl+Shift+H | Cmd/Ctrl+Alt+H |
| Bullet list | Cmd/Ctrl+Shift+8 | Cmd/Ctrl+Alt+U |
| Numbered list | Cmd/Ctrl+Shift+7 | Cmd/Ctrl+Alt+O |
| Inline code | Cmd/Ctrl+E | Cmd/Ctrl+Alt+C |
| Code block | Cmd/Ctrl+Shift+K | Cmd/Ctrl+Alt+K |
| Highlight | Cmd/Ctrl+Shift+9 | Cmd/Ctrl+Alt+M |
| Timestamp | Cmd/Ctrl+Shift+; | Cmd/Ctrl+Alt+T |

Letters are also layout-safer than the old digit/punctuation combos, whose
`event.key` value changes under Shift (`Shift+8` → `"*"`, not `"8"`) and is
keyboard-layout-dependent — the old code needed `event.code` checks
specifically to work around that; the new scheme doesn't need them at all.
Updated `sidepanel.js`'s `notesInput` keydown handler, and every affected
toolbar button's `title`/`data-label` in `sidepanel.html` (both the native
tooltip and the app's own instant hover-pill tooltip show the new combo).

## Verified

Real Chrome browser (`claude-in-chrome`), fresh local static-file harness
(cache-busted, deleted after use) — **this time with actual keypresses via
the `computer` tool's `key` action, not synthetic `dispatchEvent` calls**,
specifically because that's the class of bug this fix exists to catch.

- Cmd+Alt+T → inserted `HH:MM — ` timestamp text.
- Cmd+Alt+C → wrapped selected text in `<code>`.
- Cmd+Alt+M → wrapped selected text in `<mark>`.
- Cmd+Alt+U → toggled bullet list (`<ul><li>`).
- Cmd+Alt+O → toggled numbered list (`<ol><li>`).
- Cmd+Alt+H → toggled heading (`<h2>`).
- Cmd+Alt+K → inserted an empty code block (`<pre><code>`).
- All seven triggered correctly, with **no external app activated** and no
  browser interception — confirming the new combos don't collide the way
  the old ones did.
- Tooltip hover confirmed showing the new combo text (e.g. "Time
  (Cmd+Alt+T)"), still correctly right-anchored within the panel (the
  earlier last-child tooltip-overflow fix is unaffected by this change).
- `node --check sidepanel.js` and `npm test` (79/79) both pass.

## Docs updated

[docs/architecture.md](../../architecture.md) (Toolbar-command keyboard
shortcuts section rewritten with the new mapping and the collision
postmortem), [docs/specs/rich-text-editor.md](../../specs/rich-text-editor.md)
(shortcut list updated, points at architecture.md for the why),
[RELEASE_CHECKLIST.md](../../../RELEASE_CHECKLIST.md) (QA item updated,
now explicitly calls for real-keypress testing not scripted testing),
[docs/plan/roadmap.md](../../plan/roadmap.md) (new Resolved entry — left
handoff 0011's original description of the Shift-based scheme as
historical record rather than editing it in place, since it was already
shipped and pushed by the time this fix landed). This file.

## Left for next time

Nothing outstanding. Not committed yet — ask before committing, same as
every session. If a future session adds another toolbar-local shortcut,
follow the Cmd/Ctrl+Alt+<letter> pattern established here and — per the
lesson in this handoff — verify it with a real keypress on a real machine,
not just a synthetic-event script.
