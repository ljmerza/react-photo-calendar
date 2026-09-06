# react-photo-calendar

This folder hosts the stand-alone React + Vite workspace for the photo calendar
library. The code will eventually move into its own repository; for now it lives
alongside the main product so the team can iterate while shaping the public API
and reference playground.

## Installation

```bash
npm install react-photo-calendar
```

`react` and `react-dom` are peer dependencies (`^18.2.0 || ^19.0.0`) — the package
does not bundle its own copy.

```tsx
import { PhotoCalendar } from 'react-photo-calendar';
import 'react-photo-calendar/styles.css'; // optional reference styling

export function App() {
  return <PhotoCalendar monthKey="2030-01" />;
}
```

The stylesheet is optional: the primitives are headless, and `styles.css` only
carries the reference UI used by the `PhotoCalendar` convenience component.

## Getting started

```bash
npm install
npm run dev
```

The Storybook dev server replaces the old Vite playground and hosts interactive
examples for the headless primitives (`npm run storybook` is available as an explicit alias).
See `docs/storybook-guide.md` for more details. The `build` script bundles the
library in ESM and CJS formats and emits TypeScript declarations that match the
contract outlined in ADR-009.

## Project layout

- `src/index.ts` – public exports for the library package.
- `src/PhotoCalendar.tsx` – convenience component that composes the headless primitives with the reference UI (including the optional scroll timeline).
- `src/components/PhotoCalendarScrollView.tsx` – mobile-first scroll navigation shell consumed when `navigationMode="scroll"`.
- `src/primitives/` – `PhotoCalendarRoot`, `PhotoCalendarNavigation`, `PhotoCalendarWeekdays`, `PhotoCalendarMonthGrid`, and `PhotoCalendarDay` headless building blocks.
- `src/hooks/usePhotoCalendarState.ts` – shared state hook consumed by both the convenience component and primitives.
- `.storybook/` – Storybook configuration powered by the React + Vite framework preset.
- `src/stories/` – Storybook stories demonstrating the default calendar and headless compositions.
- `vite.config.ts` – configures library builds and test environment defaults.

## Composing your own UI

The new primitives let you mix and match calendar state with custom controls:

```tsx
import {
  PhotoCalendarRoot,
  PhotoCalendarNavigation,
  PhotoCalendarNavigationLayout,
  PhotoCalendarNavigationControls,
  PhotoCalendarNavigationPrevMonthButton,
  PhotoCalendarNavigationMonthChips,
  PhotoCalendarNavigationNextMonthButton,
  PhotoCalendarNavigationTodayButton,
  PhotoCalendarWeekdays,
  PhotoCalendarMonthGrid,
  PhotoCalendarDay,
  usePhotoCalendarContext,
} from 'react-photo-calendar';

function MyNavigation() {
  const { monthLabel } = usePhotoCalendarContext('MyNavigation');

  return (
    <PhotoCalendarNavigationLayout>
      <PhotoCalendarNavigationControls>
        <PhotoCalendarNavigationPrevMonthButton />
        <PhotoCalendarNavigationNextMonthButton />
        <PhotoCalendarNavigationTodayButton />
        <span style={{ fontWeight: 600 }}>{monthLabel}</span>
      </PhotoCalendarNavigationControls>
      <PhotoCalendarNavigationMonthChips />
    </PhotoCalendarNavigationLayout>
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
            renderDay={(props) => (
              <PhotoCalendarDay
                day={{
                  ...props,
                  defaultContent: (
                    <div
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        outline: props.isToday ? '2px solid #f97316' : 'none',
                        outlineOffset: props.isToday ? '2px' : undefined
                      }}
                    >
                      {props.defaultContent}
                    </div>
                  )
                }}
              />
            )}
          />
        </div>
      )}
    </PhotoCalendarRoot>
  );
}
```

Each primitive exposes render props so you can override just the pieces you need—see `docs/photo-calendar-render-props.md` for the full contract. If you prefer to stay on the convenience component, pass `renderNavigation`, `renderWeekdays`, or `renderDay` props to inject custom controls, or keep using the legacy `renderDayContent` helper. `PhotoCalendar` continues to provide the original all-in-one experience if you don’t need custom controls.

Navigation can also be assembled from the exported buttons and layout helpers (`PhotoCalendarNavigationLayout`, `PhotoCalendarNavigationPrevMonthButton`, etc.), letting you mix stock behaviour with bespoke markup without threading handlers manually.

```tsx
import { PhotoCalendar, PhotoCalendarDay } from 'react-photo-calendar';

<PhotoCalendar
  renderDay={(props) => (
    <PhotoCalendarDay
      day={{
        ...props,
        defaultContent: (
          <div
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              outline: props.isToday ? '2px solid #f97316' : 'none',
              outlineOffset: props.isToday ? '2px' : undefined
            }}
          >
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

## Mobile scroll timeline

Set `navigationMode="scroll"` on `PhotoCalendar` (or mount `PhotoCalendarScrollView` yourself) to swap the legacy button banner for the vertically scrolling timeline. The scroll shell keeps a small window of months mounted, sticks each month header to the top edge, and emits `onVisibleMonthChange` whenever the leading month shifts—ideal for lazy-loading more photo data as users skim the timeline.

```tsx
const loadMonth = (monthKey: string) => {
  // trigger fetch logic here
};

export function MobileTimeline() {
  const pending = useRef(new Set<string>());

  const prefetchCluster = useCallback((key: string) => {
    if (pending.current.has(key)) return;
    pending.current.add(key);
    loadMonth(key).finally(() => pending.current.delete(key));
  }, []);

  return (
    <PhotoCalendar
      navigationMode="scroll"
      onVisibleMonthChange={(key) => {
        prefetchCluster(key);
        // grab adjacent months via scroll state helpers if needed
      }}
      scrollMaxRenderedMonths={7}
    />
  );
}

// Access scroll helpers via the context when you need neighbouring keys
export function PrefetchingTimeline() {
  // assumes PhotoCalendarScrollView + PhotoCalendarScrollState are imported
  const scrollRef = useRef<PhotoCalendarScrollState | null>(null);

  return (
    <PhotoCalendarRoot
      onVisibleMonthChange={(key) => {
        const scroll = scrollRef.current;
        if (!scroll) {
          return;
        }
        const neighbours = [
          scroll.getAdjacentMonthKey(key, -1),
          key,
          scroll.getAdjacentMonthKey(key, 1)
        ].filter(Boolean) as string[];

        neighbours.forEach(loadMonth);
      }}
    >
      {(state) => {
        scrollRef.current = state.scroll;
        return <PhotoCalendarScrollView />;
      }}
    </PhotoCalendarRoot>
  );
}
```

Advanced consumers can access the scroll helpers (`getMonthSnapshot`, `getAdjacentMonthKey`, `syncVisibleMonth`) exposed on `state.scroll` by rendering through `PhotoCalendarRoot`. The helpers make it easy to prefetch neighbouring months, jump to specific anchors, or compute analytics without coupling to component internals.
