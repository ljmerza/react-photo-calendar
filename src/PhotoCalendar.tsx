import type { HTMLAttributes, ReactNode } from 'react';
import './PhotoCalendar.css';
import { PhotoCalendarRoot } from './primitives/PhotoCalendarRoot';
import { PhotoCalendarNavigation, type NavigationRenderProps } from './primitives/PhotoCalendarNavigation';
import { PhotoCalendarWeekdays, type WeekdayRenderProps } from './primitives/PhotoCalendarWeekdays';
import { PhotoCalendarMonthGrid, type DayRenderProps } from './primitives/PhotoCalendarMonthGrid';
import { PhotoCalendarDay } from './primitives/PhotoCalendarDay';
import { PhotoCalendarScrollView } from './components/PhotoCalendarScrollView';
import {
  PhotoCalendarVirtualScrollView,
  type PhotoCalendarVirtualScrollViewProps,
  type VirtualMonthRange
} from './components/PhotoCalendarVirtualScrollView';
import { useMediaQuery } from './hooks/useMediaQuery';
import {
  PhotoCalendarThumbnailRetryProvider,
  type ThumbnailRetryOptions
} from './primitives/PhotoCalendarThumbnail';
import type { DayRenderContext, MonthChangeInfo, VisibleRange } from './types/calendar';
import type { PhotoEntry } from './types/photo';

export type { DayRenderContext, MonthChangeInfo, PhotoEntry, VirtualMonthRange, VisibleRange };

// Matches the stylesheet's desktop breakpoint, where the banner shows year navigation and month chips.
const WIDE_SCREEN_QUERY = '(min-width: 875px)';

export interface PhotoCalendarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Visible month identifier (ISO yyyy-mm) used for quick visual validation while the real library takes shape.
   */
  monthKey?: string;
  /**
   * Default month identifier used when the component manages its own state.
   */
  defaultMonthKey?: string;
  /**
   * Fired when the visible month changes. Receives the ISO yyyy-mm string and whether
   * navigation controls or scrolling a timeline caused it.
   */
  onMonthChange?: (nextMonthKey: string, info: MonthChangeInfo) => void;
  /**
   * Fired when the user activates a day cell. Receives the ISO date (yyyy-mm-dd) and native `Date` instance.
   */
  onDaySelect?: (info: { isoDate: string; date: Date }) => void;
  /**
   * Index of the first day of the week (0 = Sunday, 1 = Monday, ...).
   * Keeps the placeholder grid alignment consistent with locale expectations.
   */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Array of photo entries with datetime and photos array. First entries become day thumbnails.
   */
  entries?: PhotoEntry[];
  /**
   * Maximum thumbnails to show per day before showing a +X overflow badge.
   * Defaults to 1 to mimic the Tinybeans hero-photo layout.
   */
  maxThumbnailsPerDay?: number;
  /**
   * Optional minimum bound for navigation (ISO yyyy-mm).
   */
  minMonthKey?: string;
  /**
   * Optional maximum bound for navigation (ISO yyyy-mm).
   */
  maxMonthKey?: string;
  /**
   * Fired whenever the visible calendar range (including leading/trailing placeholders) changes.
   */
  onRangeChange?: (range: VisibleRange) => void;
  /**
   * Fired when the scroll timeline promotes a new month into the active position.
   */
  onVisibleMonthChange?: (monthKey: string) => void;
  /**
   * Locale override used for weekday/month labels. Defaults to browser locale.
   */
  locale?: string;
  /**
   * Optional timeZone passed to Intl formatters.
   */
  timeZone?: string;
  /**
   * Slot to customise the content rendered inside each day cell.
   */
  renderDayContent?: (context: DayRenderContext) => ReactNode;
  /**
   * New slot to customise the entire day cell button. Receives extended render props.
   */
  renderDay?: (props: DayRenderProps) => ReactNode;
  /**
   * Optional slot to customise navigation controls.
   */
  renderNavigation?: (props: NavigationRenderProps) => ReactNode;
  /**
   * Optional slot to customise weekday headers.
   */
  renderWeekdays?: (props: WeekdayRenderProps) => ReactNode;
  /**
   * Optional slot for dev-only scaffolding while the headless primitives are built.
   */
  children?: ReactNode;
  /**
   * How the user moves between months:
   * - "controls": one month with arrows, year buttons and month chips (default).
   * - "scroll": a windowed timeline of stacked months.
   * - "virtual": a virtualized timeline spanning years; photos load only for months the user stops on.
   * - "auto": "virtual" below 875px wide, "controls" from 875px up.
   */
  navigationMode?: 'controls' | 'scroll' | 'virtual' | 'auto';
  /**
   * Maximum number of months to keep mounted when `navigationMode` is "scroll".
   */
  scrollMaxRenderedMonths?: number;
  /**
   * Months the virtual timeline lists around today's month. Defaults to 120 on each side.
   */
  virtualRange?: VirtualMonthRange;
  /**
   * Height of the virtual timeline. "fill" (default) stretches it to the bottom of the viewport.
   */
  virtualHeight?: PhotoCalendarVirtualScrollViewProps['height'];
  /**
   * What scrolls the virtual timeline: its own container ("container", default) or the page ("window").
   */
  virtualScroll?: PhotoCalendarVirtualScrollViewProps['scrollTarget'];
  /**
   * Month order of the virtual timeline: "oldest-first" (default) or "newest-first".
   */
  virtualOrder?: PhotoCalendarVirtualScrollViewProps['order'];
  /**
   * How long months must stay in view before their photos load in the virtual timeline. Default 150ms.
   */
  virtualSettleDelayMs?: number;
  /**
   * Virtual timeline only: fired with the months on screen (plus one either side) once scrolling settles.
   * Load entries for these months.
   */
  onMonthsInViewChange?: (monthKeys: string[]) => void;
  /**
   * Virtual timeline only: makes each sticky month header a button that fires with its month (yyyy-mm),
   * e.g. to open a month picker. Without it the headers are plain text.
   */
  onMonthHeaderClick?: (monthKey: string) => void;
  /**
   * Virtual timeline only: accessible name of a month header button. Defaults to "<month label>, choose month".
   */
  monthHeaderLabel?: (monthLabel: string, monthKey: string) => string;
  /**
   * Retry thumbnails that fail to load. Defaults to 2 retries, 1s then 2s apart; `false` turns it off.
   */
  thumbnailRetry?: ThumbnailRetryOptions | false;
}

