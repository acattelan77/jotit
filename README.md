# Jot it!

Quick notes in a Chrome side panel. Capture ideas while you browse, format them, and export to Markdown.

## Features
- Side panel notes that follow your active tab.
- One‑click detach to a standalone window.
- Context title auto‑fills from the active page (lockable).
- Rich text formatting with clean Markdown export.
- Optional export folder selection in settings.
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
3) Optional: choose a custom export folder in **Settings**.
4) Use **Detach** to pop the panel into its own window.

## Data & privacy
- All data stays on-device. No network calls.
- Drafts are stored in `chrome.storage.local`.
- Exports are saved either to your selected folder or to Downloads.

See `PRIVACY.md` for the full policy.

## Permissions (why they are needed)
- `sidePanel`: show the sidebar UI.
- `storage`: save a local draft.
- `downloads`: export `.md` files.
- `tabs`: read the active tab title/URL for context.

## Assets

Generate a consistent `j!` visual kit (extension icons + Chrome Web Store assets):

```sh
OPENAI_API_KEY=sk-... npm run assets:generate
```

Outputs:
- extension icons updated in `icons/` (`16`, `32`, `48`, `128`)
- store visuals in `store-assets/chrome-web-store/`
- editable masters in `store-assets/masters/`

Optional flags:

```sh
OPENAI_API_KEY=sk-... npm run assets:generate -- --quality medium --model gpt-image-1 --out ./store-assets
```

## Release

Use `RELEASE_CHECKLIST.md` before publishing to the Chrome Web Store.
