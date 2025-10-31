import {
  PhotoCalendar,
  PhotoCalendarRoot,
  PhotoCalendarNavigation,
  PhotoCalendarNavigationLayout,
  PhotoCalendarNavigationControls,
  PhotoCalendarNavigationPrevMonthButton,
  PhotoCalendarNavigationNextMonthButton,
  PhotoCalendarNavigationTodayButton,
  PhotoCalendarNavigationMonthChips,
  PhotoCalendarWeekdays,
  PhotoCalendarMonthGrid,
  PhotoCalendarDay
} from '../index';
import type { PhotoEntry } from '../index';

const toMonthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const createMonthEntries = (year: number, month: number): PhotoEntry[] => {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const sampledDays = Array.from({ length: Math.ceil(daysInMonth / 2) }, (_, index) => index * 2 + 1).filter(
    (day) => day <= daysInMonth
  );

  return sampledDays.map((day, index) => {
    const iso = new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString();
    const photoCount = (index % 4) + 1;
    const photos = Array.from({ length: photoCount }, (_, variant) =>
      `https://picsum.photos/seed/calendar-${year}-${month}-${day}-${variant}/400/400`
    );

    return {
      datetime: iso,
      photos
    } satisfies PhotoEntry;
  });
};

const createSampleEntries = (): PhotoEntry[] => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const previousMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));

  return [
    ...createMonthEntries(previousMonthDate.getUTCFullYear(), previousMonthDate.getUTCMonth()),
    ...createMonthEntries(currentYear, currentMonth)
  ];
};

const sampleEntries = createSampleEntries();
const currentMonthKey = toMonthKey(new Date());

export default {
  title: 'Photo Calendar/PhotoCalendar'
};

export const Default = () => <PhotoCalendar defaultMonthKey={currentMonthKey} entries={sampleEntries} />;

export const WithCustomDay = () => (
  <PhotoCalendar
    defaultMonthKey={currentMonthKey}
    entries={sampleEntries}
    renderDay={(props) => (
      <PhotoCalendarDay
        day={{
          ...props,
          defaultContent: (
            <div
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
                outline: props.isToday ? '2px solid #f97316' : 'none',
                outlineOffset: props.isToday ? '2px' : undefined
              }}
            >
              {props.defaultContent}
            </div>
          )
        }}
      />
    )}
  />
);

export const HeadlessComposition = () => (
  <PhotoCalendarRoot entries={sampleEntries} defaultMonthKey={currentMonthKey}>
    {(state) => (
      <section
        role="grid"
        aria-label={`Photo calendar for ${state.monthLabel}`}
        style={{ display: 'grid', gap: '0.5rem' }}
      >
        <PhotoCalendarNavigation>
          {(nav) => (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" onClick={() => nav.navigateMonth(-1)} disabled={!nav.canNavigatePrevMonth}>
                Prev
              </button>
              <span>{nav.monthLabel}</span>
              <button type="button" onClick={() => nav.navigateMonth(1)} disabled={!nav.canNavigateNextMonth}>
                Next
              </button>
              <button type="button" onClick={nav.goToToday}>Today</button>
            </div>
          )}
        </PhotoCalendarNavigation>
        <PhotoCalendarWeekdays />
        <PhotoCalendarMonthGrid />
      </section>
    )}
  </PhotoCalendarRoot>
);

export const MobileScrollNavigation = () => (
  <div
    style={{
      maxWidth: 420,
      height: 640,
      margin: '0 auto',
      borderRadius: 16,
      border: '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)'
    }}
  >
    <PhotoCalendar
      defaultMonthKey={currentMonthKey}
      entries={sampleEntries}
      navigationMode="scroll"
      scrollMaxRenderedMonths={5}
      style={{ height: '100%' }}
    />
  </div>
);

export const NavigationPrimitives = () => (
  <PhotoCalendarRoot entries={sampleEntries} defaultMonthKey={currentMonthKey}>
    {() => (
      <section style={{ display: 'grid', gap: '0.5rem' }}>
        <PhotoCalendarNavigationLayout>
          <PhotoCalendarNavigationControls>
            <PhotoCalendarNavigationPrevMonthButton />
            <PhotoCalendarNavigationNextMonthButton />
            <PhotoCalendarNavigationTodayButton />
          </PhotoCalendarNavigationControls>
          <PhotoCalendarNavigationMonthChips />
        </PhotoCalendarNavigationLayout>
        <PhotoCalendarWeekdays />
        <PhotoCalendarMonthGrid />
      </section>
    )}
  </PhotoCalendarRoot>
);
