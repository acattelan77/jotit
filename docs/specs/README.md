# Feature Specs

Each file here describes the *expected behavior* of one feature area — what
it should do, including edge cases that are easy to accidentally regress.
These describe intended behavior, not implementation; for the "how," see
[`../architecture.md`](../architecture.md) and the code itself.

Consult the relevant spec before changing that feature. Update the spec in
the same change if you deliberately change the behavior it describes — an
unreviewed behavior change that leaves the spec stale is exactly the kind of
drift this doc structure exists to prevent (see
[`AGENTS.md`](../../AGENTS.md)).

## Index

| Spec | Covers |
|---|---|
| [draft-persistence.md](draft-persistence.md) | Autosave, draft restore on reopen, New note / clear |
| [rich-text-editor.md](rich-text-editor.md) | Formatting toolbar, keyboard shortcuts, image paste/drop |
| [page-selection-capture.md](page-selection-capture.md) | Capturing and inserting selected page text |
| [panel-detach-reattach.md](panel-detach-reattach.md) | Docked ↔ standalone window behavior |
| [context-title-suggestion.md](context-title-suggestion.md) | Auto-title, title lock, per-host suggestions |
| [date-time-picker.md](date-time-picker.md) | Meeting date/time controls |
| [export-and-save.md](export-and-save.md) | Save, Save As, Markdown/YAML output, attachments |
| [note-library.md](note-library.md) | Browsing/searching/reopening/bulk-exporting past saved notes |
