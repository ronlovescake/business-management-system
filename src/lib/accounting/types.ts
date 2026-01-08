/**
 * Shared type definitions for accounting modules
 */

import type { PeriodOption } from './constants';

export type DateRange = {
  from?: string;
  to?: string;
};

export type PeriodFilterParams = {
  period: PeriodOption;
};

export type BaseAccountingStats = {
  period: string;
};
