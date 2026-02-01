# Release Checklist (Chrome Web Store)

## Versioning
- [ ] Bump `manifest.json` version.
- [ ] Update release notes for the store listing.

## Permissions & CSP
- [ ] Confirm permissions are minimal and justified.
- [ ] Verify CSP contains no `unsafe-eval` or `unsafe-inline`.

## Privacy
- [ ] Confirm `PRIVACY.md` matches actual behavior.
- [ ] Ensure no network calls or analytics are present.

## Icons & Assets
- [ ] Verify all icons render correctly on light/dark backgrounds.
- [ ] Confirm `icons/icon_16.png`, `icon_32.png`, `icon_48.png`, `icon_128.png` exist and are transparent.

## Functional Smoke Tests
- [ ] Open side panel from toolbar action.
- [ ] Auto-populate “What’s this about?” with page title; verify it remains editable.
- [ ] Date picker: open, select date and time, set “Now”.
- [ ] Formatting buttons: bold, italic, heading, lists, code, link.
- [ ] Selection capture: select text on page while panel open; text inserts in editor.
- [ ] Export: save `.md` file successfully.
- [ ] Detach/reattach sidebar workflow works.

## Packaging
- [ ] Zip only extension runtime files (`manifest.json`, `*.js`, `*.css`, `*.html`, `icons/`, `lib/`).
- [ ] Exclude local-only files (design notes, test files) if desired.

## Final Review
- [ ] Load unpacked extension in a fresh Chrome profile.
- [ ] Verify no errors in extension service worker console.
