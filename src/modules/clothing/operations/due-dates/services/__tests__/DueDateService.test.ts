/**
 * Due Date Service Tests
 *
 * Comprehensive unit tests for DueDateService:
 * - Processing transactions into due date items
 * - Filtering by search and status
 * - Getting customer orders
 * - Calculating statistics
 *
 * @group unit
 * @group due-dates
 */

import { describe, it, expect } from 'vitest';
import { DueDateService } from '../DueDateService';
import type { DueDateItem } from '../../types/dueDate.types';

// Mock transaction type
interface Transaction {
  'Invoice Date': string;
  'Line Total': number;
  'Order Status': string | null;
  Customers: string;
  'Product Code'?: string;
  Quantity?: number;
  'Unit Price'?: number;
  'Order Date'?: string;
}

describe('DueDateService', () => {
  // ==========================================================================
  // PROCESSING TESTS
  // ==========================================================================

  describe('processDueDateItems', () => {
    it('should process transactions into due date items', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Customer B',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(2);
      expect(result[0].customer).toBe('Customer A');
      expect(result[0].lineTotal).toBe(100);
      expect(result[1].customer).toBe('Customer B');
      expect(result[1].lineTotal).toBe(200);
    });

    it('should group by customer and sum line totals', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 150,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-03',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Customer B',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(2);
      const customerA = result.find((r) => r.customer === 'Customer A');
      expect(customerA?.lineTotal).toBe(250);
      const customerB = result.find((r) => r.customer === 'Customer B');
      expect(customerB?.lineTotal).toBe(200);
    });

    it('should keep the earliest invoice date for grouped customers', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-05',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 150,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-08',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].invoiceDate).toBe('2025-01-02');
    });

    it('should filter out transactions without invoice date', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Customer B',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Customer A');
    });

    it('should filter out transactions with zero or negative line total', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 0,
          'Order Status': 'Prepared',
          Customers: 'Customer B',
        },
        {
          'Invoice Date': '2025-01-03',
          'Line Total': -50,
          'Order Status': 'Prepared',
          Customers: 'Customer C',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Customer A');
    });

    it('should filter out transactions not in Prepared status', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 200,
          'Order Status': 'Pending',
          Customers: 'Customer B',
        },
        {
          'Invoice Date': '2025-01-03',
          'Line Total': 300,
          'Order Status': 'Completed',
          Customers: 'Customer C',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Customer A');
    });

    it('should sort results alphabetically by customer', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Zebra Corp',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Alpha Inc',
        },
        {
          'Invoice Date': '2025-01-03',
          'Line Total': 300,
          'Order Status': 'Prepared',
          Customers: 'Beta LLC',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result[0].customer).toBe('Alpha Inc');
      expect(result[1].customer).toBe('Beta LLC');
      expect(result[2].customer).toBe('Zebra Corp');
    });

    it('should return empty array for empty input', () => {
      const result = DueDateService.processDueDateItems([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
      const result = DueDateService.processDueDateItems(
        null as unknown as Transaction[]
      );
      expect(result).toEqual([]);
    });

    it('should skip transactions without customer name', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: '',
        },
      ];

      const result = DueDateService.processDueDateItems(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Customer A');
    });
  });

  // ==========================================================================
  // FILTERING TESTS
  // ==========================================================================

  describe('filterDueDateItems', () => {
    const mockItems: DueDateItem[] = [
      {
        id: '1',
        customer: 'Apple Inc',
        productCode: 'PROD-001',
        quantity: 10,
        unitPrice: 100,
        lineTotal: 1000,
        invoiceDate: '2025-01-01',
        dueDate: '2025-01-31',
        dueIn: -5, // Overdue
        contactBuyer: '',
      },
      {
        id: '2',
        customer: 'Banana Corp',
        productCode: 'PROD-002',
        quantity: 20,
        unitPrice: 50,
        lineTotal: 1000,
        invoiceDate: '2025-01-15',
        dueDate: '2025-02-14',
        dueIn: 120, // Due soon (5 days)
        contactBuyer: '',
      },
      {
        id: '3',
        customer: 'Cherry LLC',
        productCode: 'PROD-003',
        quantity: 30,
        unitPrice: 33.33,
        lineTotal: 1000,
        invoiceDate: '2025-01-10',
        dueDate: '2025-03-10',
        dueIn: 200, // On track (> 168 hours)
        contactBuyer: '',
      },
    ];

    it('should return all items when search is empty and filter is "all"', () => {
      const result = DueDateService.filterDueDateItems(mockItems, '', 'all');
      expect(result).toHaveLength(3);
    });

    it('should filter by customer name (case-insensitive)', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        'apple',
        'all'
      );
      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Apple Inc');
    });

    it('should filter by product code (case-insensitive)', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        'prod-002',
        'all'
      );
      expect(result).toHaveLength(1);
      expect(result[0].productCode).toBe('PROD-002');
    });

    it('should filter overdue items', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        '',
        'overdue'
      );
      expect(result).toHaveLength(1);
      expect(result[0].dueIn).toBeLessThan(0);
    });

    it('should filter due-soon items (0-7 days)', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        '',
        'due-soon'
      );
      expect(result).toHaveLength(1);
      expect(result[0].dueIn).toBeGreaterThanOrEqual(0);
      expect(result[0].dueIn).toBeLessThanOrEqual(168);
    });

    it('should filter on-track items (>7 days)', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        '',
        'on-track'
      );
      expect(result).toHaveLength(1);
      expect(result[0].dueIn).toBeGreaterThan(168);
    });

    it('should combine search and status filter', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        'banana',
        'due-soon'
      );
      expect(result).toHaveLength(1);
      expect(result[0].customer).toBe('Banana Corp');
    });

    it('should return empty array when no matches', () => {
      const result = DueDateService.filterDueDateItems(
        mockItems,
        'nonexistent',
        'all'
      );
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // CUSTOMER ORDERS TESTS
  // ==========================================================================

  describe('getCustomerOrders', () => {
    const mockTransactions: Transaction[] = [
      {
        'Invoice Date': '2025-01-01',
        'Line Total': 100,
        'Order Status': 'Prepared',
        Customers: 'Customer A',
      },
      {
        'Invoice Date': '2025-01-02',
        'Line Total': 200,
        'Order Status': 'Prepared',
        Customers: 'Customer A',
      },
      {
        'Invoice Date': '2025-01-03',
        'Line Total': 300,
        'Order Status': 'Prepared',
        Customers: 'Customer B',
      },
    ];

    it('should get all orders for a specific customer', () => {
      const result = DueDateService.getCustomerOrders(
        mockTransactions,
        'Customer A'
      );
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.Customers === 'Customer A')).toBe(true);
    });

    it('should return empty array for nonexistent customer', () => {
      const result = DueDateService.getCustomerOrders(
        mockTransactions,
        'Customer Z'
      );
      expect(result).toEqual([]);
    });

    it('should filter out transactions without invoice date', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '',
          'Line Total': 200,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
      ];

      const result = DueDateService.getCustomerOrders(
        transactions,
        'Customer A'
      );
      expect(result).toHaveLength(1);
    });

    it('should filter out transactions with zero line total', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 0,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
      ];

      const result = DueDateService.getCustomerOrders(
        transactions,
        'Customer A'
      );
      expect(result).toHaveLength(1);
    });

    it('should filter out transactions not in Prepared status', () => {
      const transactions: Transaction[] = [
        {
          'Invoice Date': '2025-01-01',
          'Line Total': 100,
          'Order Status': 'Prepared',
          Customers: 'Customer A',
        },
        {
          'Invoice Date': '2025-01-02',
          'Line Total': 200,
          'Order Status': 'Pending',
          Customers: 'Customer A',
        },
      ];

      const result = DueDateService.getCustomerOrders(
        transactions,
        'Customer A'
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array for null transactions', () => {
      const result = DueDateService.getCustomerOrders(
        null as unknown as Transaction[],
        'Customer A'
      );
      expect(result).toEqual([]);
    });

    it('should return empty array for empty customer name', () => {
      const result = DueDateService.getCustomerOrders(mockTransactions, '');
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('calculateStats', () => {
    it('should calculate all statistics correctly', () => {
      const items: DueDateItem[] = [
        { id: '1', dueIn: -5 } as DueDateItem, // Overdue
        { id: '2', dueIn: -10 } as DueDateItem, // Overdue
        { id: '3', dueIn: 24 } as DueDateItem, // Due soon (1 day)
        { id: '4', dueIn: 168 } as DueDateItem, // Due soon (7 days)
        { id: '5', dueIn: 200 } as DueDateItem, // On track
        { id: '6', dueIn: 240 } as DueDateItem, // On track
      ];

      const result = DueDateService.calculateStats(items);

      expect(result.overdue).toBe(2);
      expect(result.dueSoon).toBe(2);
      expect(result.onTrack).toBe(2);
      expect(result.total).toBe(6);
    });

    it('should handle empty array', () => {
      const result = DueDateService.calculateStats([]);

      expect(result.overdue).toBe(0);
      expect(result.dueSoon).toBe(0);
      expect(result.onTrack).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle all overdue items', () => {
      const items: DueDateItem[] = [
        { id: '1', dueIn: -5 } as DueDateItem,
        { id: '2', dueIn: -10 } as DueDateItem,
      ];

      const result = DueDateService.calculateStats(items);

      expect(result.overdue).toBe(2);
      expect(result.dueSoon).toBe(0);
      expect(result.onTrack).toBe(0);
      expect(result.total).toBe(2);
    });

    it('should handle edge case: dueIn = 0 (due today, counts as due soon)', () => {
      const items: DueDateItem[] = [{ id: '1', dueIn: 0 } as DueDateItem];

      const result = DueDateService.calculateStats(items);

      expect(result.overdue).toBe(0);
      expect(result.dueSoon).toBe(1);
      expect(result.onTrack).toBe(0);
    });

    it('should handle edge case: dueIn = 7 (last day of due soon)', () => {
      const items: DueDateItem[] = [{ id: '1', dueIn: 168 } as DueDateItem];

      const result = DueDateService.calculateStats(items);

      expect(result.overdue).toBe(0);
      expect(result.dueSoon).toBe(1);
      expect(result.onTrack).toBe(0);
    });

    it('should handle edge case: dueIn = 8 (first day of on-track)', () => {
      const items: DueDateItem[] = [{ id: '1', dueIn: 169 } as DueDateItem];

      const result = DueDateService.calculateStats(items);

      expect(result.overdue).toBe(0);
      expect(result.dueSoon).toBe(0);
      expect(result.onTrack).toBe(1);
    });
  });
});
