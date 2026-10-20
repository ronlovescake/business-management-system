import { z } from 'zod';
import {
  DATE_FILTER_VALUES,
  type DateFilterType,
} from '@/lib/analytics/periodComparison';

export const HouseholdDashboardQuerySchema = z.object({
  range: z.enum(DATE_FILTER_VALUES).default('ytd'),
});

export type HouseholdDashboardQuery = z.infer<
  typeof HouseholdDashboardQuerySchema
>;

export type TrendGranularity = 'day' | 'month';

export interface HouseholdDashboardKpis {
  netWorth: number;
  income: number;
  incomeDelta: number | null;
  expenses: number;
  expensesDelta: number | null;
  netCashFlow: number;
  netCashFlowDelta: number | null;
  /** Percent of income kept; null when there is no income. */
  savingsRate: number | null;
  previousSavingsRate: number | null;
  upcomingBillsTotal: number;
  upcomingBillsCount: number;
}

export interface HouseholdTrendPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface HouseholdCategorySpend {
  category: string;
  amount: number;
  count: number;
  share: number;
}

export interface HouseholdBudgetComparison {
  category: string;
  planned: number;
  actual: number;
  variance: number;
}

export interface HouseholdAccountBalance {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export type UpcomingBillStatus = 'scheduled' | 'pending' | 'approved' | 'paid';

export interface HouseholdUpcomingBill {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntil: number;
  accountName: string | null;
  status: UpcomingBillStatus;
}

export interface HouseholdWeekdaySpend {
  day: string;
  amount: number;
  count: number;
}

export interface HouseholdDashboardSummary {
  range: DateFilterType;
  asOf: string;
  trendGranularity: TrendGranularity;
  budgetMonthLabel: string;
  kpis: HouseholdDashboardKpis;
  trend: HouseholdTrendPoint[];
  categories: HouseholdCategorySpend[];
  budgets: HouseholdBudgetComparison[];
  accounts: HouseholdAccountBalance[];
  upcomingBills: HouseholdUpcomingBill[];
  weekday: HouseholdWeekdaySpend[];
  counts: {
    expenses: number;
    income: number;
    accounts: number;
    recurringPayments: number;
  };
}
