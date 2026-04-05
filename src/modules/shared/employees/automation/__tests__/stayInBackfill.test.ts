import { describe, expect, it } from 'vitest';
import {
  STAY_IN_ATTENDANCE_LOOKBACK_DAYS,
  buildRollingDateRange,
} from '../stayInBackfill';

describe('stayInBackfill', () => {
  it('builds a descending rolling date range ending on the target date', () => {
    expect(buildRollingDateRange('2026-04-05', 3)).toEqual([
      '2026-04-05',
      '2026-04-04',
      '2026-04-03',
    ]);
  });

  it('uses the shared 15-day lookback by default', () => {
    const dates = buildRollingDateRange('2026-04-05');

    expect(dates).toHaveLength(STAY_IN_ATTENDANCE_LOOKBACK_DAYS);
    expect(dates[0]).toBe('2026-04-05');
    expect(dates[dates.length - 1]).toBe('2026-03-22');
  });
});
