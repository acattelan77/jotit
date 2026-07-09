# 2026-07-09 — Scoped the note-library feature, dropped linking

Agent/session: Claude Code (Sonnet 5)

## What I did

Turned the two open-ended "durable storage" and "in-app note browser with
linking" proposals from the previous session
([2026-07-09-0001](2026-07-09-0001-docs-bootstrap.md)) into one scoped,
implementation-ready feature: a **note library** — storage plus a flat,
searchable, reverse-chronological list of past saved notes. Explicitly
dropped note-to-note linking/backlinks/graph-view at the product owner's
direction — the app stays a fast-capture tool that feeds Obsidian, not a
reimplementation of Obsidian's linking.

Concretely:
- Wrote [ADR-0006](../../decisions/0006-note-library-via-indexeddb.md)
  (Status: Proposed) — decided IndexedDB over scaling up
  `chrome.storage.local`, scoped to the panel document, entries created
  only on explicit Save/Save As (never from the autosaved draft), re-saving
  a library-opened note updates its existing entry rather than duplicating.
  Also recorded the actual data-loss risk this defends against (extension
  uninstall / broad "clear site data," not normal cache clearing) and
  explicitly positioned the library as a convenience index, not the source
  of truth — the exported `.md` file remains that.
- Wrote [`docs/specs/note-library.md`](../../specs/note-library.md) — behavior
  spec written ahead of implementation (marked as such, with instructions to
  correct/remove the notice once built), covering entry creation, browsing,
  search, opening, deleting, and an explicit non-goals list.
- Updated `docs/plan/roadmap.md`: removed the old unscoped items 1 & 2 from
  "Proposed features," replaced with a single "Next" entry pointing at the
  ADR + spec (this is now ready to pick up, not blocked on further scoping).
  Renumbered the remaining "code blocks/highlighting" item to 1.
- Updated `docs/glossary.md` with a **Note library** term entry, and
  `docs/decisions/README.md` / `docs/specs/README.md` indexes.

## Why

The user asked, in an exploratory exchange, "what could we realistically
add without overdoing it" — I recommended storage + a searchable note list
while explicitly recommending against in-app linking (Obsidian already does
that better once a note is exported). The user agreed and said to scope out
storage + note-list and drop linking. This session turned that verbal
decision into the durable artifacts (ADR + spec + roadmap update) per this
repo's own ground rules in `AGENTS.md` — a scoping decision like this is
exactly the kind of thing that should be written down, not left as
conversation history that the next agent can't see.

## Verified

Documentation only, no code changes this session. Verified all new/changed
markdown cross-references resolve to real files (ran a link-check script
over every `.md` file in the repo; the only "broken" hits are false
positives from inline code examples like `` `![alt](src)` ``, already known
from the previous session).

## Docs updated

`docs/decisions/0006-note-library-via-indexeddb.md` (new),
`docs/decisions/README.md`, `docs/specs/note-library.md` (new),
`docs/specs/README.md`, `docs/plan/roadmap.md`, `docs/glossary.md`, this
file.

## Left for next time

- **Nothing implemented yet** — ADR-0006 is Status: Proposed, not Accepted.
  Whoever picks up the note-library work should read
  [ADR-0006](../../decisions/0006-note-library-via-indexeddb.md) and
  [`docs/specs/note-library.md`](../../specs/note-library.md) in full first,
  resolve the "Open questions" section in the spec during implementation
  (exact IndexedDB schema, `navigator.storage.persist()` decision, where the
  list/search UI lives in the 380px panel layout), and flip the ADR to
  Accepted once it ships.
- The "code blocks + syntax highlighting" proposal (now item 1 under
  "Proposed features") is still fully unscoped — in particular the syntax
  -highlighting sub-part conflicts with
  [ADR-0001](../../decisions/0001-static-unbundled-extension.md)'s
  no-dependencies stance and needs an explicit decision before anyone starts
  coding it.
- Nothing was committed this session yet — see whether the user wants this
  committed/pushed same as prior sessions' work.
