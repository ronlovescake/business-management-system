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
  getManualEntryDefaultDate,
  validateManualEntryInput,
} from '@/lib/accounting/manual-entry';
import { parseManualEntryCsv } from '@/lib/accounting/manual-entry-import';
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
const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MANUAL_IMPORT_ROWS = 1000;

const getEntryTimestamp = (value: string) => parseDate(value)?.getTime() ?? 0;

export function useJournal(options: { apiBasePath?: string } = {}) {
  const { apiBasePath } = options;
  const apiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
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
    const endpoint = apiPath('/accounting/journal');
    const res = await fetch(qs ? `${endpoint}?${qs}` : endpoint);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = (await res.json()) as ApiResponse<{
      entries: JournalEntry[];
      stats: JournalStats;
    }>;

    return getApiDataOrThrow(payload, 'Failed to load journal');
  }, [apiPath, period]);

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
      .sort((a, b) => getEntryTimestamp(b.date) - getEntryTimestamp(a.date));
  }, [entries, filterAccount, searchQuery]);

  const filteredStats = useMemo<JournalStats>(() => {
    const totalDebits = filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.debit || 0),
      0
    );
    const totalCredits = filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.credit || 0),
      0
    );

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const entriesThisMonth = filteredEntries.filter((entry) => {
      const date = parseDate(entry.date);
      if (!date) {
        return false;
      }
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    }).length;

    return {
      totalDebits,
      totalCredits,
      netChange: totalDebits - totalCredits,
      entriesThisMonth,
      period: stats.period,
    };
  }, [filteredEntries, stats.period]);

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
      date: prev.date || getManualEntryDefaultDate(),
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
    const date = manualEntryForm.date || getManualEntryDefaultDate();
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

    const validationError = validateManualEntryInput({
      ref,
      debitAccount,
      creditAccount,
      amount,
    });
    if (validationError) {
      showNotification({
        color: 'red',
        title: validationError.title,
        message: validationError.message,
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

      const res = await fetch(apiPath('/accounting/manual-journal'), {
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
  }, [apiPath, manualEntryForm, refreshJournal, editingManualSourceId]);

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
          `${apiPath('/accounting/manual-journal')}?sourceId=${encodeURIComponent(sourceId)}`,
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
    [apiPath, refreshJournal]
  );

  const handleAddEntry = openManualEntryModal;

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }
    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      showNotification({
        color: 'red',
        title: 'Import failed',
        message: 'CSV file is too large (max 5 MB).',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const { rows, errors } = parseManualEntryCsv(text);

        if (errors.length > 0) {
          showNotification({
            color: 'red',
            title: 'Import failed',
            message: errors.slice(0, 5).join('\n'),
          });
          return;
        }

        const cappedRows = rows.slice(0, MAX_MANUAL_IMPORT_ROWS);
        const skippedCount = rows.length - cappedRows.length;

        let successCount = 0;
        let errorCount = 0;

        for (const entry of cappedRows) {
          try {
            const response = await fetch(
              apiPath('/accounting/manual-journal'),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry),
              }
            );
            if (!response.ok) {
              errorCount++;
              continue;
            }
            successCount++;
          } catch (error) {
            logger.error('Journal CSV import row failed', { error, entry });
            errorCount++;
          }
        }

        await refreshJournal();
        showNotification({
          color: errorCount > 0 ? 'yellow' : 'green',
          title: 'Journal import complete',
          message:
            `Imported ${successCount} entries` +
            (errorCount > 0 ? `, ${errorCount} failed.` : '.') +
            (skippedCount > 0
              ? ` ${skippedCount} rows skipped (limit ${MAX_MANUAL_IMPORT_ROWS}).`
              : ''),
        });
      } catch (error) {
        logger.error('Journal CSV import failed', { error });
        showNotification({
          color: 'red',
          title: 'Import failed',
          message: 'Unable to import journal CSV file.',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      showNotification({
        color: 'red',
        title: 'Export failed',
        message: 'No journal entries to export.',
      });
      return;
    }

    const headers = [
      'Date',
      'Ref',
      'Account',
      'Debit',
      'Credit',
      'Description',
      'Source Type',
      'Source Id',
      'Source Line',
      'System Generated',
    ];

    const rows = filteredEntries.map((entry) => [
      escapeCsvValue(entry.date),
      escapeCsvValue(entry.ref),
      escapeCsvValue(entry.account),
      escapeCsvValue(entry.debit.toFixed(2)),
      escapeCsvValue(entry.credit.toFixed(2)),
      escapeCsvValue(entry.description),
      escapeCsvValue(entry.sourceType || ''),
      escapeCsvValue(entry.sourceId || ''),
      escapeCsvValue(entry.sourceLineKey || ''),
      escapeCsvValue(entry.systemGenerated ? 'yes' : 'no'),
    ]);

    const csvContent = buildCsvContent(headers, rows);
    const date = getCurrentDateISO();
    const filename = `journal_${date}.csv`;
    downloadCsvFile(filename, csvContent);
  };

  const handleDownloadTemplate = () => {
    const date = getCurrentDateISO();
    downloadCsvTemplateFile(`journal_template_${date}.csv`, [
      'date',
      'amount',
      'ref',
      'debitAccount',
      'creditAccount',
      'description',
    ]);
  };

  return {
    entries,
    filteredEntries,
    stats: filteredStats,
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
    handleDownloadTemplate,
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
