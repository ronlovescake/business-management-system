import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { buildPeriodSearchParams } from '@/lib/accounting/query';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import {
  buildLedgerAccounts,
  filterAndSortLedgerEntries,
} from './ledgerDerivedData';
import {
  deleteTransitBuildLedgerEntry,
  editTransitBuildLedgerEntry,
} from './ledgerTransitBuildActions';
import {
  downloadLedgerCsvTemplate,
  exportLedgerCsv,
  importLedgerCsv,
} from './ledgerCsvHandlers';
import { getApiDataOrThrow } from '@/lib/api/response';
import { buildApiPath } from '@/lib/api/paths';
import type { ApiResponse } from '@/types/api';
import { useLedgerManualEntries } from './useLedgerManualEntries';
import { useLedgerOpeningEntries } from './useLedgerOpeningEntries';
import type { LedgerEntry, LedgerStats } from './ledgerTypes';
export type {
  LedgerEntry,
  OpeningBalanceEntry,
  LedgerStats,
} from './ledgerTypes';

const TRANSIT_BUILD_ALLOWED_CREDIT_ACCOUNTS = [
  'Cash',
  'Bank',
  'E-Wallet',
  'Accounts Payable',
  'Forwarder Payable',
  'Courier Payable',
] as const;
export const LEDGER_PERIOD_OPTIONS = PERIOD_OPTIONS;
export type LedgerPeriodOption = PeriodOption;
export const OPENING_BALANCE_PERIOD_OPTIONS = [
  'All Time',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'Last 90 Days',
  'This Year',
  'Last Year',
] as const;
export type OpeningBalancePeriodOption =
  (typeof OPENING_BALANCE_PERIOD_OPTIONS)[number];
const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MANUAL_IMPORT_ROWS = 1000;

export function useLedger(options: { apiBasePath?: string } = {}) {
  const { apiBasePath } = options;
  const apiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [period, setPeriod] = useState<LedgerPeriodOption>('This Month');
  const [openingBalancePeriod, setOpeningBalancePeriod] =
    useState<OpeningBalancePeriodOption>('This Month');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [stats, setStats] = useState<LedgerStats>({
    totalDebits: 0,
    totalCredits: 0,
    netChange: 0,
    accounts: 0,
    period: 'This Month',
  });

  const defaultStats = useCallback(
    (): LedgerStats => ({
      totalDebits: 0,
      totalCredits: 0,
      netChange: 0,
      accounts: 0,
      period,
    }),
    [period]
  );

  const fetchLedgerData = useCallback(async () => {
    const qs = buildPeriodSearchParams(period).toString();
    const endpoint = apiPath('/accounting/ledger');
    const res = await fetch(qs ? `${endpoint}?${qs}` : endpoint);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = (await res.json()) as ApiResponse<{
      entries: LedgerEntry[];
      stats: LedgerStats;
    }>;
    const data = getApiDataOrThrow(payload, 'Failed to load ledger');
    return {
      entries: data.entries ?? [],
      stats: data.stats ?? defaultStats(),
    };
  }, [apiPath, period, defaultStats]);

  const refreshLedger = useCallback(async () => {
    try {
      const data = await fetchLedgerData();
      setEntries(data.entries ?? []);
      setStats(data.stats ?? defaultStats());
    } catch (error) {
      logger.warn('Ledger fetch failed, showing empty results', { error });
      setEntries([]);
      setStats(defaultStats());
    }
  }, [fetchLedgerData, defaultStats]);

  const deleteTransitBuildEntry = useCallback(
    async (entry: LedgerEntry) => {
      await deleteTransitBuildLedgerEntry({
        entry,
        apiPath,
        refreshLedger,
      });
    },
    [apiPath, refreshLedger]
  );

  const editTransitBuildEntry = useCallback(
    async (entry: LedgerEntry) => {
      await editTransitBuildLedgerEntry({
        entry,
        apiPath,
        refreshLedger,
        allowedCreditAccounts: TRANSIT_BUILD_ALLOWED_CREDIT_ACCOUNTS,
      });
    },
    [apiPath, refreshLedger]
  );

  useEffect(() => {
    refreshLedger();
  }, [refreshLedger]);

  const openingEntriesState = useLedgerOpeningEntries({
    apiPath,
    refreshLedger,
  });

  const manualEntriesState = useLedgerManualEntries({
    apiPath,
    refreshLedger,
    entries,
  });

  const filteredEntries = useMemo(() => {
    return filterAndSortLedgerEntries(entries, searchQuery, filterAccount);
  }, [entries, filterAccount, searchQuery]);

  const filteredStats = useMemo<LedgerStats>(() => {
    const totalDebits = filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.debit || 0),
      0
    );
    const totalCredits = filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.credit || 0),
      0
    );
    const accounts = new Set(filteredEntries.map((entry) => entry.account))
      .size;

    return {
      totalDebits,
      totalCredits,
      netChange: totalDebits - totalCredits,
      accounts,
      period: stats.period,
    };
  }, [filteredEntries, stats.period]);

  const accounts = useMemo(() => {
    return buildLedgerAccounts(entries);
  }, [entries]);

  const formatCurrency = formatCurrencyPHP;

  const formatDate = (date: string) => formatLongDateUS(date);
  const handleAddEntry = manualEntriesState.openManualEntryModal;

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    void importLedgerCsv({
      file,
      apiPath,
      refreshLedger,
      maxFileSizeBytes: MAX_CSV_FILE_SIZE_BYTES,
      maxRows: MAX_MANUAL_IMPORT_ROWS,
    });
  };

  const handleExportCSV = () => {
    exportLedgerCsv({ entries: filteredEntries });
  };

  const handleDownloadTemplate = () => {
    downloadLedgerCsvTemplate();
  };

  return {
    entries,
    filteredEntries,
    stats: filteredStats,
    refreshLedger,
    period,
    setPeriod,
    openingBalancePeriod,
    setOpeningBalancePeriod,
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
    handleDownloadTemplate,
    handleExportCSV,
    ...manualEntriesState,
    editTransitBuildEntry,
    deleteTransitBuildEntry,
    ...openingEntriesState,
  };
}
