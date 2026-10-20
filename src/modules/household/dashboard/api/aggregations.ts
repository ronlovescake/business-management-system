import {
  getComparisonRange,
  getFilterStart,
  percentChange,
  type DateFilterType,
} from '@/lib/analytics/periodComparison';
import {
  getNextDueDate,
  monthKeyFromDate,
  type RecurringSchedule,
} from '../../recurringPayments/api/schedule';
import { toISODate } from '@/utils/date';
import type {
  HouseholdAccountBalance,
  HouseholdBudgetComparison,
  HouseholdCategorySpend,
  HouseholdDashboardSummary,
  HouseholdTrendPoint,
  HouseholdUpcomingBill,
  HouseholdWeekdaySpend,
  TrendGranularity,
  UpcomingBillStatus,
} from './schemas';

export interface DashboardExpenseInput {
  amount: number;
  category: string | null;
  date: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  sourceLineKey: string | null;
}

export interface DashboardIncomeInput {
  amount: number;
  date: string;
}

export interface DashboardAccountInput {
  id: string;
  name: string;
  type: string;
  balance: number;
  isActive: boolean;
}

export interface DashboardRecurringPaymentInput extends RecurringSchedule {
  id: string;
  name: string;
  category: string;
  amount: number;
  isActive: boolean;
  accountName: string | null;
}

export interface HouseholdDashboardInput {
  expenses: DashboardExpenseInput[];
  income: DashboardIncomeInput[];
  accounts: DashboardAccountInput[];
  recurringPayments: DashboardRecurringPaymentInput[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'LOAN']);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const result = new Date(year, month - 1, day);
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month - 1 ||
      result.getDate() !== day
    ) {
      return null;
    }
    return result;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function amountOf(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function dateBounds(range: DateFilterType, now: Date) {
  const today = startOfDay(now);
  let currentStart: Date | null;
  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;

  if (range === 'last7days' || range === 'last30days') {
    const days = range === 'last7days' ? 7 : 30;
    currentStart = addDays(today, -(days - 1));
    previousStart = addDays(currentStart, -days);
    previousEnd = currentStart;
  } else {
    const filterStart = getFilterStart(range, now);
    currentStart = filterStart ? startOfDay(filterStart) : null;
    const comparison = getComparisonRange(range, now);
    if (comparison) {
      previousStart = startOfDay(comparison.previousStart);
      previousEnd = addDays(startOfDay(comparison.previousEnd), 1);
    }
  }

  return {
    today,
    currentStart,
    currentEnd: addDays(today, 1),
    previousStart,
    previousEnd,
  };
}

function isInRange(date: Date, start: Date | null, end: Date): boolean {
  return (!start || date >= start) && date < end;
}

function isInPreviousRange(
  date: Date,
  start: Date | null,
  end: Date | null
): boolean {
  return Boolean(start && end && date >= start && date < end);
}

function savingsRate(income: number, expenses: number): number | null {
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}

function createTrend(
  expenses: DashboardExpenseInput[],
  income: DashboardIncomeInput[],
  range: DateFilterType,
  currentStart: Date | null,
  currentEnd: Date,
  today: Date
): { points: HouseholdTrendPoint[]; granularity: TrendGranularity } {
  const granularity: TrendGranularity =
    range === 'last7days' || range === 'last30days' ? 'day' : 'month';
  let trendStart: Date;

  if (granularity === 'day') {
    trendStart = addDays(today, range === 'last7days' ? -6 : -29);
  } else if (!currentStart) {
    const trailingStart = new Date(
      today.getFullYear(),
      today.getMonth() - 23,
      1
    );
    const earliest = [...expenses, ...income].reduce<Date | null>(
      (value, row) => {
        const date = parseDate(row.date);
        return date && (!value || date < value) ? date : value;
      },
      null
    );
    trendStart =
      earliest && earliest > trailingStart
        ? new Date(earliest.getFullYear(), earliest.getMonth(), 1)
        : trailingStart;
  } else {
    trendStart = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      1
    );
  }

  const buckets = new Map<string, HouseholdTrendPoint>();
  const addBucket = (date: Date) => {
    const key =
      granularity === 'day'
        ? dateOnlyString(date)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label:
          granularity === 'day'
            ? new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'Asia/Manila',
              }).format(date)
            : new Intl.DateTimeFormat('en-US', {
                month: 'short',
                year: '2-digit',
                timeZone: 'Asia/Manila',
              }).format(date),
        income: 0,
        expenses: 0,
        net: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  if (granularity === 'day') {
    const days = range === 'last7days' ? 7 : 30;
    for (let offset = 0; offset < days; offset += 1) {
      addBucket(addDays(trendStart, offset));
    }
  } else {
    const monthCount =
      (today.getFullYear() - trendStart.getFullYear()) * 12 +
      today.getMonth() -
      trendStart.getMonth() +
      1;
    for (let offset = 0; offset < monthCount; offset += 1) {
      addBucket(
        new Date(trendStart.getFullYear(), trendStart.getMonth() + offset, 1)
      );
    }
  }

  for (const row of expenses) {
    const date = parseDate(row.date);
    if (
      row.status === 'rejected' ||
      !date ||
      date < trendStart ||
      !isInRange(date, currentStart, currentEnd)
    ) {
      continue;
    }
    const key =
      granularity === 'day'
        ? dateOnlyString(date)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.expenses += amountOf(row.amount);
      bucket.net -= amountOf(row.amount);
    }
  }

  for (const row of income) {
    const date = parseDate(row.date);
    if (
      !date ||
      date < trendStart ||
      !isInRange(date, currentStart, currentEnd)
    ) {
      continue;
    }
    const key =
      granularity === 'day'
        ? dateOnlyString(date)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.income += amountOf(row.amount);
      bucket.net += amountOf(row.amount);
    }
  }

  return { points: Array.from(buckets.values()), granularity };
}

