import { useEffect, useMemo, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import './PhotoCalendar.css';
import { CalendarBanner } from './components/CalendarBanner';
import {
  addMonths,
  createCalendarCells,
  formatMonthKey,
  getVisibleRange,
  parseMonthKey
} from './utils/calendar';
import { createPhotosByDateMap } from './utils/photos';
import type { PhotoEntry } from './types/photo';

export type { PhotoEntry };

export interface VisibleRange {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
}

export interface DayRenderContext {
  date: Date;
  isoDate: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  photos: string[];
  visibleThumbnails: string[];
  overflow: number;
  selectDay: () => void;
}

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
   * Fired when navigation arrows request a month change. Receives ISO yyyy-mm strings.
   */
  onMonthChange?: (nextMonthKey: string) => void;
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
   * Optional slot for dev-only scaffolding while the headless primitives are built.
   */
  children?: ReactNode;
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
  locale,
  timeZone,
  renderDayContent,
  children,
  ...rest
}: PhotoCalendarProps) {
  const isControlled = monthKey !== undefined;
  const [internalMonthKey, setInternalMonthKey] = useState(() => formatMonthKey(parseMonthKey(defaultMonthKey)));

  const effectiveMonthKey = isControlled ? (monthKey as string) : internalMonthKey;
  const monthDate = useMemo(() => parseMonthKey(effectiveMonthKey), [effectiveMonthKey]);
  const minMonthDate = useMemo(() => (minMonthKey ? parseMonthKey(minMonthKey) : undefined), [minMonthKey]);
  const maxMonthDate = useMemo(() => (maxMonthKey ? parseMonthKey(maxMonthKey) : undefined), [maxMonthKey]);
  const currentYear = monthDate.getUTCFullYear();
  const currentMonth = monthDate.getUTCMonth();
  const resolvedLocale = locale ?? undefined;
  const resolvedTimeZone = timeZone ?? 'UTC';
  const timeZoneOption = useMemo(() => ({ timeZone: resolvedTimeZone }), [resolvedTimeZone]);
  const monthLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { month: 'long', year: 'numeric', ...timeZoneOption }),
    [resolvedLocale, timeZoneOption]
  );
  const dayLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { day: 'numeric', month: 'long', year: 'numeric', ...timeZoneOption }),
    [resolvedLocale, timeZoneOption]
  );
  const weekdayShortFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { weekday: 'short', ...timeZoneOption }),
    [resolvedLocale, timeZoneOption]
  );
  const weekdayLongFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { weekday: 'long', ...timeZoneOption }),
    [resolvedLocale, timeZoneOption]
  );
  const monthNameFormatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, { month: 'short', ...timeZoneOption }),
    [resolvedLocale, timeZoneOption]
  );
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        monthNameFormatter.format(new Date(Date.UTC(2021, index, 1)))
      ),
    [monthNameFormatter]
  );
  const monthLabel = monthLabelFormatter.format(monthDate);
  const calendarCells = useMemo(() => createCalendarCells(monthDate, firstDayOfWeek), [monthDate, firstDayOfWeek]);
  const photosByDate = useMemo(() => createPhotosByDateMap(entries), [entries]);
  const visibleRange = useMemo(() => {
    const range = getVisibleRange(calendarCells);
    if (!range) {
      return null;
    }
    return {
      start: range.start,
      end: range.end,
      startIso: range.start.toISOString().slice(0, 10),
      endIso: range.end.toISOString().slice(0, 10)
    };
  }, [calendarCells]);
  const weekdayLabels = useMemo(() => {
    const baseDates = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2021, 7, index + 1)));
    const shortNames = baseDates.map((date) => weekdayShortFormatter.format(date));
    const longNames = baseDates.map((date) => weekdayLongFormatter.format(date));
    const rotate = (arr: string[]) => arr.slice(firstDayOfWeek).concat(arr.slice(0, firstDayOfWeek));
    return {
      short: rotate(shortNames),
      long: rotate(longNames)
    };
  }, [firstDayOfWeek, weekdayShortFormatter, weekdayLongFormatter]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const maxThumbnails = Math.max(1, maxThumbnailsPerDay);

  useEffect(() => {
    if (!onRangeChange || !visibleRange) {
      return;
    }

    onRangeChange(visibleRange);
  }, [onRangeChange, visibleRange]);

  const toComparableMonth = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth();
  const minMonthIndex = minMonthDate ? toComparableMonth(minMonthDate) : null;
  const maxMonthIndex = maxMonthDate ? toComparableMonth(maxMonthDate) : null;
  const currentMonthIndex = toComparableMonth(monthDate);

  const isWithinRange = (date: Date) => {
    const index = toComparableMonth(date);
    if (minMonthIndex !== null && index < minMonthIndex) {
      return false;
    }
    if (maxMonthIndex !== null && index > maxMonthIndex) {
      return false;
    }
    return true;
  };

  const clampToRange = (date: Date) => {
    if (minMonthDate && toComparableMonth(date) < (minMonthIndex as number)) {
      return minMonthDate;
    }
    if (maxMonthDate && toComparableMonth(date) > (maxMonthIndex as number)) {
      return maxMonthDate;
    }
    return date;
  };

  const commitMonthChange = (nextDate: Date) => {
    const nextKey = formatMonthKey(nextDate);
    if (nextKey === effectiveMonthKey) {
      return;
    }
    onMonthChange?.(nextKey);
    if (!isControlled) {
      setInternalMonthKey(nextKey);
    }
  };

  const isTodayDisabled = (() => {
    const now = new Date();
    const todayMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const clampedToday = clampToRange(todayMonthDate);
    return toComparableMonth(clampedToday) === currentMonthIndex;
  })();

  const navigateToMonth = (monthIndex: number) => {
    const nextDate = new Date(Date.UTC(currentYear, monthIndex, 1));
    if (!isWithinRange(nextDate)) {
      const clamped = clampToRange(nextDate);
      if (toComparableMonth(clamped) === currentMonthIndex) {
        return;
      }
      commitMonthChange(clamped);
      return;
    }
    commitMonthChange(nextDate);
  };

  const navigateMonth = (delta: number) => {
    const nextDate = addMonths(monthDate, delta);
    const clamped = clampToRange(nextDate);
    if (toComparableMonth(clamped) === currentMonthIndex) {
      return;
    }
    commitMonthChange(clamped);
  };

  const navigateYear = (delta: number) => {
    const nextDate = new Date(Date.UTC(currentYear + delta, currentMonth, 1));
    const clamped = clampToRange(nextDate);
    if (toComparableMonth(clamped) === currentMonthIndex) {
      return;
    }
    commitMonthChange(clamped);
  };

  const goToToday = () => {
    const now = new Date();
    const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const clamped = clampToRange(nextDate);
    if (toComparableMonth(clamped) === currentMonthIndex) {
      return;
    }
    commitMonthChange(clamped);
  };

  return (
    <div role="grid" aria-label={`Photo calendar for ${monthLabel}`} data-view="calendar" {...rest}>
      <CalendarBanner
        currentYear={currentYear}
        currentMonth={currentMonth}
        monthLabel={monthLabel}
        monthNames={monthNames}
        onNavigateMonth={navigateMonth}
        onNavigateYear={navigateYear}
        onNavigateToMonth={navigateToMonth}
        onGoToToday={goToToday}
        canNavigatePrevMonth={minMonthIndex === null || currentMonthIndex > minMonthIndex}
        canNavigateNextMonth={maxMonthIndex === null || currentMonthIndex < maxMonthIndex}
        canNavigatePrevYear={minMonthIndex === null || currentMonthIndex > minMonthIndex}
        canNavigateNextYear={maxMonthIndex === null || currentMonthIndex < maxMonthIndex}
        isMonthDisabled={(monthIndex) => {
          const candidate = new Date(Date.UTC(currentYear, monthIndex, 1));
          return !isWithinRange(candidate);
        }}
        isTodayDisabled={isTodayDisabled}
      />
      <div className="calendar-weekdays" role="row">
        {weekdayLabels.short.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="calendar-weekday"
            role="columnheader"
            aria-label={weekdayLabels.long[index]}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {calendarCells.map((cell, index) => {
          const photos = photosByDate[cell.isoDate] ?? [];
          const visibleThumbnails = photos.slice(0, maxThumbnails);
          const overflow = Math.max(0, photos.length - visibleThumbnails.length);
          const isToday = cell.isoDate === todayIso;
          const isSelectable = cell.inCurrentMonth;
          const ariaLabel = `${dayLabelFormatter.format(cell.date)}. ${
            photos.length === 0 ? 'No photos' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
          }`;
          const context: DayRenderContext = {
            date: cell.date,
            isoDate: cell.isoDate,
            day: cell.day,
            isCurrentMonth: cell.inCurrentMonth,
            isToday,
            photos,
            visibleThumbnails,
            overflow,
            selectDay: () => {
              if (isSelectable) {
                onDaySelect?.({
                  isoDate: cell.isoDate,
                  date: cell.date
                });
              }
            }
          };

          const defaultContent = (
            <>
              {visibleThumbnails.length > 0 && (
                <div className="calendar-cell-thumbnails" data-count={visibleThumbnails.length}>
                  {visibleThumbnails.map((url, thumbIndex) => (
                    <img
                      key={`${cell.isoDate}-${thumbIndex}`}
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="calendar-cell-image"
                    />
                  ))}
                  {overflow > 0 && <span className="calendar-cell-overflow">+{overflow}</span>}
                </div>
              )}
              <span className="cell-label">{cell.day}</span>
            </>
          );

          return (
            <button
              key={`calendar-cell-${index}`}
              type="button"
              className={`calendar-cell ${cell.inCurrentMonth ? '' : 'calendar-cell--placeholder'} ${
                isToday ? 'calendar-cell--today' : ''
              } ${visibleThumbnails.length > 0 ? 'calendar-cell--has-photo' : ''}`}
              role="gridcell"
              aria-label={ariaLabel}
              aria-disabled={!isSelectable}
              disabled={!isSelectable}
              onClick={context.selectDay}
            >
              {renderDayContent ? renderDayContent(context) : defaultContent}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
