import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { buildPeriodSearchParams } from '@/lib/accounting/query';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';
import {
  buildCsvContent,
  downloadCsvFile,
  downloadCsvTemplateFile,
  escapeCsvValue,
} from '@/lib/accounting/csv';
import { getApiDataOrThrow } from '@/lib/api/response';
import type { ApiResponse } from '@/types/api';
import { getCurrentDateISO } from '@/utils/date';

export type ProfitLossRow = {
  id: string;
  category: string;
  type: 'Revenue' | 'Expense';
  amount: number;
};

export type ProfitLossDetailRow = {
  id: string;
  date: string;
  category: string;
  type: 'Revenue' | 'Expense';
  sourceType: string;
  sourceId: string | null;
  ref: string | null;
  description: string;
  amount: number;
  customer: string | null;
  productCode: string | null;
  method: string | null;
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

type ProfitLossDetailsApiResponse = {
  rows: ProfitLossDetailRow[];
  period: string;
};

export function useProfitLoss() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<ProfitLossPeriodOption>('All Time');
  const [rows, setRows] = useState<ProfitLossRow[]>([]);
  const [detailRows, setDetailRows] = useState<ProfitLossDetailRow[]>([]);
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
        const payload =
          (await res.json()) as ApiResponse<ProfitLossApiResponse>;
        const data = getApiDataOrThrow(payload, 'Failed to load profit/loss');

        if (!isMounted) {
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

  useEffect(() => {
    let isMounted = true;

    async function fetchProfitLossDetails() {
      if (activeTab !== 'details') {
        return;
      }

      try {
        const qs = buildPeriodSearchParams(period).toString();
        const res = await fetch(
          qs
            ? `/api/accounting/profit-loss/details?${qs}`
            : '/api/accounting/profit-loss/details'
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const payload =
          (await res.json()) as ApiResponse<ProfitLossDetailsApiResponse>;
        const data = getApiDataOrThrow(payload, 'Failed to load P&L details');

        if (!isMounted) {
          return;
        }

        setDetailRows(data.rows ?? []);
      } catch (error) {
        logger.warn('Profit & Loss details fetch failed, showing empty data', {
          error,
        });
        if (!isMounted) {
          return;
        }
        setDetailRows([]);
      }
    }

    fetchProfitLossDetails();

    return () => {
      isMounted = false;
    };
  }, [activeTab, period]);

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

  const filteredDetailRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return detailRows.filter((row) => {
      if (search === '') {
        return true;
      }

      const haystack = [
        row.category,
        row.type,
        row.description,
        row.sourceType,
        row.ref ?? '',
        row.customer ?? '',
        row.productCode ?? '',
        row.method ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [detailRows, searchQuery]);

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
    const headers = ['Category', 'Type', 'Amount'];
    const rowsData = rows.map((row) => [
      escapeCsvValue(row.category),
      escapeCsvValue(row.type),
      escapeCsvValue(row.amount.toFixed(2)),
    ]);
    const csvContent = buildCsvContent(headers, rowsData);
    downloadCsvFile('profit-loss.csv', csvContent);
  };

  const handleExportDetailsCSV = () => {
    const headers = [
      'Date',
      'Type',
      'Category',
      'Description',
      'Amount',
      'Customer',
      'Product Code',
      'Method',
      'Ref',
      'Source Type',
      'Source ID',
    ];

    const rowsData = detailRows.map((row) => [
      escapeCsvValue(row.date),
      escapeCsvValue(row.type),
      escapeCsvValue(row.category),
      escapeCsvValue(row.description),
      escapeCsvValue(row.amount.toFixed(2)),
      escapeCsvValue(row.customer ?? ''),
      escapeCsvValue(row.productCode ?? ''),
      escapeCsvValue(row.method ?? ''),
      escapeCsvValue(row.ref ?? ''),
      escapeCsvValue(row.sourceType),
      escapeCsvValue(row.sourceId ?? ''),
    ]);

    const csvContent = buildCsvContent(headers, rowsData);
    downloadCsvFile('profit-loss_details.csv', csvContent);
  };

  const handleDownloadTemplate = () => {
    const date = getCurrentDateISO();
    downloadCsvTemplateFile(`profit-loss_template_${date}.csv`, [
      'Category',
      'Type',
      'Amount',
    ]);
  };

  const effectiveStats = stats ?? derivedStats;

  return {
    rows,
    filteredRows,
    detailRows,
    filteredDetailRows,
    stats: effectiveStats,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
    handleExportDetailsCSV,
    handleDownloadTemplate,
  };
}
