import type { Prisma, Transaction } from '@prisma/client';

export interface TransactionDTO {
  id?: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
  'Order Status': string;
  Notes: string | null;
  'Invoice Date': string | null;
  'Packed Date': string | null;
  'Shipment Code': string | null;
}

export function mapToDTO(transaction: Transaction): TransactionDTO {
  return {
    id: transaction.id,
    'Order Date': transaction.orderDate ?? '',
    Customers: transaction.customers ?? '',
    'Product Code': transaction.productCode ?? '',
    Quantity: transaction.quantity ?? 0,
    'Unit Price': transaction.unitPrice ?? 0,
    Discount: transaction.discount ?? 0,
    Adjustment: transaction.adjustment ?? 0,
    'Line Total': transaction.lineTotal ?? 0,
    'Order Status': transaction.orderStatus ?? '',
    Notes: transaction.notes ?? null,
    'Invoice Date': transaction.invoiceDate ?? null,
    'Packed Date': transaction.packedDate ?? null,
    'Shipment Code': transaction.shipmentCode ?? null,
  };
}

export function mapFromDTO(
  payload: TransactionDTO
): Prisma.TransactionCreateInput {
  return {
    orderDate: payload['Order Date'] || null,
    customers: payload.Customers || null,
    productCode: payload['Product Code'] || null,
    quantity: payload.Quantity,
    unitPrice: payload['Unit Price'],
    discount: payload.Discount,
    adjustment: payload.Adjustment,
    lineTotal: payload['Line Total'],
    orderStatus: payload['Order Status'] || null,
    notes: payload.Notes,
    invoiceDate: payload['Invoice Date'],
    packedDate: payload['Packed Date'],
    shipmentCode: payload['Shipment Code'],
  };
}
