import type { HTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePhotoCalendarContext } from '../context/PhotoCalendarContext';
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
const ESTIMATED_MONTH_HEIGHT = 560;

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
  const [activeMonthKey, setActiveMonthKey] = useState<string>(monthKey);
  const activeMonthKeyRef = useRef(activeMonthKey);
  const isProgrammaticScrollRef = useRef(false);
  const hasAlignedInitialRef = useRef(false);
  const lastScrollSyncRef = useRef<string | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const evaluateActiveMonthRef = useRef<() => void>(() => {});
  const monthOrder = useMemo(() => {
    const seeds: string[] = [];
    const seen = new Set<string>();
    if (monthKey) {
      seeds.push(monthKey);
      seen.add(monthKey);
    }
    let prevCursor = monthKey;
    while (prevCursor) {
      const prevCandidate = scroll.getAdjacentMonthKey(prevCursor, -1);
      if (!prevCandidate || seen.has(prevCandidate)) break;
      seeds.unshift(prevCandidate);
      seen.add(prevCandidate);
      prevCursor = prevCandidate;
    }
    let nextCursor = monthKey;
    while (nextCursor) {
      const nextCandidate = scroll.getAdjacentMonthKey(nextCursor, 1);
      if (!nextCandidate || seen.has(nextCandidate)) break;
      seeds.push(nextCandidate);
      seen.add(nextCandidate);
      nextCursor = nextCandidate;
    }
    return seeds;
  }, [monthKey, scroll]);

  const monthIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    monthOrder.forEach((key, index) => {
      map.set(key, index);
    });
    return map;
  }, [monthOrder]);

  const resolvedOverscan = useMemo(() => {
    const effectiveMax = Math.max(1, maxRenderedMonths);
    return Math.max(1, Math.floor((effectiveMax - 1) / 2));
  }, [maxRenderedMonths]);

  const virtualizer = useVirtualizer({
    count: monthOrder.length,
    getItemKey: (index) => monthOrder[index],
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_MONTH_HEIGHT,
    overscan: resolvedOverscan,
    onChange: () => {
      evaluateActiveMonthRef.current();
    },
  });

  const virtualItems = virtualizer.getVirtualItems();

  const scrollToMonthKey = useCallback(
    (targetKey: string, behavior: 'auto' | 'smooth') => {
      const targetIndex = monthIndexMap.get(targetKey);
      if (targetIndex === undefined) {
        return;
      }
      isProgrammaticScrollRef.current = true;
      virtualizer.scrollToIndex(targetIndex, { align: 'start', behavior });
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    },
    [monthIndexMap, virtualizer]
  );

  useEffect(() => {
    const targetIndex = monthIndexMap.get(monthKey);
    if (targetIndex === undefined) {
      return;
    }
    if (!hasAlignedInitialRef.current) {
      hasAlignedInitialRef.current = true;
      if (activeMonthKeyRef.current !== monthKey) {
        activeMonthKeyRef.current = monthKey;
        setActiveMonthKey(monthKey);
      }
      scrollToMonthKey(monthKey, 'auto');
      return;
    }

    if (lastScrollSyncRef.current === monthKey) {
      lastScrollSyncRef.current = null;
      return;
    }

    if (activeMonthKeyRef.current !== monthKey) {
      activeMonthKeyRef.current = monthKey;
      setActiveMonthKey(monthKey);
    }

    scrollToMonthKey(monthKey, 'smooth');
  }, [monthIndexMap, monthKey, scrollToMonthKey]);

  const evaluateActiveMonth = useCallback(() => {
    if (!hasAlignedInitialRef.current) {
      return;
    }
    if (isProgrammaticScrollRef.current) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const currentItems = virtualizer.getVirtualItems();
    if (currentItems.length === 0) {
      return;
    }
    const offset = container.scrollTop;
    let nextActiveKey = monthOrder[currentItems[0]?.index ?? 0] ?? activeMonthKeyRef.current;
    for (const item of currentItems) {
      const key = monthOrder[item.index];
      if (!key) continue;
      if (item.start <= offset + 1) {
        nextActiveKey = key;
      } else {
        break;
      }
    }
    if (!nextActiveKey || nextActiveKey === activeMonthKeyRef.current) {
      return;
    }
    activeMonthKeyRef.current = nextActiveKey;
    setActiveMonthKey(nextActiveKey);
    if (nextActiveKey !== monthKey) {
      lastScrollSyncRef.current = nextActiveKey;
      scroll.syncVisibleMonth(nextActiveKey);
    }
  }, [monthKey, monthOrder, scroll, virtualizer]);

  evaluateActiveMonthRef.current = evaluateActiveMonth;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        evaluateActiveMonth();
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [evaluateActiveMonth]);

  const activeSnapshot = useMemo(
    () => scroll.getMonthSnapshot(activeMonthKey),
    [activeMonthKey, scroll]
  );

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
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const snapshotKey = monthOrder[virtualItem.index];
            const snapshot = snapshotKey ? scroll.getMonthSnapshot(snapshotKey) : null;
            if (!snapshot) {
              return null;
            }
            const isActive = snapshot.monthKey === activeMonthKey;
            const headerId = `calendar-month-${snapshot.monthKey}`;
            return (
              <section
                key={virtualItem.key}
                data-month-key={snapshot.monthKey}
                aria-labelledby={`${headerId}-header`}
                className="calendar-month-section"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
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
        </div>
        {children}
      </div>
    </div>
  );
}
