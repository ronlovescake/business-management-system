/**
 * TransactionService — Business-Rule-Mapped Tests
 *
 * Rules Covered (operations-transactions.md):
 *  B-11  Unit Price = Tier Price - Discount
 *  B-12  Line Total = (Quantity × Unit Price) - Adjustment
 *  B-13  Tier Price lookup by product code and quantity range
 *  C-22  getOrderStatusFromShipmentStatus mapping
 *  D-6   sanitizeValue treats "null" string / empty as blank
 *  D-7   sanitizeTransaction converts nullable numeric → 0
 *  H-47  calculateStatistics excludes cancelled from revenue
 *  H-48  calculateStatistics by-status totals
 *  C-25  syncTransactionsWithShipmentStatus only updates auto-statuses
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/FormatterService', () => ({
  FormatterService: {
    formatCurrency: vi.fn((v: number) => `₱${v.toFixed(2)}`),
    formatDateShort: vi.fn((v: string) => v),
    formatNumber: vi.fn((v: number) => String(v)),
  },
}));
vi.mock('@/services/ValidationService', () => ({
  ValidationService: {
    validateCustomer: vi.fn().mockResolvedValue({ isValid: true, warnings: [], errors: [] }),
  },
}));

import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import type { TransactionData, PriceTier } from '@/modules/clothing/operations/transactions/types/transaction.types';

// ---------------------------------------------------------------------------
// Helper Factories
// ---------------------------------------------------------------------------
function makeTier(productCode: string, lower: number, upper: number, price: number): PriceTier {
  return { 'Product Code': productCode, 'Lower Limit': lower, 'Upper Limit': upper, Prices: price } as PriceTier;
}

function makeTransaction(overrides: Partial<TransactionData> = {}): TransactionData {
  return {
    Customers: 'Test Customer',
    'Product Code': 'PC-001',
    Quantity: 10,
    'Unit Price': 100,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 1000,
    'Order Status': '',
    ...overrides,
  } as TransactionData;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionService', () => {
  // =========================================================================
  // Tier Price Lookup (Rule B-13)
  // =========================================================================
  describe('getUnitPriceForQuantity()', () => {
    const tiers = [
      makeTier('PC-001', 1, 10, 150),
      makeTier('PC-001', 11, 50, 120),
      makeTier('PC-001', 51, 100, 100),
      makeTier('PC-002', 1, 100, 200),
    ];

    it('Rule B-13: returns correct tier price for quantity in range', () => {
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 5, tiers)).toBe(150);
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 25, tiers)).toBe(120);
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 75, tiers)).toBe(100);
    });

    it('Rule B-13: returns null for unknown product code', () => {
      expect(TransactionService.getUnitPriceForQuantity('PC-999', 5, tiers)).toBeNull();
    });

    it('Rule B-13: returns null for zero or negative quantity', () => {
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 0, tiers)).toBeNull();
      expect(TransactionService.getUnitPriceForQuantity('PC-001', -1, tiers)).toBeNull();
    });

    it('Rule B-13: returns null for empty product code', () => {
      expect(TransactionService.getUnitPriceForQuantity('', 5, tiers)).toBeNull();
    });

    it('Rule B-13: finds matching tier at boundaries', () => {
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 1, tiers)).toBe(150);
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 10, tiers)).toBe(150);
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 11, tiers)).toBe(120);
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 50, tiers)).toBe(120);
    });

    it('Rule B-13: returns null when quantity exceeds all tiers', () => {
      expect(TransactionService.getUnitPriceForQuantity('PC-001', 200, tiers)).toBeNull();
    });
  });

  // =========================================================================
  // Unit Price Calculation (Rule B-11)
  // =========================================================================
  describe('calculateUnitPrice()', () => {
    const tiers = [makeTier('PC-001', 1, 100, 150)];

    it('Rule B-11: unitPrice = tierPrice - discount', () => {
      expect(TransactionService.calculateUnitPrice('PC-001', 10, 20, tiers)).toBe(130);
    });

    it('Rule B-11: returns 0 when product not found', () => {
      expect(TransactionService.calculateUnitPrice('MISSING', 10, 0, tiers)).toBe(0);
    });

    it('Rule B-11: allows negative result (discount > tier)', () => {
      expect(TransactionService.calculateUnitPrice('PC-001', 10, 200, tiers)).toBe(-50);
    });

    it('Rule B-11: zero discount returns full tier price', () => {
      expect(TransactionService.calculateUnitPrice('PC-001', 10, 0, tiers)).toBe(150);
    });
  });

  // =========================================================================
  // Line Total Calculation (Rule B-12)
  // =========================================================================
  describe('calculateLineTotal()', () => {
    it('Rule B-12: lineTotal = (qty × unitPrice) - adjustment', () => {
      expect(TransactionService.calculateLineTotal(10, 100, 50)).toBe(950);
    });

    it('Rule B-12: zero adjustment', () => {
      expect(TransactionService.calculateLineTotal(5, 200, 0)).toBe(1000);
    });

    it('Rule B-12: handles zero quantity', () => {
      expect(TransactionService.calculateLineTotal(0, 100, 0)).toBe(0);
    });

    it('Rule B-12: negative adjustment increases total', () => {
      expect(TransactionService.calculateLineTotal(2, 100, -50)).toBe(250);
    });
  });

  // =========================================================================
  // Order Status from Shipment Status (Rule C-22)
  // =========================================================================
  describe('getOrderStatusFromShipmentStatus()', () => {
    it('Rule C-22: blank → In Transit', () => {
      expect(TransactionService.getOrderStatusFromShipmentStatus('')).toBe('In Transit');
    });

    it.each([
      ['In Transit', 'In Transit'],
      ['Manila Port', 'In Transit'],
      ['With Pier Gatepass', 'In Transit'],
      ['PH Warehouse', 'In Transit'],
    ])('Rule C-22: "%s" → "%s"', (input, expected) => {
      expect(TransactionService.getOrderStatusFromShipmentStatus(input)).toBe(expected);
    });

    it.each([
      ['For Pickup', 'Warehouse'],
      ['Sorting', 'Warehouse'],
      ['Delivered', 'Warehouse'],
    ])('Rule C-22: "%s" → "%s"', (input, expected) => {
      expect(TransactionService.getOrderStatusFromShipmentStatus(input)).toBe(expected);
    });

    it('Rule C-22: unknown status defaults to In Transit', () => {
      expect(TransactionService.getOrderStatusFromShipmentStatus('UNKNOWN-STATUS')).toBe('In Transit');
    });

    it('Rule C-22: case insensitive matching', () => {
      expect(TransactionService.getOrderStatusFromShipmentStatus('manila port')).toBe('In Transit');
      expect(TransactionService.getOrderStatusFromShipmentStatus('FOR PICKUP')).toBe('Warehouse');
    });
  });

  // =========================================================================
  // Sanitize Value (Rule D-6)
  // =========================================================================
  describe('sanitizeValue()', () => {
    it('Rule D-6: treats "null" string as blank', () => {
      expect(TransactionService.sanitizeValue('null')).toBe('');
    });

    it('Rule D-6: treats empty string as blank', () => {
      expect(TransactionService.sanitizeValue('')).toBe('');
    });

    it('Rule D-6: treats null as blank', () => {
      expect(TransactionService.sanitizeValue(null)).toBe('');
    });

    it('Rule D-6: treats undefined as blank', () => {
      expect(TransactionService.sanitizeValue(undefined)).toBe('');
    });

    it('Rule D-6: returns string for normal value', () => {
      expect(TransactionService.sanitizeValue('hello')).toBe('hello');
    });
  });

  // =========================================================================
  // Sanitize Transaction (Rule D-7)
  // =========================================================================
  describe('sanitizeTransaction()', () => {
    it('Rule D-7: converts nullable numeric fields to 0', () => {
      const tx = makeTransaction({
        Quantity: null as unknown as number,
        'Unit Price': null as unknown as number,
        Discount: null as unknown as number,
        Adjustment: null as unknown as number,
        'Line Total': null as unknown as number,
      });

      const sanitized = TransactionService.sanitizeTransaction(tx);
      expect(sanitized.Quantity).toBe(0);
      expect(sanitized['Unit Price']).toBe(0);
      expect(sanitized.Discount).toBe(0);
      expect(sanitized.Adjustment).toBe(0);
      expect(sanitized['Line Total']).toBe(0);
    });

    it('Rule D-7: preserves existing numeric values', () => {
      const tx = makeTransaction({ Quantity: 5, 'Unit Price': 100 });
      const sanitized = TransactionService.sanitizeTransaction(tx);
      expect(sanitized.Quantity).toBe(5);
      expect(sanitized['Unit Price']).toBe(100);
    });
  });

  // =========================================================================
  // Statistics Calculation (Rules H-47, H-48)
  // =========================================================================
  describe('calculateStatistics()', () => {
    it('Rule H-47: excludes cancelled from revenue', () => {
      const data = [
        makeTransaction({ Quantity: 10, 'Unit Price': 100, 'Order Status': 'Shipped' }),
        makeTransaction({ Quantity: 5, 'Unit Price': 200, 'Order Status': 'Cancelled' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.totalRevenue).toBe(1000); // only Shipped: 10×100
    });

    it('Rule H-47: excludes forfeited and voided from revenue', () => {
      const data = [
        makeTransaction({ Quantity: 10, 'Unit Price': 100, 'Order Status': 'Shipped' }),
        makeTransaction({ Quantity: 5, 'Unit Price': 200, 'Order Status': 'Forfeited' }),
        makeTransaction({ Quantity: 3, 'Unit Price': 100, 'Order Status': 'Voided' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.totalRevenue).toBe(1000);
    });

    it('Rule H-48: counts total transactions (rows with customer or product)', () => {
      const data = [
        makeTransaction({ Customers: 'A', 'Product Code': 'PC-1' }),
        makeTransaction({ Customers: '', 'Product Code': '' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.totalTransactions).toBe(1);
    });

    it('Rule H-48: sums quantity across rows', () => {
      const data = [
        makeTransaction({ Quantity: 10 }),
        makeTransaction({ Quantity: 20 }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.totalQuantity).toBe(30);
    });

    it('Rule H-48: computes by-status totals', () => {
      const data = [
        makeTransaction({ 'Line Total': 500, 'Order Status': 'In Transit' }),
        makeTransaction({ 'Line Total': 300, 'Order Status': 'Warehouse' }),
        makeTransaction({ 'Line Total': 200, 'Order Status': 'Prepared' }),
        makeTransaction({ 'Line Total': 100, 'Order Status': 'Pending Payment' }),
        makeTransaction({ 'Line Total': 800, 'Order Status': 'Shipped' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.inTransitTotal).toBe(500);
      expect(stats.warehouseTotal).toBe(300);
      expect(stats.preparedTotal).toBe(200);
      expect(stats.pendingPaymentTotal).toBe(100);
      expect(stats.shippedOrders).toBe(1);
    });

    it('Rule H-48: unique customers count', () => {
      const data = [
        makeTransaction({ Customers: 'Alice' }),
        makeTransaction({ Customers: 'Bob' }),
        makeTransaction({ Customers: 'Alice' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.uniqueCustomers).toBe(2);
    });

    it('Rule H-48: lineTotalExcludingCancelled', () => {
      const data = [
        makeTransaction({ 'Line Total': 500, 'Order Status': 'Shipped' }),
        makeTransaction({ 'Line Total': 300, 'Order Status': 'Cancelled' }),
        makeTransaction({ 'Line Total': 200, 'Order Status': 'In Transit' }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.lineTotalExcludingCancelled).toBe(700);
    });

    it('Rule H-48: adjustment total', () => {
      const data = [
        makeTransaction({ Adjustment: 50 }),
        makeTransaction({ Adjustment: 30 }),
      ];

      const stats = TransactionService.calculateStatistics(data);
      expect(stats.adjustmentTotal).toBe(80);
    });
  });

  // =========================================================================
  // Sync Transactions with Shipment Status (Rule C-25)
  // =========================================================================
  describe('syncTransactionsWithShipmentStatus()', () => {
    it('Rule C-25: updates blank status to mapped status', () => {
      const txs = [makeTransaction({ 'Product Code': 'PC-1', 'Order Status': '' })];
      const statusMap = { 'PC-1': 'Delivered' };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(1);
      expect(updated[0]['Order Status']).toBe('Warehouse');
    });

    it('Rule C-25: does NOT override manual status (Shipped)', () => {
      const txs = [makeTransaction({ 'Product Code': 'PC-1', 'Order Status': 'Shipped' })];
      const statusMap = { 'PC-1': 'In Transit' };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(0);
      expect(updated[0]['Order Status']).toBe('Shipped');
    });

    it('Rule C-25: does NOT override Cancelled status', () => {
      const txs = [makeTransaction({ 'Product Code': 'PC-1', 'Order Status': 'Cancelled' })];
      const statusMap = { 'PC-1': 'Delivered' };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(0);
      expect(updated[0]['Order Status']).toBe('Cancelled');
    });

    it('Rule C-25: updates In Transit → Warehouse when shipment changes', () => {
      const txs = [makeTransaction({ 'Product Code': 'PC-1', 'Order Status': 'In Transit' })];
      const statusMap = { 'PC-1': 'For Pickup' };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(1);
      expect(updated[0]['Order Status']).toBe('Warehouse');
    });

    it('Rule C-25: skips rows without product code', () => {
      const txs = [makeTransaction({ 'Product Code': '', 'Order Status': '' })];
      const statusMap = { 'PC-1': 'Delivered' };

      const [, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(0);
    });

    it('Rule C-25: skips when shipment status not in map', () => {
      const txs = [makeTransaction({ 'Product Code': 'PC-1', 'Order Status': '' })];
      const statusMap = {};

      const [, count] = TransactionService.syncTransactionsWithShipmentStatus(txs, statusMap);
      expect(count).toBe(0);
    });
  });
});
