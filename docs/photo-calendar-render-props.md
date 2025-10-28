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
} from '@tinybeans/photo-calendar';

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
import { PhotoCalendarDay } from '@tinybeans/photo-calendar';

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
