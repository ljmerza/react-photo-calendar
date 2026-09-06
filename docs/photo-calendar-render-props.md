# Photo Calendar Render Prop Contracts

The headless primitives expose render props so consumers can provide custom markup while reusing the shared calendar state. This document summarises the available slots and the data each one receives.

## `<PhotoCalendarNavigation>`

```tsx
<PhotoCalendarNavigation>
  {(props) => (
    <button onClick={() => props.navigateMonth(-1)} disabled={!props.canNavigatePrevMonth}>
      Prev
    </button>
  )}
</PhotoCalendarNavigation>
```

`NavigationRenderProps` includes:

- `currentYear`, `currentMonth`, `monthLabel`, `monthNames`
- Navigation helpers: `navigateMonth(delta)`, `navigateYear(delta)`, `navigateToMonth(monthIndex)`
- Convenience actions: `goToToday()`
- Disabled state flags for prev/next month/year
- `isMonthDisabled(monthIndex)` callback (useful for availability grids)

Prefer composing navigation without render props? Import the headless pieces exported from `src/components/CalendarBanner.tsx`:

```tsx
import {
  PhotoCalendarNavigationLayout,
  PhotoCalendarNavigationYearHeading,
  PhotoCalendarNavigationControls,
  PhotoCalendarNavigationPrevYearButton,
  PhotoCalendarNavigationPrevMonthButton,
  PhotoCalendarNavigationMonthChips,
  PhotoCalendarNavigationMonthLabelMobile,
  PhotoCalendarNavigationNextYearButton,
  PhotoCalendarNavigationNextMonthButton,
  PhotoCalendarNavigationTodayButton
} from 'react-photo-calendar';

<PhotoCalendarNavigation>
  {() => (
    <PhotoCalendarNavigationLayout>
      <PhotoCalendarNavigationYearHeading />
      <PhotoCalendarNavigationControls>
        <PhotoCalendarNavigationPrevYearButton />
        <PhotoCalendarNavigationPrevMonthButton />
        <PhotoCalendarNavigationMonthChips />
        <PhotoCalendarNavigationMonthLabelMobile />
        <PhotoCalendarNavigationNextYearButton />
        <PhotoCalendarNavigationNextMonthButton />
        <PhotoCalendarNavigationTodayButton />
      </PhotoCalendarNavigationControls>
    </PhotoCalendarNavigationLayout>
  )}
</PhotoCalendarNavigation>
```

Each component reads the necessary data from `usePhotoCalendarContext`, so you can mix and match them—or drop in your own markup alongside the primitives—to build bespoke navigation bars without prop-drilling.

## `<PhotoCalendarWeekdays>`

```tsx
<PhotoCalendarWeekdays>
  {({ shortLabels, longLabels }) => (
    <ul>
      {shortLabels.map((label, index) => (
        <li key={label} title={longLabels[index]}>{label}</li>
      ))}
    </ul>
  )}
</PhotoCalendarWeekdays>
```

`WeekdayRenderProps` exposes the rotated weekday labels (short + long) based on `firstDayOfWeek`.

## `<PhotoCalendarMonthGrid>`

```tsx
<PhotoCalendarMonthGrid
  renderDay={({ defaultContent, isToday, selectDay }) => (
    <div className={isToday ? 'today' : ''} onClick={selectDay}>
      {defaultContent}
    </div>
  )}
/>;
```

`DayRenderProps` extends `DayRenderContext` with:

- `defaultContent`: JSX fragment identical to the stock layout (thumbnails + day label). Use this to append decorations instead of reimplementing thumbnails from scratch.
- `ariaLabel`: The accessible label describing the day and photo count.
- `isSelectable`: Indicates whether the day belongs to the current month (mirrors the disabled state of the default button).

`DayRenderContext` includes day metadata (`date`, `isoDate`, `day`, `isCurrentMonth`, `isToday`) along with `photos`, `visibleThumbnails`, `overflow`, and a `selectDay()` callback that respects min/max boundaries.

Need the default button wrapper but want to compose it manually? Import `PhotoCalendarDay` and reuse the computed render props:

```tsx
import { PhotoCalendarDay } from 'react-photo-calendar';

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
/>;
```

`props.defaultContent` already contains the stock layout; replace or wrap it to keep the existing button/focus behaviour without cloning the thumbnail logic yourself.

`PhotoCalendarMonthGrid` also accepts an optional `dayStates` array. Supplying this lets you render multiple months in one container with precomputed data (the scroll timeline uses the escape hatch to mount past/future months without interfering with the primary context value).

## `<PhotoCalendarScrollView>`

The mobile scroll navigation shell is exported as `PhotoCalendarScrollView`. It consumes the same context as the other primitives and accepts the familiar `renderDay` / `renderWeekdays` overrides plus a `maxRenderedMonths` window size. Mount it inside a `PhotoCalendarRoot` when you want full control over the surrounding layout or the scroll window size.

```tsx
import {
  PhotoCalendarRoot,
  PhotoCalendarScrollView
} from 'react-photo-calendar';

<PhotoCalendarRoot onVisibleMonthChange={console.log}>
  {(state) => (
    <PhotoCalendarScrollView
      renderDay={customDayRenderer}
      maxRenderedMonths={5}
      style={{ height: '100%' }}
    />
  )}
</PhotoCalendarRoot>;
```

`PhotoCalendarState` now exposes a `scroll` property with helpers:

- `getMonthSnapshot(monthKey)` – returns cached day state, labels, and visible range for any month.
- `getAdjacentMonthKey(currentKey, delta)` – returns the next/previous month respecting min/max bounds.
- `clampMonthKey(monthKey)` – clamps arbitrary ISO yyyy-mm strings into the allowed window.
- `isMonthWithinBounds(monthKey)` – boolean guard for month availability.
- `syncVisibleMonth(monthKey)` – pushes a month into the “current” slot (used by the scroll timeline to keep controlled consumers in sync).

Listen for the new `onVisibleMonthChange` callback to prefetch data whenever the sticky header changes:

```tsx
const pending = new Set<string>();

<PhotoCalendar
  navigationMode="scroll"
  onVisibleMonthChange={(monthKey) => {
    if (!pending.has(monthKey)) {
      pending.add(monthKey);
      fetchMonthPhotos(monthKey).finally(() => pending.delete(monthKey));
    }
  }}
/>;
```

When you need more context inside the callback (e.g., to prefetch adjacent months), pair it with `PhotoCalendarRoot` and store the latest `state.scroll` reference as shown in the README.

## `<PhotoCalendarRoot>`

`PhotoCalendarRoot` accepts the same props as `<PhotoCalendar>` (month control, locale, entries, etc.). Its children can be either nodes or a render function receiving the entire `PhotoCalendarState`. The render function form is ideal for composing custom wrappers:

```tsx
<PhotoCalendarRoot entries={entries}>
  {(state) => (
    <section aria-label={`Calendar for ${state.monthLabel}`}>
      {/* navigation + grid here */}
    </section>
  )}
</PhotoCalendarRoot>
```

Refer to `src/hooks/usePhotoCalendarState.ts` for the full shape of `PhotoCalendarState`.
