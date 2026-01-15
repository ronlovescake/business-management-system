import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { getPeriodRange } from '@/lib/accounting/date-utils';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';

export type LedgerEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  balance?: number;
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string;
  systemGenerated?: boolean;
};

export type OpeningBalanceEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description?: string;
};

export type LedgerStats = {
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  accounts: number;
  period: string;
};

const OPENING_BALANCE_DEFAULT_DATE = '2026-01-01';
const MANUAL_ENTRY_DEFAULT_DATE = '2026-01-01';

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
  const [openingEntries, setOpeningEntries] = useState<OpeningBalanceEntry[]>(
    []
  );
  const [isLoadingOpeningEntries, setIsLoadingOpeningEntries] = useState(false);
  const [isOpeningEntryModalOpen, setIsOpeningEntryModalOpen] = useState(false);
  const [isSavingOpeningEntry, setIsSavingOpeningEntry] = useState(false);
  const [editingOpeningEntryId, setEditingOpeningEntryId] = useState<
    string | null
  >(null);
  const [openingEntryForm, setOpeningEntryForm] = useState({
    date: OPENING_BALANCE_DEFAULT_DATE,
    ref: '',
    account: '',
    debit: 0,
    credit: 0,
    description: '',
  });

  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [editingManualSourceId, setEditingManualSourceId] = useState<
    string | null
  >(null);
  const [manualEntryForm, setManualEntryForm] = useState({
    date: MANUAL_ENTRY_DEFAULT_DATE,
    ref: '',
    debitAccount: '',
    creditAccount: '',
    amount: 0,
    description: '',
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
      error?: string;
    };

    return (
      payload.data ?? {
        entries: [],
        stats: defaultStats(),
      }
    );
  }, [period, defaultStats]);

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

  useEffect(() => {
    refreshLedger();
  }, [refreshLedger]);

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

  const formatCurrency = formatCurrencyPHP;

  const formatDate = (date: string) => formatLongDateUS(date);

  const fetchOpeningEntries = useCallback(async () => {
    setIsLoadingOpeningEntries(true);
    try {
      const res = await fetch('/api/accounting/opening-balance');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as {
        data?: { entries: OpeningBalanceEntry[] };
        error?: string;
      };

      setOpeningEntries(payload.data?.entries ?? []);
    } catch (error) {
      logger.warn('Opening balance fetch failed', { error });
      setOpeningEntries([]);
    } finally {
      setIsLoadingOpeningEntries(false);
    }
  }, []);

  useEffect(() => {
    fetchOpeningEntries();
  }, [fetchOpeningEntries]);

  const handleOpeningEntryFieldChange = useCallback(
    (
      field: 'date' | 'ref' | 'account' | 'debit' | 'credit' | 'description',
      value: string | number | null
    ) => {
      setOpeningEntryForm((prev) => {
        if (field === 'debit') {
          return {
            ...prev,
            debit: Number(value ?? 0),
            credit: 0,
          };
        }

        if (field === 'credit') {
          return {
            ...prev,
            credit: Number(value ?? 0),
            debit: 0,
          };
        }

        return {
          ...prev,
          [field]: typeof value === 'number' ? value : (value ?? ''),
        };
      });
    },
    []
  );

  const openOpeningEntryModal = useCallback(() => {
    setEditingOpeningEntryId(null);
    setOpeningEntryForm({
      date: OPENING_BALANCE_DEFAULT_DATE,
      ref: '',
      account: '',
      debit: 0,
      credit: 0,
      description: '',
    });
    setIsOpeningEntryModalOpen(true);
  }, []);

  const openOpeningEntryModalForEdit = useCallback(
    (entry: OpeningBalanceEntry) => {
      setEditingOpeningEntryId(entry.id);
      setOpeningEntryForm({
        date: entry.date.slice(0, 10),
        ref: entry.ref,
        account: entry.account,
        debit: entry.debit,
        credit: entry.credit,
        description: entry.description ?? '',
      });
      setIsOpeningEntryModalOpen(true);
    },
    []
  );

  const closeOpeningEntryModal = useCallback(() => {
    setEditingOpeningEntryId(null);
    setIsOpeningEntryModalOpen(false);
  }, []);

  const saveOpeningEntry = useCallback(async () => {
    const account = openingEntryForm.account.trim();
    const ref = openingEntryForm.ref.trim();
    const description = openingEntryForm.description.trim();
    const debit = Number(openingEntryForm.debit ?? 0);
    const credit = Number(openingEntryForm.credit ?? 0);
    const date = openingEntryForm.date || OPENING_BALANCE_DEFAULT_DATE;

    if (!account) {
      showNotification({
        color: 'red',
        title: 'Account is required',
        message: 'Choose an account for the opening entry.',
      });
      return;
    }

    const hasDebit = debit > 0;
    const hasCredit = credit > 0;

    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      showNotification({
        color: 'red',
        title: 'Enter a debit or a credit',
        message: 'Provide one side only for the opening line.',
      });
      return;
    }

    setIsSavingOpeningEntry(true);
    try {
      const payload = {
        id: editingOpeningEntryId ?? undefined,
        date,
        ref,
        account,
        debit,
        credit,
        description,
      };

      const res = await fetch('/api/accounting/opening-balance', {
        method: editingOpeningEntryId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await res.json();
      if (!res.ok) {
        const errorMessage =
          responseBody?.error || 'Failed to save opening entry';
        throw new Error(errorMessage);
      }

      showNotification({
        color: 'teal',
        title: editingOpeningEntryId
          ? 'Opening entry updated'
          : 'Opening entry saved',
        message: account,
      });

      setIsOpeningEntryModalOpen(false);
      setEditingOpeningEntryId(null);
      await fetchOpeningEntries();
      await refreshLedger();
    } catch (error) {
      logger.error('Opening balance save failed', { error });
      showNotification({
        color: 'red',
        title: 'Could not save entry',
        message:
          error instanceof Error ? error.message : 'Unexpected error occurred',
      });
    } finally {
      setIsSavingOpeningEntry(false);
    }
  }, [
    editingOpeningEntryId,
    openingEntryForm,
    fetchOpeningEntries,
    refreshLedger,
  ]);

  const deleteOpeningEntry = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/accounting/opening-balance?id=${encodeURIComponent(id)}`,
          {
            method: 'DELETE',
          }
        );

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const errorMessage =
            payload?.error || 'Failed to delete opening entry';
          throw new Error(errorMessage);
        }

        await fetchOpeningEntries();
        await refreshLedger();

        showNotification({
          color: 'green',
          title: 'Opening entry deleted',
          message: 'The opening balance line was removed.',
        });
      } catch (error) {
        logger.error('Opening balance delete failed', { error });
        showNotification({
          color: 'red',
          title: 'Delete failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error deleting entry',
        });
        throw error;
      }
    },
    [fetchOpeningEntries, refreshLedger]
  );

  const openManualEntryModal = useCallback(() => {
    setEditingManualSourceId(null);
    setManualEntryForm((prev) => ({
      ...prev,
      date: prev.date || MANUAL_ENTRY_DEFAULT_DATE,
    }));
    setIsManualEntryModalOpen(true);
  }, []);

  const openManualEntryModalForEdit = useCallback(
    (entry: LedgerEntry) => {
      const sourceId = entry.sourceId ?? null;
      if (!sourceId) {
        return;
      }

      const group = entries.filter(
        (e) => e.sourceType === 'MANUAL' && e.sourceId === sourceId
      );
      const debitLine = group.find((e) => Number(e.debit ?? 0) > 0);
      const creditLine = group.find((e) => Number(e.credit ?? 0) > 0);

      if (!debitLine || !creditLine) {
        showNotification({
          color: 'red',
          title: 'Cannot edit entry',
          message: 'This manual entry is missing a debit or credit line.',
        });
        return;
      }

      setEditingManualSourceId(sourceId);
      setManualEntryForm({
        date: (debitLine.date || creditLine.date).slice(0, 10),
        ref: debitLine.ref || creditLine.ref,
        debitAccount: debitLine.account,
        creditAccount: creditLine.account,
        amount: Number(debitLine.debit ?? creditLine.credit ?? 0),
        description: debitLine.description || creditLine.description || '',
      });
      setIsManualEntryModalOpen(true);
    },
    [entries]
  );

  const closeManualEntryModal = useCallback(() => {
    setIsManualEntryModalOpen(false);
    setEditingManualSourceId(null);
  }, []);

  const handleManualEntryFieldChange = useCallback(
    (
      field:
        | 'date'
        | 'ref'
        | 'debitAccount'
        | 'creditAccount'
        | 'amount'
        | 'description',
      value: string | number | null
    ) => {
      setManualEntryForm((prev) => ({
        ...prev,
        [field]: value ?? (field === 'amount' ? 0 : ''),
      }));
    },
    []
  );

  const saveManualEntry = useCallback(async () => {
    const date = manualEntryForm.date || MANUAL_ENTRY_DEFAULT_DATE;
    const ref = manualEntryForm.ref.trim();
    const debitAccount = manualEntryForm.debitAccount.trim();
    const creditAccount = manualEntryForm.creditAccount.trim();
    const amount = Number(manualEntryForm.amount ?? 0);
    const description = manualEntryForm.description.trim();

    if (!ref) {
      showNotification({
        color: 'red',
        title: 'Reference is required',
        message: 'Add a short reference (e.g., PAYMENT • Customer Name).',
      });
      return;
    }

    if (!debitAccount || !creditAccount) {
      showNotification({
        color: 'red',
        title: 'Accounts are required',
        message: 'Choose both a debit and credit account.',
      });
      return;
    }

    if (debitAccount === creditAccount) {
      showNotification({
        color: 'red',
        title: 'Accounts must differ',
        message: 'Debit and credit accounts must be different.',
      });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showNotification({
        color: 'red',
        title: 'Amount must be positive',
        message: 'Enter a valid amount greater than 0.',
      });
      return;
    }

    setIsSavingManualEntry(true);
    try {
      const payload = {
        sourceId: editingManualSourceId ?? undefined,
        date,
        ref,
        debitAccount,
        creditAccount,
        amount,
        description,
      };

      const res = await fetch('/api/accounting/manual-journal', {
        method: editingManualSourceId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage =
          responseBody?.error || 'Failed to save manual journal entry';
        throw new Error(errorMessage);
      }

      showNotification({
        color: 'teal',
        title: editingManualSourceId ? 'Entry updated' : 'Entry saved',
        message: `${debitAccount} / ${creditAccount}`,
      });

      setIsManualEntryModalOpen(false);
      setEditingManualSourceId(null);
      await refreshLedger();
    } catch (error) {
      logger.error('Manual journal save failed', { error });
      showNotification({
        color: 'red',
        title: 'Could not save entry',
        message:
          error instanceof Error ? error.message : 'Unexpected error occurred',
      });
    } finally {
      setIsSavingManualEntry(false);
    }
  }, [manualEntryForm, refreshLedger, editingManualSourceId]);

  const deleteManualEntry = useCallback(
    async (entry: LedgerEntry) => {
      const sourceId = entry.sourceId ?? null;
      if (!sourceId) {
        return;
      }

      const ok = window.confirm(
        `Delete this manual entry?\n\n${entry.ref}\n${entry.account}`
      );
      if (!ok) {
        return;
      }

      try {
        const res = await fetch(
          `/api/accounting/manual-journal?sourceId=${encodeURIComponent(sourceId)}`,
          { method: 'DELETE' }
        );

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const errorMessage = payload?.error || 'Failed to delete entry';
          throw new Error(errorMessage);
        }

        showNotification({
          color: 'green',
          title: 'Entry deleted',
          message: entry.ref,
        });

        await refreshLedger();
      } catch (error) {
        logger.error('Manual journal delete failed', { error });
        showNotification({
          color: 'red',
          title: 'Delete failed',
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error deleting entry',
        });
        throw error;
      }
    },
    [refreshLedger]
  );

  const handleAddEntry = openManualEntryModal;

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
    isManualEntryModalOpen,
    isSavingManualEntry,
    editingManualSourceId,
    manualEntryForm,
    handleManualEntryFieldChange,
    openManualEntryModal,
    openManualEntryModalForEdit,
    closeManualEntryModal,
    saveManualEntry,
    deleteManualEntry,
    openingEntries,
    isLoadingOpeningEntries,
    isOpeningEntryModalOpen,
    isSavingOpeningEntry,
    openingEntryForm,
    handleOpeningEntryFieldChange,
    openOpeningEntryModal,
    openOpeningEntryModalForEdit,
    closeOpeningEntryModal,
    saveOpeningEntry,
    deleteOpeningEntry,
    editingOpeningEntryId,
  };
}
