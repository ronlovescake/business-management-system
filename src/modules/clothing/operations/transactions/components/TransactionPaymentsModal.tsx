'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Pill,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { getSwal } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import { queryKeys } from '@/lib/queryKeys';
import {
  STATUS_FILTER_OPTIONS,
  type StatusFilterOption,
  type TransactionData,
} from '../types/transaction.types';
import {
  buildBulkPaymentsPayload,
  getTransactionBaseTotal,
  toPaymentDrafts,
} from './transactionPaymentsHelpers';

const HIDDEN_STATUS_PILLS = new Set<StatusFilterOption>([
  'Shipped',
  'Cancelled',
  'Forfeited',
  'Voided',
]);

type AfterSaveMode = 'close' | 'continue';

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
  defaultCustomerName,
  onCustomerChange,
  defaultProductCode,
  onProductCodeChange,
  apiBasePath,
  selectedStatuses,
  onStatusFilter,
}: {
  opened: boolean;
  onClose: () => void;
  transactions: TransactionData[];
  customerNames: string[];
  defaultCustomerName?: string | null;
  onCustomerChange?: (customerName: string | null) => void;
  defaultProductCode?: string | null;
  onProductCodeChange?: (productCode: string | null) => void;
  apiBasePath?: string;
  selectedStatuses: Set<string>;
  onStatusFilter: (status: string) => void;
}) {
  const transactionsQueryKey = useMemo(
    () => [...queryKeys.transactions.lists(), apiBasePath ?? '/api'],
    [apiBasePath]
  );
  const queryClient = useQueryClient();

  const isGeneralMerchandise =
    typeof apiBasePath === 'string' &&
    apiBasePath.includes('general-merchandise');

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    null
  );
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [method, setMethod] = useState<string | null>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [isReservation, setIsReservation] = useState(false);
  const [reservationTouched, setReservationTouched] = useState(false);
  const visibleStatusFilterOptions = useMemo(() => {
    return STATUS_FILTER_OPTIONS.filter((status) => {
      if (status === 'All Status') {
        return true;
      }
      return !HIDDEN_STATUS_PILLS.has(status);
    });
  }, []);

  const filteredSelectedStatuses = useMemo(() => {
    const next = new Set<StatusFilterOption>();

    selectedStatuses.forEach((status) => {
      const typedStatus = status as StatusFilterOption;
      if (!HIDDEN_STATUS_PILLS.has(typedStatus)) {
        next.add(typedStatus);
      }
    });

    return next;
  }, [selectedStatuses]);

  const [amountByTransactionId, setAmountByTransactionId] = useState<
    Record<number, number>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const handleStatusFilter = useCallback(
    (status: StatusFilterOption) => {
      onStatusFilter(status);
    },
    [onStatusFilter]
  );

  const resetFormState = useCallback(() => {
    setSelectedCustomer(null);
    setSelectedProductCode(null);
    setPaymentDate(new Date());
    setMethod('Cash');
    setNotes('');
    setIsReservation(false);
    setReservationTouched(false);
    setAmountByTransactionId({});
  }, []);

  const handleCustomerChange = useCallback(
    (value: string | null) => {
      setSelectedCustomer(value);
      onCustomerChange?.(value);
    },
    [onCustomerChange]
  );

  const handleProductCodeChange = useCallback(
    (value: string | null) => {
      setSelectedProductCode(value);
      onProductCodeChange?.(value);
    },
    [onProductCodeChange]
  );

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (!defaultCustomerName || selectedCustomer) {
      return;
    }

    const normalizedDefault = defaultCustomerName.trim().toLowerCase();
    if (!normalizedDefault) {
      return;
    }

    const match = customerNames.find(
      (name) => name.trim().toLowerCase() === normalizedDefault
    );

    if (match) {
      setSelectedCustomer(match);
    }
  }, [customerNames, defaultCustomerName, opened, selectedCustomer]);

  const resetAmountsOnly = useCallback(() => {
    setAmountByTransactionId({});
  }, []);

  const customerOptions = useMemo(
    () => customerNames.map((name) => ({ value: name, label: name })),
    [customerNames]
  );

  const productCodeOptions = useMemo(() => {
    const unique = new Set<string>();

    for (const t of transactions) {
      const code = (t['Product Code'] ?? '').trim();
      if (!code) {
        continue;
      }
      unique.add(code);
    }

    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b))
      .map((code) => ({ value: code, label: code }));
  }, [transactions]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (!defaultProductCode || selectedProductCode) {
      return;
    }

    const normalizedDefault = defaultProductCode.trim().toLowerCase();
    if (!normalizedDefault) {
      return;
    }

    const match = productCodeOptions.find(
      (option) => option.value.trim().toLowerCase() === normalizedDefault
    );

    if (match?.value) {
      setSelectedProductCode(match.value);
    }
  }, [defaultProductCode, opened, productCodeOptions, selectedProductCode]);

  const statusFilterPills = useMemo(() => {
    return (
      <Stack gap={4} style={{ flex: 1 }}>
        <Text size="sm" fw={500}>
          Order status
        </Text>
        <Group gap="xs" wrap="wrap">
          {visibleStatusFilterOptions.map((status) => {
            const isSelected = filteredSelectedStatuses.has(status);
            return (
              <Pill
                key={status}
                size="md"
                withRemoveButton={false}
                onClick={() => handleStatusFilter(status)}
                style={{
                  backgroundColor: isSelected ? '#228be6' : '#e9ecef',
                  color: isSelected ? '#ffffff' : '#495057',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#dee2e6';
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }
                }}
              >
                {status}
              </Pill>
            );
          })}
        </Group>
      </Stack>
    );
  }, [
    filteredSelectedStatuses,
    handleStatusFilter,
    visibleStatusFilterOptions,
  ]);

  // ============================================================================
  // ⚠️ ELIGIBILITY FILTERS (RECORD PAYMENTS)
  // ============================================================================
  // - Cancellation-like statuses are excluded via shared helper.
  // - Shipped is excluded for ops workflow (payments should be recorded before shipping).
  // ============================================================================
  const eligibleTransactions = useMemo(() => {
    if (!selectedCustomer && !selectedProductCode) {
      return [];
    }

    const excludedStatuses = new Set(['Shipped']);

    return transactions
      .filter((t) => t.id && t.id > 0)
      .filter((t) => {
        if (!selectedCustomer) {
          return true;
        }
        return (t.Customers ?? '').trim() === selectedCustomer;
      })
      .filter((t) => {
        if (!selectedProductCode) {
          return true;
        }
        return (t['Product Code'] ?? '').trim() === selectedProductCode;
      })
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
        const status = (t['Order Status'] ?? '').trim();
        const individual = Array.from(filteredSelectedStatuses).filter(
          (s) => s !== 'All Status'
        );

        // Match Transactions page behavior:
        // - No individual statuses selected -> show only rows without Order Status.
        // - Otherwise filter by selected statuses OR rows without status.
        if (individual.length === 0) {
          return !status;
        }

        return !status || individual.includes(status as StatusFilterOption);
      });
  }, [
    filteredSelectedStatuses,
    selectedCustomer,
    selectedProductCode,
    transactions,
  ]);

  const singleSelectedStatusForDefaults = useMemo(() => {
    const individual = Array.from(filteredSelectedStatuses).filter(
      (s) => s !== 'All Status'
    );
    return individual.length === 1 ? individual[0] : null;
  }, [filteredSelectedStatuses]);

  useEffect(() => {
    if (!isGeneralMerchandise) {
      return;
    }

    if (!opened) {
      return;
    }

    if (reservationTouched) {
      return;
    }

    // Convenience default: when recording payments for Prepared/Pending orders,
    // default to treating them as reservation deposits unless the user overrides.
    const shouldDefaultToReservation =
      singleSelectedStatusForDefaults === 'Prepared' ||
      singleSelectedStatusForDefaults === 'Pending Payment';

    setIsReservation(shouldDefaultToReservation);

    if (shouldDefaultToReservation && !notes.trim()) {
      setNotes('Reservation fee');
    }
  }, [
    isGeneralMerchandise,
    notes,
    opened,
    reservationTouched,
    singleSelectedStatusForDefaults,
  ]);

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

  const payloadDrafts = useMemo(
    () => toPaymentDrafts(amountByTransactionId),
    [amountByTransactionId]
  );

  const totalEntered = useMemo(
    () => payloadDrafts.reduce((sum, p) => sum + p.amount, 0),
    [payloadDrafts]
  );

  const handleSubmit = useCallback(
    async (mode: AfterSaveMode) => {
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
        const baseTotal = getTransactionBaseTotal(transaction);
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

      const requestPayload = buildBulkPaymentsPayload({
        payloadDrafts,
        paymentDate,
        method,
        notes,
        isReservation,
      });

      setIsSaving(true);
      try {
        await api.post(
          buildApiPath(apiBasePath, '/transactions/payments/bulk'),
          requestPayload
        );

        await queryClient.invalidateQueries({
          queryKey: transactionsQueryKey,
        });

        showNotification({
          title: 'Payment recorded',
          message: `Saved ${payloadDrafts.length} payment${payloadDrafts.length === 1 ? '' : 's'} (₱${totalEntered.toLocaleString()}).`,
          color: 'green',
        });

        if (mode === 'close') {
          resetFormState();
          onClose();
        } else {
          resetAmountsOnly();
        }
      } catch (error) {
        showNotification({
          title: 'Failed to save payments',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      apiBasePath,
      eligibleTransactions,
      isReservation,
      method,
      notes,
      onClose,
      paymentDate,
      payloadDrafts,
      queryClient,
      transactionsQueryKey,
      resetAmountsOnly,
      resetFormState,
      totalEntered,
    ]
  );

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    resetFormState();
    onClose();
  }, [isSaving, onClose, resetFormState]);

  const handleConfirmAndSubmit = useCallback(
    async (mode: AfterSaveMode) => {
      const Swal = await getSwal();
      if (isSaving) {
        return;
      }

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

      const reservationLabel = isReservation
        ? 'These will be recorded as Reservation fee (Customer Deposits), not Sales Revenue.'
        : 'These will be recorded as normal payments.';

      const afterSaveLabel =
        mode === 'close'
          ? 'The modal will close after saving.'
          : 'The modal will stay open after saving.';

      const result = await Swal.fire({
        title: 'Save payments?',
        html: `You are about to save <b>${payloadDrafts.length}</b> payment${
          payloadDrafts.length === 1 ? '' : 's'
        } totaling <b>₱${totalEntered.toLocaleString()}</b>.<br/><br/><span style="color:#6b7280">${reservationLabel}<br/>${afterSaveLabel}</span>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, save',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        focusCancel: true,
      });

      if (!result.isConfirmed) {
        return;
      }

      await handleSubmit(mode);
    },
    [
      handleSubmit,
      isReservation,
      isSaving,
      payloadDrafts.length,
      paymentDate,
      totalEntered,
    ]
  );

  useEffect(() => {
    if (!opened && !isSaving) {
      resetFormState();
    }
  }, [isSaving, opened, resetFormState]);

  return (
    <UniversalModal
      opened={opened}
      onClose={handleClose}
      title="Record Payments"
      size="80%"
      styles={{
        content: {
          // Reduced overall modal width by 20%.
          maxWidth: '1700px',
        },
        header: {
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: '#ffffff',
        },
        body: {
          // Increase usable height and keep header fixed.
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        },
      }}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md">
        <Stack gap={6}>
          <Group grow align="flex-end">
            <Select
              label="Customer"
              placeholder="Select a customer"
              searchable
              nothingFoundMessage="No matching customers"
              data={customerOptions}
              value={selectedCustomer}
              onChange={handleCustomerChange}
              clearable
            />

            <Select
              label="Product code"
              placeholder="Select a product"
              searchable
              nothingFoundMessage="No matching products"
              data={productCodeOptions}
              value={selectedProductCode}
              onChange={handleProductCodeChange}
              clearable
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

          {statusFilterPills}
        </Stack>

        <TextInput
          label="Notes (optional)"
          placeholder="e.g., Reservation fee"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {isGeneralMerchandise ? (
          <Stack gap={6}>
            <Checkbox
              label="Reservation fee (customer deposit)"
              checked={isReservation}
              onChange={(e) => {
                setReservationTouched(true);
                setIsReservation(e.currentTarget.checked);

                if (e.currentTarget.checked && !notes.trim()) {
                  setNotes('Reservation fee');
                }
              }}
            />
            {isReservation ? (
              <Text size="sm" c="dimmed">
                Reservation deposits increase Cash but will not hit Sales
                Revenue until completion.
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Stack gap={6}>
            <Checkbox
              label="Reservation fee (customer deposit)"
              checked={isReservation}
              onChange={(e) => {
                setReservationTouched(true);
                setIsReservation(e.currentTarget.checked);

                if (e.currentTarget.checked && !notes.trim()) {
                  setNotes('Reservation fee');
                }
              }}
            />
            {isReservation ? (
              <Text size="sm" c="dimmed">
                Reservation deposits increase Cash but will not hit Sales
                Revenue until completion.
              </Text>
            ) : null}
          </Stack>
        )}

        {isReservation ? (
          <Text size="sm" c="dimmed">
            Tip: use the per-row “Reservation Fee” button to auto-fill 10%.
          </Text>
        ) : null}

        {(() => {
          // Increase table viewport height ~25% (10 -> 13 rows).
          const RESERVED_VISIBLE_ROWS = 13;
          const ROW_HEIGHT = 42;
          const HEADER_HEIGHT = 42;
          const scrollHeight =
            HEADER_HEIGHT + RESERVED_VISIBLE_ROWS * ROW_HEIGHT;

          const rows =
            selectedCustomer || selectedProductCode ? eligibleTransactions : [];

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
              <Table striped withTableBorder>
                <Table.Thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    backgroundColor: '#f1f3f5',
                  }}
                >
                  <Table.Tr
                    style={{
                      height: HEADER_HEIGHT,
                      backgroundColor: '#f1f3f5',
                    }}
                  >
                    <Table.Th
                      style={{
                        width: 90,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Tx ID
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Order Date
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 220,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Customer
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Product Code
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Quantity
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Unit Price
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Line Total
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Adjustments
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Balance Due
                    </Table.Th>
                    <Table.Th
                      style={{
                        width: 140,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Order Status
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Reservation Fee
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      Full Payment
                    </Table.Th>

                    <Table.Th
                      style={{
                        width: 80,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        backgroundColor: '#f1f3f5',
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
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td>&nbsp;</Table.Td>
                          <Table.Td
                            style={{
                              verticalAlign: 'middle',
                              paddingLeft: 4,
                              paddingRight: 4,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'center',
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
                                style={{ width: '100%' }}
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
                    const baseTotal = getTransactionBaseTotal(t);
                    const current = amountByTransactionId[id] ?? 0;
                    const maxPayable = Math.max(baseTotal, 0);
                    const balanceDue = Math.max(baseTotal - current, 0);
                    const isOverLimit = current > maxPayable + 0.01;

                    const quantity = Number(t.Quantity) || 0;
                    const grossTotal = quantity * unitPrice;
                    const reservationFeeRaw = grossTotal * 0.1;
                    const reservationFee =
                      Math.round(reservationFeeRaw * 100) / 100;
                    const reservationFeePayable = Math.min(
                      Math.max(reservationFee, 0),
                      maxPayable
                    );
                    const hasExistingReservationPayment = paidSoFar > 0;
                    const isReservationFeeDisabled =
                      reservationFeePayable <= 0 ||
                      hasExistingReservationPayment;
                    const reservationFeeTooltipLabel =
                      hasExistingReservationPayment
                        ? 'Reservation fee already recorded'
                        : reservationFeePayable <= 0
                          ? 'No reservation fee available'
                          : '';
                    const isFullPaymentDisabled = maxPayable <= 0;
                    const fullPaymentTooltipLabel = isFullPaymentDisabled
                      ? 'No balance due'
                      : '';

                    return (
                      <Table.Tr key={id} style={{ height: ROW_HEIGHT }}>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {id}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          {t['Order Date']}
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                          {t.Customers || '—'}
                        </Table.Td>
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
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{unitPrice.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{grossTotal.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          ₱{paidSoFar.toLocaleString()}
                        </Table.Td>
                        <Table.Td
                          style={{
                            textAlign: 'center',
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

                        <Table.Td style={{ textAlign: 'center' }}>
                          <Tooltip
                            label={reservationFeeTooltipLabel}
                            disabled={!isReservationFeeDisabled}
                          >
                            <span>
                              <Button
                                size="xs"
                                variant="light"
                                aria-disabled={isReservationFeeDisabled}
                                tabIndex={isReservationFeeDisabled ? -1 : 0}
                                styles={{
                                  root: {
                                    opacity: isReservationFeeDisabled
                                      ? 0.55
                                      : undefined,
                                    cursor: isReservationFeeDisabled
                                      ? 'default'
                                      : 'pointer',
                                  },
                                }}
                                onClick={() => {
                                  if (isReservationFeeDisabled) {
                                    return;
                                  }

                                  setReservationTouched(true);
                                  setIsReservation(true);

                                  if (!notes.trim()) {
                                    setNotes('Reservation fee');
                                  }

                                  setAmountByTransactionId((prev) => ({
                                    ...prev,
                                    [id]: reservationFeePayable,
                                  }));
                                }}
                              >
                                ₱{reservationFeePayable.toLocaleString()}
                              </Button>
                            </span>
                          </Tooltip>
                        </Table.Td>

                        <Table.Td style={{ textAlign: 'center' }}>
                          <Tooltip
                            label={fullPaymentTooltipLabel}
                            disabled={!isFullPaymentDisabled}
                          >
                            <span>
                              <Button
                                size="xs"
                                variant="light"
                                aria-disabled={isFullPaymentDisabled}
                                tabIndex={isFullPaymentDisabled ? -1 : 0}
                                styles={{
                                  root: {
                                    opacity: isFullPaymentDisabled
                                      ? 0.55
                                      : undefined,
                                    cursor: isFullPaymentDisabled
                                      ? 'default'
                                      : 'pointer',
                                  },
                                }}
                                onClick={() => {
                                  if (isFullPaymentDisabled) {
                                    return;
                                  }

                                  setReservationTouched(true);
                                  setIsReservation(false);

                                  setAmountByTransactionId((prev) => ({
                                    ...prev,
                                    [id]: maxPayable,
                                  }));
                                }}
                              >
                                ₱{maxPayable.toLocaleString()}
                              </Button>
                            </span>
                          </Tooltip>
                        </Table.Td>

                        <Table.Td
                          style={{
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            paddingLeft: 4,
                            paddingRight: 4,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
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
                              style={{ width: '100%' }}
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
            <Button
              variant="default"
              onClick={() => handleConfirmAndSubmit('continue')}
              loading={isSaving}
              disabled={isSaving}
            >
              Save and continue
            </Button>
            <Button
              onClick={() => handleConfirmAndSubmit('close')}
              loading={isSaving}
              disabled={isSaving}
            >
              Save and close
            </Button>
          </Group>
        </Group>
      </Stack>
    </UniversalModal>
  );
}
