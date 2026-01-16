export const EXPENSE_MONTH_KEYS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type ExpenseMonthKey = (typeof EXPENSE_MONTH_KEYS)[number];

export type ExpenseLike = {
  date: string;
  amount: number;
  status?: string | null;
  category?: string | null;
};

export type ExpenseTotals = {
  total: number;
  pendingCount: number;
  approvedTotal: number;
  thisMonthTotal: number;
};

export type MonthlyBreakdownRow = {
  category: string;
  percentage: number;
  total: number;
} & Record<ExpenseMonthKey, number>;

const buildEmptyMonthTotals = (): Record<ExpenseMonthKey, number> => {
  return EXPENSE_MONTH_KEYS.reduce<Record<ExpenseMonthKey, number>>(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<ExpenseMonthKey, number>
  );
};

export const computeExpenseTotals = (
  expenses: ExpenseLike[]
): ExpenseTotals => {
  const total = expenses.reduce((sum, exp) => sum + (exp.amount ?? 0), 0);
  const pendingCount = expenses.filter(
    (exp) => exp.status === 'pending'
  ).length;
  const approvedTotal = expenses
    .filter((exp) => exp.status === 'approved')
    .reduce((sum, exp) => sum + (exp.amount ?? 0), 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthTotal = expenses
    .filter((exp) => {
      const expDate = new Date(exp.date);
      return (
        expDate.getMonth() === currentMonth &&
        expDate.getFullYear() === currentYear
      );
    })
    .reduce((sum, exp) => sum + (exp.amount ?? 0), 0);

  return { total, pendingCount, approvedTotal, thisMonthTotal };
};

export const computeMonthlyBreakdownByCategory = (
  expenses: Array<ExpenseLike & { category: string }>,
  categories: string[],
  totalExpenses: number
): MonthlyBreakdownRow[] => {
  const breakdown = categories.map((category) => {
    const categoryExpenses = expenses.filter(
      (exp) => exp.category === category
    );

    const totals = buildEmptyMonthTotals();
    categoryExpenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      const monthName = EXPENSE_MONTH_KEYS[expDate.getMonth()];
      totals[monthName] += exp.amount;
    });

    const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;

    return {
      category,
      percentage,
      total,
      ...totals,
    };
  });

  return breakdown.sort((a, b) => b.total - a.total);
};
