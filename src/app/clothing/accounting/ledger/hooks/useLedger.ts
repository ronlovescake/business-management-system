import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
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
  toTaggableSelection,
} from '@/lib/accounting/account-tagging';
import {
  buildManualEntryFormFromLines,
  createManualEntryFormState,
  MANUAL_ENTRY_DEFAULT_DATE,
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

const FALLBACK_OPENING_BALANCE_DATE = getCurrentDateISO();
export const LEDGER_PERIOD_OPTIONS = PERIOD_OPTIONS;
export type LedgerPeriodOption = PeriodOption;
const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MANUAL_IMPORT_ROWS = 1000;

const getEntryTimestamp = (value: string) => parseDate(value)?.getTime() ?? 0;

function computeRunningBalances(entries: LedgerEntry[]): LedgerEntry[] {
  const balances = new Map<string, number>();
  const byDate = [...entries].sort(
    (a, b) => getEntryTimestamp(a.date) - getEntryTimestamp(b.date)
  );

  return byDate.map((entry) => {
    const current = balances.get(entry.account) ?? 0;
    const next = current + entry.debit - entry.credit;
    balances.set(entry.account, next);
    return { ...entry, balance: next };
  });
}

export function useLedger(options: { apiBasePath?: string } = {}) {
  const { apiBasePath } = options;
  const apiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
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
  const [openingBalanceCutoverDate, setOpeningBalanceCutoverDate] = useState(
    FALLBACK_OPENING_BALANCE_DATE
  );
  const [isLoadingOpeningEntries, setIsLoadingOpeningEntries] = useState(false);
  const [isOpeningEntryModalOpen, setIsOpeningEntryModalOpen] = useState(false);
  const [isSavingOpeningEntry, setIsSavingOpeningEntry] = useState(false);
  const [editingOpeningEntryId, setEditingOpeningEntryId] = useState<
    string | null
  >(null);
  const [editingOpeningEntryDebitId, setEditingOpeningEntryDebitId] = useState<
    string | null
  >(null);
  const [editingOpeningEntryCreditId, setEditingOpeningEntryCreditId] =
    useState<string | null>(null);
  const [editingOpeningEntrySide, setEditingOpeningEntrySide] = useState<
    'debit' | 'credit' | null
  >(null);
  const [openingEntryForm, setOpeningEntryForm] = useState({
    date: FALLBACK_OPENING_BALANCE_DATE,
    ref: 'OPENING',
    account: '',
    debit: 0,
    credit: 0,
    debitAccount: '',
    creditAccount: '',
    debitAccountTag: '',
    creditAccountTag: '',
    amount: 0,
    description: '',
  });

  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [editingManualSourceId, setEditingManualSourceId] = useState<
    string | null
  >(null);
  const [manualEntryForm, setManualEntryForm] = useState(
    createManualEntryFormState()
  );

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
      (a, b) => getEntryTimestamp(b.date) - getEntryTimestamp(a.date)
    );
  }, [entries, filterAccount, searchQuery]);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.account));

    // Ensure common accounts are available in dropdowns even before any
    // transactions exist for them.
    [
      'Cash',
      'Accounts Receivable',
      'Stock on Hand',
      'Inventory in Transit',
      'Accounts Payable',
      'Forwarder Payable',
      'Courier Payable',
      'Credit Card Payable',
      'Loan Payable',
      'Opening Equity',
      'Owner Contribution',
      'Owner Draw',
      'Sales Revenue',
      'Sales Returns',
      'COGS',
      'Inventory Shrinkage',
      'Interest Expense',
    ].forEach((account) => set.add(account));

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const formatCurrency = formatCurrencyPHP;

  const formatDate = (date: string) => formatLongDateUS(date);

  const fetchOpeningEntries = useCallback(async () => {
    setIsLoadingOpeningEntries(true);
    try {
      const res = await fetch(apiPath('/accounting/opening-balance'));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = (await res.json()) as ApiResponse<{
        entries: OpeningBalanceEntry[];
        cutoverDate?: string;
      }>;
      const data = getApiDataOrThrow(
        payload,
        'Failed to load opening balances'
      );
      setOpeningEntries(data.entries ?? []);
      if (data.cutoverDate) {
        setOpeningBalanceCutoverDate(data.cutoverDate);
      }
    } catch (error) {
      logger.warn('Opening balance fetch failed', { error });
      setOpeningEntries([]);
    } finally {
      setIsLoadingOpeningEntries(false);
    }
  }, [apiPath]);

  useEffect(() => {
    fetchOpeningEntries();
  }, [fetchOpeningEntries]);

  useEffect(() => {
    // Opening balances are always posted on the cutover date; keep the UI aligned
    // with the server-side cutover configuration.
    setOpeningEntryForm((prev) => {
      if (
        !openingBalanceCutoverDate ||
        prev.date === openingBalanceCutoverDate
      ) {
        return prev;
      }

      // Only overwrite the date for the create flow. Edit flow preserves the
      // existing entry date key (which should match cutover anyway).
      if (editingOpeningEntryId) {
        return prev;
      }

      return { ...prev, date: openingBalanceCutoverDate };
    });
  }, [openingBalanceCutoverDate, editingOpeningEntryId]);

  const handleOpeningEntryFieldChange = useCallback(
    (
      field:
        | 'date'
        | 'ref'
        | 'account'
        | 'debit'
        | 'credit'
        | 'debitAccount'
        | 'creditAccount'
        | 'debitAccountTag'
        | 'creditAccountTag'
        | 'amount'
        | 'description',
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

        if (field === 'amount') {
          return {
            ...prev,
            amount: Number(value ?? 0),
          };
        }

        if (field === 'debitAccount') {
          const nextDebit = String(value ?? '');
          return {
            ...prev,
            debitAccount: nextDebit,
            debitAccountTag: isTaggableAccountParent(nextDebit)
              ? prev.debitAccountTag
              : '',
          };
        }

        if (field === 'creditAccount') {
          const nextCredit = String(value ?? '');
          return {
            ...prev,
            creditAccount: nextCredit,
            creditAccountTag: isTaggableAccountParent(nextCredit)
              ? prev.creditAccountTag
              : '',
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
    setEditingOpeningEntryDebitId(null);
    setEditingOpeningEntryCreditId(null);
    setEditingOpeningEntrySide(null);
    setOpeningEntryForm({
      date: openingBalanceCutoverDate,
      ref: 'OPENING',
      account: '',
      debit: 0,
      credit: 0,
      debitAccount: '',
      creditAccount: '',
      debitAccountTag: '',
      creditAccountTag: '',
      amount: 0,
      description: '',
    });
    setIsOpeningEntryModalOpen(true);
  }, [openingBalanceCutoverDate]);

  const openOpeningEntryModalForEdit = useCallback(
    (entry: OpeningBalanceEntry) => {
      const dateKey = entry.date.slice(0, 10);
      const refKey = entry.ref;
      const descKey = (entry.description ?? '').trim();
      const amount = entry.debit > 0 ? entry.debit : entry.credit;
      const side: 'debit' | 'credit' = entry.debit > 0 ? 'debit' : 'credit';

      const isSameAmount = (value: number) =>
        Math.abs(Number(value ?? 0) - amount) < 0.00001;

      const counterpart = openingEntries.find((candidate) => {
        if (candidate.id === entry.id) {
          return false;
        }
        if (candidate.date.slice(0, 10) !== dateKey) {
          return false;
        }
        if (candidate.ref !== refKey) {
          return false;
        }
        if ((candidate.description ?? '').trim() !== descKey) {
          return false;
        }

        return side === 'debit'
          ? candidate.credit > 0 && isSameAmount(candidate.credit)
          : candidate.debit > 0 && isSameAmount(candidate.debit);
      });

      setEditingOpeningEntryId(entry.id);
      setEditingOpeningEntrySide(side);

      if (counterpart) {
        const debitLine = side === 'debit' ? entry : counterpart;
        const creditLine = side === 'debit' ? counterpart : entry;

        const debitSelection = toTaggableSelection(debitLine.account);
        const creditSelection = toTaggableSelection(creditLine.account);

        setEditingOpeningEntryDebitId(debitLine.id);
        setEditingOpeningEntryCreditId(creditLine.id);

        setOpeningEntryForm({
          date: dateKey,
          ref: refKey,
          account: entry.account,
          debit: entry.debit,
          credit: entry.credit,
          debitAccount: debitSelection.account,
          creditAccount: creditSelection.account,
          debitAccountTag: debitSelection.tag,
          creditAccountTag: creditSelection.tag,
          amount,
          description: entry.description ?? '',
        });
      } else {
        const singleSelection = toTaggableSelection(entry.account);

        setEditingOpeningEntryDebitId(side === 'debit' ? entry.id : null);
        setEditingOpeningEntryCreditId(side === 'credit' ? entry.id : null);

        setOpeningEntryForm({
          date: dateKey,
          ref: refKey,
          account: entry.account,
          debit: entry.debit,
          credit: entry.credit,
          debitAccount: side === 'debit' ? singleSelection.account : '',
          creditAccount: side === 'credit' ? singleSelection.account : '',
          debitAccountTag: side === 'debit' ? singleSelection.tag : '',
          creditAccountTag: side === 'credit' ? singleSelection.tag : '',
          amount,
          description: entry.description ?? '',
        });
      }

      setIsOpeningEntryModalOpen(true);
    },
    [openingEntries]
  );

  const closeOpeningEntryModal = useCallback(() => {
    setEditingOpeningEntryId(null);
    setEditingOpeningEntryDebitId(null);
    setEditingOpeningEntryCreditId(null);
    setEditingOpeningEntrySide(null);
    setIsOpeningEntryModalOpen(false);
  }, []);

  const saveOpeningEntry = useCallback(async () => {
    const ref = openingEntryForm.ref.trim();
    const description = openingEntryForm.description.trim();
    const date = openingEntryForm.date || openingBalanceCutoverDate;

    const isEditing = Boolean(editingOpeningEntryId);

    if (isEditing) {
      const debitSelection = openingEntryForm.debitAccount.trim();
      const creditSelection = openingEntryForm.creditAccount.trim();
      const amount = Number(openingEntryForm.amount ?? 0);

      const debitAccount = isTaggableAccountParent(debitSelection)
        ? buildTaggedAccountName(
            debitSelection,
            openingEntryForm.debitAccountTag
          )
        : debitSelection;
      const creditAccount = isTaggableAccountParent(creditSelection)
        ? buildTaggedAccountName(
            creditSelection,
            openingEntryForm.creditAccountTag
          )
        : creditSelection;

      if (!debitAccount || !creditAccount) {
        showNotification({
          color: 'red',
          title: 'Accounts are required',
          message: 'Choose both a debit and a credit account.',
        });
        return;
      }

      if (debitAccount === creditAccount) {
        showNotification({
          color: 'red',
          title: 'Accounts must be different',
          message: 'Debit and credit accounts cannot be the same.',
        });
        return;
      }

      if (!(amount > 0)) {
        showNotification({
          color: 'red',
          title: 'Amount is required',
          message: 'Enter an amount greater than zero.',
        });
        return;
      }

      const putLine = async (payload: {
        id: string;
        account: string;
        debit: number;
        credit: number;
      }) => {
        const res = await fetch(apiPath('/accounting/opening-balance'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: payload.id,
            date,
            ref,
            account: payload.account,
            debit: payload.debit,
            credit: payload.credit,
            description,
          }),
        });

        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to update opening entry');
        }
      };

      setIsSavingOpeningEntry(true);
      try {
        if (editingOpeningEntryDebitId && editingOpeningEntryCreditId) {
          await Promise.all([
            putLine({
              id: editingOpeningEntryDebitId,
              account: debitAccount,
              debit: amount,
              credit: 0,
            }),
            putLine({
              id: editingOpeningEntryCreditId,
              account: creditAccount,
              debit: 0,
              credit: amount,
            }),
          ]);
        } else {
          const side = editingOpeningEntrySide;
          const existingId = editingOpeningEntryId;

          if (!side || !existingId) {
            throw new Error('Missing opening entry context for edit');
          }

          // If this was created as a single line, create the missing line first
          // and then update the existing one.
          const missingPayload =
            side === 'debit'
              ? {
                  account: creditAccount,
                  debit: 0,
                  credit: amount,
                }
              : {
                  account: debitAccount,
                  debit: amount,
                  credit: 0,
                };

          const createRes = await fetch(
            apiPath('/accounting/opening-balance'),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date,
                ref,
                account: missingPayload.account,
                debit: missingPayload.debit,
                credit: missingPayload.credit,
                description,
              }),
            }
          );

          const createBody = await createRes.json().catch(() => null);
          if (!createRes.ok) {
            throw new Error(
              createBody?.error || 'Failed to create the missing opening line'
            );
          }

          const createdId = createBody?.entry?.id as string | undefined;

          try {
            const existingPayload =
              side === 'debit'
                ? {
                    account: debitAccount,
                    debit: amount,
                    credit: 0,
                  }
                : {
                    account: creditAccount,
                    debit: 0,
                    credit: amount,
                  };

            await putLine({ id: existingId, ...existingPayload });
          } catch (error) {
            if (createdId) {
              await fetch(
                `${apiPath('/accounting/opening-balance')}?id=${encodeURIComponent(
                  createdId
                )}`,
                { method: 'DELETE' }
              ).catch(() => null);
            }
            throw error;
          }
        }

        showNotification({
          color: 'teal',
          title: 'Opening entry updated',
          message: `${debitAccount} → ${creditAccount}`,
        });

        setIsOpeningEntryModalOpen(false);
        setEditingOpeningEntryId(null);
        setEditingOpeningEntryDebitId(null);
        setEditingOpeningEntryCreditId(null);
        setEditingOpeningEntrySide(null);
        await fetchOpeningEntries();
        await refreshLedger();
      } catch (error) {
        logger.error('Opening balance save failed', { error });
        showNotification({
          color: 'red',
          title: 'Could not save entry',
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error occurred',
        });
      } finally {
        setIsSavingOpeningEntry(false);
      }

      return;
    }

    const debitAccount = openingEntryForm.debitAccount.trim();
    const creditAccount = openingEntryForm.creditAccount.trim();
    const amount = Number(openingEntryForm.amount ?? 0);

    const resolvedDebitAccount = isTaggableAccountParent(debitAccount)
      ? buildTaggedAccountName(debitAccount, openingEntryForm.debitAccountTag)
      : debitAccount;
    const resolvedCreditAccount = isTaggableAccountParent(creditAccount)
      ? buildTaggedAccountName(creditAccount, openingEntryForm.creditAccountTag)
      : creditAccount;

    if (!resolvedDebitAccount || !resolvedCreditAccount) {
      showNotification({
        color: 'red',
        title: 'Accounts are required',
        message: 'Choose both a debit and a credit account.',
      });
      return;
    }

    if (resolvedDebitAccount === resolvedCreditAccount) {
      showNotification({
        color: 'red',
        title: 'Accounts must be different',
        message: 'Debit and credit accounts cannot be the same.',
      });
      return;
    }

    if (!(amount > 0)) {
      showNotification({
        color: 'red',
        title: 'Amount is required',
        message: 'Enter an amount greater than zero.',
      });
      return;
    }

    setIsSavingOpeningEntry(true);
    try {
      // Create a balanced opening entry as two lines.
      const debitRes = await fetch(apiPath('/accounting/opening-balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          ref,
          account: resolvedDebitAccount,
          debit: amount,
          credit: 0,
          description,
        }),
      });

      const debitBody = await debitRes.json().catch(() => null);
      if (!debitRes.ok) {
        throw new Error(
          debitBody?.error || 'Failed to save opening debit line'
        );
      }

      const createdDebitId = debitBody?.entry?.id as string | undefined;

      const creditRes = await fetch(apiPath('/accounting/opening-balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          ref,
          account: resolvedCreditAccount,
          debit: 0,
          credit: amount,
          description,
        }),
      });

      const creditBody = await creditRes.json().catch(() => null);
      if (!creditRes.ok) {
        if (createdDebitId) {
          await fetch(
            `${apiPath('/accounting/opening-balance')}?id=${encodeURIComponent(
              createdDebitId
            )}`,
            { method: 'DELETE' }
          ).catch(() => null);
        }
        throw new Error(
          creditBody?.error || 'Failed to save opening credit line'
        );
      }

      showNotification({
        color: 'teal',
        title: 'Opening entry saved',
        message: `${resolvedDebitAccount} → ${resolvedCreditAccount}`,
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
    apiPath,
    editingOpeningEntryId,
    editingOpeningEntryDebitId,
    editingOpeningEntryCreditId,
    editingOpeningEntrySide,
    openingEntryForm,
    openingBalanceCutoverDate,
    fetchOpeningEntries,
    refreshLedger,
  ]);

  const deleteOpeningEntry = useCallback(
    async (id: string) => {
      try {
        const entry = openingEntries.find((candidate) => candidate.id === id);
        const idsToDelete = new Set<string>([id]);

        if (entry) {
          const dateKey = entry.date.slice(0, 10);
          const refKey = entry.ref;
          const descKey = (entry.description ?? '').trim();
          const entryAccount = entry.account.trim();
          const amount = entry.debit > 0 ? entry.debit : entry.credit;
          const side: 'debit' | 'credit' = entry.debit > 0 ? 'debit' : 'credit';

          const isSameAmount = (value: number) =>
            Math.abs(Number(value ?? 0) - amount) < 0.00001;

          const strictMatch = openingEntries.find((candidate) => {
            if (candidate.id === entry.id) {
              return false;
            }
            if (candidate.date.slice(0, 10) !== dateKey) {
              return false;
            }
            if (candidate.ref !== refKey) {
              return false;
            }
            if ((candidate.description ?? '').trim() !== descKey) {
              return false;
            }

            return side === 'debit'
              ? candidate.credit > 0 && isSameAmount(candidate.credit)
              : candidate.debit > 0 && isSameAmount(candidate.debit);
          });
          if (strictMatch) {
            idsToDelete.add(strictMatch.id);
          } else {
            const fallbackMatches = openingEntries.filter((candidate) => {
              if (candidate.id === entry.id) {
                return false;
              }
              if (candidate.date.slice(0, 10) !== dateKey) {
                return false;
              }
              if (candidate.ref !== refKey) {
                return false;
              }

              const candidateAccount = candidate.account.trim();
              if (entryAccount === 'Opening Equity') {
                if (candidateAccount === 'Opening Equity') {
                  return false;
                }
              } else if (candidateAccount !== 'Opening Equity') {
                return false;
              }

              return side === 'debit'
                ? candidate.credit > 0 && isSameAmount(candidate.credit)
                : candidate.debit > 0 && isSameAmount(candidate.debit);
            });

            if (fallbackMatches.length > 0) {
              idsToDelete.add(fallbackMatches[0].id);
            }
          }
        }

        const deleteIds = Array.from(idsToDelete);
        await Promise.all(
          deleteIds.map(async (deleteId) => {
            const res = await fetch(
              `${apiPath('/accounting/opening-balance')}?id=${encodeURIComponent(
                deleteId
              )}`,
              { method: 'DELETE' }
            );

            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              const errorMessage =
                payload?.error || 'Failed to delete opening entry';
              throw new Error(errorMessage);
            }
          })
        );

        await fetchOpeningEntries();
        await refreshLedger();

        showNotification({
          color: 'green',
          title: 'Opening entry deleted',
          message:
            idsToDelete.size > 1
              ? 'Both opening balance lines were removed.'
              : 'The opening balance line was removed.',
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
    [apiPath, fetchOpeningEntries, openingEntries, refreshLedger]
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
          const nextDebit = String(nextValue);
          return {
            ...prev,
            debitAccount: nextDebit,
            debitAccountTag: isTaggableAccountParent(nextDebit)
              ? prev.debitAccountTag
              : '',
          };
        }

        if (field === 'creditAccount') {
          const nextCredit = String(nextValue);
          return {
            ...prev,
            creditAccount: nextCredit,
            creditAccountTag: isTaggableAccountParent(nextCredit)
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
  }, [apiPath, manualEntryForm, refreshLedger, editingManualSourceId]);

  const deleteManualEntry = useCallback(
    async (entry: LedgerEntry) => {
      const sourceId = entry.sourceId ?? null;
      if (!sourceId) {
        return;
      }

      const confirmResult = await Swal.fire({
        title: 'Delete manual entry?',
        text: `${entry.ref}\n${entry.account}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        focusCancel: true,
        allowOutsideClick: false,
      });

      if (!confirmResult.isConfirmed) {
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
    [apiPath, refreshLedger]
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
            logger.error('Ledger CSV import row failed', { error, entry });
            errorCount++;
          }
        }

        await refreshLedger();
        showNotification({
          color: errorCount > 0 ? 'yellow' : 'green',
          title: 'Ledger import complete',
          message:
            `Imported ${successCount} entries` +
            (errorCount > 0 ? `, ${errorCount} failed.` : '.') +
            (skippedCount > 0
              ? ` ${skippedCount} rows skipped (limit ${MAX_MANUAL_IMPORT_ROWS}).`
              : ''),
        });
      } catch (error) {
        logger.error('Ledger CSV import failed', { error });
        showNotification({
          color: 'red',
          title: 'Import failed',
          message: 'Unable to import ledger CSV file.',
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
        message: 'No ledger entries to export.',
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
    const filename = `ledger_${date}.csv`;
    downloadCsvFile(filename, csvContent);
  };

  const handleDownloadTemplate = () => {
    const date = getCurrentDateISO();
    downloadCsvTemplateFile(`ledger_template_${date}.csv`, [
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
    stats,
    refreshLedger,
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
    openingBalanceCutoverDate,
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
