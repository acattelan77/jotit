# Release Checklist - Chrome Web Store

## Versioning

- [ ] Bump the version in `manifest.json`.
- [ ] Keep the visible version in `sidepanel.html` in sync.
- [ ] Update store release notes.

## Behavior

- [ ] Load the unpacked extension in a fresh Chrome profile.
- [ ] Open the side panel from the toolbar action.
- [ ] Open the side panel from the configured extension command.
- [ ] Confirm the active page title prefills the context field.
- [ ] Edit the context title and verify the lock prevents page changes from
  replacing it.
- [ ] Set the date and time with the date picker.
- [ ] Use the editor formatting toolbar: bold, italic, heading, bullet list,
  numbered list, inline code, code block, highlight, and timestamp. Confirm
  there is no Link button (removed to keep the toolbar from overflowing at
  the panel's real width).
- [ ] Confirm only Bold and Italic toolbar buttons show a keyboard shortcut
  on hover (Cmd/Ctrl+B, Cmd/Ctrl+I) and only those two actually work;
  confirm no other toolbar button, and no header button (New/Save/Save
  As/Library), responds to any keyboard shortcut — all keyboard shortcuts
  beyond Bold/Italic were removed after repeated real-world collisions, see
  [docs/architecture.md](docs/architecture.md#keyboard-shortcuts).
- [ ] Paste plain multi-line text into the editor and confirm it inserts as
  normal prose (not a code block); confirm pasting into an existing code
  block still appends inline.
- [ ] Confirm the first-run onboarding hint appears once, dismisses
  permanently, and does not reappear after reloading the panel.
- [ ] Confirm Escape closes the date picker when it's open, and does
  nothing else.
- [ ] Confirm the panel toolbar does not overflow or clip any icon at the
  real side-panel width (~380px), not just at a wide test-window width.
- [ ] Select text on a webpage while the panel is open and confirm the
  **Add selection** control appears.
- [ ] Click **Add selection** and confirm the selected text inserts with the
  page link.
- [ ] Confirm selected text is not inserted automatically.
- [ ] Confirm selected text is not offered when Jot it! is closed for that tab.
- [ ] Paste a local image into the editor and confirm it previews in the note.
- [ ] Export a note with a pasted image and confirm Obsidian renders the
  `attachments/` image reference.
- [ ] Copy a supported web image, paste it into the editor, and confirm export
  creates a safe image attachment.
- [ ] Export a note and confirm date, time, and pages visited are written as
  YAML frontmatter, not as a section at the bottom of the note.
- [ ] Save directly to Downloads.
- [ ] Use Save As and choose a destination.
- [ ] Detach the panel into a standalone window.
- [ ] Reattach the standalone window to the side panel.
- [ ] Clear the note and confirm the saved draft is removed.
- [ ] Write a note and confirm it appears in the library automatically, with
  no explicit save action.
- [ ] Confirm an editor with only an auto-filled title and no body text does
  not create a library entry.
- [ ] Open the library, search for a note, and confirm results match title,
  body, and visited-page text.
- [ ] Click a library row and confirm it loads into the editor and the view
  switches back to the editor (no confirmation dialog).
- [ ] Use a library row's Save button and confirm it exports that note without
  opening it into the editor.
- [ ] Delete a library row and confirm it's removed from the list, and that
  any previously exported file for that note is untouched on disk.
- [ ] Use **Export all** with the folder picker available, and again with it
  unavailable (or cancelled), and confirm both paths produce correctly
  structured per-note folders.
- [ ] Click **New note** while the library view is open and confirm the view
  switches back to a clean, empty editor.
- [ ] Pin a note and confirm it sorts to the top of the list regardless of
  the active sort mode, and that pinning does not change its "last updated"
  time.
- [ ] Switch the sort control between Recently updated, Recently created,
  and Title A–Z and confirm the order changes correctly.
- [ ] Toggle the "This site" filter and confirm only notes with a visited
  page on the current site remain.
- [ ] Use **Select** to multi-select several notes and bulk-delete them;
  confirm exactly the selected notes are removed and the mode exits
  cleanly.
- [ ] Use **Import** to load a `.md` file this app previously exported and
  confirm the resulting library entry's title, date/time, body, and visited
  pages match the original note.

## Privacy And Permissions

- [ ] Confirm `PRIVACY.md` matches actual behavior, including the note
  library (IndexedDB, on-device only, retained until deleted or uninstalled).
- [ ] Confirm the extension still makes no background network requests, aside
  from user-initiated downloads of explicitly pasted web image attachments.
- [ ] Confirm no analytics or tracking code is present.
- [ ] Confirm image paste still rejects SVG and arbitrary pasted HTML.
- [ ] Verify every permission is still needed:
  - `sidePanel`
  - `storage`
  - `downloads`
  - `tabs`
  - `scripting`
  - `http://*/*`
  - `https://*/*`
- [ ] Prepare Chrome Web Store permission explanations for active-page context,
  local draft storage, Markdown export, and selected-text insertion.

## Design And Assets

- [ ] Verify the current logo and extension icons render clearly in the toolbar,
  extension details page, and Chrome Web Store preview.
- [ ] Confirm the side panel matches the current design system in light mode.
- [ ] Confirm the side panel matches the current design system in dark mode.
- [ ] Capture current product screenshots from the real extension UI for the
  store listing.

## Packaging

- [ ] Package runtime files only:
  - `manifest.json`
  - `background.js`
  - `content-selection.js`
  - `sidepanel.html`
  - `sidepanel.css`
  - `sidepanel.js`
  - `note-library.js`
  - `lib/`
  - `icons/`
  - `fonts/`
- [ ] Exclude design notes, local settings, screenshots, and other non-runtime
  files from the upload ZIP.
- [ ] Verify the ZIP contents before upload.

## Final Review

- [ ] Confirm there are no errors in the extension service worker console.
- [ ] Confirm there are no errors in the side-panel console.
- [ ] Install the packaged ZIP locally and repeat a smoke test.
