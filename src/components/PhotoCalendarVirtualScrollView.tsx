import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePhotoCalendarContext } from '../context/PhotoCalendarContext';
import { PhotoCalendarMonthGrid } from '../primitives/PhotoCalendarMonthGrid';
import { PhotoCalendarWeekdays, type WeekdayRenderProps } from '../primitives/PhotoCalendarWeekdays';
import type { PhotoCalendarDayState, PhotoCalendarMonthSnapshot } from '../hooks/usePhotoCalendarState';
import type { DayRenderProps } from '../types/calendar';
import { addMonths, formatMonthKey, getLocalToday, parseMonthKey } from '../utils/calendar';

export interface VirtualMonthRange {
  /** Months listed before today's month. Default 120. */
  before?: number;
  /** Months listed after today's month. Default 120. */
  after?: number;
}

export interface PhotoCalendarVirtualScrollViewProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Custom renderer for day cells.
   */
  renderDay?: (props: DayRenderProps) => ReactNode;
  /**
   * Custom renderer for weekday headers.
   */
  renderWeekdays?: (props: WeekdayRenderProps) => ReactNode;
  /**
   * Optional developer scaffolding slot rendered inside the scroll container.
   */
  children?: ReactNode;
  /**
   * First day of the week, used to estimate how many week rows a month needs before it is measured.
   */
  firstDayOfWeek?: number;
  /**
   * How far the list reaches around today's month. `minMonthKey`/`maxMonthKey` still apply.
   */
  range?: VirtualMonthRange;
  /**
   * Height of the scroll container. "fill" (the default) stretches it from its top edge to the bottom of the viewport.
   */
  height?: 'fill' | CSSProperties['height'];
  /**
   * How long the visible months must stay put before their photos load and the active month is reported.
   * Scrolling past a month faster than this never loads its images. Default 150ms.
   */
  settleDelayMs?: number;
  /**
   * Months rendered above and below the viewport. Default 1.
   */
  overscan?: number;
  /**
   * Fired with the rendered months (visible plus overscan) once scrolling settles. Fetch their entries here.
   */
  onMonthsInViewChange?: (monthKeys: string[]) => void;
}

const DEFAULT_RANGE = 120;
const DEFAULT_SETTLE_DELAY_MS = 150;
// Everything in a month section except its week rows: header, weekday row,
// gaps and bottom padding. Only used until the month has been measured.
const ESTIMATED_CHROME_PX = 130;
const FALLBACK_LIST_WIDTH_PX = 360;
const MIN_FILL_HEIGHT_PX = 320;

function combineClassName(base: string, additional?: string) {
  return additional ? `${base} ${additional}` : base;
}

function countWeekRows(monthDate: Date, firstDayOfWeek: number) {
  const leading = (monthDate.getUTCDay() - firstDayOfWeek + 7) % 7;
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.ceil((leading + daysInMonth) / 7);
}

/**
 * Placeholder days never show photos: those photos already appear in their
 * own month right above or below. Current-month days keep theirs only once
 * the month has settled, so scrolling past it loads nothing.
 */
function withVisiblePhotos(dayStates: PhotoCalendarDayState[], showCurrentMonthPhotos: boolean) {
  return dayStates.map((dayState) => {
    const keep = showCurrentMonthPhotos && dayState.cell.inCurrentMonth;
    if (keep || dayState.context.photos.length === 0) return dayState;
    return { ...dayState, context: { ...dayState.context, photos: [], visibleThumbnails: [], overflow: 0 } };
  });
}

interface VirtualMonthProps {
  snapshot: PhotoCalendarMonthSnapshot;
  index: number;
  start: number;
  isActive: boolean;
  isSettled: boolean;
  measureRef: (node: HTMLElement | null) => void;
  renderDay?: (props: DayRenderProps) => ReactNode;
  renderWeekdays?: (props: WeekdayRenderProps) => ReactNode;
}

const VirtualMonth = memo(function VirtualMonth({
  snapshot,
  index,
  start,
  isActive,
  isSettled,
  measureRef,
  renderDay,
  renderWeekdays
}: VirtualMonthProps) {
  const dayStates = useMemo(() => withVisiblePhotos(snapshot.dayStates, isSettled), [snapshot.dayStates, isSettled]);
  const headerId = `calendar-month-${snapshot.monthKey}-header`;

  return (
    <section
      ref={measureRef}
      data-index={index}
      data-month-key={snapshot.monthKey}
      data-settled={isSettled ? '' : undefined}
      className="calendar-month-section calendar-virtual-month"
      // `top`, not a translateY transform: Chrome mispositions the sticky month header inside a transformed section.
      style={{ top: start }}
      aria-labelledby={headerId}
    >
      <div
        id={headerId}
        className={combineClassName('calendar-month-header', isActive ? 'calendar-month-header--active' : undefined)}
        aria-current={isActive ? 'date' : undefined}
      >
        <strong>{snapshot.monthLabel}</strong>
      </div>
      <PhotoCalendarWeekdays>{renderWeekdays}</PhotoCalendarWeekdays>
      <PhotoCalendarMonthGrid renderDay={renderDay} dayStates={dayStates} />
    </section>
  );
});

