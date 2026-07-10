# Roadmap & Backlog

Single place to answer "what's currently being worked on, what's next, and
what's known-broken-but-not-urgent." Keep this current — it's the first
thing an agent checks before picking up work (see
[`AGENTS.md`](../../AGENTS.md)). Stale entries here are worse than no
entries; if you finish or abandon something, update this file in that same
change.

## Now

*(Nothing actively in progress as of this writing — this doc structure
itself was the most recent piece of work. See
[handoffs/log/2026-07-09-0001-docs-bootstrap.md](../handoffs/log/2026-07-09-0001-docs-bootstrap.md).)*

## Next (suggested, unordered — pick based on what you're actually asked to
do; this isn't a mandate)

- Add real unit tests for `lib/note-utils.js` (filename building,
  Markdown↔HTML conversion). It's pure, dependency-free, and CI already runs
  `node --test` — it's just testing nothing right now (see Known Issues #10).
  This is the highest-leverage low-risk improvement available: it would
  catch regressions in the export path that currently has zero automated
  coverage.
- Consider promoting `detachedWindows`/`openPanelTabs` in `background.js`
  from in-memory `Map`/`Set` to `chrome.storage.session`, closing the
  service-worker-eviction gap described in
  [ADR-0002](../decisions/0002-storage-local-shared-state.md). Write a new
  ADR if you do this.
