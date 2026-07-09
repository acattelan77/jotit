# Jot it! — Design System v2

Reference for anyone (human or AI agent) changing `sidepanel.html` / `sidepanel.css`.
Goal: warm, friendly, and quietly premium — a calmer alternative to the original gray panel — while staying native to Chrome's side panel chrome.

## How to apply this

1. Replace the `:root` block (and its `prefers-color-scheme: dark` block) at the top of `sidepanel.css` with the contents of **`tokens.css`** in this folder. Every variable name is unchanged, so no other selector in `sidepanel.css` needs editing — only the values at the top.
2. Add the Inter font (see "Typography" below).
3. Apply the shape/state rules below where noted — these are small, targeted rule changes, not a rewrite.

Do not invent new colors outside this palette. If a new UI element is needed, compose it from these tokens.

## Principles

- **One accent color.** Blue (`--accent`) is the only saturated color in the UI. Everything else is neutral. This is what makes the accent feel deliberate instead of decorative — don't add a second brand color.
- **Warmth lives in ink and shape, not background.** Surfaces (`--bg`, `--panel`, `--surface`) are near-neutral so the panel sits flush with Chrome/macOS chrome. Warmth comes from a slightly warm dark ink (`#292825`, not pure black) and generous rounding.
- **Generous, friendly rounding.** Corners scale with element size: small controls 10px, inputs/toolbar 14px, panels/popovers 18–20px. Never mix a sharp corner into this system.
- **Interactive = tinted blue, not gray.** Hover/active states on icon buttons and toolbar buttons shift toward `--accent-soft` / `--accent`, not a darker gray. Focus rings are blue, not gray (`--border-focus: var(--accent)`).

## Typography

Inter, loaded from Google Fonts (or self-hosted — see note below):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

> The extension's CSP (`style-src 'self'`) blocks the Google Fonts stylesheet as-is. For the built extension, download the Inter woff2 files and self-host under `fonts/`, referencing them via `@font-face` in `sidepanel.css`. `--font-sans` already lists Inter first with the existing system-font stack as fallback, so nothing breaks if the font file is missing.

Scale (unchanged sizes from today, just the new family):
- H1 / panel title: 19–22px / 700
- Section heading (e.g. "Decisions" in notes): 1.15–1.4em / 600–700
- Body / editor text: 15px / 400, line-height 1.7
- Field text: 14px / 500
- Caption / metadata / version number: 11–12px / 500, `--muted-soft`

## Color tokens

See `tokens.css` for exact values. Summary:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--panel` | `#f7f6f4` | `#1c1c1b` | Page background |
| `--surface` | `#ffffff` | `#242322` | Inputs, editor, cards |
| `--surface-muted` | `#f1efec` | `#201f1e` | Toolbar background |
| `--ink` | `#292825` | `#eeece9` | Primary text |
| `--muted` / `--muted-soft` | `#64625c` / `#8b8880` | `#b3b0aa` / `#918e87` | Secondary / caption text |
| `--accent` / `--accent-strong` | `#3b5fd9` / `#2444ad` | `#6d8ffb` / `#8ea4fc` | Buttons, links, active/focus states |
| `--accent-soft` | `#e7ecfb` | `#2a3050` | Hover/active tint, code background |
| `--border` | `#e2e0dc` | `#34332f` | Default control border |

## Shape

- `--radius-sm` (10px): small icon buttons, calendar day cells, chips
- `--radius-md` (14px): toolbar, inputs, date/time steppers
- `--radius-lg` (20px): popovers, cards, panel-level containers
- `--radius` (18px): general default (buttons, editor container)

## Components & states

Reference mockups: `Jot it - New Design System.dc.html` (open in browser) shows all of the below live, in both light and dark.

**Icon button** (header actions, toolbar, date-picker controls)
- Rest: `--surface-ghost` bg, `--icon` color, `--border` outline
- Hover: bg → `--accent-soft`, color → `--accent-strong`, border → transparent or light accent
- Active/pressed: bg → one step darker tint (`--surface-ghost-active`)
- Always paired with a dark tooltip (`--tooltip-bg`/`--tooltip-ink`, pill-ish 7px radius) on hover, matching the existing `data-label` attribute pattern — keep that pattern, just restyle the tooltip bubble with the new tokens.

**Text input / date field / editor container**
- Rest: `--surface` bg, 1px `--border`
- Focus: border → `--accent` (`--border-focus`), plus a soft 3px accent-tinted glow (`box-shadow: 0 0 0 3px var(--accent-soft)`) instead of the old inset-only ring — more visible, still calm.

**Primary button** (if/when one is needed)
- `--primary-bg` gradient (accent → accent-strong), white ink, `--primary-shadow`.

**Toast** (`#statusMessage`)
- Neutral confirmations ("Saved locally", "Exported to Downloads"): dark ink pill (`--tooltip-bg` bg, `--tooltip-ink` text), pill radius.
- Errors: same shape, warm red bg (`#b3413a` light / adjust `~15%` lighter for dark) with light ink — the one intentional exception to the single-accent rule, reserved strictly for failure states.

**Title lock toggle**
- Unlocked: ghost icon button, open-padlock icon.
- Locked: bg → `--surface-muted`, border → `--border`, closed-padlock icon, `--icon-strong` color — a subtle "engaged" look, not a color change.

**Context suggestion link** ("Use last: …")
- Plain text button, `--muted` color, no border/background, `--ink` on hover. Never gets a background — it's a low-emphasis affordance.

**Date & time popover**
- Container: `--surface` bg, `--border`, `--radius-lg`, `--shadow`.
- Selected day: `--accent-soft` bg, `--accent` border, `--accent-strong` text, `--radius-sm`.
- "Done" button uses the primary gradient; "Today" stays ghost.

**Empty editor state** (new — not in the original build, optional to adopt)
- Centered icon in an `--accent-soft` rounded square (20px radius), `--ink` headline, `--muted-soft` subtext. Use when the editor and title are both empty.

## App icon

Same "j!" gradient mark, refined:
- 26% corner radius (superellipse-like, matches Apple app icon geometry) instead of the current more generic rounded-square.
- Gradient: `linear-gradient(160deg, #4c72e8 0%, #2444ad 100%)`.
- Add a subtle top gloss: a 50%-height white-to-transparent overlay at ~20% opacity, to match the depth of the mockup — keep it subtle, not glassy/skeuomorphic.

## What NOT to do

- Don't add a second accent hue "for variety" — everything non-neutral should be a shade of the one accent blue (or the reserved error red).
- Don't warm up the surface backgrounds — keep them neutral; warmth comes from ink color and shape only.
- Don't drop the rounded-corner scale below 10px anywhere, or mix in sharp corners.
- Don't restyle the tooltip/data-label mechanism — only its colors/radius.
