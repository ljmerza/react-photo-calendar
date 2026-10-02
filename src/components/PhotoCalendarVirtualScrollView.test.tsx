import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhotoCalendar } from '../PhotoCalendar';
import type { PhotoEntry } from '../types/photo';

const CONTAINER_HEIGHT = 600;
const MONTH_HEIGHT = 400;
const SETTLE_MS = 150;

// jsdom has no layout: give the container and month sections fixed sizes, and
// make scrollTo move scrollTop and fire a scroll event like a browser would.
function stubLayout() {
  const offsetHeight = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('calendar-virtual-container')) return CONTAINER_HEIGHT;
    if (this.classList.contains('calendar-virtual-month')) return MONTH_HEIGHT;
    return 0;
  });
  const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('calendar-virtual-container') ? 350 : 0;
  });
  // The virtualizer caps jumps at scrollHeight - clientHeight.
  const scrollHeight = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    const list = this.querySelector<HTMLElement>('.calendar-virtual-list');
    return list ? parseFloat(list.style.height) || 0 : 0;
  });
  const clientHeight = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('calendar-virtual-container') ? CONTAINER_HEIGHT : 0;
  });
  const originalScrollTo = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    const top = typeof options === 'object' ? options.top ?? 0 : 0;
    this.scrollTop = top;
    this.dispatchEvent(new Event('scroll'));
  } as typeof Element.prototype.scrollTo;
  return () => {
    offsetHeight.mockRestore();
    offsetWidth.mockRestore();
    scrollHeight.mockRestore();
    clientHeight.mockRestore();
    Element.prototype.scrollTo = originalScrollTo;
  };
}

function getTimeline() {
  return screen.getByRole('grid', { name: /photo calendar timeline/i });
}

function renderedMonthKeys() {
  return Array.from(getTimeline().querySelectorAll<HTMLElement>('.calendar-virtual-month')).map(
    (section) => section.dataset.monthKey
  );
}

function monthSection(monthKey: string) {
  return getTimeline().querySelector<HTMLElement>(`.calendar-virtual-month[data-month-key="${monthKey}"]`);
}

function scrollTimelineTo(top: number) {
  const timeline = getTimeline();
  act(() => {
    timeline.scrollTop = top;
    fireEvent.scroll(timeline);
  });
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS + 10);
  });
}

function photoOn(isoDate: string): PhotoEntry {
  return { datetime: `${isoDate}T12:00:00Z`, photos: [`https://example.test/${isoDate}.jpg`] };
}

let restoreLayout: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  restoreLayout = stubLayout();
});

