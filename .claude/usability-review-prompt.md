# Prompt: Usability Review for Jot it! Chrome Extension

Review the Jot it! Chrome extension from a usability and product-readiness perspective. The goal is to identify what is missing or rough so the app can be released on the Chrome Web Store and feel worth a **€1.99 lifetime purchase**.

## Product context

Jot it! is a Chrome Manifest V3 side-panel extension for taking quick notes while browsing. It is intentionally small: no build step, no framework, no npm dependencies. The code is unbundled vanilla JS.

Key source files to inspect:

- `sidepanel.html` — UI structure
- `sidepanel.css` — styling and design-system tokens
- `sidepanel.js` — editor behavior, draft/library storage, export
- `note-library.js` — IndexedDB wrapper for the note library
- `background.js` — panel lifecycle and detached-window coordination
- `content-selection.js` — selected-text detection on web pages
- `lib/note-utils.js` — Markdown/HTML conversion and filename helpers
- `manifest.json` — permissions and extension metadata
- `docs/specs/*.md` and `docs/architecture.md` — expected behavior and data model
- `RELEASE_CHECKLIST.md` and `GO_LIVE_PLAN.md` — release readiness items

What the app currently does:

- Opens a note editor in Chrome's side panel from the toolbar icon or a keyboard command.
- Can detach into a standalone popup window and reattach.
- Auto-fills the note title from the active page title; lets the user lock or edit it.
- Remembers custom context names per site and offers them as suggestions.
- Includes date and time controls.
- Supports basic rich-text formatting: bold, italic, heading, bullet/numbered list, inline code, code block, highlight, and links.
- Detects selected page text while the panel is open and offers an explicit **Add selection** action.
- Pastes images (local clipboard or copied web images) and exports them as Obsidian-friendly attachments.
- Autosaves the draft to `chrome.storage.local`.
- Automatically saves every note with real content to an in-extension IndexedDB library as the user writes.
- Lets the user browse, search, reopen, export, or delete past notes.
- Exports notes as `.md` files with YAML frontmatter (title, date, time, pages visited).
- Supports bulk "Export all" to a chosen folder.

## Typical users and the jobs they hire Jot it! for

Think through each of these personas. What do they need? Where does the current experience help or fail them?

### 1. The research-heavy knowledge worker
- Reads articles, documentation, and papers across many tabs.
- Needs to capture quotes, source links, and snippets quickly without losing context.
- Wants notes to accumulate sources across tabs and export cleanly into Obsidian, Notion, or a wiki.
- Likely values the page-selection capture and `pages_visited` frontmatter.

### 2. The meeting notetaker
- Joins calls in the browser (Google Meet, Zoom web, Teams).
- Needs to start a note in one click, with the meeting name pre-filled.
- Cares about timestamp accuracy and zero friction (keyboard shortcuts, auto-save, easy clear/new note).
- May want to paste action items into a task tool later.

### 3. The student or lifelong learner
- Studies videos, tutorials, documentation, and articles.
- Needs simple formatting, easy image capture, and a searchable history of notes.
- May be price-sensitive; the €1.99 price needs to feel obvious and fair.

### 4. The writer / journalist / content creator
- Gathers source material from many web pages.
- Needs reliable selection capture, page history, and clean Markdown export.
- Cares about not losing work and being able to reorganize notes later.

### 5. The privacy-conscious user
- Wants a local-first tool with no cloud, no telemetry, no accounts.
- Needs to trust that notes stay on device and exports happen only when explicitly requested.
- Reads permissions and privacy policy carefully before installing.

## What to look for

For each area below, read the relevant code and UI, then judge whether the current implementation is **release-ready**, **needs polish**, or **is missing**. Give concrete examples and, where possible, propose minimal fixes.

### 1. First-run and onboarding
- When a user installs the extension, what do they see? Is there any empty-state guidance?
- Is the toolbar icon's purpose obvious? Is there any hint about the keyboard command?
- Does the user understand that notes auto-save to the library without clicking Save?
- Is the distinction between "Save to disk" and "autosaved to library" confusing?

### 2. Discoverability and learnability
- Are the toolbar icons understandable without labels?
- Are keyboard shortcuts discoverable? (Only Bold and Italic have Cmd/Ctrl shortcuts today.)
- Is the **Detach / Reattach** behavior discoverable and understandable?
- Is the **title lock** icon clear? Does the user understand why the title changes when they switch tabs?
- Is the **context suggestion** button obvious?
- Is the **library** discoverable and its purpose clear?

### 3. Efficiency and friction
- How many clicks/keystrokes does it take to start a note from the current page?
- How easy is it to capture a selection? Does the preview bar feel intrusive or helpful?
- Is pasted text always wrapped in a code block the right default? When might that be surprising?
- How quickly can the user create a new note, find an old note, or export everything?
- Are there any places where the user must repeat work (e.g., re-entering context titles)?

### 4. Trust, safety, and data confidence
- Does the user clearly understand where their notes live (local storage, IndexedDB, disk export)?
- Is it obvious that **Delete in the library does not delete the exported file**?
- Are error messages helpful when save/export fails?
- Is there any risk of data loss on panel close, browser restart, or service-worker eviction?
- Does the user feel safe granting broad `http://*/*` and `https://*/*` permissions? Is the value exchange clear?

### 5. Power-user gaps
- What is missing that a €2 note-taking tool should probably have?
  - Note templates or default title patterns?
  - Tags or folders for organizing the library?
  - Sort/filter options beyond reverse-chronological?
  - Per-note word-count goals or reading time?
  - Pinning favorite notes?
  - Bulk delete or multi-select in the library?
  - Import from a previously exported `.md` file?
  - Dark mode toggle or theme choice?
  - Adjustable default paste behavior?
- Which of these would meaningfully increase perceived value without violating the "small, local-first" positioning?

### 6. Accessibility
- Can the app be used with only a keyboard?
- Are focus indicators visible?
- Are ARIA labels and roles correct and complete?
- Does the custom date picker work with screen readers and keyboard navigation?
- Are color-contrast ratios acceptable in both light and dark mode?
- Are icon-only buttons understandable to non-sighted users?

### 7. Visual and interaction polish
- Does the UI feel premium enough for a paid extension?
- Are hover/focus/active states consistent?
- Are transitions and loading states purposeful, not distracting?
- Are empty states helpful rather than blank?
- Does the standalone (detached) window layout still work well?
- How does the panel behave at very narrow widths?

### 8. Chrome Web Store readiness
- Does the store listing story (quick notes, Obsidian export, local-first) match the actual experience?
- Are there any features that look half-finished and would hurt reviews?
- Are there obvious bugs or rough edges a new user would hit in the first five minutes?

## Deliverable

Produce a structured report with the following sections:

1. **Executive summary** — Is it ready for a €1.99 release? Score each persona's satisfaction 1–5 and give an overall verdict.
2. **Top 5 usability blockers** — The highest-impact issues that should be fixed before release, with file/line references where possible.
3. **Top 5 quick wins** — Low-effort improvements that would noticeably improve perceived quality.
4. **Feature gaps worth considering** — Bigger additions that would increase value without bloating the app; prioritize by effort/impact.
5. **First-run / onboarding recommendation** — What should a new user see or experience in their first 60 seconds?
6. **Store-copy and pricing checklist** — Specific claims the listing should and should not make, and any permission-privacy language to include.

Be honest and specific. If something is already good, say so. If something is broken or confusing, show the evidence from the code or UI and propose a fix. Do not write code; focus on analysis and recommendations.
