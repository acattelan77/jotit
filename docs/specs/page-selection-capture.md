# Spec: Page Selection Capture

## Purpose

Let the user select text on the page they're viewing and pull it into the
note with a link back to the source, without leaving the page or manually
copy-pasting.

## Behavior

1. `content-selection.js` listens for `selectionchange`, `mouseup`, `keyup`
   on the page.
2. Debounced 200ms so rapid selection changes don't spam messages.
3. Selection text is trimmed and truncated to 4000 characters
   (`MAX_SELECTION_LENGTH`).
4. Identical text sent again within 1 second is deduped — avoids re-sending
   on every intermediate selectionchange event during a single drag.
5. Sends `PAGE_SELECTION_CANDIDATE {text, url, title}` to background.
6. Background **only forwards this to the panel if a panel is currently
   visible for that tab** (checks `openPanelTabs` / detached-window
   mapping); otherwise it's silently dropped. This is deliberate — selecting
   text on a page with no Jot it! panel open should have zero visible
   effect, not queue something invisible for later.
7. The panel shows a **pending page selection**: a preview bar with **Add
   selection** and dismiss actions. **Nothing is inserted automatically** —
   the user must explicitly click Add selection.
8. In standalone (detached) mode, incoming candidates are filtered by
   `sourceTabId` — a detached window only offers selections from the tab it
   detached from, not from whatever tab happens to be active in the browser.
9. Clicking **Add selection** inserts the text as a code block
   (`insertSelectionWithLink`), with the clickable source link as its own
   paragraph directly below the block, at the last known caret position in
   the editor — same "selected text defaults to a code block" treatment as
   a clipboard paste, see [rich-text-editor.md](rich-text-editor.md#code-blocks).

## Content script injection

The manifest declares `content-selection.js` on all `http(s)` pages at
`document_idle`. For pages that were already loaded before the extension was
installed/updated, background probes with `PING_SELECTION` and injects
on-demand via `chrome.scripting.executeScript` if there's no response — see
`ensureSelectionScript` in [`../architecture.md`](../architecture.md).

## Edge cases to preserve

- Selecting text with no panel open: no message should reach the panel (step
  6). Don't "fix" the drop-when-no-panel behavior into a queue-for-later
  without treating that as a deliberate UX change, not a bug fix.
- Switching tabs or windows while a pending selection is showing: the
  pending-selection bar is tied to the panel document's state, not to a
  particular page — verify it behaves sensibly (dismiss vs. persist) rather
  than assuming either is obviously correct without checking current
  behavior first.
- Standalone mode must not offer selections from tabs other than its
  `sourceTabId` (step 8) — this is what keeps a detached window's captured
  text scoped to the page it was detached from.
