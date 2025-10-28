# @tinybeans/photo-calendar (work in progress)

This folder hosts the stand-alone React + Vite workspace for the photo calendar
library. The code will eventually move into its own repository; for now it lives
alongside the main product so the team can iterate while shaping the public API
and reference playground.

## Getting started

```bash
npm install
npm run dev
```

The dev command launches a local playground powered by Vite so contributors can
experiment with the headless primitives. The `build` script bundles the library
in ESM and CJS formats and emits TypeScript declarations that match the contract
outlined in ADR-009.

## Project layout

- `src/index.ts` – public exports for the library package.
- `src/PhotoCalendar.tsx` – convenience component that composes the headless primitives with the reference UI.
- `src/primitives/` – `PhotoCalendarRoot`, `PhotoCalendarNavigation`, `PhotoCalendarWeekdays`, `PhotoCalendarMonthGrid`, and `PhotoCalendarDay` headless building blocks.
- `src/hooks/usePhotoCalendarState.ts` – shared state hook consumed by both the convenience component and primitives.
- `example/` – local development harness powered by Vite (`example/main.tsx` is the dev entry point).
- `vite.config.ts` – configures library builds and test environment defaults.

## Composing your own UI

The new primitives let you mix and match calendar state with custom controls:

```tsx
import {
  PhotoCalendarRoot,
  PhotoCalendarNavigation,
  PhotoCalendarWeekdays,
  PhotoCalendarMonthGrid,
  usePhotoCalendarContext,
} from '@tinybeans/photo-calendar';

function MyNavigation() {
  const { navigation, monthLabel } = usePhotoCalendarContext('MyNavigation');

  return (
    <header>
      <button onClick={() => navigation.navigateMonth(-1)}>◀</button>
      <span>{monthLabel}</span>
      <button onClick={() => navigation.navigateMonth(1)}>▶</button>
      <button onClick={navigation.goToToday}>Today</button>
    </header>
  );
}

export function MyCalendar() {
  return (
    <PhotoCalendarRoot defaultMonthKey="2030-01">
      {(state) => (
        <div role="grid" aria-label={`Photo calendar for ${state.monthLabel}`}>
          <MyNavigation />
          <PhotoCalendarWeekdays />
          <PhotoCalendarMonthGrid
            renderDay={({ defaultContent, isToday, selectDay }) => (
              <div
                className={`my-day ${isToday ? 'my-day--today' : ''}`}
                role="presentation"
                onClick={selectDay}
              >
                {defaultContent}
              </div>
            )}
          />
        </div>
      )}
    </PhotoCalendarRoot>
  );
}
```

Each primitive exposes render props so you can override just the pieces you need—see `docs/photo-calendar-render-props.md` for the full contract. If you prefer to stay on the convenience component, pass `renderNavigation`, `renderWeekdays`, or `renderDay` props to inject custom controls, or keep using the legacy `renderDayContent` helper. `PhotoCalendar` continues to provide the original all-in-one experience if you don’t need custom controls.

```tsx
import { PhotoCalendar, PhotoCalendarDay } from '@tinybeans/photo-calendar';

<PhotoCalendar
  renderDay={(props) => (
    <PhotoCalendarDay
      day={{
        ...props,
        defaultContent: (
          <div className={`my-day ${props.isToday ? 'my-day--today' : ''}`}>
            {props.defaultContent}
          </div>
        )
      }}
    />
  )}
/>
```

Use `monthKey` + `onMonthChange` to control the visible month externally, or prefer `defaultMonthKey` for uncontrolled usage while still receiving navigation callbacks. `onDaySelect` emits both ISO and native `Date` values so consumers can open detail views, modals, or drawers.

`renderDayContent` receives the same `DayRenderContext` as before plus a `defaultContent` field—return it when you want to append to the stock thumbnails/day number layout instead of replacing it outright. Theme variables are documented in `docs/photo-calendar-design-tokens.md` so you can override colours/radii without touching JSX.

Once the component architecture stabilizes, this folder can be promoted into a stand-alone repository without significant changes—package metadata already assumes an eventual npm distribution.
