# Spec: Rich Text Editor

## Purpose

A lightweight formatting toolbar over a contenteditable region — enough
structure for readable notes, not a full word processor.

## Supported formatting

Bold, italic, heading, bullet list, numbered list, inline code, code block,
highlight, timestamp — via `applyFormat()`, implemented with
`document.execCommand` plus manual DOM surgery for headings, code blocks, and
highlight (execCommand's support for these is inconsistent or nonexistent
across browsers, hence the manual handling). No toolbar link-insert control
— see [Links](#links) below.

Editor-local keyboard shortcuts, every one shown in its toolbar button's
hover tooltip: Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic), Cmd/Ctrl+E (inline
code), Cmd/Ctrl+Shift+H (heading), Cmd/Ctrl+Shift+K (code block),
Cmd/Ctrl+Shift+8 (bullet list), Cmd/Ctrl+Shift+7 (numbered list —
deliberately matching Google Docs' list shortcuts), Cmd/Ctrl+Shift+9
(highlight), Cmd/Ctrl+Shift+; (insert timestamp). Toolbar button
active-state reflects current selection formatting via
`updateToolbarState()`. Panel-wide shortcuts (Save, Save As, New note,
Library toggle, Escape) are handled globally, not per-editor — see
[architecture.md](../architecture.md#global-keyboard-shortcuts) and
[architecture.md](../architecture.md#toolbar-command-keyboard-shortcuts).

### Timestamp

The "Insert timestamp" toolbar button inserts the current local time (`HH:MM
— `) as plain text at the caret — a cheap zero-friction way to mark when
something was said/decided without hand-typing a time, aimed at the
meeting-notetaker use case. No toggle/undo state to track (unlike code
block/highlight): each click inserts a fresh stamp.

Heading and code-block insertion (both the toolbar action and paste-as-code,
see below) share a helper, `insertBlockElement()`: if inserting the new block
lands it inside an existing `<p>`/`<div>`, it splits that parent around the
new block instead of leaving invalid block-inside-`<p>` nesting. Any new
block-level insertion path should reuse this helper rather than re-deriving
the same splitting logic.

### Code blocks

Toggleable via the "Code block" toolbar button (`applyFormat("codeblock")`):
wraps the selection in `<pre><code>`, or unwraps back to a plain paragraph if
the caret is already inside one. Round-trips to/from fenced (```` ``` ````)
Markdown via `lib/note-utils.js`.

Code blocks wrap long lines (`white-space: pre-wrap; overflow-wrap: anywhere`
on `.editor pre`) rather than scrolling horizontally — internal line breaks
stay significant (still `white-space: pre`-like), but a line, or even a
single long unbroken token (a hash, a URL with no spaces), never pushes the
panel wider than the fixed editor width.

**Pasting plain text inserts it as ordinary prose** (text nodes + `<br>` per
line, via `insertPastedTextAsPlainText`) — matching the default in every
other notes/document editor. Exception: if the caret is already inside an
existing code block when pasting, the text is appended into that block as
plain text instead (falls back to `execCommand("insertText")` for that
case). Image paste (data-URI or remote) is handled separately, upstream of
this check — see [Images](#images) below; this only affects plain-text
clipboard content.

An earlier version of this app wrapped every plain-text paste in a `<pre>`
code block by default, on the theory that pasted text is usually a
snippet/quote copied from the page being read. In practice this made pasting
an agenda, a paragraph to annotate, or any other ordinary prose look broken
(unexpectedly monospaced) the first time a new user did it, with no visible
explanation or way to opt out — flagged as a top usability blocker in a
2026-07-10 product review and reverted the same day. **Captured page
selections are unaffected** — see [Selection insertion](#selection-insertion)
below, which still deliberately uses a code block for a different, narrower
reason (a quoted external source with a link back to it, not a generic paste
default).

Two contenteditable-specific correctness issues had to be worked around,
both are load-bearing — don't simplify them away without re-verifying in a
real browser:

- **Empty code block creation** does not use placeholder text (e.g. the
  literal word "code"). Selecting and typing over placeholder text makes
  Chrome silently replace the whole `<code>` element with a style-preserving
  `<span>`, losing the code semantics. Instead, an empty code block is
  `<code><br></code>` with the caret explicitly positioned before the `<br>`
  — the standard contenteditable idiom for a focusable empty line (same
  pattern as an empty `<p><br></p>`).
- **Enter inside a code block** is intercepted (`notesInput`'s `keydown`
  listener) to insert a line break within the block rather than letting the
  browser's default "insert paragraph" behavior split it into a new
  paragraph. The inserted line break is a text node `"\n" + "\u200B"` — a real
  newline plus a trailing zero-width space. The zero-width space matters: a
  caret left at the very end of a block's content, right after a lone
  newline with nothing after it, makes Chrome's `insertText` land text
  *before* that newline instead of at the caret (verified directly in a
  browser; reproducible with plain `execCommand("insertText")` too, not just
  real typing). Giving the caret a real (if invisible) character to sit next
  to avoids that ambiguity. The zero-width space is stripped back out in
  `htmlToMarkdown` (`lib/note-utils.js`) so it never reaches saved notes —
  if you add another place that reads code-block text content directly
  (bypassing `htmlToMarkdown`), it needs the same stripping.

### Highlight

Toggleable via the "Highlight" toolbar button (`applyFormat("highlight")`):
wraps the selection in `<mark>`, unwraps if already inside one. Round-trips
to/from `==highlighted text==` — not standard CommonMark, but a well-known
Obsidian convention; documented as an intentional Obsidian-flavored-Markdown
extension (see [export-and-save.md](export-and-save.md)).

### Markdown-converter code protection

`markdownToHtml` (`lib/note-utils.js`) runs a sequence of regex passes
(bold, italic, highlight, headings, lists, ...) over the whole string. Fenced
and inline code are extracted and replaced with an opaque placeholder token
*before* those passes run, then restored verbatim at the very end — otherwise
code containing `**kwargs` or `a == b` would get spuriously bolded or
highlighted by the later passes (a real bug, not hypothetical: this is
exactly what motivated the fix, since `==` and `**` are common in real code
and adding highlight syntax made the collision far more likely to occur in
practice than it was before). Any new regex pass added to `markdownToHtml`
must run *after* the code-stash step, or it reopens this class of bug — see
the `stashCode`/`codeStash` mechanism at the top of the function.

## Word/character stats

`countWords()` uses `Intl.Segmenter` when available for locale-aware word
boundaries, otherwise falls back to a simpler split. Displayed live as the
user types (`updateEditorStats`).

## Images

- **Paste:** clipboard images (screenshot, copied image, or copied HTML
  containing an `<img>`) are accepted. Data-URI images are inserted as real
  `<img>` elements. Supported types come from `SUPPORTED_IMAGE_TYPES` — see
  the duplication note below.
- **Remote image URLs:** pasted as HTML containing an `<img src="https://...">`
  are inserted as a non-editable `<figure class="image-attachment"
  data-jot-image-src=... data-jot-image-alt=...>` placeholder, not fetched
  immediately — the actual fetch happens at export time
  (`fetchRemoteAttachmentBlob`, see [export-and-save.md](export-and-save.md)).
- On export, all images (data-URI or remote) are rewritten to
  `attachments/<note>-image-N.<ext>` relative paths and the note is exported
  as a folder rather than a single file.

**Known duplication:** `SUPPORTED_IMAGE_TYPES`/`SUPPORTED_IMAGE_EXTENSIONS`
and `getImageExtensionFromUrl` exist independently in both
`lib/note-utils.js` and `sidepanel.js` with slightly different shapes (Set
vs. Map). Adding a new supported image format requires updating both — see
the backlog in [`../plan/roadmap.md`](../plan/roadmap.md). Until that's
consolidated, **always update both locations together** or the two will
silently disagree about what's supported.

## Links

**No toolbar link-insert control.** A toolbar "Link" button existed briefly
(2026-07-10, replacing a native `prompt()` with an in-panel dialog) and was
removed the same day at the product owner's direction, to make room in the
toolbar for the timestamp button without the row overflowing the panel
width — see [roadmap.md](../plan/roadmap.md). The only ways a link ends up
in a note now: it was already there in an imported/reopened note, or the
user typed literal `[text](url)` Markdown syntax and it got converted to a
real `<a>` the next time the note round-trips through `markdownToHtml` (on
reload or reopening from the library) — see
[`markdownToHtml`](../architecture.md) in `lib/note-utils.js`. There is no
live-as-you-type conversion of typed Markdown syntax in the editor.

Every link the app creates (page-selection insertion, links loaded from
Markdown) carries `target="_blank" rel="noopener noreferrer"` and a `title`
hint (`"<url> — ⌘/Ctrl+Click to open"`). Those
attributes alone aren't enough to make links clickable, though: browsers
suppress an `<a>`'s default click-to-navigate behavior inside a
contenteditable region, specifically so users can click into link text to
edit it rather than always navigating away.

Opening a link is therefore an explicit **Cmd/Ctrl+Click**, handled by a
`click` listener on `notesInput` that checks `event.metaKey ||
event.ctrlKey`, resolves the nearest `a[href]` ancestor of the click target,
calls `preventDefault()`, and opens the URL via `chrome.tabs.create` (falling
back to `window.open` if `chrome.tabs` isn't available). A plain click on a
link is left alone — it just places the caret, same as any other click in
the editor. This mirrors the convention used by Notion, Google Docs, and VS
Code's markdown preview.

## Selection insertion

Text captured from the page (see
[page-selection-capture.md](page-selection-capture.md)) is inserted at the
last known caret/insert range via `insertSelectionWithLink`, using the same
"defaults to a code block" treatment as a clipboard paste (see [Code
blocks](#code-blocks) above): the selected text goes in a `<pre><code>`
block, and the clickable link back to the source page is its own paragraph
directly below the block — not inline with the text. Reuses
`insertBlockElement` for the same parent-splitting reasons as paste-as-code.

## Non-goals

- No tables, no nested blockquotes-within-lists, no arbitrary HTML paste
  sanitization beyond what's needed to support the formats above — pasted
  rich content from other apps is not guaranteed to survive round-trip
  faithfully (the Markdown converter only understands the subset the toolbar
  itself produces — see
  [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md)).
