export type CalendarCell = { day: number } | null;

export function parseMonthKey(value?: string): Date {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const [yearStr = '', monthStr = ''] = value.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(year, monthIndex, 1));
}

export function createCalendarCells(monthDate: Date, firstDayOfWeek: number): CalendarCell[] {
  const utcYear = monthDate.getUTCFullYear();
  const utcMonth = monthDate.getUTCMonth();
  const firstOfMonth = new Date(Date.UTC(utcYear, utcMonth, 1));
  const firstDay = firstOfMonth.getUTCDay();
  const leadingPlaceholders = (firstDay - firstDayOfWeek + 7) % 7;
  const daysInMonth = new Date(Date.UTC(utcYear, utcMonth + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((leadingPlaceholders + daysInMonth) / 7) * 7;

  return Array.from<CalendarCell>({ length: totalCells }, (_, index) => {
    if (index < leadingPlaceholders) {
      return null;
    }

    const dayNumber = index - leadingPlaceholders + 1;
    if (dayNumber > daysInMonth) {
      return null;
    }

    return { day: dayNumber };
  });
}

export function formatMonthKey(date: Date): string {
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}`;
}

export function addMonths(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

export const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
