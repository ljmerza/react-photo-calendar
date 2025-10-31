import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhotoCalendar } from '../PhotoCalendar';

function setRect(el: Element, top: number, height = 100) {
  (el as any).getBoundingClientRect = () => ({
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    height,
    toJSON: () => {}
  });
}

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
    setRect(container, 0, 600);

    const sections = Array.from(container.querySelectorAll('.calendar-month-section')) as HTMLElement[];
    // Expect 3 months (Dec 2029, Jan 2030, Feb 2030)
    expect(sections.length).toBeGreaterThanOrEqual(3);

    // Position months so that February becomes the active (last <= top)
    // December above the top, January near top, February just within threshold
    setRect(sections[0], -200); // Dec 2029
    setRect(sections[1], 0);    // Jan 2030
    setRect(sections[2], 1);    // Feb 2030

    // Trigger scroll evaluation
    fireEvent.scroll(container);

    // aria-label should now reflect February 2030 being active
    const timeline = screen.getByRole('grid', { name: /photo calendar timeline/i });
    expect(timeline.getAttribute('aria-label')).toContain('February 2030');

    // And onVisibleMonthChange should be called with 2030-02
    expect(onVisibleMonthChange).toHaveBeenCalled();
    expect(onVisibleMonthChange.mock.calls.map((c) => c[0])).toContain('2030-02');
  });
});