export function PhotoCalendar({
  monthKey,
  defaultMonthKey,
  onMonthChange,
  onDaySelect,
  firstDayOfWeek = 0,
  entries,
  maxThumbnailsPerDay = 1,
  minMonthKey,
  maxMonthKey,
  onRangeChange,
  onVisibleMonthChange,
  locale,
  timeZone,
  renderDayContent,
  renderDay,
  renderNavigation,
  renderWeekdays,
  children,
  navigationMode = 'controls',
  scrollMaxRenderedMonths,
  virtualRange,
  virtualHeight,
  virtualScroll,
  virtualOrder,
  virtualSettleDelayMs,
  onMonthsInViewChange,
  onMonthHeaderClick,
  monthHeaderLabel,
  thumbnailRetry,
  ...rest
}: PhotoCalendarProps) {
  const isWideScreen = useMediaQuery(WIDE_SCREEN_QUERY, true);
  const resolvedMode = navigationMode === 'auto' ? (isWideScreen ? 'controls' : 'virtual') : navigationMode;
  const calendarOptions = {
    monthKey,
    defaultMonthKey,
    onMonthChange,
    onDaySelect,
    firstDayOfWeek,
    entries,
    maxThumbnailsPerDay,
    minMonthKey,
    maxMonthKey,
    onRangeChange,
    onVisibleMonthChange,
    locale,
    timeZone
  };
  const resolvedRenderDay = renderDay
    ? renderDay
    : renderDayContent
      ? (props: DayRenderProps) => (
          <PhotoCalendarDay day={{ ...props, defaultContent: renderDayContent(props) ?? props.defaultContent }} />
        )
      : undefined;
  const resolvedNavigation = renderNavigation
      ? (props: NavigationRenderProps) => renderNavigation(props)
    : undefined;
  const resolvedWeekdays = renderWeekdays
    ? (props: WeekdayRenderProps) => renderWeekdays(props)
    : undefined;

  const withRetry = (calendar: ReactNode) =>
    thumbnailRetry === undefined ? (
      calendar
    ) : (
      <PhotoCalendarThumbnailRetryProvider value={thumbnailRetry}>{calendar}</PhotoCalendarThumbnailRetryProvider>
    );

  if (resolvedMode === 'virtual') {
    return withRetry(
      <PhotoCalendarRoot {...calendarOptions}>
        {() => (
          <PhotoCalendarVirtualScrollView
            {...rest}
            renderDay={resolvedRenderDay}
            renderWeekdays={resolvedWeekdays}
            firstDayOfWeek={firstDayOfWeek}
            range={virtualRange}
            height={virtualHeight}
            scrollTarget={virtualScroll}
            order={virtualOrder}
            settleDelayMs={virtualSettleDelayMs}
            onMonthsInViewChange={onMonthsInViewChange}
            onMonthHeaderClick={onMonthHeaderClick}
            monthHeaderLabel={monthHeaderLabel}
          >
            {children}
          </PhotoCalendarVirtualScrollView>
        )}
      </PhotoCalendarRoot>
    );
  }

  if (resolvedMode === 'scroll') {
    return withRetry(
      <PhotoCalendarRoot {...calendarOptions}>
        {() => (
          <PhotoCalendarScrollView
            {...rest}
            renderDay={resolvedRenderDay}
            renderWeekdays={resolvedWeekdays}
            maxRenderedMonths={scrollMaxRenderedMonths}
          >
            {children}
          </PhotoCalendarScrollView>
        )}
      </PhotoCalendarRoot>
    );
  }

  return withRetry(
    <PhotoCalendarRoot {...calendarOptions}>
      {(state) => (
        <div role="grid" aria-label={`Photo calendar for ${state.monthLabel}`} data-view="calendar" {...rest}>
          <PhotoCalendarNavigation>{resolvedNavigation}</PhotoCalendarNavigation>
          <PhotoCalendarWeekdays>{resolvedWeekdays}</PhotoCalendarWeekdays>
          <PhotoCalendarMonthGrid renderDay={resolvedRenderDay} />
          {children}
        </div>
      )}
    </PhotoCalendarRoot>
  );
}
