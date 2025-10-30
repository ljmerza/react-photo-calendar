import { useEffect } from 'react';
import type { RefObject } from 'react';

interface UseCalendarWindowExpansionObserverParams {
  containerRef: RefObject<HTMLDivElement>;
  topSentinelRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
  extendWindow: (direction: 'prev' | 'next') => void;
}

export function useCalendarWindowExpansionObserver({
  containerRef,
  topSentinelRef,
  bottomSentinelRef,
  extendWindow,
}: UseCalendarWindowExpansionObserverParams) {
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
  }, [containerRef, topSentinelRef, bottomSentinelRef, extendWindow]);
}
