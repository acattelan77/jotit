# Privacy Policy - Jot it!

**Last updated:** 2026-07-10

## Summary

Jot it! stores notes locally in Chrome and exports Markdown files to your
device. It does not send your notes, selected text, page titles, URLs, or usage
data to any server. It does not use analytics, ads, or tracking.

## Data The Extension Handles

- Note content you type in the editor.
- The note date and time.
- The active page title and URL, used to prefill note context and build exported
  YAML frontmatter metadata.
- Text you select on ordinary web pages while the notes UI is open. The
  extension shows it as a pending selection and only inserts it into the note
  after you click **Add selection**; otherwise selection messages are dropped.
- Images you explicitly paste into the editor, including supported copied web
  image URLs and local clipboard image data.
- Local preferences such as title lock and debug logging.
- A library of every note you've written with real content, saved
  automatically as you type so you can browse, search, reopen, export, or
  delete it later.

## Where Data Is Stored

- Draft notes are stored in `chrome.storage.local` on your device.
- Preferences are stored in `chrome.storage.local`.
- The note library is stored in IndexedDB on your device, in a database local
  to the extension. It is never sent anywhere; nothing about it leaves your
  browser.
- Exported notes are saved as `.md` files through Chrome's Downloads flow. When
  a note includes images, supported image attachments are saved in an
  `attachments/` folder next to the exported note.

## Network Use

The extension does not send data to an application server. All note editing,
local draft saving, selected-text handling, and Markdown generation run inside
Chrome on your device. If you export a note that references a supported web
image URL, Chrome may download that image URL as an attachment as part of the
user-initiated export.

## Image Safety

- Pasted HTML is not trusted or inserted into the note.
- Only common raster image formats are accepted: PNG, JPEG, GIF, WebP, and AVIF.
- SVG images are intentionally not accepted.
- Large pasted images are rejected before being stored in the draft.

## What Is Not Collected

- No cookies, passwords, credentials, or payment information are collected.
- No browsing history is collected in the background.
- No analytics events are recorded.
- No data is sold, shared, or transmitted to third parties.

## Data Retention

- Draft notes remain in local Chrome storage until you clear the note, overwrite
  the draft, clear extension storage, or uninstall the extension.
- Library entries remain in IndexedDB until you delete them individually from
  the library view, clear extension storage, or uninstall the extension.
  Deleting a library entry only removes it from the extension's index — it
  does not affect any copy of that note already exported to disk.
- Exported Markdown files and image attachments remain wherever you save them.

## Contact

If you have questions about privacy, contact the developer through the Chrome
Web Store listing.
