import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoCalendar } from '../PhotoCalendar';
import { PhotoCalendarThumbnail, PhotoCalendarThumbnailRetryProvider } from './PhotoCalendarThumbnail';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const img = (container: HTMLElement) => container.querySelector('img')!;

describe('PhotoCalendarThumbnail', () => {
  it('remounts a failed image after 1s, then 2s, and gives up after two retries', () => {
    const { container } = render(<PhotoCalendarThumbnail src="https://cdn.test/a.jpg" alt="" />);
    const first = img(container);

    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(999));
    expect(img(container)).toBe(first);
    act(() => vi.advanceTimersByTime(1));
    const second = img(container);
    expect(second).not.toBe(first);
    expect(second.getAttribute('src')).toBe('https://cdn.test/a.jpg');

    fireEvent.error(second);
    act(() => vi.advanceTimersByTime(2000));
    const third = img(container);
    expect(third).not.toBe(second);
    expect(third.hasAttribute('data-failed')).toBe(false);

    fireEvent.error(third);
    act(() => vi.advanceTimersByTime(60_000));
    expect(img(container)).toBe(third);
    expect(third.hasAttribute('data-failed')).toBe(true);
  });

  it('does not retry when turned off, and still calls onError', () => {
    const onError = vi.fn();
    const { container } = render(
      <PhotoCalendarThumbnailRetryProvider value={false}>
        <PhotoCalendarThumbnail src="https://cdn.test/a.jpg" alt="" onError={onError} />
      </PhotoCalendarThumbnailRetryProvider>
    );
    const first = img(container);

    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(60_000));

    expect(img(container)).toBe(first);
    expect(first.hasAttribute('data-failed')).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('lets a per-image setting override the provider', () => {
    const { container } = render(
      <PhotoCalendarThumbnailRetryProvider value={false}>
        <PhotoCalendarThumbnail src="https://cdn.test/a.jpg" alt="" retry={{ attempts: 1, delayMs: 50 }} />
      </PhotoCalendarThumbnailRetryProvider>
    );
    const first = img(container);

    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(50));

    expect(img(container)).not.toBe(first);
  });

  it('starts over when the photo changes', () => {
    const { container, rerender } = render(
      <PhotoCalendarThumbnail src="https://cdn.test/a.jpg" alt="" retry={{ attempts: 0 }} />
    );
    fireEvent.error(img(container));
    expect(img(container).hasAttribute('data-failed')).toBe(true);

    rerender(<PhotoCalendarThumbnail src="https://cdn.test/b.jpg" alt="" retry={{ attempts: 0 }} />);

    expect(img(container).hasAttribute('data-failed')).toBe(false);
  });
});

describe('PhotoCalendar thumbnailRetry', () => {
  const entries = [{ datetime: '2030-01-15T12:00:00Z', photos: ['https://cdn.test/a.jpg'] }];

  it('retries day thumbnails by default', () => {
    const { container } = render(<PhotoCalendar monthKey="2030-01" entries={entries} />);
    const first = img(container);

    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(1000));

    expect(img(container)).not.toBe(first);
  });

  it('can be turned off', () => {
    const { container } = render(<PhotoCalendar monthKey="2030-01" entries={entries} thumbnailRetry={false} />);
    const first = img(container);

    fireEvent.error(first);
    act(() => vi.advanceTimersByTime(60_000));

    expect(img(container)).toBe(first);
  });
});
