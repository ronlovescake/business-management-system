import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { getPeriodRange } from '@/lib/accounting/date-utils';

export type LedgerEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  balance?: number;
};

export type LedgerStats = {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  accounts: number;
  period: string;
};

export const LEDGER_PERIOD_OPTIONS = PERIOD_OPTIONS;
export type LedgerPeriodOption = PeriodOption;

function computeRunningBalances(entries: LedgerEntry[]): LedgerEntry[] {
  const balances = new Map<string, number>();
  const byDate = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return byDate.map((entry) => {
    const current = balances.get(entry.account) ?? 0;
    const next = current + entry.debit - entry.credit;
    balances.set(entry.account, next);
    return { ...entry, balance: next };
  });
}

export function useLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<LedgerPeriodOption>('All Time');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [stats, setStats] = useState<LedgerStats>({
    totalDebits: 0,
    totalCredits: 0,
    netChange: 0,
    accounts: 0,
    period: 'All Time',
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchLedger() {
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
          qs ? `/api/accounting/ledger?${qs}` : '/api/accounting/ledger'
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = (await res.json()) as {
          success?: boolean;
          data?: { entries: LedgerEntry[]; stats: LedgerStats };
        };

        if (!isMounted || !payload?.data) {
          return;
        }

        setEntries(payload.data.entries ?? []);
        setStats((prev) => payload.data?.stats ?? prev);
      } catch (error) {
        logger.warn('Ledger fetch failed, showing empty results', { error });
        if (!isMounted) {
          return;
        }
        setEntries([]);
        setStats({
          totalDebits: 0,
          totalCredits: 0,
          netChange: 0,
          accounts: 0,
          period: period,
        });
      }
    }

    fetchLedger();

    return () => {
      isMounted = false;
    };
  }, [period]);

  const filteredEntries = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const matchesSearch =
        search === '' ||
        entry.account.toLowerCase().includes(search) ||
        entry.ref.toLowerCase().includes(search) ||
        entry.description.toLowerCase().includes(search);

      const matchesAccount = !filterAccount || entry.account === filterAccount;

      return matchesSearch && matchesAccount;
    });

    const withBalances = computeRunningBalances(filtered);

    return withBalances.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [entries, filterAccount, searchQuery]);

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
    logger.info('Add Ledger Entry clicked');
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }
    logger.info(`Import CSV (ledger) not implemented: ${file.name}`);
  };

  const handleExportCSV = () => {
    logger.info('Export CSV (ledger) not implemented');
  };

  return {
    entries,
    filteredEntries,
    stats,
    period,
    setPeriod,
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
