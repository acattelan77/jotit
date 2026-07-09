# Spec: Rich Text Editor

## Purpose

A lightweight formatting toolbar over a contenteditable region — enough
structure for readable notes, not a full word processor.

## Supported formatting

Bold, italic, heading, bullet list, numbered list, inline code, links — via
`applyFormat()`, implemented with `document.execCommand` plus manual DOM
surgery for headings (execCommand's heading support is inconsistent across
browsers, hence the manual handling).

Keyboard shortcuts: Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic). Toolbar button
active-state reflects current selection formatting via
`updateToolbarState()`.

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

## Selection insertion

Text captured from the page (see
[page-selection-capture.md](page-selection-capture.md)) is inserted at the
last known caret/insert range, wrapped in `<em>` plus a link back to the
source page — this happens through the same editor insertion path as manual
typing, not a special-cased side channel.

## Non-goals

- No tables, no nested blockquotes-within-lists, no arbitrary HTML paste
  sanitization beyond what's needed to support the formats above — pasted
  rich content from other apps is not guaranteed to survive round-trip
  faithfully (the Markdown converter only understands the subset the toolbar
  itself produces — see
  [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md)).
