import { useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { getPeriodRange } from '@/lib/accounting/date-utils';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';

export type JournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

export type JournalStats = {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  entriesThisMonth: number;
  period: string;
};

export const JOURNAL_PERIOD_OPTIONS = PERIOD_OPTIONS;
export type JournalPeriodOption = PeriodOption;

export function useJournal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<JournalPeriodOption>('All Time');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats>({
    totalDebits: 0,
    totalCredits: 0,
    netChange: 0,
    entriesThisMonth: 0,
    period: 'All Time',
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchJournal() {
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
          qs ? `/api/accounting/journal?${qs}` : '/api/accounting/journal'
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = (await res.json()) as {
          success?: boolean;
          data?: { entries: JournalEntry[]; stats: JournalStats };
        };

        if (!isMounted || !payload?.data) {
          return;
        }

        setEntries(payload.data.entries ?? []);
        setStats((prev) => payload.data?.stats ?? prev);
      } catch (error) {
        logger.warn('Journal fetch failed, showing empty results', { error });
        if (!isMounted) {
          return;
        }
        setEntries([]);
        setStats({
          totalDebits: 0,
          totalCredits: 0,
          netChange: 0,
          entriesThisMonth: 0,
          period: period,
        });
      }
    }

    fetchJournal();

    return () => {
      isMounted = false;
    };
  }, [period]);

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

  const accounts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.account));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const formatCurrency = formatCurrencyPHP;

  const formatDate = (date: string) => formatLongDateUS(date);

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
