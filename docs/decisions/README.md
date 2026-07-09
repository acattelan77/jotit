# Architecture Decision Records

ADRs capture *why* the codebase looks the way it does, so a future agent
doesn't "helpfully" undo a deliberate choice without realizing it was
deliberate. Numbered chronologically, never renumbered or deleted.

## When to write one

Any change that a future contributor might reasonably reverse without this
context: build tooling, dependency additions, storage/data-model shape,
message-passing protocol, module boundaries, privacy/telemetry stance,
cross-cutting conventions. Bug fixes and feature additions that don't change
one of those don't need an ADR — put that context in the relevant
`docs/specs/*.md` or a handoff entry instead.

## How to write one

1. Copy [`TEMPLATE.md`](TEMPLATE.md) to `NNNN-short-slug.md`, next number in
   sequence.
2. Fill in Context / Decision / Consequences. Be honest about tradeoffs —
   the point is to save the next agent from re-litigating this blind, not to
   justify the choice unconditionally.
3. Link it from [`AGENTS.md`](../../AGENTS.md) if it's foundational enough
   that every agent should know it up front (most aren't — only add the ones
   that would otherwise get silently violated).
4. If it reverses an earlier ADR, set that ADR's status to `Superseded by
   NNNN` and link both ways.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-static-unbundled-extension.md) | Static, unbundled extension — no build step, no dependencies | Accepted |
| [0002](0002-storage-local-shared-state.md) | `chrome.storage.local` as the only cross-context shared state | Accepted |
| [0003](0003-hand-rolled-markdown-conversion.md) | Hand-rolled Markdown↔HTML conversion and YAML frontmatter serialization | Accepted |
| [0004](0004-local-first-no-telemetry.md) | Local-first, no telemetry, no external servers | Accepted |
| [0005](0005-single-file-sidepanel-controller.md) | Single-file `sidepanel.js` controller instead of split modules | Accepted |
| [0006](0006-note-library-via-indexeddb.md) | Local note library, stored in IndexedDB, scoped to the panel document | Proposed |
