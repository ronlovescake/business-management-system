export type CashAdvanceCycle = 'FIRST_HALF' | 'SECOND_HALF';

const toUtcDate = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

const lastDayOfMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month + 1, 0));

const paydayForFirstHalf = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month, 15));

const paydayForSecondHalf = (year: number, month: number): Date =>
  lastDayOfMonth(year, month);

export const determineCycleFromDate = (date: Date): CashAdvanceCycle =>
  date.getUTCDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';

export const getFollowingPayday = (
  reference: Date
): { date: Date; cycle: CashAdvanceCycle } => {
  const normalized = toUtcDate(reference);
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();

  const firstHalfPayday = paydayForFirstHalf(year, month);
  if (firstHalfPayday > normalized) {
    return {
      date: firstHalfPayday,
      cycle: 'FIRST_HALF',
    };
  }

  const secondHalfPayday = paydayForSecondHalf(year, month);
  if (secondHalfPayday > normalized) {
    return {
      date: secondHalfPayday,
      cycle: 'SECOND_HALF',
    };
  }

  const nextMonthFirstHalf = paydayForFirstHalf(year, month + 1);
  return {
    date: nextMonthFirstHalf,
    cycle: 'FIRST_HALF',
  };
};

export const advanceCycleByOneMonth = (
  current: Date,
  cycle: CashAdvanceCycle
): Date => {
  const normalized = toUtcDate(current);
  const year = normalized.getUTCFullYear();
  const month = normalized.getUTCMonth();

  if (cycle === 'FIRST_HALF') {
    return paydayForFirstHalf(year, month + 1);
  }

  return paydayForSecondHalf(year, month + 1);
};

export const ensureNextPayday = (
  reference: Date,
  cycle?: CashAdvanceCycle | null,
  nextPlannedDate?: Date | null
): { date: Date; cycle: CashAdvanceCycle } => {
  if (nextPlannedDate && cycle) {
    return { date: toUtcDate(nextPlannedDate), cycle };
  }

  const { date, cycle: computedCycle } = getFollowingPayday(reference);
  return { date, cycle: computedCycle };
};