- **Note library — storage + browsable list + bulk export (scoped, ready to
  implement).** Originally two open-ended proposals ("durable storage" and
  "browser with frontmatter search/linking"); scoped down on 2026-07-09 at
  the product owner's direction to explicitly **drop linking** and keep this
  to storage plus a flat, searchable, reverse-chronological list — closer to
  Evernote, not Obsidian's graph. A bulk **"export all notes"** command was
  added to the scope the same day — explicitly a follow-on that depends on
  the storage piece existing first, reusing the existing per-note export
  mechanics in a loop rather than a new export format. Fully scoped in
  [ADR-0006](../decisions/0006-note-library-via-indexeddb.md) (Proposed —
  IndexedDB, scoped to the panel document, entries created only on explicit
  Save/Save As, verified storage capacity is disk-space-bound not a small
  fixed cap) and [note-library.md](../specs/note-library.md) (behavior spec,
  written ahead of implementation, includes the bulk-export command). A few
  open questions are left for implementation time (see that spec's "Open
  questions" section) — this is ready to pick up, not blocked on further
  scoping. Implementation order within this item: storage/list first, bulk
  export second (it has nothing to export until the library exists).

## Proposed features (requested, not yet scoped or started)

These came directly from the product owner as "next steps" — bigger than the
tech-debt backlog below, and each likely needs its own investigation/spec
before implementation starts. **Each of these touches a documented ADR** —
read the linked ADR before starting, and expect to write a new ADR
(superseding or extending it) rather than just coding around it, per the
ground rules in [`AGENTS.md`](../../AGENTS.md).

1. **Syntax highlighting for code blocks.** Fenced code blocks and
   `==highlighted text==` shipped 2026-07-09 (see Resolved below) —
   plain/unhighlighted code blocks only. Actual *syntax* highlighting
   (colorizing keywords/strings/etc. by language) was deliberately punted at
   the product owner's direction, since it almost certainly needs a
   highlighting library (highlight.js/Prism) or a meaningful hand-rolled
   tokenizer. A library pull-in directly conflicts with
   [ADR-0001](../decisions/0001-static-unbundled-extension.md) ("no npm
   dependencies") — this needs an explicit ADR decision (accept the
   dependency and supersede/amend ADR-0001, or commit to hand-rolling a
   minimal tokenizer) before implementation starts, not a silent
   `npm install`.

## Known issues / tech debt backlog

Ordered roughly by how much a change is likely to accidentally interact with
each — not by strict priority. When you fix one, move it to a "Resolved"
section below with the date and a one-line pointer to the fix, don't just
delete it (keeps the history legible instead of silently vanishing).

1. **Duplicated image-format constants** — `SUPPORTED_IMAGE_TYPES`/
   `SUPPORTED_IMAGE_EXTENSIONS`/`getImageExtensionFromUrl` defined
   independently in `lib/note-utils.js` and `sidepanel.js` with different
   shapes (Set vs. Map). See
   [rich-text-editor.md](../specs/rich-text-editor.md#images). Fix: single
   definition in `lib/note-utils.js`, `sidepanel.js` imports/reuses it.
2. **Duplicated Save/Save As logic** — `handleSave`/`handleSaveAs` in
   `sidepanel.js` share ~120 lines of near-identical logic with subtly
   different fallback tiers. See
   [export-and-save.md](../specs/export-and-save.md). Fix: extract the
   shared build-document-and-attachments logic into one function, leave only
   the actual write-to-disk mechanism (`downloads` vs. directory picker)
   distinct per handler.
3. **In-memory-only background state lost on service-worker eviction** —
   `detachedWindows`, `openPanelTabs`, `debugLogs` in `background.js`. See
   [ADR-0002](../decisions/0002-storage-local-shared-state.md) and
   [panel-detach-reattach.md](../specs/panel-detach-reattach.md#known-fragility).
   Fix candidate: `chrome.storage.session`.
4. **Global mutable state in `sidepanel.js`** — ~15 top-level `let` bindings
   closed over by dozens of functions, no encapsulation. See
   [ADR-0005](../decisions/0005-single-file-sidepanel-controller.md). Not an
   urgent fix on its own; watch for it causing actual bugs (a new code path
   forgetting to update related state) before undertaking a broader refactor.
5. **Hand-rolled YAML frontmatter serialization** (`toYamlString` is just
   `JSON.stringify`) — fine for the current flat-scalar/flat-list usage, will
   break silently if a future field needs real structure. See
   [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md).
6. **Regex-based Markdown↔HTML converter** — only handles the exact subset
   the editor's own toolbar produces; fragile against hand-edited or
   externally-authored Markdown re-imported into the app. See
   [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md).
7. **`PANEL_STATE` message type is dead code** — defined in `background.js`,
   never sent by any current caller. Either wire it up or remove it; leaving
   it is a small but real source of confusion about what the actual message
   protocol is (see [`../architecture.md`](../architecture.md#message-passing)).
8. **CI is a no-op** — `.github/workflows/ci.yml` runs `node --test`, which
   currently passes vacuously because there are no test files. This gives
   false confidence. Directly related to backlog item #1 above (write the
   tests) — until then, treat CI green as meaning nothing about export
   correctness.
9. **Version string kept in sync by hand in three places** —
   `package.json`, `manifest.json`, and a hardcoded `v. 1.2.1` string in
   `sidepanel.html`. No build step enforces consistency (see
   `GO_LIVE_PLAN.md`/`RELEASE_CHECKLIST.md`, which already call this out as a
   manual release step). Low priority unless it starts causing actual
   release mistakes.
10. **DOM lookups by ID with no failure signal** — all top-level
    `getElementById` consts in `sidepanel.js`, mostly accessed via optional
    chaining, so a renamed `id` in `sidepanel.html` fails silently (element
    becomes `null`, downstream code just no-ops) instead of erroring loudly.
    Worth a lint rule or startup assertion if this ever causes a real bug
    during a refactor.

## Resolved

- **Docked panel note changed while switching tabs** — fixed 2026-07-10.
  Normal docked opens now prefer window-scoped side-panel presentation, tab
  activation no longer creates tab-specific panel options, note titles stop
  auto-following active tabs once the editor has content, and visited-page
  history is persisted in `noteDraft` so one Markdown note can accumulate
  sources across multiple articles/tabs.
- **Code blocks + text highlighting** — shipped 2026-07-09. Toggleable
  toolbar buttons for fenced code blocks (`<pre><code>`) and
  Obsidian-style `==highlight==` (`<mark>`), both round-tripping to/from
  Markdown. Along the way, fixed two real contenteditable bugs (empty
  code-block placeholder text losing its tag on select-and-type; Enter
  inside a code block splitting into a new paragraph instead of a line
  break within it) and a latent Markdown-converter bug (code containing
  `**`/`==` getting spuriously bolded/highlighted by later regex passes —
  now protected via a stash/restore mechanism). Syntax highlighting
  (colorizing by language) was explicitly out of scope — see the
  remaining item above. Details in
  [rich-text-editor.md](../specs/rich-text-editor.md).
- **"Saved locally" toast flashing a button shape during fade-out** — fixed
  2026-07-09. `is-ambient`/`is-error` classes were removed in the same tick
  as `is-visible`, snapping the toast back to its default pill styling
  mid-transition. Fixed by deferring the class removal until after the CSS
  transition completes. (`sidepanel.js`, `showToast`.)
- **`pages_visited` frontmatter unreadable/not clickable in Obsidian** —
  fixed 2026-07-09. Was emitted as nested `title`/`url` YAML objects, which
  Obsidian's Properties panel can't type and falls back to raw JSON text
  for. Changed to a flat list of `"[title](url)"` markdown-link strings,
  which Obsidian renders as real clickable links. See
  [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md) and
  [export-and-save.md](../specs/export-and-save.md).
