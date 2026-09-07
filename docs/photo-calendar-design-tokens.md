# Photo Calendar Design Tokens

The default bundle exposes a lightweight set of CSS custom properties so consumers can restyle or theme the reference UI without touching the underlying JSX. Override these variables at any scope (globally, within a design system provider, or per calendar instance) to match your brand palette.

| Token | Purpose | Default |
| --- | --- | --- |
| `--calendar-color-surface` | Base surface color for controls and chips | `#ffffff` |
| `--calendar-color-surface-muted` | Subtle surface used by buttons/chips | `#f4f4f5` |
| `--calendar-color-text` | Primary text color | `#111827` |
| `--calendar-color-text-muted` | Muted text for weekday labels | `rgba(17, 24, 39, 0.6)` |
| `--calendar-color-accent` | Accent hue for focus rings and “today” outline | `#007bff` |
| `--calendar-color-accent-soft` | Soft accent shadow for highlighting today | `rgba(0, 123, 255, 0.15)` |
| `--calendar-color-chip-bg` | Background for inactive month chips | `rgba(0, 0, 0, 0.08)` |
| `--calendar-color-chip-active-bg` | (Reserved) optional active state background | `rgba(0, 123, 255, 0.12)` |
| `--calendar-color-chip-active-text` | (Reserved) text color for active chips | `#0051a8` |
| `--calendar-color-cell-bg` | Background of each day cell | `var(--calendar-color-surface-muted)` |
| `--calendar-color-day-label-bg` | Overlay behind the day number | `rgba(0, 0, 0, 0.4)` |
| `--calendar-color-overflow-bg` | Overlay behind the “+N” badge | `rgba(0, 0, 0, 0.7)` |
| `--calendar-radius-day` | Border radius for day buttons and thumbnails | `8px` |
| `--calendar-radius-chip` | Border radius for month chips | `16px` |
| `--calendar-radius-button` | Border radius for navigation buttons | `6px` |
| `--calendar-shadow-today` | Box shadow used for the “today” outline | `0 0 0 2px rgba(0, 123, 255, 0.15)` |
| `--calendar-spacing-gap` | Gap between grid cells | `0.1rem` |
| `--calendar-font-size-weekday` | Font size for weekday headers | `0.75rem` |
| `--calendar-font-size-day` | Font size for day numbers | `0.85rem` |

## Dark theme

The stylesheet ships a `.dark` block that re-points the color tokens. It is keyed
off a `dark` class on an ancestor, usually `<html>`, which the consuming app
toggles:

```html
<html class="dark">
```

The calendar deliberately paints no page background, so the surrounding app
supplies one. `--calendar-color-cell-bg` follows `--calendar-color-surface-muted`
by default and so themes automatically; override it on its own if you want day
cells to differ from other muted surfaces.

## Overriding Tokens

```css
.my-calendar-theme {
  --calendar-color-accent: #0ea5e9;
  --calendar-color-day-label-bg: rgba(14, 165, 233, 0.35);
  --calendar-radius-day: 12px;
}
```

```tsx
<PhotoCalendarRoot className="my-calendar-theme">
  {/* custom navigation + day grid */}
</PhotoCalendarRoot>
```

If you need additional tokens, extend the `PhotoCalendar.css` defaults in this workspace and document them here so downstream consumers can rely on a stable contract.
