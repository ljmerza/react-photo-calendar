import type { HTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const INITIAL_WINDOW_COUNT = 3;

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
  const monthRefs = useRef(new Map<string, HTMLElement>());
  const scrollFrameRef = useRef<number | null>(null);
  const lastScrollSyncRef = useRef<string | null>(null);

  const maxMountedMonths = Math.max(1, maxRenderedMonths);
  const initialWindowSize = Math.min(INITIAL_WINDOW_COUNT, maxMountedMonths);

  const buildWindow = useCallback(
    (centerKey: string, targetSize: number) => {
      const keys: string[] = [centerKey];
      let prevKey = centerKey;
      let nextKey = centerKey;

      while (keys.length < targetSize) {
        const prevCandidate = scroll.getAdjacentMonthKey(prevKey, -1);
        const nextCandidate = scroll.getAdjacentMonthKey(nextKey, 1);
        const addedPrev = prevCandidate && !keys.includes(prevCandidate);
        const addedNext = nextCandidate && !keys.includes(nextCandidate);

        if (!addedPrev && !addedNext) {
          break;
        }

        if (addedPrev) {
          keys.unshift(prevCandidate as string);
          prevKey = prevCandidate as string;
        }

        if (keys.length >= targetSize) {
          break;
        }

        if (addedNext) {
          keys.push(nextCandidate as string);
          nextKey = nextCandidate as string;
        }
      }

      return keys;
    },
    [scroll]
  );

  const [monthKeys, setMonthKeys] = useState<string[]>(() => buildWindow(monthKey, initialWindowSize));
  const [activeMonthKey, setActiveMonthKey] = useState(() => monthKey);

  const registerMonthRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (!node) {
        monthRefs.current.delete(key);
        return;
      }
      monthRefs.current.set(key, node);
    },
    []
  );

  useEffect(() => {
    monthRefs.current.forEach((_node, key) => {
      if (!monthKeys.includes(key)) {
        monthRefs.current.delete(key);
      }
    });
  }, [monthKeys]);

  const extendWindow = useCallback(
    (direction: 'prev' | 'next') => {
      setMonthKeys((prev) => {
        if (prev.length === 0) {
          return prev;
        }

        const pivot = direction === 'prev' ? prev[0] : prev[prev.length - 1];
        const adjacent = scroll.getAdjacentMonthKey(pivot, direction === 'prev' ? -1 : 1);

        if (!adjacent || prev.includes(adjacent)) {
          return prev;
        }

        const nextKeys = direction === 'prev' ? [adjacent, ...prev] : [...prev, adjacent];

        if (nextKeys.length <= maxMountedMonths) {
          return nextKeys;
        }

        if (direction === 'prev') {
          return nextKeys.slice(0, maxMountedMonths);
        }

        return nextKeys.slice(nextKeys.length - maxMountedMonths);
      });
    },
    [maxMountedMonths, scroll]
  );

  const ensureMonthInWindow = useCallback(
    (targetKey: string) => {
      setMonthKeys((prev) => {
        if (prev.includes(targetKey)) {
          return prev;
        }
        return buildWindow(targetKey, maxMountedMonths);
      });
    },
    [buildWindow, maxMountedMonths]
  );

  useEffect(() => {
    const root = containerRef.current;
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;

    if (
      typeof IntersectionObserver === 'undefined' ||
      !root ||
      !topSentinel ||
      !bottomSentinel
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          if (entry.target === topSentinel) {
            extendWindow('prev');
          } else if (entry.target === bottomSentinel) {
            extendWindow('next');
          }
        });
      },
      { root, threshold: 0.1 }
    );

    observer.observe(topSentinel);
    observer.observe(bottomSentinel);

    return () => observer.disconnect();
  }, [extendWindow]);

  const evaluateActiveMonth = useCallback(() => {
    const container = containerRef.current;
    if (!container || monthKeys.length === 0) {
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    let nextActiveKey = monthKeys[0];

    for (const key of monthKeys) {
      const section = monthRefs.current.get(key);
      if (!section) {
        continue;
      }
      const rect = section.getBoundingClientRect();
      if (rect.top - containerTop <= 2) {
        nextActiveKey = key;
      } else {
        break;
      }
    }

    if (nextActiveKey !== activeMonthKey) {
      setActiveMonthKey(nextActiveKey);
      if (nextActiveKey !== monthKey) {
        lastScrollSyncRef.current = nextActiveKey;
        scroll.syncVisibleMonth(nextActiveKey);
      }
    }
  }, [activeMonthKey, monthKey, monthKeys, scroll]);

  const scrollToMonthKey = useCallback(
    (targetKey: string, behavior: ScrollBehavior = 'smooth') => {
      const node = monthRefs.current.get(targetKey);
      if (!node) {
        return;
      }
      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'start', behavior });
        return;
      }
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const offsetTop = node.offsetTop - container.offsetTop;
      container.scrollTop = offsetTop;
    },
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
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

  useEffect(() => {
    ensureMonthInWindow(monthKey);

    if (activeMonthKey !== monthKey) {
      setActiveMonthKey(monthKey);
    }

    if (lastScrollSyncRef.current === monthKey) {
      lastScrollSyncRef.current = null;
      return;
    }

    scrollToMonthKey(monthKey);
  }, [activeMonthKey, ensureMonthInWindow, monthKey, scrollToMonthKey]);

  useEffect(() => {
    evaluateActiveMonth();
  }, [evaluateActiveMonth, monthKeys]);

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
