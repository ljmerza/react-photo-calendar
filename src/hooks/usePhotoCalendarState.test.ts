import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('invokes onVisibleMonthChange when the effective month updates', async () => {
    const spy = vi.fn();
    const { result } = renderHook(() =>
      usePhotoCalendarState({
        defaultMonthKey: '2030-01',
        onVisibleMonthChange: spy
      })
    );

    await waitFor(() => expect(spy).toHaveBeenCalledWith('2030-01'));

    act(() => {
      result.current.navigation.navigateMonth(1);
    });

    await waitFor(() => expect(spy).toHaveBeenCalledWith('2030-02'));
  });
});

describe('usePhotoCalendarState today in a zone behind UTC', () => {
  beforeEach(() => {
    // 8:51pm on Sep 30 in New York is already Oct 1 in UTC.
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T00:51:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('marks the local date as today', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ monthKey: '2026-09' }));
    const today = result.current.dayStates.filter((day) => day.context.isToday).map((day) => day.context.isoDate);

    expect(today).toEqual(['2026-09-30']);
  });

  it('opens the local month when no month is given', () => {
    const { result } = renderHook(() => usePhotoCalendarState({}));

    expect(result.current.monthKey).toBe('2026-09');
  });

  it('treats the local month as the current one for the today button', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ defaultMonthKey: '2030-01' }));

    act(() => {
      result.current.navigation.goToToday();
    });

    expect(result.current.monthKey).toBe('2026-09');
    expect(result.current.navigation.isTodayDisabled).toBe(true);
  });
});

describe('usePhotoCalendarState today across local midnight', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/New_York');
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    // 11:59pm on Sep 30 in New York.
    vi.setSystemTime(new Date('2026-10-01T03:59:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  const todayIsos = (dayStates: ReturnType<typeof usePhotoCalendarState>['dayStates']) =>
    dayStates.filter((day) => day.context.isToday).map((day) => day.context.isoDate);

  it('moves today to the new date at local midnight while the page stays open', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ monthKey: '2026-09' }));
    expect(todayIsos(result.current.dayStates)).toEqual(['2026-09-30']);
    expect(result.current.navigation.isTodayDisabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(todayIsos(result.current.dayStates)).toEqual(['2026-10-01']);
    expect(result.current.navigation.isTodayDisabled).toBe(false);
  });

  it('catches up when the page becomes visible again after sleeping through midnight', () => {
    const { result } = renderHook(() => usePhotoCalendarState({ monthKey: '2026-09' }));

    // The clock moves on but the midnight timer has not fired, as after a laptop sleep.
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(todayIsos(result.current.dayStates)).toEqual(['2026-10-01']);
  });
});
