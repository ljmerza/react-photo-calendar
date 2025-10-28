interface CalendarBannerProps {
  currentYear: number;
  currentMonth: number;
  monthLabel: string;
  monthNames: ReadonlyArray<string>;
  onNavigateMonth: (delta: number) => void;
  onNavigateYear: (delta: number) => void;
  onNavigateToMonth: (monthIndex: number) => void;
  onGoToToday: () => void;
  canNavigatePrevMonth: boolean;
  canNavigateNextMonth: boolean;
  canNavigatePrevYear: boolean;
  canNavigateNextYear: boolean;
  isMonthDisabled: (monthIndex: number) => boolean;
  isTodayDisabled: boolean;
}

export function CalendarBanner({
  currentYear,
  currentMonth,
  monthLabel,
  monthNames,
  onNavigateMonth,
  onNavigateYear,
  onNavigateToMonth,
  onGoToToday,
  canNavigatePrevMonth,
  canNavigateNextMonth,
  canNavigatePrevYear,
  canNavigateNextYear,
  isMonthDisabled,
  isTodayDisabled
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
          disabled={isTodayDisabled}
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
          disabled={!canNavigatePrevYear}
        >
          <span aria-hidden="true" className="nav-button-icon">‹</span>
          <span className="nav-button-label">Previous year</span>
        </button>
        <button
          type="button"
          className="nav-button nav-button--prev nav-button--month"
          aria-label="Previous month"
          onClick={() => onNavigateMonth(-1)}
          disabled={!canNavigatePrevMonth}
        >
          <span aria-hidden="true" className="nav-button-icon">‹</span>
          <span className="nav-button-label">Previous month</span>
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
              disabled={isMonthDisabled(monthIndex)}
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
          disabled={!canNavigateNextYear}
        >
          <span aria-hidden="true" className="nav-button-icon">›</span>
          <span className="nav-button-label">Next year</span>
        </button>
        <button
          type="button"
          className="nav-button nav-button--next nav-button--month"
          aria-label="Next month"
          onClick={() => onNavigateMonth(1)}
          disabled={!canNavigateNextMonth}
        >
          <span aria-hidden="true" className="nav-button-icon">›</span>
          <span className="nav-button-label">Next month</span>
        </button>
        <button
          type="button"
          className="today-button-icon"
          aria-label="Go to current month"
          onClick={onGoToToday}
          disabled={isTodayDisabled}
        >
          <span aria-hidden="true">📅</span>
        </button>
      </div>
    </div>
  );
}
