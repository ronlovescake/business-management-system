import { useCallback, useEffect, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import {
  buildTaggedAccountName,
  isTaggableAccountParent,
} from '@/lib/accounting/account-tagging';
import { getApiDataOrThrow } from '@/lib/api/response';
import type { ApiResponse } from '@/types/api';
import { getCurrentDateISO } from '@/utils/date';
import {
  applyOpeningEntryFieldChange,
  buildOpeningEntryDeleteIds,
  buildOpeningEntryEditState,
  createOpeningEntryFormState,
  type OpeningEntryField,
} from './ledgerOpeningEntryForm';
import type { OpeningBalanceEntry } from './ledgerTypes';

const FALLBACK_OPENING_BALANCE_DATE = getCurrentDateISO();

interface UseLedgerOpeningEntriesParams {
  apiPath: (path: string) => string;
  refreshLedger: () => Promise<void>;
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

async function updateOpeningEntryLine(params: {
  apiPath: (path: string) => string;
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
}) {
  const res = await fetch(params.apiPath('/accounting/opening-balance'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: params.id,
      date: params.date,
      ref: params.ref,
      account: params.account,
      debit: params.debit,
      credit: params.credit,
      description: params.description,
    }),
  });

  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(body?.error || 'Failed to update opening entry');
  }
}

async function createOpeningEntryLine(params: {
  apiPath: (path: string) => string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
}) {
  const res = await fetch(params.apiPath('/accounting/opening-balance'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: params.date,
      ref: params.ref,
      account: params.account,
      debit: params.debit,
      credit: params.credit,
      description: params.description,
    }),
  });

  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(body?.error || 'Failed to save opening entry');
  }

  return body?.entry?.id as string | undefined;
}

async function deleteOpeningEntryLine(params: {
  apiPath: (path: string) => string;
  id: string;
  throwOnFailure?: boolean;
}) {
  const res = await fetch(
    `${params.apiPath('/accounting/opening-balance')}?id=${encodeURIComponent(params.id)}`,
    { method: 'DELETE' }
  );

  if (!res.ok && params.throwOnFailure) {
    const payload = await readJson(res);
    throw new Error(payload?.error || 'Failed to delete opening entry');
  }
}

function resolveOpeningEntryValues(input: {
  debitAccountSelection: string;
  creditAccountSelection: string;
  debitAccountTag: string;
  creditAccountTag: string;
  amount: number;
}) {
  const debitAccount = isTaggableAccountParent(input.debitAccountSelection)
    ? buildTaggedAccountName(input.debitAccountSelection, input.debitAccountTag)
    : input.debitAccountSelection;
  const creditAccount = isTaggableAccountParent(input.creditAccountSelection)
    ? buildTaggedAccountName(
        input.creditAccountSelection,
        input.creditAccountTag
      )
    : input.creditAccountSelection;

  if (!debitAccount || !creditAccount) {
    return {
      error: {
        color: 'red' as const,
        title: 'Accounts are required',
        message: 'Choose both a debit and a credit account.',
      },
    };
  }

  if (debitAccount === creditAccount) {
    return {
      error: {
        color: 'red' as const,
        title: 'Accounts must be different',
        message: 'Debit and credit accounts cannot be the same.',
      },
    };
  }

  if (!(input.amount > 0)) {
    return {
      error: {
        color: 'red' as const,
        title: 'Amount is required',
        message: 'Enter an amount greater than zero.',
      },
    };
  }

  return { debitAccount, creditAccount };
}

