# Working on Jot it! — Agent Entry Point

This file is the front door for any AI agent (or human) picking up work in this
repo. Read it before touching code. It exists so multiple agents, working in
separate sessions with no shared memory, stay coherent instead of drifting —
reinventing decisions, contradicting each other, or rediscovering the same
tech debt from scratch every time.

## What this project is

Jot it! is a Chrome (MV3) side-panel extension for taking quick notes while
browsing — meetings, video calls, reading. It's a small, static, unbundled
JS codebase (no build step, no framework, no dependencies). See
[`docs/architecture.md`](docs/architecture.md) for what it actually does.

## Read in this order

1. **This file** — ground rules.
2. [`docs/architecture.md`](docs/architecture.md) — runtime contexts, message
   flows, data model. The system as it exists today.
3. [`docs/glossary.md`](docs/glossary.md) — shared vocabulary and the
   module-responsibility map for `sidepanel.js`. Use these terms; don't invent
   new ones for the same concept.
4. [`docs/plan/roadmap.md`](docs/plan/roadmap.md) — what's currently being
   worked on, what's next, and the known-issues backlog. This is the "what
   should I do" answer.
5. [`docs/decisions/`](docs/decisions/) — why the codebase looks the way it
   does. Skim the index before proposing an architectural change; if a
   decision record already covers it, don't relitigate it without writing a
   new ADR that explicitly supersedes the old one.
6. [`docs/specs/`](docs/specs/) — per-feature expected behavior, consulted
   when changing that feature.
7. [`docs/handoffs/log/`](docs/handoffs/log/) — most recent entries first.
   Read the last 2-3 to know what the previous agent(s) did and left
   unfinished.

## Ground rules (how to avoid drift)

- **One source of truth per fact.** Architecture lives in `docs/architecture.md`,
  not copied into code comments or re-explained in every spec. If you find a
  doc restating something another doc already owns, delete the copy and link
  instead.
- **Docs are updated in the same change as the code they describe.** If you
  change a message type, a storage key, a module boundary, or a save/export
  flow, update `docs/architecture.md` and/or the relevant `docs/specs/*.md`
  in the same commit. A code change that invalidates a doc without updating
  it is an incomplete change.
- **Structural/architectural decisions get an ADR.** Introducing a build
  step, changing the storage model, splitting `sidepanel.js` into modules,
  adding a dependency, changing the message-passing protocol — write a new
  file in `docs/decisions/` (copy `docs/decisions/TEMPLATE.md`). Don't just
  do it and move on; the next agent needs to know it was deliberate and why.
- **Don't silently undo a documented decision.** If an ADR explains why
  something is the way it is and you think it's wrong, write a new ADR that
  supersedes it (link both ways) rather than changing the code and leaving
  the old ADR stale and contradictory.
- **End every work session with a handoff entry.** See
  [`docs/handoffs/README.md`](docs/handoffs/README.md). This is what lets the
  next agent (possibly you, possibly not) resume without re-deriving context.
- **Match existing conventions before introducing new ones.** This is a
  single-file, vanilla-JS, no-build codebase on purpose (see
  [ADR-0001](docs/decisions/0001-static-unbundled-extension.md)). Don't add a
  bundler, a framework, or a package dependency without an ADR justifying the
  change in direction.
- **Local-first, no telemetry, no external calls beyond what's needed for the
  feature.** See [ADR-0004](docs/decisions/0004-local-first-no-telemetry.md).
  Any new feature that would phone home to a non-user-specified server is out
  of scope by default.

## Where things actually live (quick map)

| Concern | File |
|---|---|
| Service worker (background) | `background.js` |
| Side panel UI + all app logic | `sidepanel.js`, `sidepanel.html`, `sidepanel.css` |
| Content script (page selection capture) | `content-selection.js` |
| Shared/pure helpers (filename, markdown conversion) | `lib/note-utils.js` |
| Extension manifest | `manifest.json` |
| Static design mockups (not live code) | `design-system/` — see `docs/decisions/` note on this |
| Release process | `RELEASE_CHECKLIST.md`, `GO_LIVE_PLAN.md` |
| Privacy stance | `PRIVACY.md` |

## Before you start coding

- Check `docs/plan/roadmap.md` for the current priority and any in-progress
  work another agent already claimed.
- Check `docs/handoffs/log/` for unfinished threads.
- If your task touches a documented feature, read its spec in `docs/specs/`
  first so you don't regress documented edge-case behavior.

## When you're done

- Update `docs/plan/roadmap.md` if you completed, started, or discovered
  work.
- Update any `docs/specs/*.md` or `docs/architecture.md` your change
  invalidated.
- Write a handoff entry (`docs/handoffs/README.md` has the template and
  naming convention).
