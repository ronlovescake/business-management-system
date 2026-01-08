import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';

export type ProfitLossRow = {
  id: string;
  category: string;
  type: 'Revenue' | 'Expense';
  amount: number;
};

export type ProfitLossStats = {
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;
  period: string;
};

export const PROFIT_LOSS_PERIOD_OPTIONS = [
  'All Time',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'This Year',
] as const;

export type ProfitLossPeriodOption =
  (typeof PROFIT_LOSS_PERIOD_OPTIONS)[number];

const seedRows: ProfitLossRow[] = [
  {
    id: 'revenue-sales',
    category: 'Sales Revenue',
    type: 'Revenue',
    amount: 80000,
  },
  {
    id: 'expense-payroll',
    category: 'Payroll Expense',
    type: 'Expense',
    amount: 6923,
  },
  {
    id: 'expense-rent',
    category: 'Rent Expense',
    type: 'Expense',
    amount: 10000,
  },
  {
    id: 'expense-shipping',
    category: 'Shipping Expense',
    type: 'Expense',
    amount: 1275,
  },
];

type ProfitLossApiResponse = {
  rows: ProfitLossRow[];
  stats: ProfitLossStats;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toISOString(date: Date) {
  return date.toISOString();
}

function getPeriodRange(period: ProfitLossPeriodOption): {
  from?: string;
  to?: string;
} {
  const now = new Date();

  switch (period) {
    case 'This Month': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'Last Month': {
      const from = startOfDay(
        new Date(now.getFullYear(), now.getMonth() - 1, 1)
      );
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'Last 30 Days': {
      const to = endOfDay(now);
      const from = startOfDay(
        new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      );
      return { from: toISOString(from), to: toISOString(to) };
    }
    case 'This Year': {
      const from = startOfDay(new Date(now.getFullYear(), 0, 1));
      const to = endOfDay(new Date(now.getFullYear(), 11, 31));
      return { from: toISOString(from), to: toISOString(to) };
    }
    default:
      return {};
  }
}

export function useProfitLoss() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<ProfitLossPeriodOption>('All Time');
  const [rows, setRows] = useState<ProfitLossRow[]>(seedRows);
  const [stats, setStats] = useState<ProfitLossStats>({
    revenueTotal: 0,
    expenseTotal: 0,
    netProfit: 0,
    period: 'All Time',
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchProfitLoss() {
      try {
        const params = new URLSearchParams();
        const { from, to } = getPeriodRange(period);
        if (from) {
          params.set('from', from);
        }
        if (to) {
          params.set('to', to);
        }

        const qs = params.toString();
        const res = await fetch(
          qs
            ? `/api/accounting/profit-loss?${qs}`
            : '/api/accounting/profit-loss'
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = (await res.json()) as {
          success?: boolean;
          data?: ProfitLossApiResponse;
        };

        const data = payload?.data;
        if (!isMounted || !data) {
          return;
        }
        setRows(data.rows ?? []);
        setStats((prev) => data.stats ?? prev);
      } catch (error) {
        logger.warn('Profit & Loss fetch failed, falling back to seed data', {
          error,
        });
        if (!isMounted) {
          return;
        }
        const revenueTotal = seedRows
          .filter((row) => row.type === 'Revenue')
          .reduce((sum, row) => sum + row.amount, 0);
        const expenseTotal = seedRows
          .filter((row) => row.type === 'Expense')
          .reduce((sum, row) => sum + row.amount, 0);
        setRows(seedRows);
        setStats({
          revenueTotal,
          expenseTotal,
          netProfit: revenueTotal - expenseTotal,
          period: 'All Time',
        });
      }
    }

    fetchProfitLoss();

    return () => {
      isMounted = false;
    };
  }, [period]);

  const filteredRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (search === '') {
          return true;
        }
        return (
          row.category.toLowerCase().includes(search) ||
          row.type.toLowerCase().includes(search)
        );
      })
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) || a.category.localeCompare(b.category)
      );
  }, [rows, searchQuery]);

  const derivedStats: ProfitLossStats = useMemo(() => {
    const revenueTotal = rows
      .filter((row) => row.type === 'Revenue')
      .reduce((sum, row) => sum + row.amount, 0);
    const expenseTotal = rows
      .filter((row) => row.type === 'Expense')
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      revenueTotal,
      expenseTotal,
      netProfit: revenueTotal - expenseTotal,
      period,
    };
  }, [period, rows]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const handleExportCSV = () => {
    const header = ['Category', 'Type', 'Amount'];
    const lines = rows.map((row) => [row.category, row.type, row.amount]);
    const csv = [header, ...lines]
      .map((cols) =>
        cols
          .map((col) => {
            const value = typeof col === 'number' ? col.toString() : col;
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profit-loss.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const effectiveStats = stats ?? derivedStats;

  return {
    rows,
    filteredRows,
    stats: effectiveStats,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
  };
}
