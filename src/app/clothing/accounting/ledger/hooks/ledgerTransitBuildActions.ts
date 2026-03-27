import { showNotification } from '@mantine/notifications';
import { getSwal } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import type { LedgerEntry } from './ledgerTypes';

interface DeleteTransitBuildEntryParams {
  entry: LedgerEntry;
  apiPath: (path: string) => string;
  refreshLedger: () => Promise<void>;
}

interface EditTransitBuildEntryParams {
  entry: LedgerEntry;
  apiPath: (path: string) => string;
  refreshLedger: () => Promise<void>;
  allowedCreditAccounts: readonly string[];
}

export async function deleteTransitBuildLedgerEntry({
  entry,
  apiPath,
  refreshLedger,
}: DeleteTransitBuildEntryParams): Promise<void> {
  const Swal = await getSwal();
  const shipmentId = entry.transitBuildShipmentId ?? null;
  const entryIds = entry.transitBuildEntryIds ?? [];

  if (entryIds.length === 0) {
    showNotification({
      title: 'Delete failed',
      message: 'This transit build-up line is missing identifiers.',
      color: 'red',
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Delete transit build-up?',
    text:
      entryIds.length === 1
        ? 'This will remove the transit build-up entry from the ledger.'
        : 'This will remove all grouped transit build-up entries from the ledger.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  });

  if (!result.isConfirmed) {
    return;
  }

  try {
    for (const entryId of entryIds) {
      const endpoint = shipmentId
        ? apiPath(`/shipments/${shipmentId}/transit-build`)
        : apiPath('/accounting/transit-build');

      const res = await fetch(
        `${endpoint}?entryId=${encodeURIComponent(entryId)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    }

    showNotification({
      title: 'Deleted',
      message: 'Transit build-up entry deleted.',
      color: 'green',
    });

    await refreshLedger();
  } catch (error) {
    logger.error('Transit build-up delete failed', { error, entry });
    showNotification({
      title: 'Delete failed',
      message: 'Unable to delete transit build-up entry.',
      color: 'red',
    });
  }
}

export async function editTransitBuildLedgerEntry({
  entry,
  apiPath,
  refreshLedger,
  allowedCreditAccounts,
}: EditTransitBuildEntryParams): Promise<void> {
  const Swal = await getSwal();
  const shipmentId = entry.transitBuildShipmentId ?? null;
  const entryIds = entry.transitBuildEntryIds ?? [];

  if (entryIds.length !== 1) {
    showNotification({
      title: 'Edit unavailable',
      message:
        entryIds.length > 1
          ? 'This line is grouped; edit it from Shipments instead.'
          : 'This transit build-up line is missing identifiers.',
      color: 'yellow',
    });
    return;
  }

  const entryId = entryIds[0];
  const currentAmount = Math.max(entry.debit, entry.credit);
  const currentDate = (entry.date ?? '').slice(0, 10);
  const currentCreditAccount =
    entry.transitBuildCreditAccount ?? (entry.credit > 0 ? entry.account : '');

  const result = await Swal.fire({
    title: 'Edit transit build-up',
    html: `
      <div style="text-align:left">
        <label style="display:block;margin:0 0 6px 0;font-weight:600">Posting date</label>
        <input id="tb-posting-date" type="date" class="swal2-input" style="margin:0 0 12px 0;width:100%" value="${currentDate}" />

        <label style="display:block;margin:0 0 6px 0;font-weight:600">Amount</label>
        <input id="tb-amount" type="number" step="0.01" class="swal2-input" style="margin:0 0 12px 0;width:100%" value="${Number.isFinite(currentAmount) ? currentAmount : 0}" />

        <label style="display:block;margin:0 0 6px 0;font-weight:600">Credit account</label>
        <select id="tb-credit-account" class="swal2-select" style="margin:0;width:100%">
          ${allowedCreditAccounts.map((account) => `<option value="${account}" ${account === currentCreditAccount ? 'selected' : ''}>${account}</option>`).join('')}
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Save',
    cancelButtonText: 'Cancel',
    focusConfirm: false,
    preConfirm: () => {
      const postingDate = (
        document.getElementById('tb-posting-date') as HTMLInputElement | null
      )?.value;
      const amountRaw =
        (document.getElementById('tb-amount') as HTMLInputElement | null)
          ?.value ?? '0';
      const creditAccount = (
        document.getElementById('tb-credit-account') as HTMLSelectElement | null
      )?.value;

      const amount = Number(amountRaw);
      if (!postingDate) {
        Swal.showValidationMessage('Posting date is required.');
        return;
      }
      if (!Number.isFinite(amount) || amount < 0) {
        Swal.showValidationMessage('Amount must be 0 or greater.');
        return;
      }
      if (!creditAccount) {
        Swal.showValidationMessage('Credit account is required.');
        return;
      }

      return { postingDate, amount, creditAccount };
    },
  });

  if (!result.isConfirmed || !result.value) {
    return;
  }

  try {
    const endpoint = shipmentId
      ? apiPath(`/shipments/${shipmentId}/transit-build`)
      : apiPath('/accounting/transit-build');

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId,
        postingDate: result.value.postingDate,
        amount: result.value.amount,
        creditAccount: result.value.creditAccount,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    showNotification({
      title: 'Saved',
      message: 'Transit build-up entry updated.',
      color: 'green',
    });

    await refreshLedger();
  } catch (error) {
    logger.error('Transit build-up edit failed', { error, entry });
    showNotification({
      title: 'Save failed',
      message: 'Unable to update transit build-up entry.',
      color: 'red',
    });
  }
}
