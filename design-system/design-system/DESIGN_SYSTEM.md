# Jot it! — Design System v3 ("Chrome native" / Material 3)

Reference for anyone (human or AI agent) changing `sidepanel.html` / `sidepanel.css`.
Goal: stop looking like a separate app bolted onto Chrome's side panel, and start
looking like it belongs there — built on Material 3, the same design language as
Chrome's own UI (bookmarks, reading list, history side panels).

v2 ("warm, Apple-ish") is preserved for reference in
`Jot it - New Design System v2 (warm).dc.html`. v3 supersedes it as the target.

## How to apply this

1. Replace the `:root` block (and its `prefers-color-scheme: dark` block) at the
   top of `sidepanel.css` with the contents of **`tokens.css`** in this folder.
   Variable names are unchanged, so no other selector needs editing — only values.
2. Swap the font to Roboto (see "Typography" below) — replacing Inter.
3. Make icon buttons circular (`border-radius: 50%`) instead of squircle —
   see "Shape" below. This is the main structural change from v2.
4. Remove the gradient on the primary button and app icon — Material 3 uses flat
   tonal fills, not gloss/gradient. Solid `--primary-bg` / accent color instead.

Do not invent new colors outside this palette. If a new UI element is needed,
compose it from these tokens.

## Principles

- **Borrow Chrome's own materials.** Surface colors, border grays, and the
  primary blue are Material 3 baseline values — the same family Chrome's native
  side panels use — so the extension's chrome sits flush with the browser's.
- **One accent color, used tonally.** Blue (`--accent`) is the only saturated
  color. Hover/active states use *tonal* variants of it (`--accent-soft` at
  different strengths), not a separate gray hover state — this is the Material
  "state layer" pattern.
- **Flat, not glossy.** No gradients, no glassy highlights. Elevation comes from
  shadow (`--shadow`), not surface treatments. This is a deliberate departure
  from the v2 warm/Apple direction.
- **Icon buttons are circular.** Toolbar and header icon buttons are perfect
  circles at rest and on hover — the exact shape Chrome uses for its own
  toolbar icons. Everything else uses the rounded-rectangle shape scale below.
- **Neutral grays are cool, not warm.** Ink, borders, and muted text sit on
  Google's standard gray scale (`#1f1f1f`, `#5f6368`, `#dadce0`) rather than the
  warm off-black of v2.

## Typography

Roboto, loaded from Google Fonts (or self-hosted — see note below):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
```

> The extension's CSP (`style-src 'self'`) blocks the Google Fonts stylesheet
> as-is. For the built extension, download the Roboto woff2 files and
> self-host under `fonts/`, referencing them via `@font-face` in
> `sidepanel.css`. `--font-sans` already lists Roboto first with the existing
> system-font stack as fallback.

Scale (unchanged from v2 — only the family changes):
- H1 / panel title: 19–22px / 700
- Section heading (e.g. "Decisions" in notes): 1.15–1.4em / 600–700
- Body / editor text: 15px / 400, line-height 1.7
- Field text: 14px / 500
- Caption / metadata / version number: 11–12px / 500, `--muted-soft`

## Color tokens

See `tokens.css` for exact values. Summary:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--panel` | `#f8fafd` | `#1f1f20` | Page background |
| `--surface` | `#ffffff` | `#282a2d` | Inputs, editor, cards |
| `--surface-muted` | `#eaf1fb` | `#2d2e31` | Toolbar background |
| `--ink` | `#1f1f1f` | `#e8eaed` | Primary text |
| `--muted` / `--muted-soft` | `#444746` / `#5f6368` | `#c4c7c5` / `#9aa0a6` | Secondary / caption text |
| `--accent` / `--accent-strong` | `#0b57d0` / `#0842a0` | `#a8c7fa` / `#d3e3fd` | Buttons, links, active/focus states |
| `--accent-soft` | `#d3e3fd` | `#22385c` | Hover/active tint, code background |
| `--border` | `#dadce0` | `#3c4043` | Default control border |

## Shape

- **Icon buttons — circular** (`border-radius: 50%`), 30–34px diameter. This
  replaces the rounded-square icon buttons from v2 and is the single biggest
  visual signal of "Chrome native."
- `--radius-sm` (10px): calendar day cells, chips, small tags
- `--radius-md` (16px): toolbar, inputs, date/time steppers
- `--radius-lg` (24px): popovers, cards, panel-level containers
- `--radius` (16px): general default (editor container)

