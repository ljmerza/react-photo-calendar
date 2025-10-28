interface CalendarBannerProps {
  currentYear: number;
  currentMonth: number;
  monthLabel: string;
  monthNames: ReadonlyArray<string>;
  onNavigateMonth: (delta: number) => void;
  onNavigateYear: (delta: number) => void;
  onNavigateToMonth: (monthIndex: number) => void;
  onGoToToday: () => void;
}

export function CalendarBanner({
  currentYear,
  currentMonth,
  monthLabel,
  monthNames,
  onNavigateMonth,
  onNavigateYear,
  onNavigateToMonth,
  onGoToToday
}: CalendarBannerProps) {
  return (
    <div className="calendar-banner">
      <div className="calendar-year-row">
        <strong className="calendar-year">{currentYear}</strong>
        <button
          type="button"
          className="today-button"
          aria-label="Go to current month"
          onClick={onGoToToday}
        >
          Today
        </button>
      </div>
      <div className="month-chips-row">
        <button
          type="button"
          className="nav-button nav-button--prev nav-button--year"
          aria-label="Previous year"
          onClick={() => onNavigateYear(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="nav-button nav-button--prev nav-button--month"
          aria-label="Previous month"
          onClick={() => onNavigateMonth(-1)}
        >
          ‹
        </button>
        <div className="month-chips">
          {monthNames.map((monthName, monthIndex) => (
            <button
              key={monthName}
              type="button"
              className={`month-chip ${monthIndex === currentMonth ? 'month-chip--active' : ''}`}
              aria-label={`Go to ${monthName} ${currentYear}`}
              aria-current={monthIndex === currentMonth ? 'date' : undefined}
              onClick={() => onNavigateToMonth(monthIndex)}
            >
              {monthName}
            </button>
          ))}
        </div>
        <div className="month-label-mobile">
          <strong>{monthLabel}</strong>
        </div>
        <button
          type="button"
          className="nav-button nav-button--next nav-button--year"
          aria-label="Next year"
          onClick={() => onNavigateYear(1)}
        >
          ›
        </button>
        <button
          type="button"
          className="nav-button nav-button--next nav-button--month"
          aria-label="Next month"
          onClick={() => onNavigateMonth(1)}
        >
          ›
        </button>
        <button
          type="button"
          className="today-button-icon"
          aria-label="Go to current month"
          onClick={onGoToToday}
        >
          📅
        </button>
      </div>
    </div>
  );
}
