# 0003. Hand-rolled Markdown↔HTML conversion and YAML frontmatter serialization

Status: Accepted
Date: 2026-07-09 (retroactively documented)

## Context

Notes are edited as contenteditable HTML but stored/exported as Markdown.
`lib/note-utils.js` implements `htmlToMarkdown`/`markdownToHtml` as
sequential regex replacements over the specific HTML/Markdown subset the
editor itself produces (bold/italic/code/headings 1-3/lists/blockquote/links/
images/hr/br) — not a general-purpose Markdown parser. Separately,
`toYamlString` in `sidepanel.js` (used to build the frontmatter block) is
`JSON.stringify(String(value))` — not a real YAML encoder, just JSON-string
escaping that happens to also be valid YAML for the scalar strings this
codebase emits (see [ADR-0001](0001-static-unbundled-extension.md): no
dependencies means no pulling in a real YAML/Markdown library).

## Decision

Keep the hand-rolled converters. They only need to round-trip the exact
subset of HTML the editor's toolbar can produce and the exact subset of YAML
this app emits (flat scalars + one list of scalar strings for
`pages_visited`) — not arbitrary external Markdown or YAML.

## Consequences

- **Easier:** zero dependencies (consistent with ADR-0001), full control over
  exact output shape (e.g., the `pages_visited` list-of-markdown-link-strings
  format was chosen specifically because it's what Obsidian's Properties
  panel can render as clickable links — a real generic YAML library wouldn't
  have known to do that).
- **Harder / fragile:** regex-based conversion is order-sensitive and can
  interact in surprising ways with malformed or hand-edited Markdown
  re-imported from outside the extension (nested formatting, mixed list
  types, Markdown from other tools). `toYamlString` would not correctly
  serialize a value containing YAML-significant structure beyond what JSON
  escaping covers — if a future frontmatter field needs anything beyond a
  flat string or a flat list of strings, this needs to be revisited, not
  extended by pattern-matching what's already there.
- **Guardrail:** any new frontmatter field should be modeled as either a
  scalar string or a list of scalar strings. If it needs to be structured
  (nested objects), that's a sign this decision needs to be revisited (write
  a superseding ADR) rather than bolted onto `toYamlString`.
