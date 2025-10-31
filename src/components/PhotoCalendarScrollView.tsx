import type { HTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePhotoCalendarContext } from '../context/PhotoCalendarContext';
import { PhotoCalendarMonthGrid } from '../primitives/PhotoCalendarMonthGrid';
import { PhotoCalendarWeekdays, type WeekdayRenderProps } from '../primitives/PhotoCalendarWeekdays';
import type { DayRenderProps } from '../types/calendar';
import { useCalendarMonthVisibility } from '../hooks/useCalendarMonthVisibility';
import { useVirtualMonthList } from '../hooks/useVirtualMonthList';

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
  estimatedMonthHeight?: number;
  overscanPx?: number;
  activationHysteresisPx?: number;
  armThresholdPx?: number;
  triggerThresholdPx?: number;
  prependBatchCount?: number;
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
  estimatedMonthHeight = 560,
  overscanPx = 200,
  activationHysteresisPx,
  armThresholdPx = 160,
  triggerThresholdPx = 32,
  prependBatchCount = 6,
  className,
  ...rest
}: PhotoCalendarScrollViewProps) {
  const { monthKey, scroll } = usePhotoCalendarContext('PhotoCalendarScrollView');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Map<string, HTMLElement>>(new Map());
  // Compute a dynamic cap: do not create or extend into future months beyond "today"
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const toIndex = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return y * 12 + (m - 1);
  };
  const todayIndex = toIndex(todayKey);
  const clampToToday = (key: string) => (toIndex(key) > todayIndex ? todayKey : key);
  const isNotInFuture = (key: string | null) => (key ? toIndex(key) <= todayIndex : false);

  const maxMountedMonths = Math.max(1, maxRenderedMonths);

  const buildWindow = useCallback(
    (centerKey: string, targetSize: number) => {
      const center = clampToToday(centerKey);
      const keys: string[] = [center];
      let prevKey = centerKey;
      let nextKey = center;
      while (keys.length < targetSize) {
        const prevCandidate = scroll.getAdjacentMonthKey(prevKey, -1);
        const nextCandidate = scroll.getAdjacentMonthKey(nextKey, 1);
        if (prevCandidate && !keys.includes(prevCandidate)) {
          keys.unshift(prevCandidate);
          prevKey = prevCandidate;
        }
        if (keys.length >= targetSize) break;
        if (nextCandidate && !keys.includes(nextCandidate) && isNotInFuture(nextCandidate)) {
          keys.push(nextCandidate);
          nextKey = nextCandidate;
        }
        if (!prevCandidate && !nextCandidate) break;
      }
      return keys;
    },
    [scroll]
  );

  const [monthKeys, setMonthKeys] = useState<string[]>(() =>
    buildWindow(monthKey, Math.min(3, maxMountedMonths))
  );

  useEffect(() => {
    monthRefs.current.forEach((_node, key) => {
      if (!monthKeys.includes(key)) monthRefs.current.delete(key);
    });
  }, [monthKeys]);

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

  const extendWindow = useCallback(
    (direction: 'prev' | 'next') => {
      setMonthKeys((prev) => {
        if (prev.length === 0) return prev;
        const pivot = direction === 'prev' ? prev[0] : prev[prev.length - 1];
        const delta = direction === 'prev' ? -1 : 1;
        const adjacent = scroll.getAdjacentMonthKey(pivot, delta);
        if (!adjacent || prev.includes(adjacent)) return prev;
        if (direction === 'next' && !isNotInFuture(adjacent)) return prev;
        const next = direction === 'prev' ? [adjacent, ...prev] : [...prev, adjacent];
        if (next.length <= maxMountedMonths) return next;
        return direction === 'prev' ? next.slice(0, maxMountedMonths) : next.slice(next.length - maxMountedMonths);
      });
    },
    [maxMountedMonths, scroll]
  );

  const ensureMonthInWindow = useCallback(
    (targetKey: string) => {
      const clamped = clampToToday(targetKey);
      setMonthKeys((prev) => {
        if (prev.length === 0) return [clamped];
        if (prev.includes(clamped)) return prev;
        const first = prev[0];
        const last = prev[prev.length - 1];
        const next: string[] = [...prev];
        if (toIndex(clamped) < toIndex(first)) {
          // Fill backwards until clamped is included
          let pivot = first;
          while (toIndex(clamped) < toIndex(pivot)) {
            const prevKey = scroll.getAdjacentMonthKey(pivot, -1);
            if (!prevKey) break;
            next.unshift(prevKey);
            pivot = prevKey;
          }
          return next;
        }
        // Fill forwards until clamped is included (never past today)
        let pivot = last;
        while (toIndex(clamped) > toIndex(pivot)) {
          const nxt = scroll.getAdjacentMonthKey(pivot, 1);
          if (!nxt || !isNotInFuture(nxt)) break;
          next.push(nxt);
          pivot = nxt;
        }
        return next;
      });
    },
    [clampToToday, isNotInFuture, scroll]
  );

  const [activeMonthKey, setActiveMonthKey] = useState<string>(monthKey);
  const activeMonthKeyRef = useRef(activeMonthKey);
  const isProgrammaticScrollRef = useRef(false);
  const hasAlignedInitialRef = useRef(false);
  const lastScrollSyncRef = useRef<string | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const sectionHeightsRef = useRef<Map<string, number>>(new Map());
  const extendBusyRef = useRef(false);
  const lastExtendAtRef = useRef(0);
  const topExtendArmedRef = useRef(false);

  const virtual = useVirtualMonthList({
    containerRef,
    monthKeys,
    heights: sectionHeightsRef.current,
    estimatedItemHeight: estimatedMonthHeight,
    overscanPx,
  });
  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight, sizes: virtualSizes, prefix: virtualPrefix } = virtual;
  const renderKeys = monthKeys.slice(startIndex, endIndex + 1);

  const scrollToMonthKey = useCallback((targetKey: string, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;
    const node = monthRefs.current.get(targetKey);
    let desiredScrollTop: number | null = null;
    if (node) {
      const targetTop = node.offsetTop - container.offsetTop + topSpacerHeight;
      const targetCenter = targetTop + node.offsetHeight / 2;
      desiredScrollTop = Math.max(0, targetCenter - container.clientHeight / 2);
    } else {
      const index = monthKeys.indexOf(targetKey);
      if (index >= 0) {
        const itemTop = virtualPrefix[index] ?? 0;
        const itemHeight = virtualSizes[index] ?? estimatedMonthHeight;
        desiredScrollTop = Math.max(0, itemTop + itemHeight / 2 - container.clientHeight / 2);
      }
    }
    if (desiredScrollTop === null) return;
    if (behavior === 'smooth') {
      container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' });
    } else {
      container.scrollTop = desiredScrollTop;
    }
  }, [estimatedMonthHeight, monthKeys, topSpacerHeight, virtualPrefix, virtualSizes]);

  // Initial alignment
  useEffect(() => {
    const clampedKey = clampToToday(monthKey);
    ensureMonthInWindow(clampedKey);
    if (hasAlignedInitialRef.current) return;
    const id = requestAnimationFrame(() => {
      hasAlignedInitialRef.current = true;
      if (activeMonthKeyRef.current !== clampedKey) {
        activeMonthKeyRef.current = clampedKey;
        setActiveMonthKey(clampedKey);
      }
      isProgrammaticScrollRef.current = true;
      scrollToMonthKey(clampedKey, 'auto');
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [ensureMonthInWindow, monthKey, scrollToMonthKey]);

  // External monthKey changes
  useEffect(() => {
    if (!hasAlignedInitialRef.current) return;
    const clampedKey = clampToToday(monthKey);
    if (lastScrollSyncRef.current === clampedKey) {
      lastScrollSyncRef.current = null;
      return;
    }
    ensureMonthInWindow(clampedKey);
    if (activeMonthKeyRef.current !== clampedKey) {
      activeMonthKeyRef.current = clampedKey;
      setActiveMonthKey(clampedKey);
    }
    isProgrammaticScrollRef.current = true;
    scrollToMonthKey(clampedKey);
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [ensureMonthInWindow, monthKey, scrollToMonthKey]);

  // Only render the heavy month grid when the section is actually visible within the virtual range
  const visibleSet = useCalendarMonthVisibility({
    containerRef,
    monthRefs,
    monthKeys: renderKeys,
    threshold: 0.01,
  });

  // Cache measured section heights for offscreen placeholders
  useEffect(() => {
    visibleSet.forEach((key) => {
      const node = monthRefs.current.get(key);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.height > 0) {
        sectionHeightsRef.current.set(key, rect.height);
      }
    });
  }, [visibleSet, monthRefs]);

  // Add earlier months above the current first key and compensate scrollTop to preserve viewport
  const prependEarlierMonths = useCallback((count: number) => {
    const root = containerRef.current;
    if (!root || extendBusyRef.current) return;
    const nowTs = performance.now?.() ?? Date.now();
    if (nowTs - lastExtendAtRef.current < 150) return;
    extendBusyRef.current = true;
    lastExtendAtRef.current = nowTs;

    setMonthKeys((prev) => {
      if (prev.length === 0) return prev;
      let pivot = prev[0];
      const newKeys: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const prevKey = scroll.getAdjacentMonthKey(pivot, -1);
        if (!prevKey) break;
        newKeys.unshift(prevKey);
        pivot = prevKey;
      }
      if (newKeys.length === 0) {
        extendBusyRef.current = false;
        return prev;
      }
      const added = newKeys.reduce((sum, k) => sum + (sectionHeightsRef.current.get(k) ?? estimatedMonthHeight), 0);
      requestAnimationFrame(() => {
        root.scrollTop += added;
        extendBusyRef.current = false;
        topExtendArmedRef.current = false;
      });
      return [...newKeys, ...prev];
    });
  }, [estimatedMonthHeight, scroll]);

  // Append next months (up to today) when reaching the end of loaded keys
  useEffect(() => {
    const lastIndex = monthKeys.length - 1;
    const nearingEnd = endIndex >= lastIndex - 1;
    if (!nearingEnd) return;
    const lastKey = monthKeys[monthKeys.length - 1];
    const nxt = scroll.getAdjacentMonthKey(lastKey, 1);
    if (!nxt || !isNotInFuture(nxt)) return;
    setMonthKeys((prev) => (prev.includes(nxt) ? prev : [...prev, nxt]));
  }, [endIndex, isNotInFuture, monthKeys, scroll]);

  // Active month tracking on scroll (center-based)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const HYSTERESIS_PX = activationHysteresisPx ?? Math.max(24, Math.floor(container.clientHeight * 0.1));
    const ARM_THRESHOLD = armThresholdPx; // user must scroll this far from top to arm another prepend
    const TRIGGER_THRESHOLD = triggerThresholdPx; // near-top threshold to trigger a prepend when armed
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        // Arm when sufficiently away from top; disarm on prepend
        if (container.scrollTop > ARM_THRESHOLD) {
          topExtendArmedRef.current = true;
        }
        // Trigger once per approach when near the top
        if (container.scrollTop <= TRIGGER_THRESHOLD && topExtendArmedRef.current) {
          prependEarlierMonths(prependBatchCount);
        }
        const containerRect = container.getBoundingClientRect();
        const containerCenterY = containerRect.top + container.clientHeight / 2;

        let bestKey = activeMonthKeyRef.current;
        let bestDelta = Number.POSITIVE_INFINITY;

        for (const key of renderKeys) {
          const node = monthRefs.current.get(key);
          if (!node) continue;
          const rect = node.getBoundingClientRect();
          const sectionCenterY = rect.top + rect.height / 2;
          const delta = Math.abs(sectionCenterY - containerCenterY);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestKey = key;
          }
        }

        // Hysteresis: switch only when significantly closer than current
        if (bestKey !== activeMonthKeyRef.current) {
          // Only switch if improvement exceeds hysteresis or current is out of view
          const currentNode = monthRefs.current.get(activeMonthKeyRef.current);
          let shouldSwitch = true;
          if (currentNode) {
            const r = currentNode.getBoundingClientRect();
            const currentDelta = Math.abs((r.top + r.height / 2) - containerCenterY);
            shouldSwitch = bestDelta + 1 < currentDelta - HYSTERESIS_PX;
          }
          if (shouldSwitch) {
            activeMonthKeyRef.current = bestKey;
            setActiveMonthKey(bestKey);
            const clampedKey = clampToToday(monthKey);
            if (bestKey !== clampedKey) {
              lastScrollSyncRef.current = bestKey;
              scroll.syncVisibleMonth(bestKey);
            }
          }
        }
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    // fire once in case initial viewport already shows multiple months
    onScroll();
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [monthKeys, monthKey, scroll, activationHysteresisPx, armThresholdPx, triggerThresholdPx, prependBatchCount]);

  const snapshots = useMemo(() => renderKeys.map((key) => scroll.getMonthSnapshot(key)), [renderKeys, scroll]);
  const activeSnapshot = snapshots.find((s) => s.monthKey === activeMonthKey) ?? scroll.getMonthSnapshot(activeMonthKey);

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
        <div aria-hidden="true" style={{ height: topSpacerHeight }} />
        {snapshots.map((snapshot) => {
          const isActive = snapshot.monthKey === activeMonthKey;
          const headerId = `calendar-month-${snapshot.monthKey}`;
          const isVisible = visibleSet.has(snapshot.monthKey);

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
              {isVisible ? (
                <>
                  <PhotoCalendarWeekdays>{renderWeekdays}</PhotoCalendarWeekdays>
                  <PhotoCalendarMonthGrid renderDay={renderDay} dayStates={snapshot.dayStates} />
                </>
              ) : (
                <div aria-hidden="true" style={{ height: sectionHeightsRef.current.get(snapshot.monthKey) ?? 480 }} />
              )}
            </section>
          );
        })}
        <div aria-hidden="true" style={{ height: bottomSpacerHeight }} />
        {children}
      </div>
    </div>
  );
}
