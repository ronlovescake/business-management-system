import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';
import {
  buildCsvContent,
  downloadCsvFile,
  downloadCsvTemplateFile,
  escapeCsvValue,
} from '@/lib/accounting/csv';
import { parseDate } from '@/lib/accounting/date-utils';
import { getApiDataOrThrow } from '@/lib/api/response';
import { buildApiPath } from '@/lib/api/paths';
import type { ApiResponse } from '@/types/api';
import { getCurrentDateISO } from '@/utils/date';

export type BalanceSheetRow = {
  id: string;
  account: string;
  type: 'Asset' | 'Liability' | 'Equity';
  amount: number;
  details?: Array<{ label: string; amount: number }>;
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
  asOf: getCurrentDateISO(),
};

function toIsoDate(asOfLabel: string): string {
  const parsed = parseDate(asOfLabel);
  if (!parsed) {
    return getCurrentDateISO();
  }

  // IMPORTANT:
  // This endpoint treats `asOf=YYYY-MM-DD` as a calendar date and clamps to end-of-day.
  // If we send a full ISO timestamp (e.g. 2026-02-02T00:00:00.000Z), the server will
  // *not* apply end-of-day clamping and the balance sheet can look like “start of day”.
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDisplayDate(iso: string): string {
  const parsed = parseDate(iso);
  if (!parsed) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function useBalanceSheet(options: { apiBasePath?: string } = {}) {
  const { apiBasePath } = options;
  const apiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [asOf, setAsOf] = useState(() => toDisplayDate(getCurrentDateISO()));
  const [rows, setRows] = useState<BalanceSheetRow[]>([]);
  const [stats, setStats] = useState<BalanceSheetStats>(DEFAULT_STATS);

  const fetchBalanceSheet = useCallback(async () => {
    const iso = toIsoDate(asOf);
    try {
      const endpoint = apiPath('/accounting/balance-sheet');
      const res = await fetch(`${endpoint}?asOf=${encodeURIComponent(iso)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as ApiResponse<BalanceSheetResponse>;
      const data = getApiDataOrThrow(payload, 'Failed to load balance sheet');

      setRows(data.rows ?? []);
      const nextStats = data.stats;
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
  }, [apiPath, asOf]);

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

  const filteredStats = useMemo<BalanceSheetStats>(() => {
    const assets = filteredRows
      .filter((row) => row.type === 'Asset')
      .reduce((sum, row) => sum + row.amount, 0);
    const liabilities = filteredRows
      .filter((row) => row.type === 'Liability')
      .reduce((sum, row) => sum + row.amount, 0);
    const equity = filteredRows
      .filter((row) => row.type === 'Equity')
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      assets,
      liabilities,
      equity,
      balance: assets - liabilities - equity,
      asOf: stats.asOf,
    };
  }, [filteredRows, stats.asOf]);

  const formatCurrency = formatCurrencyPHP;

  const toDisplayAmount = (row: BalanceSheetRow, amount: number) =>
    row.type === 'Asset' ? amount : -amount;

  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      logger.info('No balance sheet rows to export');
      return;
    }

    const headers = ['Account', 'Type', 'Amount', 'Details'];
    const rows = filteredRows.map((row) => {
      const details = row.details?.length
        ? row.details
            .map(
              (detail) =>
                `${detail.label}: ${toDisplayAmount(row, detail.amount)}`
            )
            .join(' | ')
        : '';

      return [
        escapeCsvValue(row.account),
        escapeCsvValue(row.type),
        escapeCsvValue(toDisplayAmount(row, row.amount).toFixed(2)),
        escapeCsvValue(details),
      ];
    });

    const csvContent = buildCsvContent(headers, rows);
    const safeAsOf = asOf.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    downloadCsvFile(`balance-sheet-${safeAsOf}.csv`, csvContent);
  };

  const handleDownloadTemplate = () => {
    const date = getCurrentDateISO();
    downloadCsvTemplateFile(`balance-sheet_template_${date}.csv`, [
      'Account',
      'Type',
      'Amount',
      'Details',
    ]);
  };

  return {
    rows,
    filteredRows,
    stats: filteredStats,
    asOf,
    setAsOf,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
    handleDownloadTemplate,
  };
}
