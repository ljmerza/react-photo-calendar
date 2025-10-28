import { useMemo, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import './PhotoCalendar.css';
import { CalendarBanner } from './components/CalendarBanner';
import {
  addMonths,
  createCalendarCells,
  formatMonthKey,
  MONTH_NAMES_SHORT,
  parseMonthKey
} from './utils/calendar';
import { createPhotosByDateMap } from './utils/photos';
import type { PhotoEntry } from './types/photo';

export type { PhotoEntry };

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
   * Array of photo entries with datetime and photos array. First photo will be displayed.
   */
  entries?: PhotoEntry[];
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
  children,
  ...rest
}: PhotoCalendarProps) {
  const isControlled = monthKey !== undefined;
  const [internalMonthKey, setInternalMonthKey] = useState(() => formatMonthKey(parseMonthKey(defaultMonthKey)));

  const effectiveMonthKey = isControlled ? (monthKey as string) : internalMonthKey;
  const monthDate = useMemo(() => parseMonthKey(effectiveMonthKey), [effectiveMonthKey]);
  const currentYear = monthDate.getUTCFullYear();
  const currentMonth = monthDate.getUTCMonth();
  const monthLabel = monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const calendarCells = useMemo(() => createCalendarCells(monthDate, firstDayOfWeek), [monthDate, firstDayOfWeek]);
  const photosByDate = useMemo(() => createPhotosByDateMap(entries), [entries]);

  const navigateToMonth = (monthIndex: number) => {
    const nextDate = new Date(Date.UTC(currentYear, monthIndex, 1));
    const nextKey = formatMonthKey(nextDate);
    onMonthChange?.(nextKey);
    if (!isControlled) {
      setInternalMonthKey(nextKey);
    }
  };

  const navigateMonth = (delta: number) => {
    const nextDate = addMonths(monthDate, delta);
    const nextKey = formatMonthKey(nextDate);
    onMonthChange?.(nextKey);
    if (!isControlled) {
      setInternalMonthKey(nextKey);
    }
  };

  const navigateYear = (delta: number) => {
    const nextDate = new Date(Date.UTC(currentYear + delta, currentMonth, 1));
    const nextKey = formatMonthKey(nextDate);
    onMonthChange?.(nextKey);
    if (!isControlled) {
      setInternalMonthKey(nextKey);
    }
  };

  const goToToday = () => {
    const now = new Date();
    const nextDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextKey = formatMonthKey(nextDate);
    onMonthChange?.(nextKey);
    if (!isControlled) {
      setInternalMonthKey(nextKey);
    }
  };

  return (
    <div role="grid" aria-label={`Photo calendar prototype for ${monthLabel}`} data-view="calendar" {...rest}>
      <CalendarBanner
        currentYear={currentYear}
        currentMonth={currentMonth}
        monthLabel={monthLabel}
        monthNames={MONTH_NAMES_SHORT}
        onNavigateMonth={navigateMonth}
        onNavigateYear={navigateYear}
        onNavigateToMonth={navigateToMonth}
        onGoToToday={goToToday}
      />
      <div className="calendar-grid">
        {calendarCells.map((cell, index) => {
          const isPlaceholder = cell === null;
          const dateForCell =
            !isPlaceholder && cell
              ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), cell.day))
              : undefined;

          const isoDate = dateForCell?.toISOString().slice(0, 10);
          const photoUrl = isoDate ? photosByDate[isoDate] : undefined;

          return (
            <button
              key={`calendar-cell-${index}`}
              type="button"
              className={`calendar-cell ${photoUrl ? 'calendar-cell--has-photo' : ''}`}
              role="gridcell"
              aria-disabled={isPlaceholder}
              disabled={isPlaceholder}
              onClick={() => {
                if (!isPlaceholder && dateForCell && isoDate) {
                  onDaySelect?.({
                    isoDate,
                    date: dateForCell
                  });
                }
              }}
            >
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt={`Photo for ${isoDate}`}
                  className="calendar-cell-image"
                />
              )}
              {!isPlaceholder && <span className="cell-label">{cell.day}</span>}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
