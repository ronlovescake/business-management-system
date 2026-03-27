import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { getSwal } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
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

const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'GCash', label: 'GCash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Other', label: 'Other' },
];

type AfterSaveMode = 'close' | 'continue';

type UseTransactionPaymentsStateArgs = {
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
};

export function useTransactionPaymentsState({
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
}: UseTransactionPaymentsStateArgs) {
  const queryClient = useQueryClient();
  const transactionsQueryKey = useMemo(
    () => [...queryKeys.transactions.lists(), apiBasePath ?? '/api'],
    [apiBasePath]
  );

  const isGeneralMerchandise =
    typeof apiBasePath === 'string' &&
    apiBasePath.includes('general-merchandise');

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    null
  );
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date());
  const [method, setMethod] = useState<string | null>('Cash');
  const [notes, setNotes] = useState('');
  const [isReservation, setIsReservation] = useState(false);
  const [reservationTouched, setReservationTouched] = useState(false);
  const [amountByTransactionId, setAmountByTransactionId] = useState<
    Record<number, number>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const visibleStatusFilterOptions = useMemo(
    () =>
      STATUS_FILTER_OPTIONS.filter((status) => {
        return status === 'All Status' || !HIDDEN_STATUS_PILLS.has(status);
      }),
    []
  );

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
    if (!opened || !defaultCustomerName || selectedCustomer) {
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

  const customerOptions = useMemo(
    () => customerNames.map((name) => ({ value: name, label: name })),
    [customerNames]
  );

  const productCodeOptions = useMemo(() => {
    const unique = new Set<string>();

    transactions.forEach((transaction) => {
      const code = (transaction['Product Code'] ?? '').trim();
      if (code) {
        unique.add(code);
      }
    });

    return Array.from(unique)
      .sort((left, right) => left.localeCompare(right))
      .map((code) => ({ value: code, label: code }));
  }, [transactions]);

  useEffect(() => {
    if (!opened || !defaultProductCode || selectedProductCode) {
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

  const eligibleTransactions = useMemo(() => {
    if (!selectedCustomer && !selectedProductCode) {
      return [];
    }

    const excludedStatuses = new Set(['Shipped']);

    return transactions
      .filter((transaction) => transaction.id && transaction.id > 0)
      .filter((transaction) => {
        if (!selectedCustomer) {
          return true;
        }
        return (transaction.Customers ?? '').trim() === selectedCustomer;
      })
      .filter((transaction) => {
        if (!selectedProductCode) {
          return true;
        }
        return (
          (transaction['Product Code'] ?? '').trim() === selectedProductCode
        );
      })
      .filter((transaction) => {
        const status = transaction['Order Status'] ?? '';
        if (!status) {
          return true;
        }
        if (isCancelledOrderStatus(status)) {
          return false;
        }
        return !excludedStatuses.has(status);
      })
      .filter((transaction) => {
        const status = (transaction['Order Status'] ?? '').trim();
        const individual = Array.from(filteredSelectedStatuses).filter(
          (option) => option !== 'All Status'
        );

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
      (option) => option !== 'All Status'
    );

    return individual.length === 1 ? individual[0] : null;
  }, [filteredSelectedStatuses]);

  useEffect(() => {
    if (!isGeneralMerchandise || !opened || reservationTouched) {
      return;
    }

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
      setAmountByTransactionId((previous) => ({
        ...previous,
        [transactionId]: Number.isFinite(numeric) ? numeric : 0,
      }));
    },
    []
  );

  const handleReservationChange = useCallback(
    (checked: boolean) => {
      setReservationTouched(true);
      setIsReservation(checked);

      if (checked && !notes.trim()) {
        setNotes('Reservation fee');
      }
    },
    [notes]
  );

  const handleApplyReservationFee = useCallback(
    (transactionId: number, amount: number) => {
      setReservationTouched(true);
      setIsReservation(true);

      if (!notes.trim()) {
        setNotes('Reservation fee');
      }

      setAmountByTransactionId((previous) => ({
        ...previous,
        [transactionId]: amount,
      }));
    },
    [notes]
  );

  const handleApplyFullPayment = useCallback(
    (transactionId: number, amount: number) => {
      setReservationTouched(true);
      setIsReservation(false);
      setAmountByTransactionId((previous) => ({
        ...previous,
        [transactionId]: amount,
      }));
    },
    []
  );

  const payloadDrafts = useMemo(
    () => toPaymentDrafts(amountByTransactionId),
    [amountByTransactionId]
  );

  const totalEntered = useMemo(
    () => payloadDrafts.reduce((sum, draft) => sum + draft.amount, 0),
    [payloadDrafts]
  );

  const resetAmountsOnly = useCallback(() => {
    setAmountByTransactionId({});
  }, []);

  const submitPayments = useCallback(
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
          (item) => Number(item.id) === draft.transactionId
        );
        if (!transaction) {
          return false;
        }

        return draft.amount > getTransactionBaseTotal(transaction) + 0.01;
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

        await queryClient.invalidateQueries({ queryKey: transactionsQueryKey });

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
      resetAmountsOnly,
      resetFormState,
      totalEntered,
      transactionsQueryKey,
    ]
  );

  const handleConfirmAndSubmit = useCallback(
    async (mode: AfterSaveMode) => {
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

      const Swal = await getSwal();
      const reservationLabel = isReservation
        ? 'These will be recorded as Reservation fee (Customer Deposits), not Sales Revenue.'
        : 'These will be recorded as normal payments.';
      const afterSaveLabel =
        mode === 'close'
          ? 'The modal will close after saving.'
          : 'The modal will stay open after saving.';

      const result = await Swal.fire({
        title: 'Save payments?',
        html: `You are about to save <b>${payloadDrafts.length}</b> payment${payloadDrafts.length === 1 ? '' : 's'} totaling <b>₱${totalEntered.toLocaleString()}</b>.<br/><br/><span style="color:#6b7280">${reservationLabel}<br/>${afterSaveLabel}</span>`,
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

      await submitPayments(mode);
    },
    [
      isReservation,
      isSaving,
      payloadDrafts.length,
      paymentDate,
      submitPayments,
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

  useEffect(() => {
    if (!opened && !isSaving) {
      resetFormState();
    }
  }, [isSaving, opened, resetFormState]);

  return {
    customerOptions,
    eligibleTransactions,
    filteredSelectedStatuses,
    handleAmountChange,
    handleApplyFullPayment,
    handleApplyReservationFee,
    handleClose,
    handleConfirmAndSubmit,
    handleCustomerChange,
    handleProductCodeChange,
    handleReservationChange,
    handleStatusFilter: onStatusFilter,
    isGeneralMerchandise,
    isReservation,
    isSaving,
    method,
    notes,
    paymentDate,
    productCodeOptions,
    selectedCustomer,
    selectedProductCode,
    setMethod,
    setNotes,
    setPaymentDate,
    totalEntered,
    amountByTransactionId,
    visibleStatusFilterOptions,
    paymentMethodOptions: PAYMENT_METHOD_OPTIONS,
  };
}
