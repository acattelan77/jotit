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
- [ ] Confirm the "Use last" context suggestion appears for a previously edited
  site context.
- [ ] Set the date and time with the date picker.
- [ ] Use the editor formatting toolbar: bold, italic, heading, bullet list,
  numbered list, inline code, and link.
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

## Privacy And Permissions

- [ ] Confirm `PRIVACY.md` matches actual behavior.
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
