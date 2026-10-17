import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export type PayoutStatus = 'deferred' | 'waived' | 'scheduled';

export interface InvestmentTerms {
  effectiveDate: string;
  principalCents: number;
  monthlyRateBps: number;
}

export interface ScheduledReturn {
  month: number;
  anniversaryDate: string;
  dueDate: string | null;
  amountCents: number;
  status: PayoutStatus;
}

export function isCalendarDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayjs.utc(value).isValid() &&
    dayjs.utc(value).format('YYYY-MM-DD') === value
  );
}

export function buildInvestmentSchedule(
  terms: InvestmentTerms,
  closedHolidays: readonly string[] = []
) {
  if (
    !isCalendarDate(terms.effectiveDate) ||
    !Number.isSafeInteger(terms.principalCents) ||
    terms.principalCents <= 0 ||
    !Number.isInteger(terms.monthlyRateBps) ||
    terms.monthlyRateBps <= 0 ||
    terms.monthlyRateBps > 10000 ||
    closedHolidays.some((date) => !isCalendarDate(date))
  ) {
    throw new Error('Invalid investment terms or holiday dates');
  }

  const effectiveDate = dayjs.utc(terms.effectiveDate);
  const eligibleDate = effectiveDate.add(81, 'day');
  const holidays = new Set(closedHolidays);
  const monthlyReturnCents = Number(
    (BigInt(terms.principalCents) * BigInt(terms.monthlyRateBps) +
      BigInt(5000)) /
      BigInt(10000)
  );
  const payouts: ScheduledReturn[] = Array.from({ length: 36 }, (_, index) => {
    const anniversary = effectiveDate.add(index + 1, 'month');
    const status: PayoutStatus = anniversary.isBefore(eligibleDate, 'day')
      ? 'deferred'
      : anniversary.month() === 2
        ? 'waived'
        : 'scheduled';
    let dueDate = anniversary;
    if (status === 'scheduled') {
      while (
        dueDate.day() === 0 ||
        dueDate.day() === 6 ||
        holidays.has(dueDate.format('YYYY-MM-DD'))
      ) {
        dueDate = dueDate.add(1, 'day');
      }
    }
    return {
      month: index + 1,
      anniversaryDate: anniversary.format('YYYY-MM-DD'),
      dueDate: status === 'scheduled' ? dueDate.format('YYYY-MM-DD') : null,
      amountCents: status === 'scheduled' ? monthlyReturnCents : 0,
      status,
    };
  });

  const maturity = effectiveDate.add(36, 'month');
  return {
    eligibleDate: eligibleDate.format('YYYY-MM-DD'),
    maturityDate: maturity.format('YYYY-MM-DD'),
    principalRepaymentDeadline: maturity.add(30, 'day').format('YYYY-MM-DD'),
    monthlyReturnCents,
    payouts,
  };
}
