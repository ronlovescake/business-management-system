import type { PeriodOption } from './constants';
import { getPeriodRange } from './date-utils';

export function buildPeriodSearchParams(period: PeriodOption): URLSearchParams {
  const params = new URLSearchParams();
  const { from, to } = getPeriodRange(period);

  if (from) {
    params.set('from', from);
  }

  if (to) {
    params.set('to', to);
  }

  return params;
}
