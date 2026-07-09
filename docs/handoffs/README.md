# Handoffs

A handoff is a short, dated log entry an agent writes at the end of a work
session so the next agent (a different session, possibly a different model
or tool entirely) can resume without re-deriving context. This is the
mechanism that makes "multiple agents working together without drift"
actually work in practice — everything else in `docs/` is the stable map;
this is the changelog of who did what and why.

## When to write one

At the end of any session that changed code, made a non-trivial decision, or
investigated something worth remembering even if nothing shipped (e.g. "I
looked into X, here's why I didn't do it"). Skip it for pure Q&A sessions
that touched no files and reached no conclusions worth persisting.

## How

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to
   `docs/handoffs/log/YYYY-MM-DD-NNNN-short-slug.md`, where `NNNN` is a
   4-digit sequence number (per day, starting at `0001`) — this keeps entries
   sortable by filename and avoids collisions when multiple agents work the
   same day.
2. Fill it in. Be concrete: what changed, why, what you verified, what you
   didn't get to, what the next agent should know before touching the same
   area.
3. If your session changed anything `docs/architecture.md`,
   `docs/glossary.md`, `docs/specs/*.md`, or `docs/decisions/` describe,
   make sure those are updated too — the handoff entry documents *that* you
   updated them, it doesn't substitute for updating them.
4. Update [`../plan/roadmap.md`](../plan/roadmap.md) if you finished,
   started, or discovered backlog-worthy work.

## Reading handoffs

Read the most recent 2-3 entries in [`log/`](log/) (sorted by filename —
newest last if you're listing chronologically, so check the tail) before
starting work, in addition to the rest of `docs/`. They're the fastest way to
learn what the immediately preceding agent was mid-thought on.

## What NOT to put in a handoff

- Anything that belongs in a permanent doc instead (architecture facts,
  decisions, specs) — those go in their proper home and get *linked* from
  the handoff, not duplicated into it. A handoff is a session log, not
  another copy of the architecture doc.
- Speculative future work with no grounding — that belongs in
  `docs/plan/roadmap.md`'s backlog, not scattered across handoff entries
  where it'll be hard to find later.
