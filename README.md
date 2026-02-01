# Jot it!

Quick notes in a Chrome side panel. Capture ideas while you browse, format them, and export to Markdown.

## Features
- Side panel notes that follow your active tab.
- One‑click detach to a standalone window.
- Context title auto‑fills from the active page (lockable).
- Rich text formatting with clean Markdown export.
- Selected page text inserts into the editor when the panel is open.

## Install (development)
Requires Chrome 114+.

1) Open `chrome://extensions`
2) Enable **Developer mode**
3) Click **Load unpacked**
4) Select this project folder

## Usage
1) Click the extension icon to open the side panel.
2) Write notes, format as needed, and export.
3) Use **Detach** to pop the panel into its own window.

## Data & privacy
- All data stays on-device. No network calls.
- Drafts are stored in `chrome.storage.local`.
- Exports are saved to your downloads folder.

See `PRIVACY.md` for the full policy.

## Permissions (why they are needed)
- `sidePanel`: show the sidebar UI.
- `storage`: save a local draft.
- `downloads`: export `.md` files.
- `tabs`: read the active tab title/URL for context.

## Development

Run the lightweight unit tests (Node built-in runner):

```sh
node --test
```

### Playwright smoke tests (dev-only)

Requires installing dev dependencies once:

```sh
npm install
```

Run the smoke test (launches Chromium with the extension loaded):

```sh
npm run test:e2e
```

## Release

Use `RELEASE_CHECKLIST.md` before publishing to the Chrome Web Store.
