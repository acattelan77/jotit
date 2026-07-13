# Spec: Export (Save / Save As)

## Purpose

Turn the in-progress note into a portable `.md` file (plus attachments, if
any) that works well as an Obsidian vault note. **This is disk export
only.** Since [ADR-0007](../decisions/0007-autosave-to-library.md), Save and
Save As have no other effect — they don't touch the
[note library](note-library.md), which is kept up to date automatically by
autosave regardless of whether the user ever exports. Don't reintroduce a
library-write side effect here; if you're tempted to, read ADR-0007 first —
that's exactly the design it replaced.

## Output shape

See [`../architecture.md`](../architecture.md#exported-markdown) for the
exact frontmatter/body structure. Key points worth restating here because
they're easy to regress:

- `pages_visited` entries are **flat markdown-link strings**
  (`"[title](url)"`), not nested `{title, url}` objects. This is required
  for Obsidian's frontmatter Properties panel to render them as clickable
  links — nested object arrays fall back to unstyled raw JSON display in
  Obsidian. See [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md).
  **Do not reintroduce the nested form.**
- Filenames: `"YYYY-MM-DD - hHH:MM - <safe title>.md"`
  (`NoteUtils.buildFilename`).
- Notes containing images export as a **folder**:
  `<slugified-title>/<filename>.md` + `<slugified-title>/attachments/<note>-image-N.<ext>`.
  Notes with no images export as a single `.md` file — don't force the
  folder structure unconditionally, it's specifically gated on
  `hasAttachments`.

## Save vs. Save As

Both paths use `exportService.prepareNoteExport()`
(`panel/export-service.mjs`) to build form data, filename, Markdown,
frontmatter, and rewritten image attachments once.

- **Save** (`handleSave`): `chrome.downloads.download({saveAs:false})`
  first (no dialog); on error, retries with `saveAs:true`.
- **Save As** (`handleSaveAs`): tries `window.showDirectoryPicker()` (File
  System Access API) first, writing files directly via
  `FileSystemDirectoryHandle` if the user's Chrome supports it; otherwise
  falls back to `chrome.downloads.download({saveAs: !hasAttachments})`.
  When invoked by a Chrome extension command, it deliberately skips the
  directory picker (which requires a direct panel click) and uses the Chrome
  Downloads Save As dialog instead.

The write mechanisms remain intentionally distinct: Save uses Downloads with
a Save As fallback, while Save As prefers the File System Access API. Changes
to export construction belong in `panel/export-service.mjs`; changes to
handler orchestration still need both paths verified.

## Non-goals

- No cloud export destinations (Google Drive, Dropbox, etc.) — local
  filesystem only, consistent with
  [ADR-0004](../decisions/0004-local-first-no-telemetry.md).
- No export formats other than Markdown + attachments folder.
