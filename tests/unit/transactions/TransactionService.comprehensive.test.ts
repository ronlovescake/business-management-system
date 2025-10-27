/**
 * Comprehensive Test Suite for TransactionService
 *
 * This test suite covers all public methods of TransactionService with
 * edge cases, error handling, and business logic validation.
 */

import { describe, it, expect } from 'vitest';
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import type {
  TransactionData,
  PriceTier,
} from '@/modules/clothing/operations/transactions/types/transaction.types';

describe('TransactionService - Comprehensive Tests', () => {
  // ============================================================================
  // VALUE SANITIZATION TESTS
  // ============================================================================

  describe('sanitizeValue', () => {
    it('should return empty string for null', () => {
      expect(TransactionService.sanitizeValue(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(TransactionService.sanitizeValue(undefined)).toBe('');
    });

    it('should return empty string for "null" string', () => {
      expect(TransactionService.sanitizeValue('null')).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(TransactionService.sanitizeValue('')).toBe('');
    });

    it('should convert non-null values to string', () => {
      expect(TransactionService.sanitizeValue(123)).toBe('123');
      expect(TransactionService.sanitizeValue('test')).toBe('test');
      expect(TransactionService.sanitizeValue(true)).toBe('true');
    });
  });

  describe('sanitizeNumericValue', () => {
    it('should return empty string for null', () => {
      expect(TransactionService.sanitizeNumericValue(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(TransactionService.sanitizeNumericValue(undefined)).toBe('');
    });

    it('should return empty string for "null" string', () => {
      expect(TransactionService.sanitizeNumericValue('null')).toBe('');
    });

    it('should return empty string for 0', () => {
      expect(TransactionService.sanitizeNumericValue(0)).toBe('');
      expect(TransactionService.sanitizeNumericValue('0')).toBe('');
    });

    it('should convert non-zero numeric values to string', () => {
      expect(TransactionService.sanitizeNumericValue(123)).toBe('123');
      expect(TransactionService.sanitizeNumericValue('456')).toBe('456');
      expect(TransactionService.sanitizeNumericValue(-10)).toBe('-10');
    });
  });

  // ============================================================================
  // UNIT PRICE CALCULATION TESTS
  // ============================================================================

  describe('getUnitPriceForQuantity', () => {
    const mockPriceTiers: PriceTier[] = [
      {
        'Product Code': 'PROD001',
        'Lower Limit': 1,
        'Upper Limit': 10,
        Prices: 100,
      },
      {
        'Product Code': 'PROD001',
        'Lower Limit': 11,
        'Upper Limit': 50,
        Prices: 90,
      },
      {
        'Product Code': 'PROD001',
        'Lower Limit': 51,
        'Upper Limit': 999999,
        Prices: 80,
      },
      {
        'Product Code': 'PROD002',
        'Lower Limit': 1,
        'Upper Limit': 100,
        Prices: 50,
      },
    ];

    it('should return correct tier price for quantity within first tier', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD001',
        5,
        mockPriceTiers
      );
      expect(price).toBe(100);
    });

    it('should return correct tier price for quantity within second tier', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD001',
        25,
        mockPriceTiers
      );
      expect(price).toBe(90);
    });

    it('should return correct tier price for quantity within third tier', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD001',
        100,
        mockPriceTiers
      );
      expect(price).toBe(80);
    });

    it('should return null for product code not found', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'UNKNOWN',
        5,
        mockPriceTiers
      );
      expect(price).toBeNull();
    });

    it('should return null for quantity 0', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD001',
        0,
        mockPriceTiers
      );
      expect(price).toBeNull();
    });

    it('should return null for negative quantity', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD001',
        -5,
        mockPriceTiers
      );
      expect(price).toBeNull();
    });

    it('should return null for empty product code', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        '',
        5,
        mockPriceTiers
      );
      expect(price).toBeNull();
    });

    it('should handle different product codes', () => {
      const price = TransactionService.getUnitPriceForQuantity(
        'PROD002',
        10,
        mockPriceTiers
      );
      expect(price).toBe(50);
    });
  });

  describe('calculateUnitPrice', () => {
    const mockPriceTiers: PriceTier[] = [
      {
        'Product Code': 'PROD001',
        'Lower Limit': 1,
        'Upper Limit': 10,
        Prices: 100,
      },
    ];

    it('should calculate unit price with discount (Tier Price - Discount)', () => {
      const unitPrice = TransactionService.calculateUnitPrice(
        'PROD001',
        5,
        10,
        mockPriceTiers
      );
      expect(unitPrice).toBe(90); // 100 - 10
    });

    it('should return 0 when tier price not found', () => {
      const unitPrice = TransactionService.calculateUnitPrice(
        'UNKNOWN',
        5,
        10,
        mockPriceTiers
      );
      expect(unitPrice).toBe(0);
    });

    it('should handle zero discount', () => {
      const unitPrice = TransactionService.calculateUnitPrice(
        'PROD001',
        5,
        0,
        mockPriceTiers
      );
      expect(unitPrice).toBe(100);
    });

    it('should handle discount larger than tier price', () => {
      const unitPrice = TransactionService.calculateUnitPrice(
        'PROD001',
        5,
        150,
        mockPriceTiers
      );
      expect(unitPrice).toBe(-50); // Business decision: allow negative
    });
  });

  // ============================================================================
  // LINE TOTAL CALCULATION TESTS
  // ============================================================================

  describe('calculateLineTotal', () => {
    it('should calculate line total: (Quantity × Unit Price) - Adjustment', () => {
      const lineTotal = TransactionService.calculateLineTotal(10, 50, 20);
      expect(lineTotal).toBe(480); // (10 × 50) - 20 = 480
    });

    it('should handle zero adjustment', () => {
      const lineTotal = TransactionService.calculateLineTotal(10, 50, 0);
      expect(lineTotal).toBe(500);
    });

    it('should handle zero quantity', () => {
      const lineTotal = TransactionService.calculateLineTotal(0, 50, 10);
      expect(lineTotal).toBe(-10); // 0 - 10
    });

    it('should handle zero unit price', () => {
      const lineTotal = TransactionService.calculateLineTotal(10, 0, 5);
      expect(lineTotal).toBe(-5);
    });

    it('should handle fractional quantities', () => {
      const lineTotal = TransactionService.calculateLineTotal(2.5, 100, 50);
      expect(lineTotal).toBe(200); // (2.5 × 100) - 50
    });

    it('should handle large numbers', () => {
      const lineTotal = TransactionService.calculateLineTotal(1000, 999.99, 100);
      expect(lineTotal).toBeCloseTo(999890, 2);
    });
  });

  // ============================================================================
  // ORDER STATUS LOGIC TESTS
  // ============================================================================

  describe('getOrderStatusFromShipmentStatus', () => {
    it('should return "In Transit" for blank shipment status', () => {
      expect(TransactionService.getOrderStatusFromShipmentStatus('')).toBe(
        'In Transit'
      );
      expect(TransactionService.getOrderStatusFromShipmentStatus('   ')).toBe(
        'In Transit'
      );
    });

    it('should return "In Transit" for "In Transit" shipment status', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('In Transit')
      ).toBe('In Transit');
    });

    it('should return "In Transit" for "Manila Port"', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('Manila Port')
      ).toBe('In Transit');
    });

    it('should return "In Transit" for "With Pier Gatepass"', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('With Pier Gatepass')
      ).toBe('In Transit');
    });

    it('should return "In Transit" for "PH Warehouse"', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('PH Warehouse')
      ).toBe('In Transit');
    });

    it('should return "Warehouse" for "For Pickup"', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('For Pickup')
      ).toBe('Warehouse');
    });

    it('should return "Warehouse" for "Sorting"', () => {
      expect(TransactionService.getOrderStatusFromShipmentStatus('Sorting')).toBe(
        'Warehouse'
      );
    });

    it('should return "Warehouse" for "Delivered"', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('Delivered')
      ).toBe('Warehouse');
    });

    it('should return "In Transit" for unknown shipment status (default)', () => {
      expect(
        TransactionService.getOrderStatusFromShipmentStatus('Unknown Status')
      ).toBe('In Transit');
    });
  });

  // ============================================================================
  // DATA SANITIZATION TESTS
  // ============================================================================

  describe('sanitizeTransaction', () => {
    it('should convert null numeric fields to 0', () => {
      const transaction: TransactionData = {
        id: 1,
        'Order Date': '2025-01-01',
        Customers: 'Test Customer',
        'Product Code': 'PROD001',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'In Transit',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      };

      const sanitized = TransactionService.sanitizeTransaction(transaction);

      expect(sanitized.Quantity).toBe(0);
      expect(sanitized['Unit Price']).toBe(0);
      expect(sanitized.Discount).toBe(0);
      expect(sanitized.Adjustment).toBe(0);
      expect(sanitized['Line Total']).toBe(0);
    });

    it('should preserve existing numeric values', () => {
      const transaction: TransactionData = {
        id: 1,
        'Order Date': '2025-01-01',
        Customers: 'Test Customer',
        'Product Code': 'PROD001',
        Quantity: 10,
        'Unit Price': 50,
        Discount: 5,
        Adjustment: 2,
        'Line Total': 480,
        'Order Status': 'In Transit',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      };

      const sanitized = TransactionService.sanitizeTransaction(transaction);

      expect(sanitized.Quantity).toBe(10);
      expect(sanitized['Unit Price']).toBe(50);
      expect(sanitized.Discount).toBe(5);
      expect(sanitized.Adjustment).toBe(2);
      expect(sanitized['Line Total']).toBe(480);
    });

    it('should preserve string fields', () => {
      const transaction: TransactionData = {
        id: 1,
        'Order Date': '2025-01-01',
        Customers: 'Test Customer',
        'Product Code': 'PROD001',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Warehouse',
        Notes: 'Test notes',
        'Invoice Date': '2025-01-15',
        'Packed Date': '2025-01-16',
        'Shipment Code': 'SHIP001',
      };

      const sanitized = TransactionService.sanitizeTransaction(transaction);

      expect(sanitized['Order Date']).toBe('2025-01-01');
      expect(sanitized.Customers).toBe('Test Customer');
      expect(sanitized['Product Code']).toBe('PROD001');
      expect(sanitized['Order Status']).toBe('Warehouse');
      expect(sanitized.Notes).toBe('Test notes');
      expect(sanitized['Invoice Date']).toBe('2025-01-15');
      expect(sanitized['Packed Date']).toBe('2025-01-16');
      expect(sanitized['Shipment Code']).toBe('SHIP001');
    });
  });

  describe('sanitizeTransactions', () => {
    it('should sanitize array of transactions', () => {
      const transactions: TransactionData[] = [
        {
          id: 1,
          'Order Date': '2025-01-01',
          Customers: 'Customer 1',
          'Product Code': 'PROD001',
          Quantity: null,
          'Unit Price': 50,
          Discount: null,
          Adjustment: null,
          'Line Total': null,
          'Order Status': '',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '-',
        },
        {
          id: 2,
          'Order Date': '2025-01-02',
          Customers: 'Customer 2',
          'Product Code': 'PROD002',
          Quantity: 10,
          'Unit Price': null,
          Discount: 5,
          Adjustment: null,
          'Line Total': null,
          'Order Status': '',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '-',
        },
      ];

      const sanitized = TransactionService.sanitizeTransactions(transactions);

      expect(sanitized).toHaveLength(2);
      expect(sanitized[0].Quantity).toBe(0);
      expect(sanitized[0]['Unit Price']).toBe(50);
      expect(sanitized[1].Quantity).toBe(10);
      expect(sanitized[1]['Unit Price']).toBe(0);
    });

    it('should handle empty array', () => {
      const sanitized = TransactionService.sanitizeTransactions([]);
      expect(sanitized).toEqual([]);
    });
  });

  // ============================================================================
  // STATISTICS CALCULATION TESTS
  // ============================================================================

  describe('calculateStatistics', () => {
    const mockTransactions: TransactionData[] = [
      {
        id: 1,
        'Order Date': '2025-01-01',
        Customers: 'Customer A',
        'Product Code': 'PROD001',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 1000,
        'Order Status': 'In Transit',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      },
      {
        id: 2,
        'Order Date': '2025-01-02',
        Customers: 'Customer B',
        'Product Code': 'PROD002',
        Quantity: 5,
        'Unit Price': 200,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 1000,
        'Order Status': 'Warehouse',
        'Notes': '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      },
      {
        id: 3,
        'Order Date': '2025-01-03',
        Customers: 'Customer A',
        'Product Code': 'PROD003',
        Quantity: 20,
        'Unit Price': 50,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 1000,
        'Order Status': 'cancelled',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      },
    ];

    it('should calculate total transactions count', () => {
      const stats = TransactionService.calculateStatistics(mockTransactions);
      expect(stats.totalTransactions).toBe(3);
    });

    it('should calculate total revenue excluding cancelled orders', () => {
      const stats = TransactionService.calculateStatistics(mockTransactions);
      // (10 × 100) + (5 × 200) = 2000 (cancelled order excluded)
      expect(stats.totalRevenue).toBe(2000);
    });

    it('should calculate in transit total', () => {
      const stats = TransactionService.calculateStatistics(mockTransactions);
      expect(stats.inTransitTotal).toBe(1000);
    });

    it('should calculate warehouse total', () => {
      const stats = TransactionService.calculateStatistics(mockTransactions);
      expect(stats.warehouseTotal).toBe(1000);
    });

    it('should count unique customers', () => {
      const stats = TransactionService.calculateStatistics(mockTransactions);
      expect(stats.uniqueCustomers).toBe(2); // Customer A and Customer B
    });

    it('should handle empty transactions array', () => {
      const stats = TransactionService.calculateStatistics([]);
      expect(stats.totalTransactions).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.uniqueCustomers).toBe(0);
    });
  });

  // ============================================================================
  // TRANSACTION SYNC TESTS
  // ============================================================================

  describe('syncTransactionsWithShipmentStatus', () => {
    it('should update "In Transit" orders based on shipment status', () => {
      const transactions: TransactionData[] = [
        {
          id: 1,
          'Order Date': '2025-01-01',
          Customers: 'Customer A',
          'Product Code': 'PROD001',
          Quantity: 10,
          'Unit Price': 100,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 1000,
          'Order Status': 'In Transit',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': 'SHIP001',
        },
      ];

      const statusMap = {
        PROD001: 'For Pickup', // Should change to "Warehouse"
      };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(
        transactions,
        statusMap
      );

      expect(count).toBe(1);
      expect(updated[0]['Order Status']).toBe('Warehouse');
    });

    it('should not update manual order statuses', () => {
      const transactions: TransactionData[] = [
        {
          id: 1,
          'Order Date': '2025-01-01',
          Customers: 'Customer A',
          'Product Code': 'PROD001',
          Quantity: 10,
          'Unit Price': 100,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 1000,
          'Order Status': 'Prepared', // Manual status, should not change
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': 'SHIP001',
        },
      ];

      const statusMap = {
        PROD001: 'For Pickup',
      };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(
        transactions,
        statusMap
      );

      expect(count).toBe(0);
      expect(updated[0]['Order Status']).toBe('Prepared'); // Unchanged
    });

    it('should handle transactions without product code', () => {
      const transactions: TransactionData[] = [
        {
          id: 1,
          'Order Date': '2025-01-01',
          Customers: 'Customer A',
          'Product Code': '',
          Quantity: 10,
          'Unit Price': 100,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 1000,
          'Order Status': 'In Transit',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '-',
        },
      ];

      const statusMap = {
        PROD001: 'For Pickup',
      };

      const [updated, count] = TransactionService.syncTransactionsWithShipmentStatus(
        transactions,
        statusMap
      );

      expect(count).toBe(0);
      expect(updated[0]['Order Status']).toBe('In Transit'); // Unchanged
    });
  });

  // ============================================================================
  // CSV PARSING TESTS
  // ============================================================================

  describe('parseCSVLine', () => {
    it('should parse simple CSV line', () => {
      const result = TransactionService.parseCSVLine('field1,field2,field3');
      expect(result).toEqual(['field1', 'field2', 'field3']);
    });

    it('should handle quoted fields', () => {
      const result = TransactionService.parseCSVLine('"field1","field2","field3"');
      expect(result).toEqual(['field1', 'field2', 'field3']);
    });

    it('should handle commas inside quotes', () => {
      const result = TransactionService.parseCSVLine('"field1,with,commas",field2,field3');
      expect(result).toEqual(['field1,with,commas', 'field2', 'field3']);
    });

    it('should trim whitespace', () => {
      const result = TransactionService.parseCSVLine('  field1  ,  field2  ,  field3  ');
      expect(result).toEqual(['field1', 'field2', 'field3']);
    });
  });

  // ============================================================================
  // EMPTY ROWS GENERATION TESTS
  // ============================================================================

  describe('generateEmptyRows', () => {
    it('should generate specified number of empty rows', () => {
      const rows = TransactionService.generateEmptyRows(5);
      expect(rows).toHaveLength(5);
    });

    it('should have unique IDs', () => {
      const rows = TransactionService.generateEmptyRows(10);
      const ids = rows.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should initialize with empty/null values', () => {
      const rows = TransactionService.generateEmptyRows(1);
      const row = rows[0];
      
      expect(row['Order Date']).toBe('');
      expect(row.Customers).toBe('');
      expect(row['Product Code']).toBe('');
      expect(row.Quantity).toBeNull();
      expect(row['Unit Price']).toBeNull();
      expect(row.Discount).toBeNull();
      expect(row.Adjustment).toBeNull();
      expect(row['Line Total']).toBeNull();
      expect(row['Order Status']).toBe('');
      expect(row.Notes).toBe('');
      expect(row['Shipment Code']).toBe('-');
    });

    it('should handle zero count', () => {
      const rows = TransactionService.generateEmptyRows(0);
      expect(rows).toHaveLength(0);
    });
  });
});
