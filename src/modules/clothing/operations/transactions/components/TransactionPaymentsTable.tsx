import React from 'react';
import { Button, NumberInput, ScrollArea, Table, Tooltip } from '@mantine/core';
import { getTransactionBaseTotal } from './transactionPaymentsHelpers';
import type { TransactionData } from '../types/transaction.types';

type TransactionPaymentsTableProps = {
  eligibleTransactions: TransactionData[];
  selectedCustomer: string | null;
  selectedProductCode: string | null;
  amountByTransactionId: Record<number, number>;
  onAmountChange: (transactionId: number, value: number | string) => void;
  onApplyReservationFee: (transactionId: number, amount: number) => void;
  onApplyFullPayment: (transactionId: number, amount: number) => void;
};

type TableRow = {
  key: string;
  transaction: TransactionData | null;
};

export function TransactionPaymentsTable({
  eligibleTransactions,
  selectedCustomer,
  selectedProductCode,
  amountByTransactionId,
  onAmountChange,
  onApplyReservationFee,
  onApplyFullPayment,
}: TransactionPaymentsTableProps) {
  const reservedVisibleRows = 13;
  const rowHeight = 42;
  const headerHeight = 42;
  const scrollHeight = headerHeight + reservedVisibleRows * rowHeight;
  const columnKeys = [
    'tx-id',
    'order-date',
    'customer',
    'product-code',
    'quantity',
    'unit-price',
    'line-total',
    'adjustments',
    'balance-due',
    'order-status',
    'reservation-fee',
    'full-payment',
    'add-payment',
  ];

  const rows =
    selectedCustomer || selectedProductCode ? eligibleTransactions : [];
  const paddedRows: TableRow[] = rows.map((transaction) => ({
    key: `transaction-${transaction.id}`,
    transaction,
  }));

  if (paddedRows.length < reservedVisibleRows) {
    const placeholderCount = reservedVisibleRows - paddedRows.length;
    for (let index = 0; index < placeholderCount; index += 1) {
      paddedRows.push({
        key: `placeholder-${paddedRows.length + 1}`,
        transaction: null,
      });
    }
  }

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
            style={{ height: headerHeight, backgroundColor: '#f1f3f5' }}
          >
            {[
              ['Tx ID', 90],
              ['Order Date', 80],
              ['Customer', 220],
              ['Product Code', 140],
              ['Quantity', 80],
              ['Unit Price', 80],
              ['Line Total', 80],
              ['Adjustments', 80],
              ['Balance Due', 80],
              ['Order Status', 140],
              ['Reservation Fee', 80],
              ['Full Payment', 80],
              ['Add payment', 80],
            ].map(([label, width]) => (
              <Table.Th
                key={label}
                style={{
                  width,
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: '#f1f3f5',
                }}
              >
                {label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paddedRows.map((row) => {
            const { key, transaction } = row;
            if (!transaction) {
              return (
                <Table.Tr key={key} style={{ height: rowHeight }}>
                  {columnKeys.slice(0, 12).map((columnKey) => (
                    <Table.Td key={`${key}-${columnKey}`}>&nbsp;</Table.Td>
                  ))}
                  <Table.Td
                    style={{
                      verticalAlign: 'middle',
                      paddingLeft: 4,
                      paddingRight: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
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

            const id = transaction.id as number;
            const paidSoFar = Number(transaction.Adjustment) || 0;
            const unitPrice = Number(transaction['Unit Price']) || 0;
            const quantity = Number(transaction.Quantity) || 0;
            const grossTotal = quantity * unitPrice;
            const current = amountByTransactionId[id] ?? 0;
            const maxPayable = Math.max(
              getTransactionBaseTotal(transaction),
              0
            );
            const balanceDue = Math.max(maxPayable - current, 0);
            const isOverLimit = current > maxPayable + 0.01;
            const reservationFee = Math.round(grossTotal * 0.1 * 100) / 100;
            const reservationFeePayable = Math.min(
              Math.max(reservationFee, 0),
              maxPayable
            );
            const hasExistingReservationPayment = paidSoFar > 0;
            const isReservationFeeDisabled =
              reservationFeePayable <= 0 || hasExistingReservationPayment;
            const reservationFeeTooltipLabel = hasExistingReservationPayment
              ? 'Reservation fee already recorded'
              : reservationFeePayable <= 0
                ? 'No reservation fee available'
                : '';
            const isFullPaymentDisabled = maxPayable <= 0;
            const fullPaymentTooltipLabel = isFullPaymentDisabled
              ? 'No balance due'
              : '';

            return (
              <Table.Tr key={key} style={{ height: rowHeight }}>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  {id}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  {transaction['Order Date']}
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {transaction.Customers || '—'}
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {transaction['Product Code']}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  {transaction.Quantity}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  ₱{unitPrice.toLocaleString()}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  ₱{grossTotal.toLocaleString()}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  ₱{paidSoFar.toLocaleString()}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  ₱{balanceDue.toLocaleString()}
                </Table.Td>
                <Table.Td
                  style={{ textAlign: 'center', verticalAlign: 'middle' }}
                >
                  {transaction['Order Status'] || '—'}
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
                          if (!isReservationFeeDisabled) {
                            onApplyReservationFee(id, reservationFeePayable);
                          }
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
                            opacity: isFullPaymentDisabled ? 0.55 : undefined,
                            cursor: isFullPaymentDisabled
                              ? 'default'
                              : 'pointer',
                          },
                        }}
                        onClick={() => {
                          if (!isFullPaymentDisabled) {
                            onApplyFullPayment(id, maxPayable);
                          }
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
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <NumberInput
                      value={current}
                      min={0}
                      max={maxPayable}
                      step={1}
                      hideControls
                      prefix="₱"
                      error={
                        isOverLimit ? 'Payment exceeds balance due' : undefined
                      }
                      onFocus={(event) => {
                        event.currentTarget.select();
                      }}
                      onChange={(value) => onAmountChange(id, value)}
                      styles={{ input: { textAlign: 'right' } }}
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
}