## Components & states

Reference mockup: `Jot it - New Design System.dc.html` (open in browser) shows
all of the below live, in both light and dark.

**Icon button** (header actions, toolbar, date-picker controls)
- Shape: perfect circle, not rounded-square.
- Rest: transparent bg, `--icon` color, no border (Material buttons are
  typically borderless; rely on the icon + state layer, not an outline).
- Hover: bg → `--surface-ghost-hover` (tonal blue state layer), color → `--accent-strong`.
- Active/pressed: bg → `--surface-ghost-active` (one step darker tint).
- Always paired with a dark tooltip (`--tooltip-bg`/`--tooltip-ink`, small 4px
  radius rectangle — Material "plain tooltip" shape, not a pill) on hover,
  matching the existing `data-label` attribute pattern.

**Text input / date field / editor container**
- Rest: `--surface` bg, 1px `--border`, `--radius-md` (16px) corners.
- Focus: border → `--accent` (`--border-focus`), plus a 3px accent-tinted glow
  (`box-shadow: 0 0 0 3px var(--accent-soft)`).

**Primary button** (if/when one is needed)
- Flat `--primary-bg` fill (solid, no gradient), white ink, `--primary-shadow`
  (a crisp Material elevation-1 shadow, not a soft diffuse one), pill radius
  (`border-radius: 20px` / fully rounded) — Material 3's default filled-button
  shape.

**Toast** (`#statusMessage`)
- Neutral confirmations ("Exported to Downloads", "File saved"): Material
  "snackbar" shape — dark ink surface (`--tooltip-bg`/`--tooltip-ink`), small
  8px corner radius rectangle (not a pill), left-aligned padding.
- Errors: same shape, warm red bg (`#b3413a` light / `#d45a52` dark) with light
  ink — the one intentional exception to the single-accent rule, reserved
  strictly for failure states.

**Autosave status**
- "Saved locally" is not a snackbar. Treat it as ambient state text: 11px,
  `--muted-soft`, italic, no background, no border, no shadow. Keep it aligned
  with the footer/version row so it reassures without asking for attention.
  Reserve snackbar styling for explicit exports and errors.

**Title lock toggle**
- Unlocked: ghost circular icon button, open-padlock icon.
- Locked: bg → `--surface-muted`, closed-padlock icon, `--icon-strong` color —
  a subtle "engaged" look, not a color change.

**Context suggestion link** ("Use last: …")
- Plain text button, `--muted` color, no border/background, `--ink` on hover.
  Never gets a background — it's a low-emphasis affordance.

**Pending selection strip** ("Add selection")
- Low-emphasis action row, not an input and not a snackbar. Use
  `--surface-ghost` with `--border-soft`, `--radius-sm`, compact vertical
  padding, and 11px muted italic preview text. The action is a small tonal pill
  using `--accent-soft` / `--accent-strong`; dismiss is a circular icon button.

**Date & time popover**
- Container: `--surface` bg, `--border`, `--radius-lg` (24px), `--shadow`.
- Selected day: `--accent-soft` bg, `--accent` border, `--accent-strong` text,
  `--radius-sm`, circular day cells (matches Chrome/Android's own date pickers).
- "Done" button uses the flat primary fill; "Today" stays ghost/text button.

**Empty editor state**
- Centered icon in an `--accent-soft` circular badge (not rounded-square —
  circles read as more "Google"), `--ink` headline, `--muted-soft` subtext.
  Use when the editor and title are both empty.

## App icon

Keep the current Jot it! logo and extension icons unless a future task
explicitly asks for a logo redesign. The panel header should use the existing
icon asset without adding gloss, gradients, or extra decorative treatment around
it.

## What NOT to do

- Don't add a second accent hue "for variety" — everything non-neutral should
  be a shade of the one accent blue (or the reserved error red).
- Don't add gradients or glossy highlights anywhere — flat fills only.
- Don't round icon buttons as squares/squircles — they must be circular.
- Don't warm up the neutral scale — ink, borders, and muted text stay on the
  cool Google gray scale, not the warm off-black from v2.
- Don't drop the rounded-corner scale below 10px anywhere on rectangular
  elements, or mix in fully sharp corners.
- Don't restyle the tooltip/data-label mechanism — only its colors/radius.