afterEach(() => {
  cleanup();
  restoreLayout();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PhotoCalendarVirtualScrollView', () => {
  it('mounts only the months around the requested one', () => {
    render(<PhotoCalendar monthKey="2027-01" navigationMode="virtual" virtualHeight={CONTAINER_HEIGHT} />);
    settle();

    const keys = renderedMonthKeys();
    expect(keys).toContain('2027-01');
    // The list spans about 20 years, but only a screenful plus overscan is in the DOM.
    expect(keys.length).toBeLessThanOrEqual(5);
  });

  it("loads a month's photos only once it has stayed in view", () => {
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        entries={[photoOn('2027-01-15')]}
      />
    );

    expect(monthSection('2027-01')?.querySelectorAll('img')).toHaveLength(0);
    settle();
    expect(monthSection('2027-01')?.querySelectorAll('img')).toHaveLength(1);
  });

  it('leaves placeholder days of neighbouring months without photos', () => {
    // January 2027 ends on a Sunday, so its grid shows February 1-6 as placeholders.
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        entries={[photoOn('2027-01-15'), photoOn('2027-02-01')]}
      />
    );
    settle();

    expect(monthSection('2027-01')?.querySelectorAll('img')).toHaveLength(1);
    expect(monthSection('2027-02')?.querySelectorAll('img')).toHaveLength(1);
  });

  it('reports months in view after scrolling settles, skipping months flung past', () => {
    const onMonthsInViewChange = vi.fn();
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthsInViewChange={onMonthsInViewChange}
      />
    );
    settle();
    expect(onMonthsInViewChange).toHaveBeenCalledTimes(1);
    expect(onMonthsInViewChange.mock.calls[0][0]).toContain('2027-01');

    const start = getTimeline().scrollTop;
    // A fast fling: a new month every 20ms, never pausing long enough to settle.
    for (let step = 1; step <= 12; step += 1) {
      scrollTimelineTo(start + step * MONTH_HEIGHT);
      act(() => {
        vi.advanceTimersByTime(20);
      });
    }
    expect(onMonthsInViewChange).toHaveBeenCalledTimes(1);

    settle();
    expect(onMonthsInViewChange).toHaveBeenCalledTimes(2);
    const landed = onMonthsInViewChange.mock.calls[1][0] as string[];
    expect(landed).toContain('2028-01');
    expect(landed).not.toContain('2027-06');
  });

  it('reports the month scrolled to as a scroll-driven month change', () => {
    const onMonthChange = vi.fn();
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthChange={onMonthChange}
      />
    );
    settle();
    // Opening on the requested month is not a change.
    expect(onMonthChange).not.toHaveBeenCalled();

    scrollTimelineTo(getTimeline().scrollTop + 2 * MONTH_HEIGHT + 10);
    settle();

    expect(onMonthChange).toHaveBeenCalledWith('2027-03', { source: 'scroll' });
    expect(getTimeline().querySelector('[aria-current="date"]')?.textContent).toMatch(/March 2027/);
  });

  it('jumps to a month set from outside without echoing it back', () => {
    const onMonthChange = vi.fn();
    const { rerender } = render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthChange={onMonthChange}
      />
    );
    settle();

    rerender(
      <PhotoCalendar
        monthKey="2024-06"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthChange={onMonthChange}
      />
    );
    settle();

    expect(renderedMonthKeys()).toContain('2024-06');
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('keeps month headers as plain text without onMonthHeaderClick', () => {
    render(<PhotoCalendar monthKey="2027-01" navigationMode="virtual" virtualHeight={CONTAINER_HEIGHT} />);
    settle();

    const header = monthSection('2027-01')?.querySelector('.calendar-month-header');
    expect(header?.tagName).toBe('DIV');
    expect(header?.id).toBe('calendar-month-2027-01-header');
    expect(header?.classList.contains('calendar-month-header--interactive')).toBe(false);
    expect(getTimeline().querySelector('button.calendar-month-header')).toBeNull();
    expect(monthSection('2027-01')?.getAttribute('aria-labelledby')).toBe('calendar-month-2027-01-header');
  });

  it('makes month headers buttons that report their month', () => {
    const onMonthHeaderClick = vi.fn();
    const onMonthChange = vi.fn();
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthHeaderClick={onMonthHeaderClick}
        onMonthChange={onMonthChange}
      />
    );
    settle();

    const january = screen.getByRole('button', { name: 'January 2027, choose month' });
    expect(january.classList.contains('calendar-month-header')).toBe(true);
    expect(january.classList.contains('calendar-month-header--interactive')).toBe(true);
    expect(january.getAttribute('type')).toBe('button');
    expect(january.getAttribute('aria-current')).toBe('date');
    fireEvent.click(january);
    expect(onMonthHeaderClick).toHaveBeenCalledWith('2027-01');

    fireEvent.click(screen.getByRole('button', { name: 'February 2027, choose month' }));
    expect(onMonthHeaderClick).toHaveBeenLastCalledWith('2027-02');
    // Tapping a header only reports it; the calendar does not move on its own.
    expect(onMonthChange).not.toHaveBeenCalled();

    // The section is still named by the month alone.
    expect(monthSection('2027-01')?.getAttribute('aria-labelledby')).toBe('calendar-month-2027-01-header');
    expect(document.getElementById('calendar-month-2027-01-header')?.textContent).toBe('January 2027');
  });

  it('lets the month header button label be overridden', () => {
    render(
      <PhotoCalendar
        monthKey="2027-01"
        navigationMode="virtual"
        virtualHeight={CONTAINER_HEIGHT}
        onMonthHeaderClick={() => {}}
        monthHeaderLabel={(label, key) => `Jump from ${label} (${key})`}
      />
    );
    settle();

    expect(screen.getByRole('button', { name: 'Jump from January 2027 (2027-01)' })).toBeTruthy();
  });

  it('calls the latest onMonthHeaderClick after a re-render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <PhotoCalendar monthKey="2027-01" navigationMode="virtual" virtualHeight={CONTAINER_HEIGHT} onMonthHeaderClick={first} />
    );
    settle();
    rerender(
      <PhotoCalendar monthKey="2027-01" navigationMode="virtual" virtualHeight={CONTAINER_HEIGHT} onMonthHeaderClick={second} />
    );

    fireEvent.click(screen.getByRole('button', { name: /January 2027/ }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('2027-01');
  });

  it('does not pass the header props to the paged calendar as DOM attributes', () => {
    render(<PhotoCalendar monthKey="2027-01" onMonthHeaderClick={() => {}} monthHeaderLabel={(label) => label} />);
    const grid = screen.getByRole('grid', { name: /photo calendar for/i });
    expect(grid.hasAttribute('onmonthheaderclick')).toBe(false);
    expect(grid.hasAttribute('monthheaderlabel')).toBe(false);
  });
});

