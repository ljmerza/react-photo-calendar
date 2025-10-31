import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseVirtualMonthListParams {
  containerRef: RefObject<HTMLDivElement | null>;
  monthKeys: string[];
  /** Measured heights by month key */
  heights: Map<string, number>;
  /** Fallback height when not measured yet */
  estimatedItemHeight: number;
  /** Extra pixels to render before/after viewport */
  overscanPx?: number;
}

export interface VirtualRange {
  startIndex: number;
  endIndex: number; // inclusive
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}

export interface VirtualResult extends VirtualRange {
  sizes: number[];
  prefix: number[];
  totalHeight: number;
}

export function useVirtualMonthList({
  containerRef,
  monthKeys,
  heights,
  estimatedItemHeight,
  overscanPx = 200,
}: UseVirtualMonthListParams): VirtualResult {
  const [range, setRange] = useState<VirtualRange>(() => ({
    startIndex: 0,
    endIndex: Math.min(2, Math.max(0, monthKeys.length - 1)),
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
  }));
  const rafRef = useRef<number | null>(null);

  const sizeList = useMemo(() => monthKeys.map((k) => heights.get(k) ?? estimatedItemHeight), [estimatedItemHeight, heights, monthKeys]);
  const prefix: number[] = useMemo(() => {
    const out: number[] = new Array(sizeList.length);
    let sum = 0;
    for (let i = 0; i < sizeList.length; i += 1) {
      out[i] = sum;
      sum += sizeList[i];
    }
    return out;
  }, [sizeList]);
  const totalHeight = useMemo(() => sizeList.reduce((a, b) => a + b, 0), [sizeList]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const compute = () => {
      const viewportTop = root.scrollTop;
      const viewportBottom = viewportTop + root.clientHeight;
      const minTop = Math.max(0, viewportTop - overscanPx);
      const maxBottom = viewportBottom + overscanPx;

      // find start index: last prefix <= minTop
      let start = 0;
      for (let i = 0; i < prefix.length; i += 1) {
        if (prefix[i] <= minTop) start = i; else break;
      }
      // find end index: first prefix+size >= maxBottom
      let end = Math.max(start, monthKeys.length - 1);
      let acc = prefix[start];
      for (let i = start; i < sizeList.length; i += 1) {
        acc += sizeList[i];
        end = i;
        if (acc >= maxBottom) break;
      }

      const topSpacerHeight = prefix[start] ?? 0;
      const renderedHeight = (prefix[end] + sizeList[end]) - topSpacerHeight;
      const bottomSpacerHeight = Math.max(0, totalHeight - topSpacerHeight - renderedHeight);

      const next = { startIndex: start, endIndex: end, topSpacerHeight, bottomSpacerHeight };
      setRange((prev) => (
        prev.startIndex === next.startIndex &&
        prev.endIndex === next.endIndex &&
        prev.topSpacerHeight === next.topSpacerHeight &&
        prev.bottomSpacerHeight === next.bottomSpacerHeight
          ? prev
          : next
      ));
    };

    const onScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    compute();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, monthKeys.length, overscanPx, prefix, sizeList, totalHeight]);

  // Recompute when sizes change even without scrolling
  useEffect(() => {
    setRange((prev) => ({ ...prev }));
  }, [prefix, sizeList, totalHeight]);

  return useMemo(() => ({
    ...range,
    sizes: sizeList,
    prefix,
    totalHeight,
  }), [prefix, range, sizeList, totalHeight]);
}
