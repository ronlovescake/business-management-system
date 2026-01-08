import { useMemo, useState } from 'react';
import { logger } from '@/lib/logger';

export type JournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

type JournalStats = {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  entriesThisMonth: number;
};

const seedEntries: JournalEntry[] = [
  {
    id: 'JV-001-inventory',
    date: '2026-01-02',
    ref: 'JV-001',
    account: 'Inventory',
    debit: 50000,
    credit: 0,
    description: 'Purchased baby clothes',
  },
  {
    id: 'JV-001-cash',
    date: '2026-01-02',
    ref: 'JV-001',
    account: 'Cash',
    debit: 0,
    credit: 50000,
    description: 'Cash payment',
  },
  {
    id: 'JV-002-shipping',
    date: '2026-01-03',
    ref: 'JV-002',
    account: 'Shipping Expense',
    debit: 1275,
    credit: 0,
    description: 'Delivery fee',
  },
  {
    id: 'JV-002-cash',
    date: '2026-01-03',
    ref: 'JV-002',
    account: 'Cash',
    debit: 0,
    credit: 1275,
    description: 'Courier payment',
  },
  {
    id: 'JV-003-cash',
    date: '2026-01-05',
    ref: 'JV-003',
    account: 'Cash',
    debit: 80000,
    credit: 0,
    description: 'Cash sales',
  },
  {
    id: 'JV-003-sales',
    date: '2026-01-05',
    ref: 'JV-003',
    account: 'Sales Revenue',
    debit: 0,
    credit: 80000,
    description: 'Sales revenue',
  },
  {
    id: 'JV-004-payroll',
    date: '2026-01-08',
    ref: 'JV-004',
    account: 'Payroll Expense',
    debit: 6923,
    credit: 0,
    description: 'Payroll',
  },
  {
    id: 'JV-004-cash',
    date: '2026-01-08',
    ref: 'JV-004',
    account: 'Cash',
    debit: 0,
    credit: 6923,
    description: 'Staff payment',
  },
  {
    id: 'JV-005-rent',
    date: '2026-01-10',
    ref: 'JV-005',
    account: 'Rent Expense',
    debit: 10000,
    credit: 0,
    description: 'Warehouse rent',
  },
  {
    id: 'JV-005-cash',
    date: '2026-01-10',
    ref: 'JV-005',
    account: 'Cash',
    debit: 0,
    credit: 10000,
    description: 'Monthly rent',
  },
];

export function useJournal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');

  const entries = useMemo(() => seedEntries, []);

  const filteredEntries = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const matchesSearch =
          search === '' ||
          entry.account.toLowerCase().includes(search) ||
          entry.ref.toLowerCase().includes(search) ||
          entry.description.toLowerCase().includes(search);

        const matchesAccount =
          !filterAccount || entry.account === filterAccount;

        return matchesSearch && matchesAccount;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, filterAccount, searchQuery]);

  const stats: JournalStats = useMemo(() => {
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    const now = new Date();
    const entriesThisMonth = entries.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      totalDebits,
      totalCredits,
      netChange: totalDebits - totalCredits,
      entriesThisMonth,
    };
  }, [entries]);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.account));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));

  const handleAddEntry = () => {
    logger.info('Add Journal Entry clicked');
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }
    logger.info(`Import CSV (journal) not implemented: ${file.name}`);
  };

  const handleExportCSV = () => {
    logger.info('Export CSV (journal) not implemented');
  };

  return {
    entries,
    filteredEntries,
    stats,
    accounts,
    searchQuery,
    setSearchQuery,
    filterAccount,
    setFilterAccount,
    activeTab,
    setActiveTab,
    formatCurrency,
    formatDate,
    handleAddEntry,
    handleImportCSV,
    handleExportCSV,
  };
}
