import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePhotoCalendarState } from './usePhotoCalendarState';

describe('usePhotoCalendarState', () => {
  it('produces day states including selectable days for the active month', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ monthKey: '2030-01' }));

    expect(result.current.dayStates).toHaveLength(35);
    const firstSelectable = result.current.dayStates.find((day) => day.isSelectable);
    expect(firstSelectable?.context.day).toBe(1);
    expect(firstSelectable?.context.isoDate).toBe('2030-01-01');
  });

  it('advances internal month when uncontrolled navigation is invoked', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ defaultMonthKey: '2030-01' }));

    act(() => {
      result.current.navigation.navigateMonth(1);
    });

    expect(result.current.monthKey).toBe('2030-02');
  });

  it('calls onRangeChange with visible bounds', async () => {
    const rangeSpy = vi.fn();
    renderHook(() =>
      usePhotoCalendarState({
        monthKey: '2030-01',
        onRangeChange: rangeSpy
      })
    );

    await waitFor(() =>
      expect(rangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          startIso: '2029-12-30',
          endIso: '2030-02-02'
        })
      )
    );
  });

  it('respects min and max month bounds for navigation helpers', () => {
    const { result } = renderHook(() =>
      usePhotoCalendarState({
        monthKey: '2030-02',
        minMonthKey: '2030-01',
        maxMonthKey: '2030-03'
      })
    );

    expect(result.current.navigation.canNavigatePrevMonth).toBe(true);
    expect(result.current.navigation.canNavigateNextMonth).toBe(true);
    expect(result.current.navigation.isMonthDisabled(0)).toBe(false);
    expect(result.current.navigation.isMonthDisabled(3)).toBe(true);
  });

  it('returns photo metrics per day state', () => {
    const { result } = renderHook(() =>
      usePhotoCalendarState({
        monthKey: '2030-01',
        maxThumbnailsPerDay: 1,
        entries: [
          {
            datetime: '2030-01-05T00:00:00Z',
            photos: ['a.jpg', 'b.jpg']
          }
        ]
      })
    );

    const target = result.current.dayStates.find((day) => day.context.isoDate === '2030-01-05');
    expect(target).toBeDefined();
    expect(target!.context.visibleThumbnails).toHaveLength(1);
    expect(target!.context.overflow).toBe(1);
  });
});
