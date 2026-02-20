# Privacy Policy — Jot it!

**Last updated:** 2026-02-20

## Summary
Jot it! stores your notes locally in your browser and saves files to your device when you export. Files can be exported to Downloads or to a folder you explicitly choose in settings. The extension does **not** send data to any servers and does **not** use analytics or tracking.

## What data is handled
- Note content you type in the editor.
- The current page title and URL (used to prefill context and include a source line in exports).
- Text you explicitly select on a webpage **only when the notes UI is open** (side panel or detached note window), where it is inserted into the editor.

## Where data is stored
- Draft notes are saved in `chrome.storage.local` on your device.
- Preferences (for example title lock, selected export folder name, and debug logging) and per-site context suggestions are saved locally.
- If you choose a custom export folder, the browser stores a local folder permission handle so the extension can write files there.
- Exported notes are saved as `.md` files either via direct write to your selected folder or via the Chrome downloads API.

## What data is not collected
- No cookies, credentials, or background browsing history are collected.
- No data is transmitted to third-party services.

## Data retention
- Draft notes remain on your device until you clear them or uninstall the extension.
- Exported files are stored in your selected folder or in your browser downloads location.

## Contact
If you have questions about privacy, contact the developer through the Chrome Web Store listing.
