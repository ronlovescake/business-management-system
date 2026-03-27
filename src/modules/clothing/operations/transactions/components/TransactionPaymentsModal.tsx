'use client';

import React from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { type TransactionData } from '../types/transaction.types';
import { TransactionPaymentsFilters } from './TransactionPaymentsFilters';
import { TransactionPaymentsTable } from './TransactionPaymentsTable';
import { useTransactionPaymentsState } from './useTransactionPaymentsState';

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
  const {
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
    handleStatusFilter,
    isReservation,
    isSaving,
    method,
    notes,
    paymentDate,
    paymentMethodOptions,
    productCodeOptions,
    selectedCustomer,
    selectedProductCode,
    setMethod,
    setNotes,
    setPaymentDate,
    totalEntered,
    amountByTransactionId,
    visibleStatusFilterOptions,
  } = useTransactionPaymentsState({
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
  });

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
        <TransactionPaymentsFilters
          customerOptions={customerOptions}
          productCodeOptions={productCodeOptions}
          selectedCustomer={selectedCustomer}
          selectedProductCode={selectedProductCode}
          paymentDate={paymentDate}
          method={method}
          notes={notes}
          isReservation={isReservation}
          selectedStatuses={filteredSelectedStatuses}
          statusOptions={visibleStatusFilterOptions}
          paymentMethodOptions={paymentMethodOptions}
          onCustomerChange={handleCustomerChange}
          onProductCodeChange={handleProductCodeChange}
          onPaymentDateChange={setPaymentDate}
          onMethodChange={setMethod}
          onNotesChange={setNotes}
          onReservationChange={handleReservationChange}
          onStatusFilter={handleStatusFilter}
        />

        <TransactionPaymentsTable
          eligibleTransactions={eligibleTransactions}
          selectedCustomer={selectedCustomer}
          selectedProductCode={selectedProductCode}
          amountByTransactionId={amountByTransactionId}
          onAmountChange={handleAmountChange}
          onApplyReservationFee={handleApplyReservationFee}
          onApplyFullPayment={handleApplyFullPayment}
        />

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
