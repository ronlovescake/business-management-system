export const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseStoredDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
};

export const monthKeyFromDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const parseMonthKey = (month: string): Date => {
  const [y, m] = month.split('-').map((p) => Number(p));
  return new Date(y, m - 1, 1);
};

export const clampDayInMonth = (
  year: number,
  monthIndex: number,
  day: number
) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
};

export const diffMonths = (from: Date, to: Date): number => {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
};

export interface RecurringSchedule {
  startDate: string;
  monthsCount: number | null;
}

/** First occurrence on or after `from` (date-only), or null once the plan has ended. */
export function getNextDueDate(
  schedule: RecurringSchedule,
  from: Date
): Date | null {
  const start = parseStoredDate(schedule.startDate);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startDay = start.getDate();

  const occurrence = (index: number) => {
    const year = start.getFullYear();
    const monthIndex = start.getMonth() + index;
    const anchor = new Date(year, monthIndex, 1);
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      clampDayInMonth(anchor.getFullYear(), anchor.getMonth(), startDay)
    );
  };

  let index = Math.max(0, diffMonths(start, fromDay));
  if (occurrence(index) < fromDay) {
    index += 1;
  }
  if (schedule.monthsCount !== null && index >= schedule.monthsCount) {
    return null;
  }
  return occurrence(index);
}