describe('PhotoCalendarVirtualScrollView with page scrolling, newest first', () => {
  let pageScrollY = 0;
  const originalScrollTo = window.scrollTo;
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
  const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

  beforeEach(() => {
    pageScrollY = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => pageScrollY });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: CONTAINER_HEIGHT });
    window.scrollTo = ((options?: ScrollToOptions | number) => {
      pageScrollY = typeof options === 'object' ? options.top ?? 0 : 0;
      window.dispatchEvent(new Event('scroll'));
    }) as typeof window.scrollTo;
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else delete (window as { scrollY?: number }).scrollY;
    if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight);
  });

  function scrollPageTo(top: number) {
    act(() => {
      pageScrollY = top;
      window.dispatchEvent(new Event('scroll'));
    });
  }

  const renderTimeline = (props: { monthKey: string; onMonthChange?: () => void }) =>
    render(
      <PhotoCalendar
        {...props}
        maxMonthKey="2027-06"
        navigationMode="virtual"
        virtualScroll="window"
        virtualOrder="newest-first"
      />
    );

  it('lists the newest month first and leaves the page at the top when opening on it', () => {
    renderTimeline({ monthKey: '2027-06' });
    settle();

    const keys = renderedMonthKeys();
    expect(keys[0]).toBe('2027-06');
    expect(keys[1]).toBe('2027-05');
    expect(window.scrollY).toBe(0);
    expect(getTimeline().classList.contains('calendar-virtual-container--window')).toBe(true);
  });

  it('scrolls the page to an older month it opens on', () => {
    renderTimeline({ monthKey: '2027-01' });
    settle();

    expect(window.scrollY).toBeGreaterThan(0);
    expect(renderedMonthKeys()).toContain('2027-01');
    expect(getTimeline().querySelector('[aria-current="date"]')?.textContent).toMatch(/January 2027/);
  });

  it('reports the older month the page scrolled down to', () => {
    const onMonthChange = vi.fn();
    renderTimeline({ monthKey: '2027-06', onMonthChange });
    settle();

    // Two months down the page, newest first, is April.
    scrollPageTo(parseFloat(monthSection('2027-04')?.style.top ?? '0') + 10);
    settle();

    expect(onMonthChange).toHaveBeenCalledWith('2027-04', { source: 'scroll' });
  });
});

describe('navigationMode="auto"', () => {
  function stubWidth(isWide: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: isWide,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the paged controls on wide screens', () => {
    stubWidth(true);
    render(<PhotoCalendar monthKey="2027-01" navigationMode="auto" />);
    expect(screen.queryByRole('grid', { name: /photo calendar timeline/i })).toBeNull();
    expect(screen.getByRole('grid', { name: /photo calendar for/i })).toBeTruthy();
  });

  it('uses the virtual timeline on narrow screens', () => {
    stubWidth(false);
    render(<PhotoCalendar monthKey="2027-01" navigationMode="auto" virtualHeight={CONTAINER_HEIGHT} />);
    expect(getTimeline().classList.contains('calendar-virtual-container')).toBe(true);
  });
});
