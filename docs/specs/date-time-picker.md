# Spec: Date/Time Picker

## Purpose

Let the user set (or correct) the note's meeting date/time without typing a
raw datetime string, and have that value flow into the exported frontmatter.

## Behavior

- Custom picker UI (`renderDatePicker`, a 42-cell month grid), not the
  native `<input type="date">` picker — gives consistent cross-platform
  styling.
- Opens/closes via explicit trigger and click-outside-to-close.
- Keyboard navigation: arrow keys move within the grid.
- Time adjustment via increment/decrement controls (`adjustTime`) for hour
  and minute independently.
- The resulting value is stored as a local `"YYYY-MM-DDTHH:MM"` string with
  no timezone component (`meetingDate` in the draft/form data) — see
  [`../architecture.md`](../architecture.md#note-draft--chromestoragelocalnotedraft).
  This is intentional: notes are personal/local artifacts, not
  timezone-portable calendar events.
- `getLocalDateTimeParts()` (used when building frontmatter) derives
  `date`/`time`/`datetime` from this value, falling back to "now" if the
  stored value fails to parse.

## Edge cases to preserve

- An unparseable stored date must fall back gracefully to the current
  date/time, not throw or export a broken frontmatter value.
- The picker's keyboard navigation and click-outside-to-close should keep
  working if the picker markup changes — these are accessibility-relevant,
  don't regress them silently while touching styling.
