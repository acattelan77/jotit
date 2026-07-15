# Roadmap & Backlog

Single place to answer "what's currently being worked on, what's next, and
what's known-broken-but-not-urgent." Keep this current — it's the first
thing an agent checks before picking up work (see
[`AGENTS.md`](../../AGENTS.md)). Stale entries here are worse than no
entries; if you finish or abandon something, update this file in that same
change.

## Now

*(Nothing actively in progress. The native side-panel module refactor is
complete; see Resolved below. Syntax highlighting and the remaining tech-debt
backlog are on hold per the product owner's direction — don't pick those up
without being asked.)*

## Next (suggested, unordered — pick based on what you're actually asked to
do; this isn't a mandate)

- Consider promoting `detachedWindows`/`openPanelTabs` in `background.js`
  from in-memory `Map`/`Set` to `chrome.storage.session`, closing the
  service-worker-eviction gap described in
  [ADR-0002](../decisions/0002-storage-local-shared-state.md). Write a new
  ADR if you do this.

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

1. **In-memory-only background state lost on service-worker eviction** —
   `detachedWindows`, `openPanelTabs`, `debugLogs` in `background.js`. See
   [ADR-0002](../decisions/0002-storage-local-shared-state.md) and
   [panel-detach-reattach.md](../specs/panel-detach-reattach.md#known-fragility).
   Fix candidate: `chrome.storage.session`.
2. **Hand-rolled YAML frontmatter serialization** (`toYamlString` is just
   `JSON.stringify`) — fine for the current flat-scalar/flat-list usage, will
   break silently if a future field needs real structure. See
   [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md).
3. **Regex-based Markdown↔HTML converter** — only handles the exact subset
   the editor's own toolbar produces; fragile against hand-edited or
   externally-authored Markdown re-imported into the app. See
   [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md).
4. **Version string kept in sync by hand in three places** —
   `package.json`, `manifest.json`, and a hardcoded `v. 1.3.0` string in
   `sidepanel.html`. No build step enforces consistency (see
   `GO_LIVE_PLAN.md`/`RELEASE_CHECKLIST.md`, which already call this out as a
   manual release step). Low priority unless it starts causing actual
   release mistakes.

## Resolved

- **Blank lines accumulated between list items after reopening a note from
  the Library** — fixed 2026-07-15. The Markdown restore converter no longer
  turns list-item separators into `<br>` elements inside `<ul>`/`<ol>`, and
  it collapses separators already persisted by the old round-trip behavior.
  Bullet and numbered list round trips are covered by regression tests; see
  [rich-text-editor.md](../specs/rich-text-editor.md).

- **Native side-panel modules and encapsulated state** — fixed 2026-07-11.
  `sidepanel.js` is now a native-module entry point over cohesive state,
  storage, date/time, date-picker, and export-service modules. The extension
  remains static, dependency-free, and unbundled; module behavior and import
  integrity are covered by Node tests. This supersedes the former single-file
  decision; see [ADR-0009](../decisions/0009-native-sidepanel-modules.md).

- **Repository review correctness and debt fixes** — fixed 2026-07-11.
  Autosaves are serialized, persist a newly-created library id back into the
  draft, preserve pin metadata, and retain image-only notes. Per-note export
  history is now explicit rather than temporarily swapping live global state;
  remote images are fetched once and use their validated MIME extension.
  Image metadata and export-package construction are shared, the dead
  `PANEL_STATE`/`DETACH_PANEL` paths and no-op content-script lifecycle sends
  are removed, the title-restore focus race is guarded until initialization,
  and repository-integrity tests now catch missing DOM ids and manifest files.

- **Chrome-managed keyboard shortcuts for stable Jot it! commands** — shipped
  2026-07-11. The extension now declares four suggested defaults (Open, New,
  Export, Library) and exposes the remaining stable toolbar, date, selection,
  and library actions as user-assignable commands in
  `chrome://extensions/shortcuts`. The service worker forwards commands to an
  already-open panel rather than relying on the page-level `keydown` layer
  that repeatedly failed on the product owner's real machine. File import and
  per-library-row actions remain direct UI controls because they require a
  file-picker gesture or a specific row target. See
  [keyboard-shortcuts.md](../specs/keyboard-shortcuts.md) and
  [ADR-0008](../decisions/0008-chrome-extension-commands.md).
- **Usability-review fixes: onboarding hint, paste default, keyboard
  shortcuts, and library pin/sort/filter/multi-select/import** —
  shipped 2026-07-10, following a structured product usability review (five
  personas, blockers/quick-wins/feature-gap analysis). All items from that
  review's blockers and quick-wins sections were implemented, plus the
  review's higher-ROI feature gaps:
  - First-run onboarding: a dismissible banner (`#onboardingHint`,
    `onboardingHintDismissed` storage key) explains autosave-to-library and
    points at the Library button, shown once until dismissed.
  - **Paste no longer defaults to a code block** — reverts the
    2026-07-10 "Paste defaults to code block" entry below for plain-text
    clipboard paste specifically (`insertPastedTextAsPlainText` replaces
    `insertPastedTextAsCodeBlock` in the paste listener); ordinary prose
    was looking broken (unexpectedly monospaced) to first-time users with
    no explanation. Captured page selections (`insertSelectionWithLink`)
    are unaffected — that code-block treatment was for a different reason
    (a quoted external source with a link back to it) and stays. See
    [rich-text-editor.md](../specs/rich-text-editor.md).
  - **Native `prompt()` for links briefly replaced** with an in-panel
    dialog (`#linkDialog`) matching the Material 3 UI — then the toolbar
    Link button itself was removed a few minutes later the same day, once
    it became clear in a real browser that a 10-icon toolbar overflowed
    the panel at its actual width. See the follow-up entry directly below
    for what actually shipped.
  - **Global keyboard shortcuts added**: Cmd/Ctrl+S (Save), Cmd/Ctrl+Shift+S
    (Save As), Cmd/Ctrl+Alt+N (New note — not plain Alt+N, see the macOS
    dead-key note in architecture.md), Alt+L (Library), Escape (closes
    the library, then the date picker, in that priority order). See
    [architecture.md](../architecture.md#keyboard-shortcuts).
  - **Insert-timestamp toolbar button** — plain-text `HH:MM —` at the
    caret, for the meeting-notetaker persona.
  - **Library search placeholder/hint** made explicit about what's
    searched (title, body, visited pages) instead of just "Search saved
    notes...".
  - **Library row action buttons enlarged** 28px → 36px (touch-target
    quick win).
  - **Pin, sort (recently updated/created, title A–Z), and a "this site"
    filter** added to the library. See
    [note-library.md](../specs/note-library.md).
  - **Multi-select + bulk delete** added to the library (previously
    one-confirm-per-note only).
  - **Import a previously-exported `.md` file** back into the library —
    the one feature gap the review flagged as actually threatening the
    "local-first, no cloud backup" trade-off, since it's the only way back
    in after storage eviction/uninstall/machine switch. Deliberately
    scoped to round-tripping this app's own export format, not a general
    Markdown importer. See [note-library.md](../specs/note-library.md).
  - Deliberately **not** built, per the review's own "skip for now" call:
    a manual dark-mode toggle (already auto-follows
    `prefers-color-scheme`) and word-count goals/reading time (scope
    creep away from "quick notes").
  - Verified in a real browser: plain-text paste renders as prose not
    code; Cmd+S exports without triggering the browser's own Save Page dialog;
    Cmd+Alt+N clears the note; Alt+L / Escape open and close the library;
    pin reorders the list and survives a reload; sort-by-title and the
    site filter both produce correct results; multi-select bulk-delete
    removes exactly the selected notes; a round-tripped import (export
    format → parsed back in) preserves title, date/time, body markdown
    (including a bold span and a link), and page history exactly; no
    console errors across the whole pass; all 79 existing unit tests still
    pass unchanged (none of this touched `lib/note-utils.js`).
- **Follow-up same-day fixes from direct user feedback on the above** —
  shipped 2026-07-10, a few minutes after the entry directly above, from
  the product owner reacting to screenshots of the shipped result rather
  than from the original usability review:
  - **Context/title suggestion removed entirely** ("that feature is not
    needed") — the "Use last: `<value>`" button, `contextByHost` storage
    key, and every function/listener that maintained it
    (`updateContextSuggestion`, `rememberContextForHost`,
    `debouncedRememberContext`) are gone. `getCurrentHost()` was kept — the
    library's "this site" filter depends on it independently and has no
    relation to the removed feature. See
    [context-title-suggestion.md](../specs/context-title-suggestion.md).
  - **Toolbar Link button removed** ("remove the link icon to leave room
    for the clock") — the 10-icon toolbar (with the timestamp button added
    minutes earlier) visibly overflowed the panel at its real width. The
    entire link-dialog feature from the entry above (`#linkDialog`,
    `openLinkDialog`/`closeLinkDialog`/`confirmLinkDialog`, its CSS, its
    Escape-chain entry) was removed as dead code along with the button,
    rather than left unreachable. There is no toolbar link-insert control
    anymore — see [rich-text-editor.md](../specs/rich-text-editor.md#links)
    for what still creates a link (page-selection insertion, or typing
    literal `[text](url)` Markdown which converts on the next reload).
  - **A keyboard shortcut for every remaining toolbar command**, shown on
    hover ("Add shortcut for the commands in the toolbar and show the
    shortcut on hover over the icons"): Cmd/Ctrl+E (inline code),
    Cmd/Ctrl+Shift+H (heading), Cmd/Ctrl+Shift+K (code block),
    Cmd/Ctrl+Shift+8/7 (bullet/numbered list — matching Google Docs),
    Cmd/Ctrl+Shift+9 (highlight), Cmd/Ctrl+Shift+; (timestamp). Digit- and
    semicolon-based combos check `event.code` rather than `event.key`
    (Shift+8's `key` is `"*"`, not `"8"`, and that's layout-dependent) —
    see [architecture.md](../architecture.md#keyboard-shortcuts).
  - Verified in a real browser: the toolbar (9 icons, post-Link-removal)
    fits with zero horizontal overflow at the real ~380px side-panel
    width, confirmed both by a forced-width DOM check
    (`scrollWidth`/`clientWidth`) and a visual zoom screenshot; every new
    shortcut triggers its formatting action; no console errors; `node
    --check` on all five JS files passes; all 79 existing tests still pass.
- **Toolbar-command shortcuts remapped from Cmd/Ctrl+Shift+<digit/letter/;>
  to Cmd/Ctrl+Alt+<letter>** — fixed 2026-07-10, after the entry directly
  above shipped and the user tested it on their actual machine (not a
  synthetic-event test harness). Two real collisions surfaced that no
  amount of `dispatchEvent(new KeyboardEvent(...))` testing could have
  caught, because a synthetic dispatch skips real hardware/OS/browser
  capture entirely: **Cmd+E didn't reach the page at all** — it was
  already bound to something else on the user's machine, which activated
  instead — and **Cmd+Shift+; simply did nothing**. Remapped every
  non-Bold/Italic toolbar shortcut to Cmd/Ctrl+Alt+<letter>: H (heading), U
  (bullet list), O (numbered list), C (inline code), K (code block), M
  (highlight), T (timestamp) — the same low-collision pattern New note
  already used successfully (Cmd/Ctrl+Alt+N), and letter-based rather than
  digit/punctuation-based (sidesteps the `event.code`-vs-`event.key`
  workaround the old scheme needed). See
  [architecture.md](../architecture.md#keyboard-shortcuts).
  Verified this time with **real keypresses** in a real browser (not
  synthetic events): all seven new shortcuts correctly triggered their
  formatting action, Bold/Italic unaffected, no external app activated, no
  console errors. Lesson for future shortcut work: synthetic-event testing
  proves the JS branch logic is correct, but cannot prove a key combo
  actually reaches the page on a real machine — that requires an actual
  keypress test, ideally on hardware that isn't a fresh/empty test profile.
- **All keyboard shortcuts removed except Bold/Italic** — fixed 2026-07-10,
  immediately after the entry directly above. Despite that fix being
  verified with real keypresses, the user reported on further testing that
  every shortcut still failed except Cmd/Ctrl+B and Cmd/Ctrl+I — both the
  global app shortcuts (Save/Save As/New note/Library) and the just-remapped
  Cmd/Ctrl+Alt+<letter> toolbar shortcuts. Rather than attempt a third
  scheme, removed all of it at the user's explicit direction ("remove all
  shortcuts. they don't work. only cmd+b and cmd+i work"):
  - `notesInput`'s keydown handler now only checks Bold/Italic.
  - The `document`-level keydown handler reverted to its original,
    pre-2026-07-10 form: Escape closes the date picker, nothing else. The
    library-closing Escape behavior and the Save/Save As/New note/Library
    toggle bindings are gone.
  - Every toolbar/header button's `title`/`data-label`/`aria-label` reverted
    to a plain description with no shortcut hint, except Bold and Italic
    (kept, since those two were confirmed working).
  - Working theory for why only Bold/Italic survived three attempts: Chrome
    contenteditable regions have built-in native handling for Cmd+B/Cmd+I
    regardless of any page-level JS listener, so those two never actually
    depended on this app's own keydown handler reaching the DOM the way
    every other command did. Not confirmed, just the most likely
    explanation given the pattern.
  - See [architecture.md](../architecture.md#keyboard-shortcuts) for the
    consolidated writeup replacing the two sections the two earlier entries
    added. Save/Save As/New note/Library remain fully usable via their
    existing header icon buttons — only the keyboard-shortcut convenience
    layer is gone, not the underlying functionality.
- **Notes are saved to the library automatically — no explicit Save
  required** — shipped 2026-07-10, same day as the note library itself (see
  the entry directly below), superseding that entry's original "only on
  explicit Save/Save As" design per explicit product-owner direction. See
  [ADR-0007](../decisions/0007-autosave-to-library.md). The same debounced
  autosave that already wrote the draft now also keeps the library entry
  up to date (gated on real content, so an auto-filled title alone doesn't
  spawn an empty entry — `hasRealNoteContent()`); Save and Save As are now
  pure disk-export actions with no library involvement at all. Removed two
  "discard unsaved changes?" confirmation dialogs (New note, opening a
  different library entry) since nothing is lost under this model — one
  final synchronous flush write happens right before either action
  (`flushLibrarySync()`). A one-time migration sync also runs in `init()`
  for a draft restored with real *body* content (deliberately checked
  directly rather than via `hasRealNoteContent()`'s title fallback — testing
  found that `init()` isn't a safe context to trust the title signal in, see
  known-issue #10 below). Verified in a real browser: typing alone (no Save
  click) creates a library entry; a reload with only a title and no body
  does not spawn an entry; Save/Save As leave the library entry count and
  content untouched (confirmed exactly one download fires, entry count
  unchanged); New note and opening another entry both correctly preserve
  the just-edited note via the flush, with zero `window.confirm` calls;
  deliberately typing a title with no body still correctly creates an
  entry (the intended exception to "body required").
- **Note library — storage + browsable list + bulk export** — shipped
  2026-07-10. IndexedDB-backed ([ADR-0006](../decisions/0006-note-library-via-indexeddb.md),
  now Accepted), a toggle view (`#libraryView`) with search, open, and
  delete, and a bulk "Export all notes" command reusing the normal per-note
  export path in a loop. One deliberate deviation from the original spec:
  images are stored inline in the Markdown text (same shape as the draft),
  not as separate Blobs — simpler, and IndexedDB's realistic multi-hundred
  -MB-to-GB capacity makes the base64 overhead a non-issue. Verified in a
  real browser: save/re-save-updates-same-entry, search matching body text
  not just titles, open-and-reload round-trip, delete, and both bulk-export
  paths (directory picker and the throttled `chrome.downloads` fallback)
  producing correct per-note folder structure with each note's own
  `pages_visited` frontmatter (not a leaked shared one — a real bug caught
  and fixed during implementation, see
  [note-library.md](../specs/note-library.md)). Details in
  [architecture.md](../architecture.md#note-library-indexeddb) and
  [note-library.md](../specs/note-library.md).
- **No automated test coverage / CI was a no-op** — fixed 2026-07-10. Added
  `test/note-utils.test.js`: 79 tests covering `lib/note-utils.js` (filename
  building, URL/image normalization, and both directions of the
  Markdown↔HTML converter, including a round-trip suite and a hand-rolled
  DOM shim so the `htmlToMarkdown` direction stays testable without adding a
  jsdom dependency — consistent with [ADR-0001](../decisions/0001-static-unbundled-extension.md)).
  `.github/workflows/ci.yml` already ran `node --test`; it now actually
  verifies something. Caught a real, previously-unnoticed bug in the
  process: blockquotes (`> quoted text`) never actually rendered, because
  the `>` → `&gt;` HTML-escape ran before the blockquote regex ever saw the
  literal `>` — confirmed by reverting the fix and watching the test fail.
  Fixed with the same stash/restore pattern already used for code
  protection (see the [ADR-0003](../decisions/0003-hand-rolled-markdown-conversion.md)
  update). This resolves the old known-issue "CI is a no-op" and the "add
  unit tests" backlog item — both removed from their prior sections.
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
- **Paste defaults to code block** — shipped 2026-07-10. Pasted plain text
  wraps in `<pre><code>` via `insertPastedTextAsCodeBlock` (reuses
  `insertBlockElement`). If caret is already inside a code block, text
  appends to it instead of nesting. Image paste handled separately upstream.
- **Selection insertion → code block** — shipped 2026-07-10. The "Add
  selection" button now inserts captured text as a code block with the
  clickable source link as its own paragraph below, matching paste behavior.
- **Clickable links via Cmd/Ctrl+Click** — shipped 2026-07-09. Links in the
  contenteditable editor open via `chrome.tabs.create` (falling back to
  `window.open`) on Cmd/Ctrl+Click, matching Notion/Docs convention.
- **Image paste & export** — shipped 2026-07-09. Clipboard images (data-URI
  or remote) are inserted; `buildObsidianImageExport` rewrites them to
  `attachments/<note>-image-N.<ext>` at export time. Notes with images
  export as a folder.
- **Editor word/character count** — shipped 2026-07-09. Live stats bar
  below the editor using `Intl.Segmenter` for word boundaries.
- **Material 3 design system (v3)** — shipped 2026-07-10 (replacing v2 warm
  theme). Chrome-native palette (cool neutrals, `#0b57d0` accent), Roboto
  font self-hosted, circular icon buttons, flat tonal fills, consistent
  Material 3 shape scale. See `design-system/design-system/DESIGN_SYSTEM.md`.
