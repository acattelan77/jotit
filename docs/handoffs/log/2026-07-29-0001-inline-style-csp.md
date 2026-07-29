# 2026-07-29 — Inline-style CSP fix

Agent/session: Codex (GPT-5)

## What I did

Fixed rich-text editor paths that could let Chrome try to apply inline
`style` attributes under the extension page CSP:

- Added `forceSemanticEditorFormatting()`, which calls
  `document.execCommand("styleWithCSS", false, false)` before browser editing
  commands.
- Added inline-style cleanup for restored Markdown, formatting commands,
  paste/drop text insertion, ordinary editor input, and DOM mutations under
  `#notes`.
- Kept `manifest.json` strict; no `unsafe-inline` was added.
- Added an integrity test that guards the CSP-compatible editor behavior.

## Why

Chrome reported: `Applying inline style violates ... style-src 'self'`.
Since ADR-0001 documents a static extension with a strict CSP, the right fix
is to prevent and strip browser-generated inline styles rather than weaken the
manifest policy.

## Verified

- `node --test test/repository-integrity.test.js`: passed.
- `node --check sidepanel.js`: passed.
- `npm test`: passed.
- `jq empty manifest.json`: passed.
- `git diff --check`: passed.

## Docs updated

- Updated `docs/specs/rich-text-editor.md` with the inline-style/CSP invariant.
- Added this fix to `docs/plan/roadmap.md` Resolved.
- Added this handoff entry.

## Left for next time

Reload the unpacked extension in Chrome and confirm the original console
warning is gone while using Bold/Italic, code blocks, paste into code blocks,
and normal typing.
