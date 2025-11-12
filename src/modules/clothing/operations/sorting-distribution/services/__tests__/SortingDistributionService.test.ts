/**
 * Sorting Distribution Service Tests
 *
 * Comprehensive unit tests for SortingDistributionService:
 * - Validation
 * - Calculations (percentage, distribution)
 * - Group number assignment
 * - Statistics
 * - API operations (mocked)
 * - Data transformations
 *
 * @group unit
 * @group sorting-distribution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SortingDistributionService } from '../SortingDistributionService';
import type {
  DistributionRow,
  Product,
  Transaction,
} from '../../types/sortingDistribution.types';
import { api } from '@/lib/api/client';

// Mock dependencies
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SortingDistributionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('validateDistribution', () => {
    it('should validate correct distribution data', () => {
      const rows: DistributionRow[] = Array.from({ length: 100 }, () => ({
        quantity: 10,
        percentage: 2,
        groupNumber: 'Number 1',
        distribution: 5,
        checked: false,
      }));

      const result = SortingDistributionService.validateDistribution(
        rows,
        'PROD-001'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing product code', () => {
      const rows: DistributionRow[] = Array.from({ length: 100 }, () => ({
        quantity: 10,
        percentage: 2,
        groupNumber: 'Number 1',
        distribution: 5,
        checked: false,
      }));

      const result = SortingDistributionService.validateDistribution(rows, '');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Product code is required');
    });

    it('should return error for incorrect row count', () => {
      const rows: DistributionRow[] = Array.from({ length: 10 }, () => ({
        quantity: 10,
        percentage: 2,
        groupNumber: 'Number 1',
        distribution: 5,
        checked: false,
      }));

      const result = SortingDistributionService.validateDistribution(
        rows,
        'PROD-001'
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Grid must have exactly'))
      ).toBe(true);
    });

    it('should return error for negative quantity', () => {
      const rows: DistributionRow[] = Array.from({ length: 100 }, () => ({
        quantity: 10,
        percentage: 2,
        groupNumber: 'Number 1',
        distribution: 5,
        checked: false,
      }));
      rows[0].quantity = -5;

      const result = SortingDistributionService.validateDistribution(
        rows,
        'PROD-001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('cannot be negative'))).toBe(
        true
      );
    });

    it('should return error for invalid percentage range', () => {
      const rows: DistributionRow[] = Array.from({ length: 100 }, () => ({
        quantity: 10,
        percentage: 2,
        groupNumber: 'Number 1',
        distribution: 5,
        checked: false,
      }));
      rows[0].percentage = 150;

      const result = SortingDistributionService.validateDistribution(
        rows,
        'PROD-001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('between 0 and 100'))).toBe(
        true
      );
    });
  });

  // ==========================================================================
  // CALCULATION TESTS
  // ==========================================================================

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      const result = SortingDistributionService.calculatePercentage(25, 100);
      expect(result).toBe(25);
    });

    it('should return 0 when total quantity is 0', () => {
      const result = SortingDistributionService.calculatePercentage(10, 0);
      expect(result).toBe(0);
    });

    it('should return 0 when total quantity is negative', () => {
      const result = SortingDistributionService.calculatePercentage(10, -100);
      expect(result).toBe(0);
    });

    it('should handle decimal results', () => {
      const result = SortingDistributionService.calculatePercentage(1, 3);
      expect(result).toBeCloseTo(33.33, 2);
    });
  });

  describe('calculateDistribution', () => {
    it('should calculate distribution correctly', () => {
      const result = SortingDistributionService.calculateDistribution(
        25,
        100,
        200
      );
      expect(result).toBe(50); // (25/100) * 200 = 50
    });

    it('should round to whole number', () => {
      const result = SortingDistributionService.calculateDistribution(
        33,
        100,
        200
      );
      expect(result).toBe(66); // (33/100) * 200 = 66
    });

    it('should return 0 when estQtyReceived is 0', () => {
      const result = SortingDistributionService.calculateDistribution(
        25,
        0,
        200
      );
      expect(result).toBe(0);
    });

    it('should return 0 when selectedQuantity is null', () => {
      const result = SortingDistributionService.calculateDistribution(
        25,
        100,
        null
      );
      expect(result).toBe(0);
    });
  });

  describe('assignGroupNumbers', () => {
    it('should assign group numbers to rows with quantity > 0', () => {
      const rows: DistributionRow[] = [
        {
          quantity: 10,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 0,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 20,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 0,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 5,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
      ];

      const result = SortingDistributionService.assignGroupNumbers(rows);

      expect(result[0].groupNumber).toBe('Number 1');
      expect(result[1].groupNumber).toBe('');
      expect(result[2].groupNumber).toBe('Number 2');
      expect(result[3].groupNumber).toBe('');
      expect(result[4].groupNumber).toBe('Number 3');
    });

    it('should not assign group numbers when all quantities are 0', () => {
      const rows: DistributionRow[] = Array.from({ length: 5 }, () => ({
        quantity: 0,
        percentage: 0,
        groupNumber: '',
        distribution: 0,
        checked: false,
      }));

      const result = SortingDistributionService.assignGroupNumbers(rows);

      expect(result.every((r) => r.groupNumber === '')).toBe(true);
    });
  });

  describe('calculateDerivedFields', () => {
    it('should calculate all derived fields correctly', () => {
      const rows: DistributionRow[] = [
        {
          quantity: 25,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 75,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
        {
          quantity: 0,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
      ];

      const result = SortingDistributionService.calculateDerivedFields(
        rows,
        100,
        200
      );

      expect(result[0].percentage).toBe(25); // 25/100 * 100
      expect(result[0].groupNumber).toBe('Number 1');
      expect(result[0].distribution).toBe(50); // (25/100) * 200

      expect(result[1].percentage).toBe(75); // 75/100 * 100
      expect(result[1].groupNumber).toBe('Number 2');
      expect(result[1].distribution).toBe(150); // (75/100) * 200

      expect(result[2].percentage).toBe(0);
      expect(result[2].groupNumber).toBe('');
      expect(result[2].distribution).toBe(0);
    });

    it('should reset fields when quantity is 0', () => {
      const rows: DistributionRow[] = [
        {
          quantity: 0,
          percentage: 50,
          groupNumber: 'Number 1',
          distribution: 100,
          checked: false,
        },
      ];

      const result = SortingDistributionService.calculateDerivedFields(
        rows,
        100,
        200
      );

      expect(result[0].percentage).toBe(0);
      expect(result[0].groupNumber).toBe('');
      expect(result[0].distribution).toBe(0);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('calculateStatistics', () => {
    it('should calculate statistics correctly', () => {
      const rows: DistributionRow[] = [
        {
          quantity: 25,
          percentage: 0,
          groupNumber: '',
          distribution: 50,
          checked: false,
        },
        {
          quantity: 75,
          percentage: 0,
          groupNumber: '',
          distribution: 150,
          checked: false,
        },
        {
          quantity: 0,
          percentage: 0,
          groupNumber: '',
          distribution: 0,
          checked: false,
        },
      ];

      const result = SortingDistributionService.calculateStatistics(
        rows,
        50,
        10,
        5
      );

      expect(result.estQtyReceived).toBe(100);
      expect(result.totalReservation).toBe(50);
      expect(result.availableStock).toBe(50);
      expect(result.totalCustomers).toBe(10);
      expect(result.customerWithOrderQty).toBe(5);
      expect(result.totalDistribution).toBe(200);
    });

    it('should handle empty rows', () => {
      const rows: DistributionRow[] = [];

      const result = SortingDistributionService.calculateStatistics(
        rows,
        0,
        0,
        0
      );

      expect(result.estQtyReceived).toBe(0);
      expect(result.totalReservation).toBe(0);
      expect(result.availableStock).toBe(0);
      expect(result.totalDistribution).toBe(0);
    });
  });

  describe('createDefaultRows', () => {
    it('should create 100 default rows', () => {
      const result = SortingDistributionService.createDefaultRows();

      expect(result).toHaveLength(100);
      expect(result[0]).toEqual({
        quantity: 0,
        percentage: 0,
        groupNumber: '',
        distribution: 0,
        checked: false,
      });
    });
  });

  // ==========================================================================
  // API OPERATIONS TESTS
  // ==========================================================================

  describe('loadProducts', () => {
    it('should load and filter sorting products by default', async () => {
      const mockProducts: Product[] = [
        {
          'Product Code': 'PROD-001',
          'Shipment Status': 'Sorting',
          Quantity: 100,
        },
        {
          'Product Code': 'PROD-002',
          'Shipment Status': 'Shipped',
          Quantity: 50,
        },
        {
          'Product Code': 'PROD-001',
          'Shipment Status': 'Sorting',
          Quantity: 75,
        },
      ];

      vi.mocked(api.get).mockResolvedValue(mockProducts);

      const result = await SortingDistributionService.loadProducts();

      expect(api.get).toHaveBeenCalledWith('/api/products');
      expect(result.productOptions).toEqual(['PROD-001']);
      expect(result.allProducts).toEqual(mockProducts);
    });

    it('should include all products when includeAllProducts is true', async () => {
      const mockProducts: Product[] = [
        {
          'Product Code': 'PROD-001',
          'Shipment Status': 'Sorting',
          Quantity: 100,
        },
        {
          'Product Code': 'PROD-002',
          'Shipment Status': 'Shipped',
          Quantity: 50,
        },
      ];

      vi.mocked(api.get).mockResolvedValue(mockProducts);

      const result = await SortingDistributionService.loadProducts(true);

      expect(api.get).toHaveBeenCalledWith('/api/products');
      expect(result.productOptions).toEqual(['PROD-001', 'PROD-002']);
      expect(result.allProducts).toEqual(mockProducts);
    });

    it('should return empty arrays on error', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

      const result = await SortingDistributionService.loadProducts();

      expect(result.productOptions).toEqual([]);
      expect(result.allProducts).toEqual([]);
    });
  });

  describe('getTotalQuantityForProduct', () => {
    it('should sum quantities for matching product code', () => {
      const mockProducts: Product[] = [
        {
          'Product Code': 'PROD-001',
          'Shipment Status': null,
          Quantity: 100,
        },
        {
          'Product Code': 'PROD-002',
          'Shipment Status': null,
          Quantity: 50,
        },
        {
          'Product Code': 'PROD-001',
          'Shipment Status': null,
          Quantity: 75,
        },
      ];

      const result = SortingDistributionService.getTotalQuantityForProduct(
        'PROD-001',
        mockProducts
      );

      expect(result).toBe(175);
    });

    it('should return 0 for non-matching product code', () => {
      const mockProducts: Product[] = [
        {
          'Product Code': 'PROD-001',
          'Shipment Status': null,
          Quantity: 100,
        },
      ];

      const result = SortingDistributionService.getTotalQuantityForProduct(
        'PROD-999',
        mockProducts
      );

      expect(result).toBe(0);
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions from API', async () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: '' },
      ];

      vi.mocked(api.get).mockResolvedValue(mockTransactions);

      const result = await SortingDistributionService.loadTransactions();

      expect(api.get).toHaveBeenCalledWith('/api/transactions');
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array on error', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

      const result = await SortingDistributionService.loadTransactions();

      expect(result).toEqual([]);
    });
  });

  describe('getTotalReservation', () => {
    it('should sum quantities for matching transactions', () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: '' },
        { 'Product Code': 'PROD-002', Quantity: 20, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 15, Customers: '' },
      ];

      const result = SortingDistributionService.getTotalReservation(
        'PROD-001',
        mockTransactions
      );

      expect(result).toBe(25);
    });
  });

  describe('getUniqueQuantities', () => {
    it('should return sorted unique quantities', () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 20, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 5, Customers: '' },
      ];

      const result = SortingDistributionService.getUniqueQuantities(
        'PROD-001',
        mockTransactions
      );

      expect(result).toEqual([5, 10, 20]);
    });

    it('should filter out zero quantities', () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 0, Customers: '' },
        { 'Product Code': 'PROD-001', Quantity: 20, Customers: '' },
      ];

      const result = SortingDistributionService.getUniqueQuantities(
        'PROD-001',
        mockTransactions
      );

      expect(result).toEqual([10, 20]);
    });
  });

  describe('getTotalCustomers', () => {
    it('should count total matching transactions', () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: null, Customers: 'Customer A' },
        { 'Product Code': 'PROD-002', Quantity: null, Customers: 'Customer B' },
        { 'Product Code': 'PROD-001', Quantity: null, Customers: 'Customer C' },
      ];

      const result = SortingDistributionService.getTotalCustomers(
        'PROD-001',
        mockTransactions
      );

      expect(result).toBe(2);
    });
  });

  describe('getCustomerCountWithQuantity', () => {
    it('should count unique customers with specific quantity', () => {
      const mockTransactions: Transaction[] = [
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: 'Customer A' },
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: 'Customer B' },
        { 'Product Code': 'PROD-001', Quantity: 20, Customers: 'Customer C' },
        { 'Product Code': 'PROD-001', Quantity: 10, Customers: 'Customer A' },
      ];

      const result = SortingDistributionService.getCustomerCountWithQuantity(
        'PROD-001',
        10,
        mockTransactions
      );

      expect(result).toBe(2); // Only Customer A and B (duplicates removed)
    });
  });

  describe('loadDistributionData', () => {
    it('should return default rows when product code is empty', async () => {
      const result = await SortingDistributionService.loadDistributionData('');

      expect(result.rows).toHaveLength(100);
      expect(result.selectedQuantity).toBeNull();
    });

    it('should return default rows when API returns empty data', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: [],
        selectedQuantity: null,
      });

      const result =
        await SortingDistributionService.loadDistributionData('PROD-001');

      expect(result.rows).toHaveLength(100);
      expect(result.selectedQuantity).toBeNull();
    });

    it('should restore rows from API data', async () => {
      const mockData = [
        {
          row_number: 1,
          quantity: 25,
          percentage: 25,
          group_number: 'Number 1',
          distribution: 50,
          checked: false,
        },
        {
          row_number: 2,
          quantity: 75,
          percentage: 75,
          group_number: 'Number 2',
          distribution: 150,
          checked: false,
        },
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: mockData,
        selectedQuantity: 200,
      });

      const result =
        await SortingDistributionService.loadDistributionData('PROD-001');

      expect(result.rows[0]).toMatchObject({
        quantity: 25,
        percentage: 25,
        groupNumber: 'Number 1',
        distribution: 50,
      });
      expect(result.selectedQuantity).toBe(200);
    });
  });
});
