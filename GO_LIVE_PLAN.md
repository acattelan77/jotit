# Jot it! Go-Live Plan

## Goal

Publish Jot it! to the Chrome Web Store with accurate product copy, matching
privacy disclosures, verified permissions, and a clean release package.

## Scope

- Chrome extension code and manifest readiness.
- Chrome Web Store listing copy and screenshots.
- Privacy and permission disclosures.
- Manual QA, packaging, submission, and post-launch checks.

## Release Gates

- [ ] Gate 1: Core note-taking behavior works on current Chrome stable.
- [ ] Gate 2: Store listing copy accurately describes the extension.
- [ ] Gate 3: Privacy and data-use disclosures match runtime behavior.
- [ ] Gate 4: Permissions are minimal, justified, and explainable.
- [ ] Gate 5: Package contents are final, reviewed, and versioned.

## Phase 1: Product And Manifest Review

- [ ] Bump the version in `manifest.json`.
- [ ] Keep the visible version in `sidepanel.html` in sync.
- [ ] Verify the manifest description still matches the product.
- [ ] Recheck required permissions:
  - `sidePanel` for the Chrome side-panel UI.
  - `storage` for local draft and preferences.
  - `downloads` for Markdown export.
  - `tabs` for active page title and URL context.
  - `scripting` for the selected-text helper.
  - `http://*/*` and `https://*/*` for selected-text insertion on web pages.
- [ ] Confirm the content security policy still avoids remote scripts,
  `unsafe-eval`, and `unsafe-inline`.

## Phase 2: Functional QA

- [ ] Open the side panel from the toolbar action.
- [ ] Open the side panel from the extension command.
- [ ] Confirm title/context autofill from the active page.
- [ ] Confirm title lock behavior.
- [ ] Confirm date and time controls.
- [ ] Confirm editor formatting and Markdown conversion.
- [ ] Confirm selected page text appears as a pending **Add selection** action
  only while Jot it! is open for the tab.
- [ ] Confirm pasted local images export as Obsidian-compatible attachments.
- [ ] Confirm explicitly copied and pasted web images export safely.
- [ ] Confirm date, time, and pages visited export as YAML frontmatter.
- [ ] Confirm local draft restore after closing and reopening the panel.
- [ ] Confirm direct export to Downloads.
- [ ] Confirm Save As export.
- [ ] Confirm detach and reattach behavior.
- [ ] Confirm notes with real content are saved to the library automatically,
  with no explicit save action, and that an auto-filled title alone does not
  create an entry.
- [ ] Confirm the library view: search, sort, "this site" filter, pin,
  reopening a note, per-row Save and Delete, multi-select bulk delete,
  import, and Export all (both the folder-picker and Downloads-fallback
  paths).
- [ ] Confirm pasted plain text inserts as prose, not a code block, and that
  the toolbar has no Link button (removed to prevent overflow — see
  roadmap.md) while still fitting cleanly at the real ~380px panel width.
- [ ] Confirm `chrome://extensions/shortcuts` lists every Jot it! command,
  assigns the four non-conflicting suggested defaults, and can remap the
  remaining commands. Real-keypress-test a formatting, date, and library
  command with Jot it! open; confirm New note and Open library open the panel
  when closed, while other contextual commands are no-ops. Confirm the
  first-run onboarding hint.
- [ ] Confirm the current design system in light and dark mode.
- [ ] Confirm there are no service-worker or side-panel console errors.

## Phase 3: Privacy And Store Disclosures

- [ ] Verify `PRIVACY.md` describes the current behavior exactly:
  - local draft storage;
  - active page title and URL context;
  - selected-text handling;
  - pasted local image and copied web image handling;
  - Markdown export through Chrome Downloads;
  - user-initiated image attachment downloads;
  - the note library (IndexedDB, on-device only, retained until deleted or
    uninstalled);
  - no analytics or tracking.
- [ ] Fill Chrome Web Store privacy fields to match the policy.
- [ ] Prepare concise permission rationale text for each requested permission.
- [ ] Confirm the listing presents the extension as a single-purpose side-panel
  note-taking tool.

## Phase 4: Listing Materials

- [ ] Finalize listing metadata:
  - name;
  - short summary;
  - full description;
  - category;
  - support URL;
  - privacy URL.
- [ ] Capture screenshots from the real extension UI.
- [ ] Verify the current logo and icons appear clearly in Chrome's required
  preview sizes.
- [ ] Proofread all listing copy against the actual UI labels.

## Phase 5: Packaging

- [ ] Build the upload ZIP from runtime files only:
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
- [ ] Exclude development-only files:
  - design-system references;
  - local settings;
  - screenshots;
  - git metadata;
  - documentation not needed at runtime.
- [ ] Install the packaged ZIP locally and run the release smoke test.

## Phase 6: Submission

- [ ] Upload the ZIP and listing materials to the Chrome Web Store dashboard.
- [ ] Complete privacy and permissions sections.
- [ ] Resolve dashboard warnings.
- [ ] Submit for review.
- [ ] Record submission date, version, and review status.

## Phase 7: Post-Launch

- [ ] Install the published version from the store.
- [ ] Open the panel, write a note, export it, and verify no regressions.
- [ ] Monitor review feedback and user reports.
- [ ] Prepare a patch release if a review or launch issue appears.

## Risks And Mitigations

- Risk: Broad host permissions raise reviewer questions.
  - Mitigation: Explain that access is used only for selected-text insertion on
    ordinary web pages while Jot it! is open.
- Risk: Privacy copy diverges from implementation.
  - Mitigation: Recheck `PRIVACY.md` and Chrome Web Store disclosures before
    each submission.
- Risk: Store screenshots drift from the current UI.
  - Mitigation: Capture screenshots from the packaged extension during release
    QA.

## Definition Of Done

- [ ] Extension is approved and published.
- [ ] Store listing copy, screenshots, privacy disclosures, and permission
  explanations are accurate.
- [ ] First post-launch smoke test passes.
