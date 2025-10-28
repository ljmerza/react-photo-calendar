# Storybook Guide

Storybook replaces the previous Vite playground as the primary way to preview the photo calendar primitives.

## Commands
- `npm run dev` / `npm run storybook` – launch Storybook locally on port `6006`.
- `npm run storybook:build` – emit a static Storybook bundle under `storybook-static/`.

Storybook packages are listed as dev dependencies; run `npm install` to pull them down before starting the server.

## Structure
- `.storybook/main.js` – Storybook configuration (React + Vite framework preset, essentials addon).
- `.storybook/preview.js` – global parameters and shared styles (imports `src/PhotoCalendar.css`).
- `src/stories/PhotoCalendar.stories.tsx` – canonical stories covering the default component, render-prop overrides, and headless composition.

Add additional stories in `src/stories/` (they are excluded from the library build via `tsconfig.build.json`).

## Notes
- Stories seed a large spread of picsum photos (roughly half the days in the current month plus half in the previous month) so navigation showcases real data. Swap them for local assets if offline previews are required.
- `PhotoCalendarDay` is exported for consumers that want to extend the default button markup without reimplementing accessibility semantics—use it inside stories to keep the grid functional while styling.
