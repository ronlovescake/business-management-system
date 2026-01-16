import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { PERIOD_OPTIONS, type PeriodOption } from '@/lib/accounting/constants';
import { buildPeriodSearchParams } from '@/lib/accounting/query';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import {
  buildTaggedAccountName,
  isTaggableAccountParent,
} from '@/lib/accounting/account-tagging';
import {
  buildManualEntryFormFromLines,
  createManualEntryFormState,
  MANUAL_ENTRY_DEFAULT_DATE,
} from '@/lib/accounting/manual-entry';

export type JournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string;
  systemGenerated?: boolean;
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

  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [editingManualSourceId, setEditingManualSourceId] = useState<
    string | null
  >(null);
  const [manualEntryForm, setManualEntryForm] = useState(
    createManualEntryFormState()
  );

  const fetchJournalData = useCallback(async () => {
    const qs = buildPeriodSearchParams(period).toString();
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

    return payload.data ?? null;
  }, [period]);

  const refreshJournal = useCallback(async () => {
    try {
      const data = await fetchJournalData();
      setEntries(data?.entries ?? []);
      setStats((prev) => data?.stats ?? prev);
    } catch (error) {
      logger.warn('Journal fetch failed, showing empty results', { error });
      setEntries([]);
      setStats({
        totalDebits: 0,
        totalCredits: 0,
        netChange: 0,
        entriesThisMonth: 0,
        period,
      });
    }
  }, [fetchJournalData, period]);

  useEffect(() => {
    refreshJournal();
  }, [refreshJournal]);

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

  const openManualEntryModal = useCallback(() => {
    setEditingManualSourceId(null);
    setManualEntryForm((prev) => ({
      ...prev,
      date: prev.date || MANUAL_ENTRY_DEFAULT_DATE,
    }));
    setIsManualEntryModalOpen(true);
  }, []);

  const openManualEntryModalForEdit = useCallback(
    (entry: JournalEntry) => {
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

      setManualEntryForm(buildManualEntryFormFromLines(debitLine, creditLine));
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
        | 'debitAccountTag'
        | 'creditAccountTag'
        | 'amount'
        | 'description',
      value: string | number | null
    ) => {
      setManualEntryForm((prev) => {
        const nextValue = value ?? (field === 'amount' ? 0 : '');

        if (field === 'debitAccount') {
          return {
            ...prev,
            debitAccount: String(nextValue),
            debitAccountTag: isTaggableAccountParent(String(nextValue))
              ? prev.debitAccountTag
              : '',
          };
        }

        if (field === 'creditAccount') {
          return {
            ...prev,
            creditAccount: String(nextValue),
            creditAccountTag: isTaggableAccountParent(String(nextValue))
              ? prev.creditAccountTag
              : '',
          };
        }

        return {
          ...prev,
          [field]: nextValue,
        };
      });
    },
    []
  );

  const saveManualEntry = useCallback(async () => {
    const date = manualEntryForm.date || MANUAL_ENTRY_DEFAULT_DATE;
    const ref = manualEntryForm.ref.trim();
    const debitAccountSelection = manualEntryForm.debitAccount.trim();
    const creditAccountSelection = manualEntryForm.creditAccount.trim();
    const amount = Number(manualEntryForm.amount ?? 0);
    const description = manualEntryForm.description.trim();

    const debitAccount = isTaggableAccountParent(debitAccountSelection)
      ? buildTaggedAccountName(
          debitAccountSelection,
          manualEntryForm.debitAccountTag
        )
      : debitAccountSelection;
    const creditAccount = isTaggableAccountParent(creditAccountSelection)
      ? buildTaggedAccountName(
          creditAccountSelection,
          manualEntryForm.creditAccountTag
        )
      : creditAccountSelection;

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
      await refreshJournal();
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
  }, [manualEntryForm, refreshJournal, editingManualSourceId]);

  const deleteManualEntry = useCallback(
    async (entry: JournalEntry) => {
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

        await refreshJournal();
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
    [refreshJournal]
  );

  const handleAddEntry = openManualEntryModal;

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
    isManualEntryModalOpen,
    closeManualEntryModal,
    saveManualEntry,
    isSavingManualEntry,
    manualEntryForm,
    handleManualEntryFieldChange,
    editingManualSourceId,
    openManualEntryModalForEdit,
    deleteManualEntry,
  };
}
