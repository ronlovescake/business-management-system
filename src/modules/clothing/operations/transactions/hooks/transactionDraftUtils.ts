import type { TransactionData } from '../types/transaction.types';

export const formatTodayInManila = (): string => {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

export const createEmptyTransaction = (): TransactionData => ({
  'Order Date': '',
  Customers: '',
  'Product Code': '',
  Quantity: 0,
  'Unit Price': 0,
  Discount: 0,
  Adjustment: 0,
  'Line Total': 0,
  'Order Status': '',
  Notes: '',
  'Invoice Date': '',
  'Packed Date': '',
  'Shipment Code': '',
});

export const hasMinimumCreateFields = (draft: TransactionData): boolean => {
  const orderDate = (draft['Order Date'] ?? '').trim();
  const hasOrderDate = orderDate !== '';
  const hasCustomer = (draft.Customers ?? '').trim() !== '';
  const hasProduct = (draft['Product Code'] ?? '').trim() !== '';
  return hasOrderDate && (hasCustomer || hasProduct);
};

export const computeRemainingBalance = (row: TransactionData): number => {
  const lineTotal = Number(row['Line Total']);
  if (Number.isFinite(lineTotal)) {
    return lineTotal;
  }

  const quantity = Number(row.Quantity) || 0;
  const unitPrice = Number(row['Unit Price']) || 0;
  const discount = Number(row.Discount) || 0;
  const adjustment = Number(row.Adjustment) || 0;

  return quantity * unitPrice - discount - adjustment;
};
