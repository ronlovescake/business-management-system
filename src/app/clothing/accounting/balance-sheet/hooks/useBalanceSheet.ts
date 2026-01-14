import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';

export type BalanceSheetRow = {
  id: string;
  account: string;
  type: 'Asset' | 'Liability' | 'Equity';
  amount: number;
};

export type BalanceSheetStats = {
  assets: number;
  liabilities: number;
  equity: number;
  balance: number;
  asOf: string;
};

type BalanceSheetResponse = {
  rows: BalanceSheetRow[];
  stats: BalanceSheetStats;
};

const DEFAULT_STATS: BalanceSheetStats = {
  assets: 0,
  liabilities: 0,
  equity: 0,
  balance: 0,
  asOf: '2026-01-31',
};

function toIsoDate(asOfLabel: string): string {
  const parsed = new Date(asOfLabel);
  if (Number.isNaN(parsed.getTime())) {
    return '2026-01-31T00:00:00.000Z';
  }
  return parsed.toISOString();
}

function toDisplayDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 'January 31, 2026';
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function useBalanceSheet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [asOf, setAsOf] = useState('January 31, 2026');
  const [rows, setRows] = useState<BalanceSheetRow[]>([]);
  const [stats, setStats] = useState<BalanceSheetStats>(DEFAULT_STATS);

  const fetchBalanceSheet = useCallback(async () => {
    const iso = toIsoDate(asOf);
    try {
      const res = await fetch(
        `/api/accounting/balance-sheet?asOf=${encodeURIComponent(iso)}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as { data?: BalanceSheetResponse };

      setRows(payload.data?.rows ?? []);
      const nextStats = payload.data?.stats;
      setStats(
        nextStats
          ? {
              ...nextStats,
              asOf: toDisplayDate(nextStats.asOf),
            }
          : { ...DEFAULT_STATS, asOf: toDisplayDate(iso) }
      );
    } catch (error) {
      logger.warn('Balance sheet fetch failed; showing empty data', { error });
      setRows([]);
      setStats({ ...DEFAULT_STATS, asOf: toDisplayDate(iso) });
    }
  }, [asOf]);

  useEffect(() => {
    fetchBalanceSheet();
  }, [fetchBalanceSheet]);

  const filteredRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (search === '') {
          return true;
        }
        return (
          row.account.toLowerCase().includes(search) ||
          row.type.toLowerCase().includes(search)
        );
      })
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) || a.account.localeCompare(b.account)
      );
  }, [rows, searchQuery]);

  const formatCurrency = formatCurrencyPHP;

  const handleExportCSV = () => {
    logger.info('Export CSV (balance sheet) not implemented');
  };

  return {
    rows,
    filteredRows,
    stats,
    asOf,
    setAsOf,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
  };
}
