import type { Prisma } from '@prisma/client';
import type { TransactionUpdateRecord } from './sanitizers';

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
