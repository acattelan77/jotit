# Jot it!

Minimal Chrome side panel extension for quick note capture and export.

## What it does
- Opens a side panel for quick notes.
- Prefills the context field with the active page title (editable).
- Lets you format notes and export to Markdown.
- Inserts selected page text into the editor **only when the panel is open**.

## Permissions (why they are needed)
- `sidePanel`: show the sidebar UI.
- `storage`: save a local draft.
- `downloads`: export `.md` files.
- `tabs`: read the active tab title/URL for context.

## Data handling
- All data stays on-device. No network calls.
- Drafts are stored in `chrome.storage.local`.
- Exports are saved to your downloads folder.

See `PRIVACY.md` for the full policy.

## Tests

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
# jotit
