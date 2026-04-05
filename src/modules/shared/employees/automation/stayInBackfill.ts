import { dayjs } from '@/utils/date';

export const STAY_IN_ATTENDANCE_LOOKBACK_DAYS = 15;

export function buildRollingDateRange(
  endDate: string,
  lookbackDays = STAY_IN_ATTENDANCE_LOOKBACK_DAYS
): string[] {
  const sanitizedLookbackDays = Math.max(1, Math.floor(lookbackDays));

  return Array.from({ length: sanitizedLookbackDays }, (_, index) =>
    dayjs(endDate).subtract(index, 'day').format('YYYY-MM-DD')
  );
}