export function useLedgerOpeningEntries({
  apiPath,
  refreshLedger,
}: UseLedgerOpeningEntriesParams) {
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
  const [openingEntryForm, setOpeningEntryForm] = useState(
    createOpeningEntryFormState(FALLBACK_OPENING_BALANCE_DATE)
  );

  const resetOpeningEntryEditState = useCallback(() => {
    setEditingOpeningEntryId(null);
    setEditingOpeningEntryDebitId(null);
    setEditingOpeningEntryCreditId(null);
    setEditingOpeningEntrySide(null);
  }, []);

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
    void fetchOpeningEntries();
  }, [fetchOpeningEntries]);

  useEffect(() => {
    setOpeningEntryForm((prev) => {
      if (
        !openingBalanceCutoverDate ||
        prev.date === openingBalanceCutoverDate ||
        editingOpeningEntryId
      ) {
        return prev;
      }

      return { ...prev, date: openingBalanceCutoverDate };
    });
  }, [editingOpeningEntryId, openingBalanceCutoverDate]);

  const handleOpeningEntryFieldChange = useCallback(
    (field: OpeningEntryField, value: string | number | null) => {
      setOpeningEntryForm((prev) =>
        applyOpeningEntryFieldChange(prev, field, value)
      );
    },
    []
  );

  const openOpeningEntryModal = useCallback(() => {
    resetOpeningEntryEditState();
    setOpeningEntryForm(createOpeningEntryFormState(openingBalanceCutoverDate));
    setIsOpeningEntryModalOpen(true);
  }, [openingBalanceCutoverDate, resetOpeningEntryEditState]);

  const openOpeningEntryModalForEdit = useCallback(
    (entry: OpeningBalanceEntry) => {
      const editState = buildOpeningEntryEditState(entry, openingEntries);

      setEditingOpeningEntryId(entry.id);
      setEditingOpeningEntrySide(editState.side);
      setEditingOpeningEntryDebitId(editState.debitId);
      setEditingOpeningEntryCreditId(editState.creditId);
      setOpeningEntryForm(editState.form);
      setIsOpeningEntryModalOpen(true);
    },
    [openingEntries]
  );

  const closeOpeningEntryModal = useCallback(() => {
    resetOpeningEntryEditState();
    setIsOpeningEntryModalOpen(false);
  }, [resetOpeningEntryEditState]);

  const saveOpeningEntry = useCallback(async () => {
    const ref = openingEntryForm.ref.trim();
    const description = openingEntryForm.description.trim();
    const date = openingEntryForm.date || openingBalanceCutoverDate;
    const amount = Number(openingEntryForm.amount ?? 0);
    const resolved = resolveOpeningEntryValues({
      debitAccountSelection: openingEntryForm.debitAccount.trim(),
      creditAccountSelection: openingEntryForm.creditAccount.trim(),
      debitAccountTag: openingEntryForm.debitAccountTag,
      creditAccountTag: openingEntryForm.creditAccountTag,
      amount,
    });

    if ('error' in resolved && resolved.error) {
      showNotification(resolved.error);
      return;
    }

    const { debitAccount, creditAccount } = resolved;

    setIsSavingOpeningEntry(true);
    try {
      if (editingOpeningEntryId) {
        if (editingOpeningEntryDebitId && editingOpeningEntryCreditId) {
          await Promise.all([
            updateOpeningEntryLine({
              apiPath,
              id: editingOpeningEntryDebitId,
              date,
              ref,
              account: debitAccount,
              debit: amount,
              credit: 0,
              description,
            }),
            updateOpeningEntryLine({
              apiPath,
              id: editingOpeningEntryCreditId,
              date,
              ref,
              account: creditAccount,
              debit: 0,
              credit: amount,
              description,
            }),
          ]);
        } else {
          const side = editingOpeningEntrySide;
          const existingId = editingOpeningEntryId;

          if (!side || !existingId) {
            throw new Error('Missing opening entry context for edit');
          }

          const createdId = await createOpeningEntryLine({
            apiPath,
            date,
            ref,
            account: side === 'debit' ? creditAccount : debitAccount,
            debit: side === 'debit' ? 0 : amount,
            credit: side === 'debit' ? amount : 0,
            description,
          });

          try {
            await updateOpeningEntryLine({
              apiPath,
              id: existingId,
              date,
              ref,
              account: side === 'debit' ? debitAccount : creditAccount,
              debit: side === 'debit' ? amount : 0,
              credit: side === 'debit' ? 0 : amount,
              description,
            });
          } catch (error) {
            if (createdId) {
              await deleteOpeningEntryLine({ apiPath, id: createdId }).catch(
                () => null
              );
            }
            throw error;
          }
        }

        showNotification({
          color: 'teal',
          title: 'Opening entry updated',
          message: `${debitAccount} → ${creditAccount}`,
        });
      } else {
        const createdDebitId = await createOpeningEntryLine({
          apiPath,
          date,
          ref,
          account: debitAccount,
          debit: amount,
          credit: 0,
          description,
        });

        try {
          await createOpeningEntryLine({
            apiPath,
            date,
            ref,
            account: creditAccount,
            debit: 0,
            credit: amount,
            description,
          });
        } catch (error) {
          if (createdDebitId) {
            await deleteOpeningEntryLine({ apiPath, id: createdDebitId }).catch(
              () => null
            );
          }
          throw error;
        }

        showNotification({
          color: 'teal',
          title: 'Opening entry saved',
          message: `${debitAccount} → ${creditAccount}`,
        });
      }

      setIsOpeningEntryModalOpen(false);
      resetOpeningEntryEditState();
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
    editingOpeningEntryCreditId,
    editingOpeningEntryDebitId,
    editingOpeningEntryId,
    editingOpeningEntrySide,
    fetchOpeningEntries,
    openingBalanceCutoverDate,
    openingEntryForm,
    refreshLedger,
    resetOpeningEntryEditState,
  ]);

  const deleteOpeningEntry = useCallback(
    async (id: string) => {
      try {
        const deleteIds = buildOpeningEntryDeleteIds(id, openingEntries);
        await Promise.all(
          deleteIds.map((deleteId) =>
            deleteOpeningEntryLine({
              apiPath,
              id: deleteId,
              throwOnFailure: true,
            })
          )
        );

        await fetchOpeningEntries();
        await refreshLedger();

        showNotification({
          color: 'green',
          title: 'Opening entry deleted',
          message:
            deleteIds.length > 1
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

  return {
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
