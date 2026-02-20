# Jot it! Go-Live Plan

## Goal
Ship `Jot it!` to the Chrome Web Store with compliant listing assets, accurate privacy disclosures, and low review risk.

## Scope
- Extension code and manifest readiness
- Chrome Web Store listing assets and metadata
- Privacy and permissions compliance
- Final QA, packaging, submission, and immediate post-launch checks

## Release Gates
- [ ] Gate 1: Product behavior stable on current Chrome stable (macOS + Windows)
- [ ] Gate 2: Listing assets meet Chrome Web Store requirements
- [ ] Gate 3: Privacy/data usage disclosures match real behavior
- [ ] Gate 4: Permissions are minimal and clearly justified
- [ ] Gate 5: Package and metadata are final, reviewed, and versioned

## Phase 1: Code and Manifest Hardening (Day 1)
- [ ] Bump extension version in `/Users/alessandrocattelan/Dev/Jot it!/manifest.json`
- [ ] Verify permissions are still required:
  - `sidePanel`, `storage`, `downloads`, `tabs`, `scripting`
- [ ] Re-evaluate host permissions in `/Users/alessandrocattelan/Dev/Jot it!/manifest.json`:
  - Current: `http://*/*`, `https://*/*`
  - Decide whether to keep broad access or move to a stricter/optional model
- [ ] Smoke-test export behavior on target Chrome versions
- [ ] Confirm no console/runtime errors in service worker or panel

## Phase 2: Store Asset Production (Day 1-2)
- [ ] Update asset generator output targets to current CWS-friendly set:
  - Small promo tile `440x280`
  - Screenshots `1280x800`
  - Marquee `1400x560` (optional)
- [ ] Generate icon set and listing art from `/Users/alessandrocattelan/Dev/Jot it!/scripts/generate_store_assets.mjs`
- [ ] Capture real product screenshots from actual extension UI (not mockups)
- [ ] Curate final assets folder for submission:
  - Store icon (128x128)
  - Small promo tile
  - Marquee (if used)
  - At least 3 screenshots

## Phase 3: Privacy and Policy Alignment (Day 2)
- [ ] Verify `/Users/alessandrocattelan/Dev/Jot it!/PRIVACY.md` reflects actual runtime behavior:
  - Selected text capture
  - Active-page context usage
  - Local storage behavior
  - Export paths and file generation
- [ ] Fill Chrome Web Store privacy/data usage fields to match actual behavior exactly
- [ ] Prepare clear permission rationale text for listing:
  - Why each permission is needed
  - What user benefit it unlocks
  - What is not collected/transmitted

## Phase 4: Listing Readiness (Day 2-3)
- [ ] Finalize listing metadata:
  - Name
  - Short summary
  - Full description
  - Category
  - Support and privacy URLs
- [ ] Ensure listing emphasizes single-purpose utility (quick side-panel notes)
- [ ] Proofread for clarity and consistency with in-product wording

## Phase 5: QA and Packaging (Day 3)
- [ ] Run a full functional pass:
  - Open side panel
  - Capture selection
  - Edit/format note
  - Export (default and Save As flow)
  - Detach/reattach workflow
  - Settings interactions
- [ ] Validate icon rendering in:
  - Toolbar
  - Extensions page
  - Store icon preview
- [ ] Build final upload ZIP with runtime files only:
  - `manifest.json`
  - `background.js`
  - `content-selection.js`
  - `sidepanel.js`
  - `sidepanel.css`
  - `sidepanel.html`
  - `icons/`
  - `lib/`
- [ ] Verify ZIP contents before upload

## Phase 6: Submission and Launch (Day 3)
- [ ] Upload package and listing assets to Chrome Web Store dashboard
- [ ] Complete privacy and permissions sections
- [ ] Run dashboard validation and resolve warnings
- [ ] Submit for review
- [ ] Record submission date/time and review status

## Phase 7: Post-Submission and Post-Launch (Day 3+)
- [ ] Track review feedback and respond quickly
- [ ] If changes requested, patch and resubmit same day
- [ ] After publish, run production sanity check:
  - Install from store
  - Open panel
  - Save/export note
  - Verify no regressions
- [ ] Prepare patch-release playbook for first 7 days

## Risks and Mitigations
- Risk: Asset rejection due to wrong dimensions or non-representative screenshots
  - Mitigation: Use exact target sizes and real UI screenshots
- Risk: Privacy/permission review delays
  - Mitigation: Keep disclosures specific and aligned with code behavior
- Risk: Browser-specific export edge cases
  - Mitigation: Validate on current Chrome stable and confirm fallback paths

## Definition of Done
- [ ] Extension approved and published
- [ ] Store listing assets and copy live and accurate
- [ ] Privacy/data usage declarations accepted
- [ ] First post-launch smoke test completed successfully
