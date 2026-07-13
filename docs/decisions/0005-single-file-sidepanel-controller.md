# 0005. Single-file `sidepanel.js` controller instead of split modules

Status: Superseded by [ADR-0009](0009-native-sidepanel-modules.md)
Date: 2026-07-09 (retroactively documented)

## Context

`sidepanel.js` is ~2000 lines covering toast notifications, storage helpers,
title/context suggestion, page-visit history, caret persistence, rich-text
formatting, image handling, Markdown/YAML export, draft persistence,
save/save-as, incoming-selection handling, tab listeners, and a full
date/time picker — all as top-level functions and `let`/`const` bindings in
one file, with over 30 `document.getElementById` globals at the top (see
the historical region map that was replaced by the current
[`docs/glossary.md`](../glossary.md#side-panel-module-map). This was treated as
a direct consequence of
[ADR-0001](0001-static-unbundled-extension.md): no bundler means no ES
module graph without extra script tags and CSP considerations, and no
build step to enforce module boundaries even if `type="module"` were used.

## Decision

Keep `sidepanel.js` as one file, organized into clearly delimited regions
(see `docs/glossary.md`) rather than splitting into multiple script files or
ES modules, for now.

This temporary decision was superseded on 2026-07-11 after the coupling risks
described below caused concrete state and export bugs. See
[ADR-0009](0009-native-sidepanel-modules.md).

## Consequences

- **Easier:** no import/export wiring, no load-order footguns from multiple
  `<script>` tags, single place to `grep` for anything panel-related, no risk
  of a module boundary being wrong in a way that only manifests at runtime
  (MV3's CSP makes debugging broken module loading annoying).
- **Harder:** global mutable state (~15 top-level `let` bindings) is closed
  over by dozens of functions with no encapsulation — easy to add a new code
  path that forgets to update related state (e.g., a new "insert content"
  function that forgets to update `lastNotesRange`/`lastCaretOffset` would
  silently break caret restore). DOM lookups by ID have no central registry;
  a renamed `id` in `sidepanel.html` silently breaks the corresponding
  `const` to `null`, usually masked by optional chaining rather than failing
  loudly. Duplicated logic between `handleSave`/`handleSaveAs` and between
  `lib/note-utils.js`'s and `sidepanel.js`'s own copies of image-format
  constants (see [`docs/plan/roadmap.md`](../plan/roadmap.md)) is a direct
  symptom of no shared-module boundary enforcing single-definition.
- **Revisit when:** the file's size or the state-coupling problem starts
  actively causing bugs (not just aesthetic discomfort). If/when that
  happens, the fix is `type="module"` script tags (still no bundler needed)
  plus splitting along the existing region boundaries in
  `docs/glossary.md` — write a superseding ADR before doing that split so
  it's a deliberate, documented restructure rather than an incidental
  side-effect of an unrelated feature change.
