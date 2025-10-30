import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarBanner } from './CalendarBanner';
import { PhotoCalendarContextProvider } from '../context/PhotoCalendarContext';
import type { PhotoCalendarNavigationState, PhotoCalendarScrollState, PhotoCalendarState } from '../hooks/usePhotoCalendarState';

function createNavigation(overrides: Partial<PhotoCalendarNavigationState> = {}): PhotoCalendarNavigationState {
  return {
    canNavigatePrevMonth: true,
    canNavigateNextMonth: true,
    canNavigatePrevYear: true,
    canNavigateNextYear: true,
    isTodayDisabled: false,
    navigateMonth: vi.fn(),
    navigateYear: vi.fn(),
    navigateToMonth: vi.fn(),
    goToToday: vi.fn(),
    isMonthDisabled: vi.fn(() => false),
    ...overrides
  };
}

function createScrollState(overrides: Partial<PhotoCalendarScrollState> = {}): PhotoCalendarScrollState {
  return {
    getMonthSnapshot: vi.fn(),
    getAdjacentMonthKey: vi.fn(),
    clampMonthKey: vi.fn((key: string) => key),
    isMonthWithinBounds: vi.fn(() => true),
    syncVisibleMonth: vi.fn(),
    ...overrides
  };
}

function createState(overrides: Partial<PhotoCalendarState> = {}): PhotoCalendarState {
  const navigation = overrides.navigation ?? createNavigation();
  const scroll = overrides.scroll ?? createScrollState();
  return {
    currentYear: 2030,
    currentMonth: 5,
    monthDate: new Date(Date.UTC(2030, 5, 1)),
    monthKey: '2030-06',
    monthLabel: 'June 2030',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdayLabels: {
      short: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      long: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    },
    visibleRange: null,
    dayStates: [],
    isControlled: false,
    ...overrides,
    navigation,
    scroll
  };
}

function renderWithContext(state: PhotoCalendarState) {
  return render(
    <PhotoCalendarContextProvider value={state}>
      <CalendarBanner />
    </PhotoCalendarContextProvider>
  );
}

describe('CalendarBanner', () => {
  it('routes navigation button clicks to the provided navigation state', () => {
    const navigation = createNavigation();
    const state = createState({ navigation });
    renderWithContext(state);

    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Feb 2030' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to current month' }));

    expect(navigation.navigateYear).toHaveBeenCalledWith(-1);
    expect(navigation.navigateYear).toHaveBeenCalledWith(1);
    expect(navigation.navigateMonth).toHaveBeenCalledWith(-1);
    expect(navigation.navigateMonth).toHaveBeenCalledWith(1);
    expect(navigation.navigateToMonth).toHaveBeenCalledWith(1);
    expect(navigation.goToToday).toHaveBeenCalledTimes(1);
  });

  it('disables controls based on navigation capability flags', () => {
    const navigation = createNavigation({
      canNavigatePrevMonth: false,
      canNavigateNextMonth: false,
      canNavigatePrevYear: false,
      canNavigateNextYear: false,
      isTodayDisabled: true,
      isMonthDisabled: vi.fn((index: number) => index === 1)
    });
    const state = createState({ navigation });
    renderWithContext(state);

    expect(screen.getByRole('button', { name: 'Previous year' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Next year' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Previous month' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Next month' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Go to current month' }).hasAttribute('disabled')).toBe(true);

    const febChip = screen.getByRole('button', { name: 'Go to Feb 2030' });
    expect(febChip.hasAttribute('disabled')).toBe(true);
    expect(navigation.isMonthDisabled).toHaveBeenCalledWith(1);
  });
});