function createCategorySpend(
  expenses: DashboardExpenseInput[],
  currentStart: Date | null,
  currentEnd: Date
): HouseholdCategorySpend[] {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const row of expenses) {
    const date = parseDate(row.date);
    if (
      row.status === 'rejected' ||
      !date ||
      !isInRange(date, currentStart, currentEnd)
    ) {
      continue;
    }
    const category = row.category?.trim() || 'Uncategorized';
    const current = totals.get(category) ?? { amount: 0, count: 0 };
    current.amount += amountOf(row.amount);
    current.count += 1;
    totals.set(category, current);
  }
  const total = Array.from(totals.values()).reduce(
    (sum, entry) => sum + entry.amount,
    0
  );
  return Array.from(totals.entries())
    .map(([category, entry]) => ({
      category,
      amount: entry.amount,
      count: entry.count,
      share: total > 0 ? (entry.amount / total) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function createBudgetComparison(
  expenses: DashboardExpenseInput[],
  today: Date
): HouseholdBudgetComparison[] {
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const monthsElapsed = monthIndex;
  const ytdStart = new Date(year, 0, 1);
  const currentMonthStart = new Date(year, monthIndex, 1);
  const byCategory = new Map<string, { priorTotal: number; actual: number }>();

  for (const row of expenses) {
    if (row.status === 'rejected') {
      continue;
    }
    const date = parseDate(row.date);
    if (!date || date < ytdStart || date >= addDays(today, 1)) {
      continue;
    }
    const category = row.category?.trim() || 'Uncategorized';
    const entry = byCategory.get(category) ?? { priorTotal: 0, actual: 0 };
    if (date >= currentMonthStart) {
      entry.actual += amountOf(row.amount);
    } else {
      entry.priorTotal += amountOf(row.amount);
    }
    byCategory.set(category, entry);
  }

  return Array.from(byCategory.entries())
    .map(([category, entry]) => {
      const planned = monthsElapsed ? entry.priorTotal / monthsElapsed : 0;
      return {
        category,
        planned: Number(planned.toFixed(2)),
        actual: Number(entry.actual.toFixed(2)),
        variance: Number((entry.actual - planned).toFixed(2)),
      };
    })
    .sort(
      (left, right) =>
        Math.max(right.planned, right.actual) -
        Math.max(left.planned, left.actual)
    );
}

function createAccountBalances(accounts: DashboardAccountInput[]): {
  rows: HouseholdAccountBalance[];
  netWorth: number;
} {
  const rows = accounts
    .filter((account) => account.isActive)
    .map((account) => {
      const rawBalance = amountOf(account.balance);
      const isLiability = LIABILITY_TYPES.has(account.type);
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        balance: isLiability ? -Math.abs(rawBalance) : rawBalance,
      };
    })
    .sort((left, right) => right.balance - left.balance);
  return {
    rows,
    netWorth: rows.reduce((sum, account) => sum + account.balance, 0),
  };
}

function createUpcomingBills(
  recurringPayments: DashboardRecurringPaymentInput[],
  expenses: DashboardExpenseInput[],
  today: Date
): HouseholdUpcomingBill[] {
  const dueThrough = addDays(today, 30);
  const generated = new Map<string, DashboardExpenseInput>();
  for (const expense of expenses) {
    if (
      expense.sourceType === 'RECURRING' &&
      expense.sourceId &&
      expense.sourceLineKey
    ) {
      generated.set(`${expense.sourceId}:${expense.sourceLineKey}`, expense);
    }
  }

  return recurringPayments
    .filter((payment) => payment.isActive)
    .flatMap((payment) => {
      const dueDate = getNextDueDate(payment, today);
      if (!dueDate || dueDate > dueThrough) {
        return [];
      }
      const expense = generated.get(
        `${payment.id}:${monthKeyFromDate(dueDate)}`
      );
      if (expense?.status === 'rejected') {
        return [];
      }
      const knownStatus = ['pending', 'approved', 'paid'].includes(
        expense?.status ?? ''
      );
      const status: UpcomingBillStatus = knownStatus
        ? (expense?.status as UpcomingBillStatus)
        : 'scheduled';
      return [
        {
          id: payment.id,
          name: payment.name,
          category: payment.category,
          amount: amountOf(payment.amount),
          dueDate: dateOnlyString(dueDate),
          daysUntil: Math.round((dueDate.getTime() - today.getTime()) / DAY_MS),
          accountName: payment.accountName,
          status,
        },
      ];
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function createWeekdaySpend(
  expenses: DashboardExpenseInput[],
  currentStart: Date | null,
  currentEnd: Date
): HouseholdWeekdaySpend[] {
  const rows = WEEKDAY_LABELS.map((day) => ({ day, amount: 0, count: 0 }));
  for (const expense of expenses) {
    const date = parseDate(expense.date);
    if (
      expense.status === 'rejected' ||
      !date ||
      !isInRange(date, currentStart, currentEnd)
    ) {
      continue;
    }
    const row = rows[date.getDay()];
    row.amount += amountOf(expense.amount);
    row.count += 1;
  }
  return rows;
}

export function buildHouseholdDashboardSummary(
  input: HouseholdDashboardInput,
  range: DateFilterType,
  now: Date = new Date()
): HouseholdDashboardSummary {
  const businessToday = parseDate(toISODate(now)) ?? startOfDay(now);
  const bounds = dateBounds(range, businessToday);
  const countedExpenses = input.expenses.filter(
    (expense) => expense.status !== 'rejected'
  );
  const currentExpenses = countedExpenses.filter((expense) => {
    const date = parseDate(expense.date);
    return date && isInRange(date, bounds.currentStart, bounds.currentEnd);
  });
  const currentIncome = input.income.filter((entry) => {
    const date = parseDate(entry.date);
    return date && isInRange(date, bounds.currentStart, bounds.currentEnd);
  });
  const previousExpenses = countedExpenses.filter((expense) => {
    const date = parseDate(expense.date);
    return (
      date && isInPreviousRange(date, bounds.previousStart, bounds.previousEnd)
    );
  });
  const previousIncome = input.income.filter((entry) => {
    const date = parseDate(entry.date);
    return (
      date && isInPreviousRange(date, bounds.previousStart, bounds.previousEnd)
    );
  });

  const expenseTotal = currentExpenses.reduce(
    (sum, expense) => sum + amountOf(expense.amount),
    0
  );
  const incomeTotal = currentIncome.reduce(
    (sum, entry) => sum + amountOf(entry.amount),
    0
  );
  const previousExpenseTotal = previousExpenses.reduce(
    (sum, expense) => sum + amountOf(expense.amount),
    0
  );
  const previousIncomeTotal = previousIncome.reduce(
    (sum, entry) => sum + amountOf(entry.amount),
    0
  );
  const accountData = createAccountBalances(input.accounts);
  const upcomingBills = createUpcomingBills(
    input.recurringPayments,
    input.expenses,
    bounds.today
  );
  const unpaidBills = upcomingBills.filter((bill) => bill.status !== 'paid');
  const trend = createTrend(
    input.expenses,
    input.income,
    range,
    bounds.currentStart,
    bounds.currentEnd,
    bounds.today
  );
  const budgetMonthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(bounds.today);

  return {
    range,
    asOf: dateOnlyString(bounds.today),
    trendGranularity: trend.granularity,
    budgetMonthLabel,
    kpis: {
      netWorth: accountData.netWorth,
      income: incomeTotal,
      incomeDelta: percentChange(incomeTotal, previousIncomeTotal),
      expenses: expenseTotal,
      expensesDelta: percentChange(expenseTotal, previousExpenseTotal),
      netCashFlow: incomeTotal - expenseTotal,
      netCashFlowDelta: percentChange(
        incomeTotal - expenseTotal,
        previousIncomeTotal - previousExpenseTotal
      ),
      savingsRate: savingsRate(incomeTotal, expenseTotal),
      previousSavingsRate: savingsRate(
        previousIncomeTotal,
        previousExpenseTotal
      ),
      upcomingBillsTotal: unpaidBills.reduce(
        (sum, bill) => sum + bill.amount,
        0
      ),
      upcomingBillsCount: unpaidBills.length,
    },
    trend: trend.points,
    categories: createCategorySpend(
      input.expenses,
      bounds.currentStart,
      bounds.currentEnd
    ),
    budgets: createBudgetComparison(input.expenses, bounds.today),
    accounts: accountData.rows,
    upcomingBills,
    weekday: createWeekdaySpend(
      input.expenses,
      bounds.currentStart,
      bounds.currentEnd
    ),
    counts: {
      expenses: currentExpenses.length,
      income: currentIncome.length,
      accounts: accountData.rows.length,
      recurringPayments: input.recurringPayments.filter(
        (payment) => payment.isActive
      ).length,
    },
  };
}
