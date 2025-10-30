import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCalendarMonthWindow } from './useCalendarMonthWindow';

interface ScrollStateBounds {
  min?: string;
  max?: string;
}

function toIndex(key: string) {
  const [year, month] = key.split('-').map(Number);
  return year * 12 + (month - 1);
}

function fromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function createScrollState(bounds: ScrollStateBounds = {}) {
  const minIndex = bounds.min ? toIndex(bounds.min) : null;
  const maxIndex = bounds.max ? toIndex(bounds.max) : null;

  const clampIndex = (index: number) => {
    if (minIndex !== null && index < minIndex) {
      return minIndex;
    }
    if (maxIndex !== null && index > maxIndex) {
      return maxIndex;
    }
    return index;
  };

  return {
    getMonthSnapshot: vi.fn(),
    clampMonthKey: vi.fn((key: string) => {
      const clamped = clampIndex(toIndex(key));
      return fromIndex(clamped);
    }),
    isMonthWithinBounds: vi.fn((key: string) => {
      const index = toIndex(key);
      if (minIndex !== null && index < minIndex) {
        return false;
      }
      if (maxIndex !== null && index > maxIndex) {
        return false;
      }
      return true;
    }),
    syncVisibleMonth: vi.fn(),
    getAdjacentMonthKey: vi.fn((key: string, delta: number) => {
      const nextIndex = toIndex(key) + delta;
      if (minIndex !== null && nextIndex < minIndex) {
        return null;
      }
      if (maxIndex !== null && nextIndex > maxIndex) {
        return null;
      }
      return fromIndex(nextIndex);
    })
  };
}

describe('useCalendarMonthWindow', () => {
  it('builds a balanced month window around the visible month', () => {
    const scroll = createScrollState();
    const { result } = renderHook(() =>
      useCalendarMonthWindow({
        scroll,
        visibleMonthKey: '2030-05',
        maxMountedMonths: 5
      })
    );

    expect(result.current.monthKeys).toEqual(['2030-04', '2030-05', '2030-06']);
  });

  it('extends the window while respecting the max mount count', () => {
    const scroll = createScrollState();
    const { result } = renderHook(() =>
      useCalendarMonthWindow({
        scroll,
        visibleMonthKey: '2030-05',
        maxMountedMonths: 4
      })
    );

    act(() => {
      result.current.extendWindow('next');
    });
    expect(result.current.monthKeys).toEqual(['2030-04', '2030-05', '2030-06', '2030-07']);

    act(() => {
      result.current.extendWindow('next');
    });
    expect(result.current.monthKeys).toEqual(['2030-05', '2030-06', '2030-07', '2030-08']);
  });

  it('centres the window on a requested month within bounds', () => {
    const scroll = createScrollState({ min: '2030-02', max: '2030-05' });
    const { result, rerender } = renderHook(
      ({ visibleMonthKey }) =>
        useCalendarMonthWindow({
          scroll,
          visibleMonthKey,
          maxMountedMonths: 3
        }),
      { initialProps: { visibleMonthKey: '2030-04' } }
    );

    expect(result.current.monthKeys).toEqual(['2030-03', '2030-04', '2030-05']);

    act(() => {
      result.current.extendWindow('next');
    });
    expect(result.current.monthKeys).toEqual(['2030-03', '2030-04', '2030-05']);

    act(() => {
      result.current.ensureMonthInWindow('2030-02');
    });
    expect(result.current.monthKeys).toEqual(['2030-02', '2030-03', '2030-04']);

    rerender({ visibleMonthKey: '2030-02' });
    expect(result.current.monthKeys).toEqual(['2030-02', '2030-03', '2030-04']);
  });
});
