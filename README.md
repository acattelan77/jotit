# Jot it!

Jot it! is a Chrome extension for taking quick notes in the browser side panel.
It keeps a local draft while you write, can detach into a small standalone
window, and exports clean Markdown files when you are done.

## What It Does

- Opens a note editor in Chrome's side panel from the toolbar icon or extension
  command.
- Can detach the side panel into a standalone popup window, then reattach it.
- Prefills the note context from the active page title and lets you lock or edit
  that title.
- Remembers recent custom context names per site and offers them as suggestions.
- Includes date and time controls for the note.
- Supports basic rich-text formatting: bold, italic, heading, bullet list,
  numbered list, inline code, and links.
- Detects selected page text while the side panel or detached window is open and
  offers an explicit **Add selection** action.
- Supports images explicitly pasted from the clipboard, including images copied
  from the web or from a local source, then exports them as Obsidian-friendly
  attachments.
- Autosaves the in-progress draft locally in Chrome.
- Exports notes as `.md` files through Chrome Downloads, with a Save As option.
  Notes with images are exported as a folder containing the note and an
  `attachments/` directory.
- Saves note metadata as YAML frontmatter, including title, date, time, and
  pages visited.

## Install From GitHub

Requires Chrome 114 or newer.

1. Open the GitHub repository:
   `https://github.com/acattelan77/jotit`
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Unzip the downloaded file. This creates a folder such as
   `jotit-main`.
5. Open Chrome and go to `chrome://extensions`.
6. Enable **Developer mode** in the top-right corner.
7. Click **Load unpacked**.
8. Select the unzipped `jotit-main` folder, the one containing
   `manifest.json`.
9. Click the Jot it! toolbar icon to open the side panel.

Keep the unzipped folder on your computer. Chrome loads the extension from that
folder, so deleting or moving it can disable the extension.

To update later, download the latest ZIP from GitHub, unzip it, replace the old
folder, then click **Reload** for Jot it! on `chrome://extensions`.

## Install For Development

Requires Chrome 114 or newer.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Click the Jot it! toolbar icon to open the side panel.

## How To Use

1. Open Jot it! from the Chrome toolbar.
2. Write in the editor and use the toolbar for formatting.
3. Edit the context title if needed, or lock it to prevent page changes from
   replacing it.
4. Select text on a webpage while Jot it! is open, then click **Add selection**
   to insert it into the note with its page link.
5. Paste an image into the editor when you want it included with the note.
6. Use **Save .md** to export directly to Downloads, or **Save as...** to choose
   a destination folder when Chrome's folder picker is available. Notes with
   images export as a self-contained folder for Obsidian.
7. Use **New note** to clear the current draft and start fresh.

## Data And Privacy

Jot it! is local-first. It does not send notes, selections, page titles, URLs,
or usage data to a server, and it does not include analytics or tracking.

Draft notes, pasted image data, title-lock preference, debug preference, and
per-site context suggestions are stored in `chrome.storage.local`. Exports are
saved as Markdown files and image attachments through Chrome's Downloads flow.
See `PRIVACY.md` for the full policy.

## Permissions

- `sidePanel`: shows the side-panel interface.
- `storage`: saves the local draft and preferences.
- `downloads`: exports Markdown files.
- `tabs`: reads the active tab title and URL for note context.
- `scripting`: injects the selection helper when needed.
- `http://*/*`, `https://*/*`: allows selected text from ordinary web pages to
  be inserted into the open note.

## Project Files

- `manifest.json`: Chrome extension manifest and permission list.
- `background.js`: side-panel opening, detached-window coordination, and
  selection forwarding.
- `content-selection.js`: selected-text detector for web pages.
- `sidepanel.html`: extension UI structure.
- `sidepanel.css`: design system implementation and responsive styling.
- `sidepanel.js`: editor behavior, local draft storage, context handling, and
  Markdown export.
- `lib/note-utils.js`: shared date, filename, URL, and Markdown helpers.
- `PRIVACY.md`: user-facing privacy policy.
- `RELEASE_CHECKLIST.md`: pre-release checks for Chrome Web Store publishing.

## Release

Use `RELEASE_CHECKLIST.md` before packaging or publishing the extension.
