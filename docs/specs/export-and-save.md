# Spec: Export (Save / Save As)

## Purpose

Turn the in-progress note into a portable `.md` file (plus attachments, if
any) that works well as an Obsidian vault note — this is the actual
deliverable of using the app; the draft (see
[draft-persistence.md](draft-persistence.md)) is scratch state, this is the
output.

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

Both paths independently: build form data, build filename, convert editor
HTML to Markdown, build the full document, rewrite image references via
`buildObsidianImageExport()`.

- **Save** (`handleSave`): `chrome.downloads.download({saveAs:false})`
  first (no dialog); on error, retries with `saveAs:true`.
- **Save As** (`handleSaveAs`): tries `window.showDirectoryPicker()` (File
  System Access API) first, writing files directly via
  `FileSystemDirectoryHandle` if the user's Chrome supports it; otherwise
  falls back to `chrome.downloads.download({saveAs: !hasAttachments})`.

**Known duplication:** these two handlers currently duplicate a large
fraction of this logic with subtly different fallback tiers (see
[`../plan/roadmap.md`](../plan/roadmap.md)). A behavior change to one
(e.g., a new frontmatter field, a new attachment naming rule) must currently
be applied to both or they will silently diverge — until they're
consolidated behind a shared function, **treat any export-logic change as
needing to touch both `handleSave` and `handleSaveAs`**, and verify both
paths manually (see [`AGENTS.md`](../../AGENTS.md) / the repo's `verify`
skill) since there's no automated test coverage for either.

## Non-goals

- No cloud export destinations (Google Drive, Dropbox, etc.) — local
  filesystem only, consistent with
  [ADR-0004](../decisions/0004-local-first-no-telemetry.md).
- No export formats other than Markdown + attachments folder.
