# 2026-07-09 — Docs bootstrap + two bug fixes

Agent/session: Claude Code (Sonnet 5)

## What I did

1. Fixed a UI bug: the "Saved locally" toast briefly flashed into a
   button/pill shape during its fade-out animation. Root cause: `showToast()`
   in `sidepanel.js` removed `is-ambient`/`is-error` in the same tick as
   `is-visible`, snapping the toast back to its default (non-ambient) pill
   styling — background, padding, box-shadow — while only opacity/transform
   were CSS-transitioned. Fixed by deferring the class cleanup until after
   the transition duration elapses. Committed as `440618a`.
2. Fixed the exported `pages_visited` YAML frontmatter being unreadable in
   Obsidian: it was a nested `title`/`url` object per entry, which Obsidian's
   Properties panel can't type and falls back to displaying as raw JSON
   text (no clickable link, "?" unknown-type icon). Changed to a flat list
   of `"[title](url)"` markdown-link strings, which Obsidian *does* render
   as clickable links in a text/list-type property. Same commit (`440618a`).
   Also manually fixed one already-exported note file outside the repo
   (`~/42/_inbox/...Introducing Portent....md`) to match.
3. Bootstrapped this entire `docs/` + `AGENTS.md` structure from scratch —
   this repo had no prior agent-facing documentation. Did a full read of
   every source file (`manifest.json`, `background.js`,
   `content-selection.js`, `lib/note-utils.js`, `sidepanel.js`,
   `sidepanel.html`, plus `README.md`/`PRIVACY.md`/`GO_LIVE_PLAN.md`/
   `RELEASE_CHECKLIST.md`) to ground the docs in actual current behavior,
   not aspirational description.

## Why

The user explicitly asked for a "proper software development project"
structure — specs, architecture, design decisions, implementation plan,
handoffs — specifically so multiple AI agents working across separate
sessions can stay coherent without drifting (re-deriving context badly,
contradicting earlier decisions, or losing track of known issues). See
`AGENTS.md` for the resulting ground rules.

The two bug fixes predate the docs-bootstrap request (came from earlier in
the same conversation) but are included here since they were the most
recent code changes and are referenced from `docs/plan/roadmap.md`'s
Resolved section.

## Verified

- Toast fix: verified in an isolated static HTML harness (copied
  `sidepanel.css`, reimplemented `showToast()` verbatim) using a
  MutationObserver to log class/style state through the full show→hide
  cycle. Confirmed `is-ambient` (transparent background, zero padding)
  persists through the entire opacity fade and is only removed after
  opacity has already reached 0 — no more pill-shape flash.
- Frontmatter fix: verified the generated YAML shape directly (`node -e`
  reproducing the serialization logic) and manually confirmed the flat
  markdown-link-string form is what Obsidian's Properties panel needs to
  render a link (based on Obsidian's documented behavior for text/list
  frontmatter properties — not independently re-verified inside Obsidian
  itself in this session; if you touch this again, consider actually
  opening the exported file in Obsidian to confirm rendering).
- Docs: no automated verification possible (they're documentation); relied
  on the full source-file read summarized above to ground every factual
  claim in actual code, not assumption. Cross-checked line-range claims
  against the files at time of writing — if they've drifted since, they'll
  need correcting (see `AGENTS.md` ground rules on this).

## Docs updated

This session *created* the docs structure, so "updated" isn't quite the
right frame — full list of what now exists:
`AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/glossary.md`,
`docs/decisions/{README,TEMPLATE,0001-0005}.md`,
`docs/specs/{README,draft-persistence,rich-text-editor,
page-selection-capture,panel-detach-reattach,context-title-suggestion,
date-time-picker,export-and-save}.md`, `docs/plan/roadmap.md`,
`docs/handoffs/{README,TEMPLATE}.md`, this file.

## Left for next time

- The commit for the two bug fixes (`440618a`) is local-only — pushing
  directly to `main` was blocked by this environment's auto-mode
  classifier (no PR-bypass override available even with explicit user
  confirmation). The user was told to either push it themselves or have a
  future session open a branch + PR instead. **Check `git log`/`git status`
  before assuming this is on `origin/main`.**
- `docs/plan/roadmap.md`'s "Next" section lists two suggested (not
  mandated) pieces of follow-up work: adding real unit tests for
  `lib/note-utils.js` (CI currently runs `node --test` against zero test
  files, so it's a no-op gate), and considering promoting
  `background.js`'s in-memory `detachedWindows`/`openPanelTabs` to
  `chrome.storage.session` to survive service-worker eviction. Neither was
  started — they're backlog, not in-progress.
- This is the first handoff entry, so there's no prior one to reconcile
  against. Future agents: actually use this log — read the last 2-3 entries
  before starting, per `docs/handoffs/README.md`.
