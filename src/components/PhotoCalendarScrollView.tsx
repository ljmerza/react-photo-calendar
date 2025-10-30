import type { HTMLAttributes, ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import { usePhotoCalendarContext } from '../context/PhotoCalendarContext';
import { useCalendarActiveMonthTracking } from '../hooks/useCalendarActiveMonthTracking';
import { useCalendarMonthWindow } from '../hooks/useCalendarMonthWindow';
import { useCalendarWindowExpansionObserver } from '../hooks/useCalendarWindowExpansionObserver';
import { PhotoCalendarMonthGrid } from '../primitives/PhotoCalendarMonthGrid';
import { PhotoCalendarWeekdays, type WeekdayRenderProps } from '../primitives/PhotoCalendarWeekdays';
import type { DayRenderProps } from '../types/calendar';

export interface PhotoCalendarScrollViewProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Custom renderer for day cells.
   */
  renderDay?: (props: DayRenderProps) => ReactNode;
  /**
   * Custom renderer for weekday headers.
   */
  renderWeekdays?: (props: WeekdayRenderProps) => ReactNode;
  /**
   * Optional developer scaffolding slot rendered inside the scroll view container.
   */
  children?: ReactNode;
  /**
   * Maximum number of month sections to keep mounted at once.
   * Defaults to 7 which keeps memory in check while preserving scroll continuity.
   */
  maxRenderedMonths?: number;
}

const DEFAULT_MAX_RENDERED_MONTHS = 7;

function combineClassName(base: string, additional?: string) {
  return additional ? `${base} ${additional}` : base;
}

export function PhotoCalendarScrollView({
  renderDay,
  renderWeekdays,
  children,
  maxRenderedMonths = DEFAULT_MAX_RENDERED_MONTHS,
  className,
  ...rest
}: PhotoCalendarScrollViewProps) {
  const { monthKey, scroll } = usePhotoCalendarContext('PhotoCalendarScrollView');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const maxMountedMonths = Math.max(1, maxRenderedMonths);

  const { monthKeys, registerMonthRef, monthRefs, extendWindow, ensureMonthInWindow } =
    useCalendarMonthWindow({
      scroll,
      visibleMonthKey: monthKey,
      maxMountedMonths,
    });

  useCalendarWindowExpansionObserver({
    containerRef,
    topSentinelRef,
    bottomSentinelRef,
    extendWindow,
  });

  const activeMonthKey = useCalendarActiveMonthTracking({
    containerRef,
    monthRefs,
    monthKeys,
    visibleMonthKey: monthKey,
    scroll,
    ensureMonthInWindow,
  });

  const snapshots = useMemo(
    () => monthKeys.map((key) => scroll.getMonthSnapshot(key)),
    [monthKeys, scroll]
  );
  const activeSnapshot =
    snapshots.find((snapshot) => snapshot.monthKey === activeMonthKey) ??
    scroll.getMonthSnapshot(activeMonthKey);

  const { role: roleProp, ['aria-label']: ariaLabelProp, ...containerProps } = rest;
  const role = roleProp ?? 'grid';
  const ariaLabel =
    ariaLabelProp ?? `Photo calendar timeline – currently viewing ${activeSnapshot.monthLabel}`;
  const containerClassName = combineClassName('calendar-scroll-container', className);

  return (
    <div className="calendar-scroll-view">
      <div
        {...containerProps}
        role={role}
        aria-label={ariaLabel}
        className={containerClassName}
        ref={containerRef}
      >
        <div ref={topSentinelRef} aria-hidden="true" className="calendar-scroll-sentinel" />
        {snapshots.map((snapshot) => {
          const isActive = snapshot.monthKey === activeMonthKey;
          const headerId = `calendar-month-${snapshot.monthKey}`;

          return (
            <section
              key={snapshot.monthKey}
              className="calendar-month-section"
              data-month-key={snapshot.monthKey}
              aria-labelledby={`${headerId}-header`}
              ref={registerMonthRef(snapshot.monthKey)}
            >
              <div
                id={`${headerId}-header`}
                className={combineClassName(
                  'calendar-month-header',
                  isActive ? 'calendar-month-header--active' : undefined
                )}
                aria-current={isActive ? 'date' : undefined}
              >
                <strong>{snapshot.monthLabel}</strong>
              </div>
              <PhotoCalendarWeekdays>{renderWeekdays}</PhotoCalendarWeekdays>
              <PhotoCalendarMonthGrid renderDay={renderDay} dayStates={snapshot.dayStates} />
            </section>
          );
        })}
        <div ref={bottomSentinelRef} aria-hidden="true" className="calendar-scroll-sentinel" />
        {children}
      </div>
    </div>
  );
}
