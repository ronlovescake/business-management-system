import React from 'react';
import {
  Checkbox,
  Group,
  Pill,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { StatusFilterOption } from '../types/transaction.types';

type TransactionPaymentsFiltersProps = {
  customerOptions: Array<{ value: string; label: string }>;
  productCodeOptions: Array<{ value: string; label: string }>;
  selectedCustomer: string | null;
  selectedProductCode: string | null;
  paymentDate: Date | null;
  method: string | null;
  notes: string;
  isReservation: boolean;
  selectedStatuses: Set<StatusFilterOption>;
  statusOptions: StatusFilterOption[];
  paymentMethodOptions: Array<{ value: string; label: string }>;
  onCustomerChange: (value: string | null) => void;
  onProductCodeChange: (value: string | null) => void;
  onPaymentDateChange: (value: Date | null) => void;
  onMethodChange: (value: string | null) => void;
  onNotesChange: (value: string) => void;
  onReservationChange: (checked: boolean) => void;
  onStatusFilter: (status: string) => void;
};

export function TransactionPaymentsFilters({
  customerOptions,
  productCodeOptions,
  selectedCustomer,
  selectedProductCode,
  paymentDate,
  method,
  notes,
  isReservation,
  selectedStatuses,
  statusOptions,
  paymentMethodOptions,
  onCustomerChange,
  onProductCodeChange,
  onPaymentDateChange,
  onMethodChange,
  onNotesChange,
  onReservationChange,
  onStatusFilter,
}: TransactionPaymentsFiltersProps) {
  return (
    <>
      <Stack gap={6}>
        <Group grow align="flex-end">
          <Select
            label="Customer"
            placeholder="Select a customer"
            searchable
            nothingFoundMessage="No matching customers"
            data={customerOptions}
            value={selectedCustomer}
            onChange={onCustomerChange}
            clearable
          />

          <Select
            label="Product code"
            placeholder="Select a product"
            searchable
            nothingFoundMessage="No matching products"
            data={productCodeOptions}
            value={selectedProductCode}
            onChange={onProductCodeChange}
            clearable
          />

          <DateInput
            label="Payment date"
            value={paymentDate}
            onChange={onPaymentDateChange}
            valueFormat="YYYY-MM-DD"
            clearable={false}
          />

          <Select
            label="Method"
            data={paymentMethodOptions}
            value={method}
            onChange={onMethodChange}
            allowDeselect
          />
        </Group>

        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            Order status
          </Text>
          <Group gap="xs" wrap="wrap">
            {statusOptions.map((status) => {
              const isSelected = selectedStatuses.has(status);

              return (
                <Pill
                  key={status}
                  size="md"
                  withRemoveButton={false}
                  onClick={() => onStatusFilter(status)}
                  style={{
                    backgroundColor: isSelected ? '#228be6' : '#e9ecef',
                    color: isSelected ? '#ffffff' : '#495057',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
                    if (!isSelected) {
                      event.currentTarget.style.backgroundColor = '#dee2e6';
                    }
                  }}
                  onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => {
                    if (!isSelected) {
                      event.currentTarget.style.backgroundColor = '#e9ecef';
                    }
                  }}
                >
                  {status}
                </Pill>
              );
            })}
          </Group>
        </Stack>
      </Stack>

      <TextInput
        label="Notes (optional)"
        placeholder="e.g., Reservation fee"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
      />

      <Stack gap={6}>
        <Checkbox
          label="Reservation fee (customer deposit)"
          checked={isReservation}
          onChange={(event) => onReservationChange(event.currentTarget.checked)}
        />
        {isReservation ? (
          <Text size="sm" c="dimmed">
            Reservation deposits increase Cash but will not hit Sales Revenue
            until completion.
          </Text>
        ) : null}
      </Stack>

      {isReservation ? (
        <Text size="sm" c="dimmed">
          Tip: use the per-row “Reservation Fee” button to auto-fill 10%.
        </Text>
      ) : null}
    </>
  );
}
