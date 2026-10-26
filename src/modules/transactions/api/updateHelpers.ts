import type { Prisma, Transaction } from '@prisma/client';
import type { TransactionUpdateRecord } from './sanitizers';
import {
  isCancelledOrderStatus,
  isForfeitedOrderStatus,
  normalizeOrderStatus,
} from '@/lib/transactions/order-status';
import { TransactionValidationError } from './referenceValidation';

export function assertGenericOrderStatusChange(
  nextStatus: string | null | undefined,
  previousStatus: string | null | undefined
) {
  if (
    nextStatus === undefined ||
    normalizeOrderStatus(nextStatus) === normalizeOrderStatus(previousStatus)
  ) {
    return;
  }
  if (isForfeitedOrderStatus(nextStatus)) {
    throw new TransactionValidationError(
      'Forfeited is historical only. Use Cancelled and the money-decision workflow.'
    );
  }
  if (isCancelledOrderStatus(previousStatus)) {
    throw new TransactionValidationError(
      'A closed order cannot be reopened by a generic edit. Preserve its money history.'
    );
  }
  if (isCancelledOrderStatus(nextStatus)) {
    throw new TransactionValidationError(
      'Use the cancellation decision workflow to close this order safely.'
    );
  }
}

export function assertClosedOrderFinancialEdit(
  values: TransactionUpdateRecord['values'],
  existing: Pick<
    Transaction,
    | 'orderStatus'
    | 'orderDate'
    | 'customers'
    | 'productCode'
    | 'quantity'
    | 'unitPrice'
    | 'discount'
    | 'adjustment'
    | 'lineTotal'
    | 'invoiceDate'
    | 'shipmentCode'
  >
): void {
  if (!isCancelledOrderStatus(existing.orderStatus)) {
    return;
  }
  const protectedFields = [
    ['Order Date', existing.orderDate],
    ['Customers', existing.customers],
    ['Product Code', existing.productCode],
    ['Quantity', existing.quantity],
    ['Unit Price', existing.unitPrice],
    ['Discount', existing.discount],
    ['Adjustment', existing.adjustment],
    ['Line Total', existing.lineTotal],
    ['Invoice Date', existing.invoiceDate],
    ['Shipment Code', existing.shipmentCode],
  ] as const;
  for (const [field, previous] of protectedFields) {
    if (
      values[field] !== undefined &&
      String(values[field] ?? '') !== String(previous ?? '')
    ) {
      throw new TransactionValidationError(
        'A closed order cannot have its financial history rewritten. Use a dated correction workflow.'
      );
    }
  }
}

export function buildUpdatePayload(
  values: TransactionUpdateRecord['values']
): Prisma.TransactionUpdateInput {
  const data: Prisma.TransactionUpdateInput = {};

  if (values['Order Date'] !== undefined) {
    data.orderDate = values['Order Date'];
  }
  if (values.Customers !== undefined) {
    data.customers = values.Customers;
  }
  if (values['Product Code'] !== undefined) {
    data.productCode = values['Product Code'];
  }
  if (values.Quantity !== undefined) {
    data.quantity = values.Quantity;
  }
  if (values['Unit Price'] !== undefined) {
    data.unitPrice = values['Unit Price'];
  }
  if (values.Discount !== undefined) {
    data.discount = values.Discount;
  }
  if (values.Adjustment !== undefined) {
    data.adjustment = values.Adjustment;
  }
  if (values['Line Total'] !== undefined) {
    data.lineTotal = values['Line Total'];
  }
  if (values['Order Status'] !== undefined) {
    data.orderStatus = values['Order Status'];
  }
  if (values.Notes !== undefined) {
    data.notes = values.Notes;
  }
  if (values['Invoice Date'] !== undefined) {
    data.invoiceDate = values['Invoice Date'];
  }
  if (values['Packed Date'] !== undefined) {
    data.packedDate = values['Packed Date'];
  }
  if (values['Shipment Code'] !== undefined) {
    data.shipmentCode = values['Shipment Code'];
  }

  return data;
}

export function shouldRecalculateLineTotal(
  values: TransactionUpdateRecord['values']
): boolean {
  return (
    values.Quantity !== undefined ||
    values['Unit Price'] !== undefined ||
    values.Adjustment !== undefined ||
    values['Line Total'] !== undefined
  );
}

export function describeChange(
  field: string,
  oldValue: unknown,
  newValue: unknown
): string {
  const formattedOld =
    oldValue === null || oldValue === undefined || oldValue === ''
      ? 'empty'
      : String(oldValue);
  const formattedNew =
    newValue === null || newValue === undefined || newValue === ''
      ? 'empty'
      : String(newValue);
  return `${field}: ${formattedOld} → ${formattedNew}`;
}

export function mapFieldName(field: string): string {
  switch (field) {
    case 'Order Date':
      return 'orderDate';
    case 'Product Code':
      return 'productCode';
    case 'Unit Price':
      return 'unitPrice';
    case 'Line Total':
      return 'lineTotal';
    case 'Order Status':
      return 'orderStatus';
    case 'Invoice Date':
      return 'invoiceDate';
    case 'Packed Date':
      return 'packedDate';
    case 'Shipment Code':
      return 'shipmentCode';
    default:
      return field.charAt(0).toLowerCase() + field.slice(1);
  }
}
