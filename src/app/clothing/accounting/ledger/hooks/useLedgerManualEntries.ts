import { useCallback, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { logger } from '@/lib/logger';
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
import {
  applyManualEntryFieldChange,
  type ManualEntryField,
} from './ledgerManualEntryForm';
import type { LedgerEntry } from './ledgerTypes';

interface UseLedgerManualEntriesParams {
  apiPath: (path: string) => string;
  refreshLedger: () => Promise<void>;
  entries: LedgerEntry[];
}

export function useLedgerManualEntries({
  apiPath,
  refreshLedger,
  entries,
}: UseLedgerManualEntriesParams) {
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isSavingManualEntry, setIsSavingManualEntry] = useState(false);
  const [editingManualSourceId, setEditingManualSourceId] = useState<
    string | null
  >(null);
  const [manualEntryForm, setManualEntryForm] = useState(
    createManualEntryFormState()
  );

  const openManualEntryModal = useCallback(() => {
    setEditingManualSourceId(null);
    setManualEntryForm((prev) => ({
      ...prev,
      date: prev.date || getManualEntryDefaultDate(),
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
        (candidate) =>
          candidate.sourceType === 'MANUAL' && candidate.sourceId === sourceId
      );
      const debitLine = group.find(
        (candidate) => Number(candidate.debit ?? 0) > 0
      );
      const creditLine = group.find(
        (candidate) => Number(candidate.credit ?? 0) > 0
      );

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
    (field: ManualEntryField, value: string | number | null) => {
      setManualEntryForm((prev) =>
        applyManualEntryFieldChange(prev, field, value)
      );
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
        throw new Error(
          responseBody?.error || 'Failed to save manual journal entry'
        );
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
  }, [apiPath, editingManualSourceId, manualEntryForm, refreshLedger]);

  const deleteManualEntry = useCallback(
    async (entry: LedgerEntry) => {
      const Swal = await getSwal();
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
          throw new Error(payload?.error || 'Failed to delete entry');
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

  return {
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
  };
}
