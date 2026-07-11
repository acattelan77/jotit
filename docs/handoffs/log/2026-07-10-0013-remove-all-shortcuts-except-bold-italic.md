# 2026-07-10 — Remove all keyboard shortcuts except Bold/Italic

Agent/session: Claude Code (Sonnet 5)

## What I did

Direct follow-up from the user after handoff 0012's fix, which had been
verified with real keypresses and appeared to work: **"remove all
shortcuts. they don't work. only cmd+b and cmd+i work."** On further
testing on their actual machine, every shortcut beyond Bold/Italic failed
again — both the global app shortcuts (Save/Save As/New note/Library) from
handoff 0010 and the remapped Cmd/Ctrl+Alt+<letter> toolbar shortcuts from
handoff 0012. Rather than attempt a fourth scheme, removed all of it at
the user's explicit direction:

- `notesInput`'s keydown handler now only checks Bold (Cmd/Ctrl+B) and
  Italic (Cmd/Ctrl+I) — every `Cmd/Ctrl+Alt+<letter>` check for
  heading/bullet/numbered/code/codeblock/highlight/timestamp removed.
- The `document`-level keydown handler reverted to its original,
  pre-2026-07-10 form: `if (event.key === "Escape" && pickerOpen)
  closeDatePicker();` — nothing else. The Save/Save As/New note/Library
  toggle bindings and the library-closing Escape behavior are gone.
- Every toolbar and header button's `title`/`data-label`/`aria-label`
  reverted to a plain description with no shortcut hint, except Bold and
  Italic (kept — confirmed working across three rounds of testing now).

All the underlying functionality (Save, Save As, New note, Library
toggle, every formatting command) is untouched and fully usable via mouse/
tap on the existing icon buttons — only the keyboard-shortcut convenience
layer is gone.

## Why this probably happened (not confirmed, just the working theory)

Chrome's contenteditable regions have built-in native handling for
Cmd+B/Cmd+I regardless of any page-level JS listener. That would explain
why those two alone survived three consecutive rounds of real-machine
testing while every other shortcut — spanning two completely different key
combinations schemes (Shift-based, then Alt-based) and two completely
different categories (global app shortcuts, toolbar-local shortcuts) —
failed every time. If true, this app's own `keydown` listener may not
actually have been receiving most of these key combinations at all on the
user's machine, for reasons outside this codebase's control (OS-level
capture, another app/extension, or something specific to how this Chrome
profile handles side-panel documents). Not chasing this further per the
user's explicit "remove all shortcuts" instruction — noted here so a
future session doesn't reintroduce shortcuts without knowing this history.

## Verified

Real Chrome browser (`claude-in-chrome`), fresh local static-file harness
(cache-busted, deleted after use).

- Hovering Bold shows "Bold (Cmd+B)"; hovering every other toolbar button
  (Heading, Bullets, Numbered, Code, Code block, Highlight, Time) shows
  only its plain label with no shortcut text.
- No console errors.
- `node --check sidepanel.js` and `npm test` (79/79) both pass.
- Did **not** re-verify the removed shortcuts still do nothing via real
  keypress — there's nothing meaningful to verify (the code paths that
  handled them no longer exist), and the user's own testing is what
  triggered this change.

## Docs updated

[docs/architecture.md](../../architecture.md) — replaced the "Global
keyboard shortcuts" and "Toolbar-command keyboard shortcuts" sections
(added in handoffs 0010/0012) with a single consolidated "Keyboard
shortcuts" section covering the current state and the full three-round
history, with an explicit warning against reintroducing shortcuts without
real-keypress verification. [docs/specs/rich-text-editor.md](../../specs/rich-text-editor.md),
[docs/glossary.md](../../glossary.md), [README.md](../../../README.md),
[RELEASE_CHECKLIST.md](../../../RELEASE_CHECKLIST.md),
[GO_LIVE_PLAN.md](../../../GO_LIVE_PLAN.md) all updated to match.
[docs/plan/roadmap.md](../../plan/roadmap.md) — new Resolved entry; fixed
now-dead `#global-keyboard-shortcuts`/`#toolbar-command-keyboard-shortcuts`
anchor links in earlier entries to point at the new consolidated section
(mechanical link fix only — left the surrounding historical prose in
handoffs 0010-0012 and the earlier roadmap entries untouched, since those
accurately record what was believed true at each point in time). This
file.

## Left for next time

Nothing outstanding. Not committed yet — ask before committing, same as
every session. If a future session wants keyboard shortcuts again, read
this handoff and the "Keyboard shortcuts" section of architecture.md
first — three attempts with three different schemes all failed the same
way, so the next attempt needs a real hypothesis for *why* (see the
theory above), not just a fourth key combination.
