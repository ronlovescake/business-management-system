import { useMemo, useState } from 'react';
import { logger } from '@/lib/logger';

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

const seedRows: BalanceSheetRow[] = [
  {
    id: 'asset-cash',
    account: 'Cash',
    type: 'Asset',
    amount: 11802,
  },
  {
    id: 'asset-inventory',
    account: 'Inventory',
    type: 'Asset',
    amount: 50000,
  },
  {
    id: 'equity-retained',
    account: 'Retained Earnings',
    type: 'Equity',
    amount: 61802,
  },
];

export function useBalanceSheet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [asOf, setAsOf] = useState('January 31, 2026');

  const rows = useMemo(() => seedRows, []);

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

  const stats: BalanceSheetStats = useMemo(() => {
    const assets = rows
      .filter((row) => row.type === 'Asset')
      .reduce((sum, row) => sum + row.amount, 0);
    const liabilities = rows
      .filter((row) => row.type === 'Liability')
      .reduce((sum, row) => sum + row.amount, 0);
    const equity = rows
      .filter((row) => row.type === 'Equity')
      .reduce((sum, row) => sum + row.amount, 0);

    return {
      assets,
      liabilities,
      equity,
      balance: assets - liabilities - equity,
      asOf,
    };
  }, [asOf, rows]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

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
