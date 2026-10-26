'use client';

import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import type { OrderCancellationPreview } from '@/lib/accounting/customer-money';
import type { TransactionData } from '../types/transaction.types';
import { OrderCancellationModal } from '../components/OrderCancellationModal';

export function useOrderCancellation() {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<{
    preview: OrderCancellationPreview;
    kind: 'CANCELLED' | 'VOIDED';
  } | null>(null);
  const requestKeys = useRef(new Map<string, string>());

  const requestCancellation = async (
    transaction: TransactionData,
    status: 'Cancelled' | 'Voided'
  ) => {
    if (!transaction.id) {
      throw new Error('Save the order before changing its status.');
    }
    const preview = await api.get<OrderCancellationPreview>(
      `/api/transactions/${transaction.id}/cancellation`
    );
    if (preview.closed) {
      throw new Error(
        'This order is already closed. Refresh the transaction list.'
      );
    }
    if (preview.reviewRequired) {
      throw new Error(
        'The recorded payment history needs administrator review.'
      );
    }
    const kind = status === 'Voided' ? 'VOIDED' : 'CANCELLED';
    if (preview.collectedAmount > 0) {
      setDecision({ preview, kind });
      return;
    }

    const key = `${transaction.id}:${kind}`;
    let requestId = requestKeys.current.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      requestKeys.current.set(key, requestId);
    }
    await api.post(
      `/api/transactions/${transaction.id}/cancellation`,
      {
        kind,
        mode: 'REFUND_ALL',
        reason:
          status === 'Voided'
            ? 'Supplier failure before payment'
            : 'Unpaid order cancellation',
      },
      { headers: { 'Idempotency-Key': requestId } }
    );
    await queryClient.invalidateQueries();
    requestKeys.current.delete(key);
    showNotification({
      title: 'Order closed',
      message: status,
      color: 'green',
    });
  };

  return {
    requestCancellation,
    cancellationModal: decision ? (
      <OrderCancellationModal
        key={`${decision.preview.transactionId}:${decision.kind}`}
        preview={decision.preview}
        kind={decision.kind}
        onClose={() => setDecision(null)}
        onSaved={() => {
          setDecision(null);
          showNotification({
            title: 'Decision saved',
            message: 'Refund approval recorded.',
            color: 'green',
          });
        }}
      />
    ) : null,
  };
}
