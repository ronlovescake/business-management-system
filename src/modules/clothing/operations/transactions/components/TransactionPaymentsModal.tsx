'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { TransactionData } from '../types/transaction.types';

type PaymentDraft = {
  transactionId: number;
  amount: number;
};

type BulkPaymentsRequest = {
  payments: Array<{
    transactionId: number;
    paymentDate: string;
    amount: number;
    method?: string | null;
    notes?: string | null;
  }>;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'GCash', label: 'GCash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Other', label: 'Other' },
];

export function TransactionPaymentsModal({
  opened,
  onClose,
  transactions,
  customerNames,
}: {
  opened: boolean;
  onClose: () => void;
  transactions: TransactionData[];
  customerNames: string[];
}) {
  const queryClient = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [method, setMethod] = useState<string | null>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [amountByTransactionId, setAmountByTransactionId] = useState<
    Record<number, number>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const customerOptions = useMemo(
    () => customerNames.map((name) => ({ value: name, label: name })),
    [customerNames]
  );

  const eligibleTransactions = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    const excludedStatuses = new Set(['Shipped', 'Cancelled', 'Canceled']);

    return transactions
      .filter((t) => t.id && t.id > 0)
      .filter((t) => (t.Customers ?? '').trim() === selectedCustomer)
      .filter((t) => {
        const status = (t['Order Status'] ?? '').trim();
        if (!status) {
          return true;
        }
        return !excludedStatuses.has(status);
      });
  }, [selectedCustomer, transactions]);

  const handleAmountChange = useCallback(
    (transactionId: number, value: number | string) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      setAmountByTransactionId((prev) => ({
        ...prev,
        [transactionId]: Number.isFinite(numeric) ? numeric : 0,
      }));
    },
    []
  );

  const payloadDrafts = useMemo(() => {
    const drafts: PaymentDraft[] = [];

    for (const [key, rawValue] of Object.entries(amountByTransactionId)) {
      const transactionId = Number(key);
      if (!Number.isFinite(transactionId) || transactionId <= 0) {
        continue;
      }

      const amount = Number(rawValue);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      drafts.push({ transactionId, amount });
    }

    return drafts;
  }, [amountByTransactionId]);

  const totalEntered = useMemo(
    () => payloadDrafts.reduce((sum, p) => sum + p.amount, 0),
    [payloadDrafts]
  );

  const handleSubmit = useCallback(async () => {
    if (!paymentDate) {
      showNotification({
        title: 'Missing payment date',
        message: 'Select a payment date.',
        color: 'yellow',
      });
      return;
    }

    if (payloadDrafts.length === 0) {
      showNotification({
        title: 'No payments entered',
        message: 'Enter at least one payment amount.',
        color: 'yellow',
      });
      return;
    }

    const requestPayload: BulkPaymentsRequest = {
      payments: payloadDrafts.map((draft) => ({
        transactionId: draft.transactionId,
        amount: draft.amount,
        paymentDate: paymentDate.toISOString().slice(0, 10),
        method,
        notes: notes.trim() ? notes.trim() : null,
      })),
    };

    setIsSaving(true);
    try {
      await api.post('/api/transactions/payments/bulk', requestPayload);

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });

      showNotification({
        title: 'Payment recorded',
        message: `Saved ${payloadDrafts.length} payment${payloadDrafts.length === 1 ? '' : 's'} (₱${totalEntered.toLocaleString()}).`,
        color: 'green',
      });

      setAmountByTransactionId({});
      onClose();
    } catch (error) {
      showNotification({
        title: 'Failed to save payments',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    method,
    notes,
    onClose,
    paymentDate,
    payloadDrafts,
    queryClient,
    totalEntered,
  ]);

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    onClose();
  }, [isSaving, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Record Payments"
      size="xl"
      closeOnClickOutside={!isSaving}
      closeOnEscape={!isSaving}
    >
      <Stack gap="md">
        <Group grow align="flex-end">
          <Select
            label="Customer"
            placeholder="Select a customer"
            searchable
            nothingFoundMessage="No matching customers"
            data={customerOptions}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
          />

          <DateInput
            label="Payment date"
            value={paymentDate}
            onChange={setPaymentDate}
            valueFormat="YYYY-MM-DD"
            clearable={false}
          />

          <Select
            label="Method"
            data={PAYMENT_METHOD_OPTIONS}
            value={method}
            onChange={setMethod}
            allowDeselect
          />
        </Group>

        <TextInput
          label="Notes (optional)"
          placeholder="e.g., Reservation fee"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {!selectedCustomer ? (
          <Text c="dimmed">Select a customer to see eligible orders.</Text>
        ) : eligibleTransactions.length === 0 ? (
          <Text c="dimmed">
            No eligible transactions found (Shipped/Cancelled are excluded).
          </Text>
        ) : (
          <ScrollArea h={360}>
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 90 }}>Tx ID</Table.Th>
                  <Table.Th style={{ width: 130 }}>Order Date</Table.Th>
                  <Table.Th style={{ width: 140 }}>Product</Table.Th>
                  <Table.Th style={{ width: 80 }}>Qty</Table.Th>
                  <Table.Th style={{ width: 120 }}>Paid (Adj)</Table.Th>
                  <Table.Th style={{ width: 140 }}>Add payment</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {eligibleTransactions.map((t) => {
                  const id = t.id as number;
                  const paidSoFar = Number(t.Adjustment) || 0;
                  const current = amountByTransactionId[id] ?? 0;

                  return (
                    <Table.Tr key={id}>
                      <Table.Td>{id}</Table.Td>
                      <Table.Td>{t['Order Date']}</Table.Td>
                      <Table.Td>{t['Product Code']}</Table.Td>
                      <Table.Td>{t.Quantity}</Table.Td>
                      <Table.Td>₱{paidSoFar.toLocaleString()}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={current}
                          min={0}
                          step={1}
                          hideControls
                          prefix="₱"
                          onChange={(value) => handleAmountChange(id, value)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        <Group justify="space-between">
          <Text>
            Total to save: <strong>₱{totalEntered.toLocaleString()}</strong>
          </Text>
          <Group>
            <Button variant="default" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isSaving}>
              Save payments
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
