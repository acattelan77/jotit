# Spec: Export (Save / Save As)

## Purpose

Turn the in-progress note into a portable `.md` file (plus attachments, if
any) that works well as an Obsidian vault note. Save and Save As are still
disk-export actions, not a separate "save to library" workflow; since
[ADR-0007](../decisions/0007-autosave-to-library.md), the
[note library](note-library.md) is maintained by autosave. Export actions
must, however, flush the visible editor state through that same autosave path
before preparing/writing the file. This keeps the exported file, local draft,
and library entry from diverging when the user exports immediately after an
edit.

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

- **Save** (`handleSave`): when a save folder is remembered (see below),
  writes into it with `exportService.writeNoteToDirectory()`; otherwise
  `chrome.downloads.download({saveAs:false})` first (no dialog); on error,
  retries with `saveAs:true`. It calls `saveDraft()` before reading form
  data for export.
- **Save As** (`handleSaveAs`): tries `window.showDirectoryPicker()` (File
  System Access API) first, writing files directly via
  `FileSystemDirectoryHandle` if the user's Chrome supports it; otherwise
  falls back to `chrome.downloads.download({saveAs: !hasAttachments})`.
  When invoked by a Chrome extension command, it deliberately skips the
  directory picker (which requires a direct panel click) and uses the Chrome
  Downloads Save As dialog instead. When the directory picker is used, the
  picker must run before `saveDraft()` to preserve Chrome's user-gesture
  requirement; after the picker returns, `saveDraft()` runs before export
  construction.

The write mechanisms remain intentionally distinct: Save uses Downloads with
a Save As fallback, while Save As prefers the File System Access API. Changes
to export construction belong in `panel/export-service.mjs`; changes to
handler orchestration still need both paths verified.

## Remembered save folder

See [ADR-0010](../decisions/0010-remembered-save-folder.md).

- The footer shows "Save to: <folder name>" (default "Downloads"). Clicking
  it opens `showDirectoryPicker({ mode: "readwrite" })`; the handle is
  stored in IndexedDB (`panel/save-folder.mjs`). The × button next to it
  clears the folder and Save returns to Downloads.
- When set, **Save** and the library row **Save .md** action write into the
  folder with the same layout as Downloads: a bare `.md` for notes without
  images, `<slug>/<file>.md` + `attachments/` otherwise. An existing `.md`
  is not overwritten — the new file gets a ` (1)`, ` (2)`… suffix, like
  `chrome.downloads`' `uniquify`.
- **Save As** and **Export all** keep their own picker but open it in the
  remembered folder (`startIn`).
- Access is checked before `saveDraft()` so Chrome's permission prompt still
  has the click's user gesture. Every failure is reported and nothing is
  written to Downloads instead:
  - prompt denied → error toast "Access to "<name>" was not allowed.";
  - no user gesture (Chrome command shortcut) → error toast
    "Click Save to allow access to "<name>".";
  - write error (folder moved or deleted) → error toast + alert asking to
    choose the folder again.

**Export all** also flushes the current editor draft before listing library
entries, otherwise the current note can be missing the user's last edit in the
bulk export.

## Non-goals

- No cloud export destinations (Google Drive, Dropbox, etc.) — local
  filesystem only, consistent with
  [ADR-0004](../decisions/0004-local-first-no-telemetry.md).
- No export formats other than Markdown + attachments folder.
