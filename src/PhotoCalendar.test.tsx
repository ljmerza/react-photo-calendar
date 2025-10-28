import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoCalendar } from './PhotoCalendar';
import type { PhotoEntry } from './types/photo';

afterEach(() => cleanup());

function getEnabledButton(label: RegExp): HTMLButtonElement {
  const match = screen.getAllByLabelText(label).find((element) => !(element as HTMLButtonElement).disabled);
  if (!match) {
    throw new Error(`No enabled button found for label ${label}`);
  }
  return match as HTMLButtonElement;
}

describe('PhotoCalendar', () => {
  it('renders grid structure with weekday headers', () => {
    render(<PhotoCalendar monthKey="2030-01" />);

    expect(() => screen.getByRole('grid', { name: /photo calendar for/i })).not.toThrow();
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    const cells = screen.getAllByRole('gridcell');
    expect(cells.length).toBe(35);
    expect(cells[0].getAttribute('aria-disabled')).toBe('true');
    expect(cells[2].textContent).toContain('1');
  });

  it('honours the firstDayOfWeek offset', () => {
    render(<PhotoCalendar monthKey="2030-01" firstDayOfWeek={1} />);

    const cells = screen.getAllByRole('gridcell');
    expect(cells[0].getAttribute('aria-disabled')).toBe('true');
    const firstEnabled = cells.find((cell) => cell.getAttribute('aria-disabled') !== 'true');
    expect(firstEnabled).toBeDefined();
    expect(firstEnabled!.textContent).toContain('1');
  });

  it('emits onDaySelect with ISO date and Date instance', () => {
    const spy = vi.fn();
    render(<PhotoCalendar monthKey="2030-01" onDaySelect={spy} />);

    const firstOfMonth = screen.getAllByRole('gridcell').find((cell) => cell.getAttribute('aria-disabled') !== 'true');
    expect(firstOfMonth).toBeDefined();
    fireEvent.click(firstOfMonth!);

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0];
    expect(payload.isoDate).toBe('2030-01-01');
    expect(payload.date).toBeInstanceOf(Date);
  });

  it('advances months internally when uncontrolled', () => {
    render(<PhotoCalendar defaultMonthKey="2030-01" />);
    const nextButton = getEnabledButton(/next month/i);

    fireEvent.click(nextButton);

    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-label')).toContain('February 2030');
  });

  it('notifies month changes in controlled mode', () => {
    const spy = vi.fn();
    render(<PhotoCalendar monthKey="2030-01" onMonthChange={spy} />);

    const nextButton = getEnabledButton(/next month/i);
    fireEvent.click(nextButton);
    expect(spy).toHaveBeenCalledWith('2030-02');
  });

  it('respects min and max month bounds', () => {
    const spy = vi.fn();
    render(
      <PhotoCalendar
        defaultMonthKey="2030-06"
        minMonthKey="2030-04"
        maxMonthKey="2030-07"
        onMonthChange={spy}
      />
    );

    const prevButton = getEnabledButton(/previous month/i);
    const nextButton = getEnabledButton(/next month/i);

    fireEvent.click(prevButton);
    expect(spy).toHaveBeenLastCalledWith('2030-05');

    fireEvent.click(prevButton);
    expect(spy.mock.calls.map((args) => args[0])).not.toContain('2030-03');

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);
    expect(spy.mock.calls.map((args) => args[0])).toContain('2030-07');

    fireEvent.click(nextButton);
    expect(spy.mock.calls.map((args) => args[0])).not.toContain('2030-08');
  });

  it('updates onDaySelect after navigation', () => {
    const spy = vi.fn();
    render(<PhotoCalendar defaultMonthKey="2030-01" onDaySelect={spy} />);

    const nextButton = getEnabledButton(/next month/i);
    fireEvent.click(nextButton);
    const nextMonthFirst = screen
      .getAllByRole('gridcell')
      .find((cell) => cell.getAttribute('aria-disabled') !== 'true');
    expect(nextMonthFirst).toBeDefined();
    fireEvent.click(nextMonthFirst!);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ isoDate: '2030-02-01' }));
  });

  it('renders multiple thumbnails with overflow indicator', () => {
    const entries: PhotoEntry[] = [
      {
        datetime: '2030-01-05T10:00:00Z',
        photos: ['one.jpg', 'two.jpg', 'three.jpg']
      }
    ];
    render(<PhotoCalendar monthKey="2030-01" entries={entries} maxThumbnailsPerDay={2} />);

    const targetCell = screen
      .getAllByRole('gridcell')
      .find((cell) => within(cell).queryByText(/^5$/));
    expect(targetCell).toBeTruthy();
    const images = targetCell!.querySelectorAll('img');
    expect(images.length).toBe(2);
    expect(() => within(targetCell!).getByText('+1')).not.toThrow();
  });

  it('emits onRangeChange with visible bounds', () => {
    const spy = vi.fn();
    render(<PhotoCalendar monthKey="2030-01" onRangeChange={spy} />);

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0][0];
    expect(payload.startIso).toBe('2029-12-30');
    expect(payload.endIso).toBe('2030-02-02');
    expect(payload.start).toBeInstanceOf(Date);
    expect(payload.end).toBeInstanceOf(Date);
  });

  it('passes day context to renderDayContent', () => {
    const renderSpy = vi.fn();
    render(
      <PhotoCalendar
        monthKey="2030-01"
        renderDayContent={(ctx) => {
          renderSpy(ctx.isoDate, ctx.photos.length, ctx.isCurrentMonth);
          return <span>{ctx.day}</span>;
        }}
        entries={[
          { datetime: '2030-01-01T00:00:00Z', photos: ['a.jpg'] },
          { datetime: '2030-01-02T00:00:00Z', photos: ['b.jpg'] }
        ]}
      />
    );

    expect(renderSpy).toHaveBeenCalledWith('2030-01-01', 1, true);
    expect(renderSpy).toHaveBeenCalledWith('2030-01-02', 1, true);
  });
});
