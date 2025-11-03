import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PhotoCalendar } from '../PhotoCalendar';

beforeAll(() => {
  if (typeof window.ResizeObserver === 'undefined') {
    class MockResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('PhotoCalendarScrollView (integration)', () => {
  it('promotes next month when its header crosses the top edge', async () => {
    // Make rAF synchronous to avoid timing flakiness in tests
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
      cb(0);
      return 1 as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const onVisibleMonthChange = vi.fn();
    render(
      <PhotoCalendar defaultMonthKey="2030-01" navigationMode="scroll" onVisibleMonthChange={onVisibleMonthChange} />
    );

    const container = screen.getByRole('grid', { name: /photo calendar timeline/i });

    const sections = Array.from(container.querySelectorAll('.calendar-month-section')) as HTMLElement[];
    // Expect 3 months (Dec 2029, Jan 2030, Feb 2030)
    expect(sections.length).toBeGreaterThanOrEqual(3);

    const estimatedHeight = sections[0].getBoundingClientRect().height || 560;
    // Scroll so that February becomes the active month (index 2)
    container.scrollTop = estimatedHeight * 2 + 1;
    fireEvent.scroll(container);

    // aria-label should now reflect February 2030 being active
    await waitFor(() => {
      const timeline = screen.getByRole('grid', { name: /photo calendar timeline/i });
      expect(timeline.getAttribute('aria-label')).toContain('February 2030');
    });

    // And onVisibleMonthChange should be called with 2030-02
    await waitFor(() => {
      expect(onVisibleMonthChange).toHaveBeenCalled();
      expect(onVisibleMonthChange.mock.calls.map((c) => c[0])).toContain('2030-02');
    });
  });
});
