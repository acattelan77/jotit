# 0004. Local-first, no telemetry, no external servers

Status: Accepted
Date: 2026-07-09 (retroactively documented)

## Context

`PRIVACY.md` states Jot it! does not send notes, selections, page titles,
URLs, or usage data to a server, and includes no analytics/tracking. This is
reflected in the code: the only network activity is
`fetchRemoteAttachmentBlob()` fetching a remote image URL the user themselves
pasted, during export — not telemetry. `host_permissions` covers `http(s)`
broadly because the content script and remote-image fetch need it, not
because the extension calls home anywhere.

## Decision

No analytics, no crash reporting service, no remote logging, no phone-home
of any kind. The only outbound network requests are ones directly caused by
and visible to the user's own action (fetching an image they pasted a URL
for). Debug logging (`debugLogsEnabled`) stays local — `chrome.storage.local`
plus `console.log`, never sent anywhere.

## Consequences

- **Easier:** the privacy stance in `PRIVACY.md` stays true without needing
  a data-flow audit every release; simpler Chrome Web Store review story;
  users can trust "local-first" as a real property, not just marketing copy.
- **Harder:** no visibility into real-world error rates, usage patterns, or
  which features actually get used — debugging relies entirely on user
  reports plus the local debug-log console (`window.JotDebug`).
- **Forecloses (without a new ADR + updating `PRIVACY.md` in the same
  change):** adding any analytics SDK, crash reporter, or remote logging
  endpoint. This is a product/trust commitment, not just a technical default
  — don't add telemetry "just for debugging" without treating it as the
  privacy-stance change it is.
