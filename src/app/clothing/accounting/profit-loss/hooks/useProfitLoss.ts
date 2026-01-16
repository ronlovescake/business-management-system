import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { buildPeriodSearchParams } from '@/lib/accounting/query';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';

export type ProfitLossRow = {
  id: string;
  category: string;
  type: 'Revenue' | 'Expense';
  amount: number;
};

export type ProfitLossStats = {
  revenueTotal: number;
  cogsTotal: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
  period: string;
};

export const PROFIT_LOSS_PERIOD_OPTIONS = PERIOD_OPTIONS;
export type ProfitLossPeriodOption = PeriodOption;

type ProfitLossApiResponse = {
  rows: ProfitLossRow[];
  stats: ProfitLossStats;
};

export function useProfitLoss() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<ProfitLossPeriodOption>('All Time');
  const [rows, setRows] = useState<ProfitLossRow[]>([]);
  const [stats, setStats] = useState<ProfitLossStats>({
    revenueTotal: 0,
    cogsTotal: 0,
    grossProfit: 0,
    expenseTotal: 0,
    netProfit: 0,
    period: 'All Time',
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchProfitLoss() {
      try {
        const qs = buildPeriodSearchParams(period).toString();
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
        logger.warn('Profit & Loss fetch failed, showing empty data', {
          error,
        });
        if (!isMounted) {
          return;
        }
        setRows([]);
        setStats({
          revenueTotal: 0,
          cogsTotal: 0,
          grossProfit: 0,
          expenseTotal: 0,
          netProfit: 0,
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

    const cogsTotal = rows
      .filter((row) => row.type === 'Expense' && row.category === 'COGS')
      .reduce((sum, row) => sum + row.amount, 0);

    const expenseTotal = rows
      .filter((row) => row.type === 'Expense')
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      revenueTotal,
      cogsTotal,
      grossProfit: revenueTotal - cogsTotal,
      expenseTotal,
      netProfit: revenueTotal - expenseTotal,
      period,
    };
  }, [period, rows]);

  const formatCurrency = formatCurrencyPHP;

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
