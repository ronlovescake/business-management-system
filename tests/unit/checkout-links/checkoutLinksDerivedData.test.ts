import { describe, expect, it } from 'vitest';

import {
  buildCustomerOrderWeightsByCustomer,
  buildLocalInvoiceData,
  buildLocalInvoiceDateOptions,
} from '@/modules/clothing/operations/checkout-links/hooks/checkoutLinksDerivedData';
import type { CustomerOrderData } from '@/modules/clothing/operations/checkout-links/types';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';

// ---------------------------------------------------------------------------
// buildCustomerOrderWeightsByCustomer
// ---------------------------------------------------------------------------

describe('buildCustomerOrderWeightsByCustomer', () => {
  it('sums weights by customer (case-insensitive)', () => {
    const orders: CustomerOrderData[] = [
      {
        id: '1',
        customerName: 'Alice',
        productCode: 'X',
        quantity: 1,
        orderStatus: 'shipped',
        weightPerPiece: '0.5',
        actualWeight: '2.0',
      },
      {
        id: '2',
        customerName: 'alice',
        productCode: 'Y',
        quantity: 1,
        orderStatus: 'shipped',
        weightPerPiece: '0.5',
        actualWeight: '3.0',
      },
    ];
    const map = buildCustomerOrderWeightsByCustomer(orders);
    expect(map.get('alice')).toBe(5.0);
  });

  it('skips non-finite weights', () => {
    const orders: CustomerOrderData[] = [
      {
        id: '1',
        customerName: 'Bob',
        productCode: 'X',
        quantity: 1,
        orderStatus: 'shipped',
        weightPerPiece: '',
        actualWeight: 'not-a-number',
      },
    ];
    const map = buildCustomerOrderWeightsByCustomer(orders);
    expect(map.size).toBe(0);
  });

  it('skips entries with empty customer name', () => {
    const orders: CustomerOrderData[] = [
      {
        id: '1',
        customerName: '  ',
        productCode: 'X',
        quantity: 1,
        orderStatus: 'shipped',
        weightPerPiece: '0.5',
        actualWeight: '1.0',
      },
    ];
    const map = buildCustomerOrderWeightsByCustomer(orders);
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildLocalInvoiceData
// ---------------------------------------------------------------------------

describe('buildLocalInvoiceData', () => {
  const baseTx = (
    overrides: Partial<TransactionData> = {}
  ): TransactionData => ({
    'Order Date': '2026-01-01',
    Customers: 'Alice',
    'Product Code': 'X',
    Quantity: 1,
    'Unit Price': 100,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 100,
    'Order Status': 'shipped',
    Notes: '',
    'Invoice Date': '2026-01-15',
    'Packed Date': '',
    'Shipment Code': '',
    ...overrides,
  });

  it('returns empty array for no transactions', () => {
    expect(
      buildLocalInvoiceData({
        transactionsWithInvoiceDate: [],
        localInvoiceTickboxes: {},
        customerOrderWeightsByCustomer: new Map(),
      })
    ).toEqual([]);
  });

  it('builds one invoice per customer, alphabetically sorted', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [
        baseTx({ Customers: 'Bob', 'Invoice Date': '2026-01-20' }),
        baseTx({ Customers: 'Alice', 'Invoice Date': '2026-01-15' }),
      ],
      localInvoiceTickboxes: {},
      customerOrderWeightsByCustomer: new Map(),
    });

    expect(result).toHaveLength(2);
    expect(result[0].customerName).toBe('Alice');
    expect(result[1].customerName).toBe('Bob');
  });

  it('merges multiple invoice dates for the same customer', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [
        baseTx({ Customers: 'Alice', 'Invoice Date': '2026-01-15' }),
        baseTx({ Customers: 'Alice', 'Invoice Date': '2026-01-20' }),
      ],
      localInvoiceTickboxes: {},
      customerOrderWeightsByCustomer: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].localInvoiceDates).toEqual(['2026-01-15', '2026-01-20']);
  });

  it('resolves actual weight from customerOrderWeightsByCustomer first', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [baseTx()],
      localInvoiceTickboxes: {},
      customerOrderWeightsByCustomer: new Map([['alice', 7.5]]),
    });

    expect(result[0].actualWeight).toBe('7.50');
  });

  it('leaves actual weight blank when order weights are missing', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [baseTx()],
      localInvoiceTickboxes: {},
      customerOrderWeightsByCustomer: new Map(),
    });

    expect(result[0].actualWeight).toBe('');
  });

  it('sets tickbox from localInvoiceTickboxes', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [baseTx()],
      localInvoiceTickboxes: { 'local-alice': true },
      customerOrderWeightsByCustomer: new Map(),
    });

    expect(result[0].tickbox).toBe(true);
  });

  it('skips transactions with empty invoice date or customer', () => {
    const result = buildLocalInvoiceData({
      transactionsWithInvoiceDate: [
        baseTx({ 'Invoice Date': '', Customers: 'Alice' }),
        baseTx({ 'Invoice Date': '2026-01-15', Customers: '' }),
      ],
      localInvoiceTickboxes: {},
      customerOrderWeightsByCustomer: new Map(),
    });

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildLocalInvoiceDateOptions
// ---------------------------------------------------------------------------

describe('buildLocalInvoiceDateOptions', () => {
  const baseTx = (date: string): TransactionData =>
    ({
      'Invoice Date': date,
      Customers: 'X',
      'Order Date': '',
      'Product Code': '',
      Quantity: 0,
      'Unit Price': 0,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 0,
      'Order Status': '',
      Notes: '',
      'Packed Date': '',
      'Shipment Code': '',
    }) as TransactionData;

  it('returns unique dates sorted newest first', () => {
    const result = buildLocalInvoiceDateOptions([
      baseTx('2026-01-01'),
      baseTx('2026-03-01'),
      baseTx('2026-02-01'),
      baseTx('2026-01-01'), // duplicate
    ]);
    expect(result).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('returns empty array for no transactions', () => {
    expect(buildLocalInvoiceDateOptions([])).toEqual([]);
  });

  it('skips empty/falsy invoice dates', () => {
    const result = buildLocalInvoiceDateOptions([
      baseTx(''),
      baseTx('2026-06-01'),
    ]);
    expect(result).toEqual(['2026-06-01']);
  });
});