/**
 * A virtualized month timeline: one scroll container listing years of months,
 * of which only the visible ones (plus `overscan`) are mounted. A month's
 * photos load once it has stayed in view for `settleDelayMs`, so flinging
 * across years loads nothing on the way.
 */
export function PhotoCalendarVirtualScrollView({
  renderDay,
  renderWeekdays,
  children,
  firstDayOfWeek = 0,
  range,
  height = 'fill',
  settleDelayMs = DEFAULT_SETTLE_DELAY_MS,
  overscan = 1,
  onMonthsInViewChange,
  className,
  style,
  ...rest
}: PhotoCalendarVirtualScrollViewProps) {
  const { monthKey, scroll } = usePhotoCalendarContext('PhotoCalendarVirtualScrollView');
  const { getMonthSnapshot, isMonthWithinBounds, clampMonthKey } = scroll;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // The list is anchored on today's month as of mount, so its indexes stay
  // stable while the page is open.
  const [anchorKey] = useState(() => formatMonthKey(addMonths(getLocalToday(), 0)));
  const before = range?.before ?? DEFAULT_RANGE;
  const after = range?.after ?? DEFAULT_RANGE;
  const defaultFirstKey = formatMonthKey(addMonths(parseMonthKey(anchorKey), -before));
  const defaultLastKey = formatMonthKey(addMonths(parseMonthKey(anchorKey), after));
  // A month outside the default range (e.g. an old link) stretches the list to reach it.
  const firstKey = monthKey < defaultFirstKey ? monthKey : defaultFirstKey;
  const lastKey = monthKey > defaultLastKey ? monthKey : defaultLastKey;

  const { monthKeys, weekRows, indexByKey } = useMemo(() => {
    const keys: string[] = [];
    const rows: number[] = [];
    const last = parseMonthKey(lastKey);
    for (let date = parseMonthKey(firstKey); date <= last; date = addMonths(date, 1)) {
      const key = formatMonthKey(date);
      if (!isMonthWithinBounds(key)) continue;
      keys.push(key);
      rows.push(countWeekRows(date, firstDayOfWeek));
    }
    if (keys.length === 0) {
      const key = clampMonthKey(monthKey);
      keys.push(key);
      rows.push(countWeekRows(parseMonthKey(key), firstDayOfWeek));
    }
    return { monthKeys: keys, weekRows: rows, indexByKey: new Map(keys.map((key, index) => [key, index])) };
    // monthKey only matters when no month is within bounds; firstKey/lastKey already track it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, lastKey, firstDayOfWeek, isMonthWithinBounds, clampMonthKey]);

  const indexForMonth = useCallback(
    (key: string) => indexByKey.get(key) ?? indexByKey.get(clampMonthKey(key)) ?? 0,
    [clampMonthKey, indexByKey]
  );

  const estimateSize = useCallback(
    (index: number) => {
      const width = listRef.current?.clientWidth || FALLBACK_LIST_WIDTH_PX;
      return ESTIMATED_CHROME_PX + weekRows[index] * (width / 7);
    },
    [weekRows]
  );
  const getItemKey = useCallback((index: number) => monthKeys[index], [monthKeys]);

  const virtualizer = useVirtualizer({
    count: monthKeys.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    getItemKey,
    overscan
  });

  // Snapshots are rebuilt only when the calendar data changes, not on every scroll frame.
  const snapshotCacheRef = useRef({ source: getMonthSnapshot, byKey: new Map<string, PhotoCalendarMonthSnapshot>() });
  if (snapshotCacheRef.current.source !== getMonthSnapshot) {
    snapshotCacheRef.current = { source: getMonthSnapshot, byKey: new Map() };
  }
  const getSnapshot = (key: string) => {
    const { byKey } = snapshotCacheRef.current;
    let snapshot = byKey.get(key);
    if (!snapshot) {
      snapshot = getMonthSnapshot(key);
      byKey.set(key, snapshot);
    }
    return snapshot;
  };

  const items = virtualizer.getVirtualItems();
  const renderedKeys = items.map((item) => monthKeys[item.index]);
  // The active month is the one under the top edge. The last months can never
  // reach the top, so once the list is scrolled to the bottom the last month is active.
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const viewportHeight = virtualizer.scrollRect?.height ?? 0;
  const isAtEnd = viewportHeight > 0 && scrollOffset + viewportHeight >= virtualizer.getTotalSize() - 2;
  const activeItem = isAtEnd ? undefined : virtualizer.getVirtualItemForOffset(scrollOffset + 1);
  const activeKey = isAtEnd ? monthKeys[monthKeys.length - 1] : activeItem ? monthKeys[activeItem.index] : monthKey;

  const latestRef = useRef({ renderedKeys, activeKey, monthKey, scroll, onMonthsInViewChange });
  latestRef.current = { renderedKeys, activeKey, monthKey, scroll, onMonthsInViewChange };
  // Month keys this view reported through syncVisibleMonth; their echo through
  // the monthKey prop must not scroll the list again.
  const emittedKeysRef = useRef<Set<string>>(new Set());
  // Set while a programmatic jump lands; the settle after it reports nothing.
  const jumpingRef = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || height !== 'fill') return;
    const fill = () => {
      const top = container.getBoundingClientRect().top + window.scrollY;
      container.style.height = `${Math.max(MIN_FILL_HEIGHT_PX, window.innerHeight - top)}px`;
    };
    fill();
    window.addEventListener('resize', fill);
    return () => {
      window.removeEventListener('resize', fill);
      container.style.height = '';
    };
  }, [height]);

  // Open on the requested month. Runs after the fill effect so the container already has its height.
  const alignedRef = useRef(false);
  useLayoutEffect(() => {
    if (alignedRef.current) return;
    alignedRef.current = true;
    jumpingRef.current = true;
    virtualizer.scrollToIndex(indexForMonth(monthKey), { align: 'start' });
  }, [indexForMonth, monthKey, virtualizer]);

  // Follow monthKey changes that did not come from scrolling this list.
  const previousMonthKeyRef = useRef(monthKey);
  useEffect(() => {
    if (previousMonthKeyRef.current === monthKey) return;
    previousMonthKeyRef.current = monthKey;
    if (emittedKeysRef.current.has(monthKey)) {
      emittedKeysRef.current.clear();
      return;
    }
    emittedKeysRef.current.clear();
    if (monthKey === latestRef.current.activeKey) return;
    jumpingRef.current = true;
    virtualizer.scrollToIndex(indexForMonth(monthKey), { align: 'start' });
  }, [indexForMonth, monthKey, virtualizer]);

  const [settledKeys, setSettledKeys] = useState<ReadonlySet<string>>(() => new Set());
  const settleSignature = `${renderedKeys.join(',')}|${activeKey}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      const latest = latestRef.current;
      setSettledKeys((previous) =>
        previous.size === latest.renderedKeys.length && latest.renderedKeys.every((key) => previous.has(key))
          ? previous
          : new Set(latest.renderedKeys)
      );
      if (jumpingRef.current) {
        jumpingRef.current = false;
        return;
      }
      if (latest.activeKey !== latest.monthKey) {
        emittedKeysRef.current.add(latest.activeKey);
        latest.scroll.syncVisibleMonth(latest.activeKey);
      }
    }, settleDelayMs);
    return () => clearTimeout(timer);
  }, [settleSignature, settleDelayMs]);

  useEffect(() => {
    if (settledKeys.size === 0) return;
    latestRef.current.onMonthsInViewChange?.(monthKeys.filter((key) => settledKeys.has(key)));
  }, [monthKeys, settledKeys]);

  const activeSnapshot = getSnapshot(activeKey);
  const { role: roleProp, ['aria-label']: ariaLabelProp, ...containerProps } = rest;
  const role = roleProp ?? 'grid';
  const ariaLabel = ariaLabelProp ?? `Photo calendar timeline – currently viewing ${activeSnapshot.monthLabel}`;

  return (
    <div
      {...containerProps}
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      className={combineClassName('calendar-virtual-container', className)}
      style={height === 'fill' ? style : { height, ...style }}
    >
      <div ref={listRef} className="calendar-virtual-list" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const key = monthKeys[item.index];
          return (
            <VirtualMonth
              key={item.key}
              snapshot={getSnapshot(key)}
              index={item.index}
              start={item.start}
              isActive={key === activeKey}
              isSettled={settledKeys.has(key)}
              measureRef={virtualizer.measureElement}
              renderDay={renderDay}
              renderWeekdays={renderWeekdays}
            />
          );
        })}
      </div>
      {children}
    </div>
  );
}
