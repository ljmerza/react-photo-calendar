import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoCalendarRoot } from './PhotoCalendarRoot';
import { PhotoCalendarNavigation } from './PhotoCalendarNavigation';
import { PhotoCalendarMonthGrid } from './PhotoCalendarMonthGrid';
import { usePhotoCalendarContext } from '../context/PhotoCalendarContext';

function CustomNavigation() {
  const { navigation, monthLabel } = usePhotoCalendarContext('CustomNavigation');

  return (
    <div>
      <span data-testid="current-label">{monthLabel}</span>
      <button type="button" onClick={() => navigation.navigateMonth(1)}>
        Next
      </button>
    </div>
  );
}

describe('PhotoCalendarRoot and primitives', () => {
  it('provides context to custom navigation components', () => {
    render(
      <PhotoCalendarRoot defaultMonthKey="2030-01">
        <CustomNavigation />
      </PhotoCalendarRoot>
    );

    expect(screen.getByTestId('current-label').textContent).toContain('January 2030');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('current-label').textContent).toContain('February 2030');
  });

  it('allows overriding navigation buttons via render prop', () => {
    const monthChange = vi.fn();
    render(
      <PhotoCalendarRoot monthKey="2030-01" onMonthChange={monthChange}>
        <PhotoCalendarNavigation>
          {({ navigateMonth }) => (
            <button type="button" onClick={() => navigateMonth(1)}>
              custom next
            </button>
          )}
        </PhotoCalendarNavigation>
      </PhotoCalendarRoot>
    );

    fireEvent.click(screen.getByRole('button', { name: 'custom next' }));
    expect(monthChange).toHaveBeenCalledWith('2030-02');
  });

  it('passes day render context to PhotoCalendarMonthGrid render prop', () => {
    const observedIsoDates: string[] = [];
    render(
      <PhotoCalendarRoot monthKey="2030-01">
        <PhotoCalendarMonthGrid renderDay={(props) => {
          observedIsoDates.push(props.isoDate);
          return <span>{props.day}</span>;
        }} />
      </PhotoCalendarRoot>
    );

    expect(observedIsoDates).toContain('2030-01-01');
  });
});
