import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { PhotoCalendarScrollState } from './usePhotoCalendarState';
import type { MonthRefsMap } from './useCalendarMonthWindow';

interface UseCalendarActiveMonthTrackingParams {
  containerRef: RefObject<HTMLDivElement>;
  monthRefs: MutableRefObject<MonthRefsMap>;
  monthKeys: string[];
  visibleMonthKey: string;
  scroll: PhotoCalendarScrollState;
  ensureMonthInWindow: (targetKey: string) => void;
}

export function useCalendarActiveMonthTracking({
  containerRef,
  monthRefs,
  monthKeys,
  visibleMonthKey,
  scroll,
  ensureMonthInWindow,
}: UseCalendarActiveMonthTrackingParams) {
  const [activeMonthKey, setActiveMonthKey] = useState(() => visibleMonthKey);
  const scrollFrameRef = useRef<number | null>(null);
  const lastScrollSyncRef = useRef<string | null>(null);

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
    [containerRef, monthRefs]
  );

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
      if (nextActiveKey !== visibleMonthKey) {
        lastScrollSyncRef.current = nextActiveKey;
        scroll.syncVisibleMonth(nextActiveKey);
      }
    }
  }, [activeMonthKey, containerRef, monthKeys, monthRefs, scroll, visibleMonthKey]);

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
  }, [containerRef, evaluateActiveMonth]);

  useEffect(() => {
    ensureMonthInWindow(visibleMonthKey);

    setActiveMonthKey((previous) => {
      if (previous === visibleMonthKey) {
        return previous;
      }
      return visibleMonthKey;
    });

    if (lastScrollSyncRef.current === visibleMonthKey) {
      lastScrollSyncRef.current = null;
      return;
    }

    scrollToMonthKey(visibleMonthKey);
  }, [ensureMonthInWindow, scrollToMonthKey, visibleMonthKey]);

  useEffect(() => {
    evaluateActiveMonth();
  }, [evaluateActiveMonth, monthKeys]);

  return activeMonthKey;
}
