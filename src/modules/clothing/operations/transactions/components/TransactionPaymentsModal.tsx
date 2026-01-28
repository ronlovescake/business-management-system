'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
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
import { buildApiPath } from '@/lib/api/paths';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import {
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  type TransactionData,
} from '../types/transaction.types';

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
    isReservation?: boolean;
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
  apiBasePath,
}: {
  opened: boolean;
  onClose: () => void;
  transactions: TransactionData[];
  customerNames: string[];
  apiBasePath?: string;
}) {
  const queryClient = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [method, setMethod] = useState<string | null>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [isReservation, setIsReservation] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<StatusFilterOption>('All Status');
  const [amountByTransactionId, setAmountByTransactionId] = useState<
    Record<number, number>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const resetFormState = useCallback(() => {
    setSelectedCustomer(null);
    setPaymentDate(new Date());
    setMethod('Cash');
    setNotes('');
    setIsReservation(false);
    setStatusFilter('All Status');
    setAmountByTransactionId({});
  }, []);

  const isGeneralMerchandise = useMemo(
    () => (apiBasePath ?? '').includes('/general-merchandise'),
    [apiBasePath]
  );

  const customerOptions = useMemo(
    () => customerNames.map((name) => ({ value: name, label: name })),
    [customerNames]
  );

  const statusFilterOptions = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.map((status) => ({
        value: status,
        label: status,
      })),
    []
  );

  // ============================================================================
  // ⚠️ ELIGIBILITY FILTERS (RECORD PAYMENTS)
  // ============================================================================
  // - Cancellation-like statuses are excluded via shared helper.
  // - Shipped is excluded for ops workflow (payments should be recorded before shipping).
  // ============================================================================
  const eligibleTransactions = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    const excludedStatuses = new Set(['Shipped']);

    return transactions
      .filter((t) => t.id && t.id > 0)
      .filter((t) => (t.Customers ?? '').trim() === selectedCustomer)
      .filter((t) => {
        const status = t['Order Status'] ?? '';
        if (!status) {
          return true;
        }
        if (isCancelledOrderStatus(status)) {
          return false;
        }
        return !excludedStatuses.has(status);
      })
      .filter((t) => {
        if (statusFilter === 'All Status') {
          return true;
        }
        return (t['Order Status'] ?? '') === statusFilter;
      });
  }, [selectedCustomer, statusFilter, transactions]);

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

  const getBaseTotal = useCallback((transaction: TransactionData) => {
    const paidSoFar = Number(transaction.Adjustment) || 0;
    const quantity = Number(transaction.Quantity) || 0;
    const unitPrice = Number(transaction['Unit Price']) || 0;
    const lineTotalRaw = Number(transaction['Line Total']);

    return Number.isFinite(lineTotalRaw)
      ? lineTotalRaw
      : quantity * unitPrice - paidSoFar;
  }, []);

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

    const overLimitDrafts = payloadDrafts.filter((draft) => {
      const transaction = eligibleTransactions.find(
        (t) => Number(t.id) === draft.transactionId
      );
      if (!transaction) {
        return false;
      }
      const baseTotal = getBaseTotal(transaction);
      return draft.amount > baseTotal + 0.01;
    });

    if (overLimitDrafts.length > 0) {
      showNotification({
        title: 'Payment exceeds balance due',
        message: 'Reduce the payment amount to match the balance due.',
        color: 'red',
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
        isReservation,
      })),
    };

    setIsSaving(true);
    try {
      await api.post(
        buildApiPath(apiBasePath, '/transactions/payments/bulk'),
        requestPayload
      );

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });

      showNotification({
        title: 'Payment recorded',
        message: `Saved ${payloadDrafts.length} payment${payloadDrafts.length === 1 ? '' : 's'} (₱${totalEntered.toLocaleString()}).`,
        color: 'green',
      });

      resetFormState();
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
    apiBasePath,
    eligibleTransactions,
    getBaseTotal,
    isGeneralMerchandise,
    isReservation,
    method,
    notes,
    onClose,
    paymentDate,
    payloadDrafts,
    queryClient,
    resetFormState,
    totalEntered,
  ]);

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    resetFormState();
    onClose();
  }, [isSaving, onClose, resetFormState]);

  useEffect(() => {
    if (!opened && !isSaving) {
      resetFormState();
    }
  }, [isSaving, opened, resetFormState]);

  return (
    <PolishedModal
      opened={opened}
      onClose={handleClose}
      title="Record Payments"
      size="90%"
      styles={{
        content: {
          maxWidth: '1700px',
        },
      }}
      closeOnClickOutside={false}
      closeOnEscape={false}
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

          <Select
            label="Order status"
            placeholder="All Status"
            data={statusFilterOptions}
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter((value as StatusFilterOption) ?? 'All Status')
            }
            allowDeselect={false}
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

        <Checkbox
          label="Reservation fee (customer deposit)"
          checked={isReservation}
          onChange={(e) => setIsReservation(e.currentTarget.checked)}
        />

        {selectedCustomer && eligibleTransactions.length === 0 ? (
          <Text c="dimmed">
            No eligible transactions found (Shipped/cancelled statuses are
            excluded).
          </Text>
        ) : null}

        {(() => {
          const RESERVED_VISIBLE_ROWS = 10;
          const ROW_HEIGHT = 42;
          const HEADER_HEIGHT = 42;
          const scrollHeight =
            HEADER_HEIGHT + RESERVED_VISIBLE_ROWS * ROW_HEIGHT;

          const rows = selectedCustomer ? eligibleTransactions : [];

          const padded =
            rows.length >= RESERVED_VISIBLE_ROWS
              ? rows
              : [
                  ...rows,
                  ...Array.from(
                    { length: RESERVED_VISIBLE_ROWS - rows.length },
                    () => null
                  ),
                ];

          return (
            <ScrollArea h={scrollHeight}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr style={{ height: HEADER_HEIGHT }}>
                    <Table.Th
                      style={{
                        width: 90,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Tx ID
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 130,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Order Date
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Product Code
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Quantity
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 120,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Unit Price
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 120,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Payment
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Balance Due
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Order Status
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      Add payment
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {padded.map((t, index) => {
                    if (!t) {
                      const key = `placeholder-${index}`;
                      return (
                        <Table.Tr key={key} style={{ height: ROW_HEIGHT }}>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                              }}
                            >
                              <NumberInput
                                value={0}
                                min={0}
                                step={1}
                                hideControls
                                prefix="₱"
                                disabled
                                styles={{ input: { textAlign: 'right' } }}
                                style={{ width: 140 }}
                              />
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      );
                    }

                    const id = t.id as number;
                    const paidSoFar = Number(t.Adjustment) || 0;
                    const unitPrice = Number(t['Unit Price']) || 0;
                    // ========================================================================
                    // ⚠️ BALANCE DUE (DISCOUNT ALREADY IN UNIT PRICE)
                    // ========================================================================
                    // Formula: (Quantity × Unit Price) - Adjustment (paid so far)
                    // The live Add Payment input is subtracted for preview.
                    // ========================================================================
                    const baseTotal = getBaseTotal(t);
                    const current = amountByTransactionId[id] ?? 0;
                    const maxPayable = Math.max(baseTotal, 0);
                    const balanceDue = Math.max(baseTotal - current, 0);
                    const isOverLimit = current > maxPayable + 0.01;

                    return (
                      <Table.Tr key={id} style={{ height: ROW_HEIGHT }}>
                        <Table.Td>{id}</Table.Td>
                        <Table.Td>{t['Order Date']}</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {t['Product Code']}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {t.Quantity}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'right',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{unitPrice.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'right',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{paidSoFar.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'right',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{balanceDue.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {t['Order Status'] || '—'}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'right',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <NumberInput
                              value={current}
                              min={0}
                              max={maxPayable}
                              step={1}
                              hideControls
                              prefix="₱"
                              error={
                                isOverLimit
                                  ? 'Payment exceeds balance due'
                                  : undefined
                              }
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.currentTarget.focus();
                              }}
                              onFocus={(event) => {
                                event.currentTarget.select();
                              }}
                              onChange={(value) =>
                                handleAmountChange(id, value)
                              }
                              styles={{
                                input: {
                                  textAlign: 'right',
                                },
                              }}
                              style={{ width: 140 }}
                            />
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          );
        })()}

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
    </PolishedModal>
  );
}
