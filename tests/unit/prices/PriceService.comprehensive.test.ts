/**
 * Comprehensive Tests for Price Service
 * Tests validation, tier pricing, bulk adjustments, CSV import, and statistics
 */

import { describe, it, expect } from 'vitest';
import { PriceService } from '@/modules/clothing/operations/prices/services/PriceService';
import type { PriceData, PriceFormData, BulkAdjustmentConfig } from '@/modules/clothing/operations/prices/types/price.types';

describe('Price Service', () => {
  describe('Price Validation', () => {
    it('should require product code', () => {
      const form: PriceFormData = {
        productCode: '',
        tiers: [
          { lowerLimit: 1, upperLimit: 10, price: 100 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Product code is required');
    });

    it('should require at least one tier', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one pricing tier is required');
    });

    it('should validate tier completeness', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 1, upperLimit: 0, price: 100 }, // Missing upper limit
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Upper limit is required'))).toBe(true);
    });

    it('should validate lower limit < upper limit', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 10, upperLimit: 5, price: 100 }, // Invalid range
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Lower limit must be less than upper limit'))).toBe(true);
    });

    it('should validate tier ordering', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 1, upperLimit: 10, price: 100 },
          { lowerLimit: 1, upperLimit: 20, price: 90 }, // Same lower limit as tier 1
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Lower limit must be greater than previous tier'))).toBe(true);
    });

    it('should accept valid price with single tier', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 1, upperLimit: 100, price: 150 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid price with multiple tiers', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 1, upperLimit: 10, price: 150 },
          { lowerLimit: 11, upperLimit: 50, price: 140 },
          { lowerLimit: 51, upperLimit: 100, price: 130 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const result = PriceService.validatePrice(form);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Form Conversion', () => {
    it('should convert form to price data', () => {
      const form: PriceFormData = {
        productCode: 'TEST001',
        tiers: [
          { lowerLimit: 1, upperLimit: 100, price: 150 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 10,
      };

      const price = PriceService.formToPriceData(form);
      expect(price['Product Code']).toBe('TEST001');
      expect(price['Lower Limit']).toBe(1);
      expect(price['Upper Limit']).toBe(100);
      expect(price['Prices']).toBe(150);
      expect(price['Price Adjustment']).toBe(10);
    });

    it('should trim product code', () => {
      const form: PriceFormData = {
        productCode: '  TEST001  ',
        tiers: [
          { lowerLimit: 1, upperLimit: 100, price: 150 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
          { lowerLimit: 0, upperLimit: 0, price: 0 },
        ],
        priceAdjustment: 0,
      };

      const price = PriceService.formToPriceData(form);
      expect(price['Product Code']).toBe('TEST001');
    });
  });

  describe('Price Statistics', () => {
    const prices: PriceData[] = [
      {
        id: 1,
        'Product Code': 'TEST001',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 100,
        'Price Adjustment': 10,
      },
      {
        id: 2,
        'Product Code': 'TEST002',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 200,
        'Price Adjustment': -5,
      },
      {
        id: 3,
        'Product Code': 'TEST003',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 150,
        'Price Adjustment': 0,
      },
    ];

    it('should calculate total count', () => {
      const stats = PriceService.calculateStats(prices, prices);
      expect(stats.total).toBe(3);
      expect(stats.filtered).toBe(3);
    });

    it('should calculate average price', () => {
      const stats = PriceService.calculateStats(prices, prices);
      // Average: (100 + 200 + 150) / 3 = 150
      expect(stats.avgPrice).toBe(150);
    });

    it('should count adjustments', () => {
      const stats = PriceService.calculateStats(prices, prices);
      expect(stats.totalAdjustments).toBe(2); // 2 non-zero adjustments
      expect(stats.priceIncreases).toBe(1); // 1 positive adjustment
      expect(stats.priceDecreases).toBe(1); // 1 negative adjustment
    });

    it('should handle empty array', () => {
      const stats = PriceService.calculateStats([], []);
      expect(stats.total).toBe(0);
      expect(stats.filtered).toBe(0);
      expect(stats.avgPrice).toBe(0);
      expect(stats.totalAdjustments).toBe(0);
    });

    it('should handle filtered data', () => {
      const filtered = prices.slice(0, 2);
      const stats = PriceService.calculateStats(prices, filtered);
      expect(stats.total).toBe(3);
      expect(stats.filtered).toBe(2);
      expect(stats.avgPrice).toBe(150); // (100 + 200) / 2
    });
  });

  describe('CSV Import', () => {
    it('should import valid CSV', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
TEST001,1,10,100,10
TEST002,1,20,200,0`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.rowsImported).toBe(2);
      expect(result.data?.[0]['Product Code']).toBe('TEST001');
      expect(result.data?.[1]['Product Code']).toBe('TEST002');
    });

    it('should handle empty CSV', () => {
      const result = PriceService.importFromCSV('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('CSV file is empty');
    });

    it('should skip empty lines', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
TEST001,1,10,100,10

TEST002,1,20,200,0`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should skip incomplete rows', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
TEST001,1,10,100,10
TEST002,1
TEST003,1,30,300,0`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]['Product Code']).toBe('TEST001');
      expect(result.data?.[1]['Product Code']).toBe('TEST003');
    });

    it('should skip rows without product code', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
,1,10,100,10
TEST002,1,20,200,0`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]['Product Code']).toBe('TEST002');
    });

    it('should handle missing values', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
TEST001,,,100,`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data?.[0]['Lower Limit']).toBe(0);
      expect(result.data?.[0]['Upper Limit']).toBe(0);
      expect(result.data?.[0]['Price Adjustment']).toBe(0);
    });

    it('should round numeric values', () => {
      const csv = `Product Code,Lower Limit,Upper Limit,Prices,Price Adjustment
TEST001,1.7,10.3,100.9,10.2`;

      const result = PriceService.importFromCSV(csv);
      expect(result.success).toBe(true);
      expect(result.data?.[0]['Lower Limit']).toBe(2);
      expect(result.data?.[0]['Upper Limit']).toBe(10);
      expect(result.data?.[0]['Prices']).toBe(101);
      expect(result.data?.[0]['Price Adjustment']).toBe(10);
    });
  });

  describe('Price Search', () => {
    const prices: PriceData[] = [
      {
        id: 1,
        'Product Code': 'ABC123',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 100,
        'Price Adjustment': 10,
      },
      {
        id: 2,
        'Product Code': 'XYZ456',
        'Lower Limit': 5,
        'Upper Limit': 20,
        'Prices': 200,
        'Price Adjustment': 0,
      },
      {
        id: 3,
        'Product Code': 'TEST789',
        'Lower Limit': 1,
        'Upper Limit': 50,
        'Prices': 150,
        'Price Adjustment': -5,
      },
    ];

    it('should search by product code', () => {
      const result = PriceService.searchPrices(prices, 'ABC');
      expect(result).toHaveLength(1);
      expect(result[0]['Product Code']).toBe('ABC123');
    });

    it('should search case-insensitively', () => {
      const result = PriceService.searchPrices(prices, 'abc');
      expect(result).toHaveLength(1);
      expect(result[0]['Product Code']).toBe('ABC123');
    });

    it('should search by numeric values', () => {
      const result = PriceService.searchPrices(prices, '200');
      expect(result).toHaveLength(1);
      expect(result[0]['Product Code']).toBe('XYZ456');
    });

    it('should return all for empty query', () => {
      const result = PriceService.searchPrices(prices, '');
      expect(result).toHaveLength(3);
    });

    it('should return empty for no matches', () => {
      const result = PriceService.searchPrices(prices, 'NOTFOUND');
      expect(result).toHaveLength(0);
    });
  });

  describe('Bulk Adjustments', () => {
    const prices: PriceData[] = [
      {
        id: 1,
        'Product Code': 'TEST001',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 100,
        'Price Adjustment': 0,
      },
      {
        id: 2,
        'Product Code': 'TEST002',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 200,
        'Price Adjustment': 0,
      },
    ];

    it('should apply percentage adjustment', () => {
      const config: BulkAdjustmentConfig = {
        type: 'percentage',
        value: 10,
        applyTo: 'all',
      };

      const result = PriceService.applyBulkAdjustment(prices, config);
      expect(result[0]['Price Adjustment']).toBe(10); // 10% of 100
      expect(result[1]['Price Adjustment']).toBe(20); // 10% of 200
    });

    it('should apply fixed adjustment', () => {
      const config: BulkAdjustmentConfig = {
        type: 'fixed',
        value: 15,
        applyTo: 'all',
      };

      const result = PriceService.applyBulkAdjustment(prices, config);
      expect(result[0]['Price Adjustment']).toBe(15);
      expect(result[1]['Price Adjustment']).toBe(15);
    });

    it('should round adjustment values', () => {
      const config: BulkAdjustmentConfig = {
        type: 'percentage',
        value: 7.5,
        applyTo: 'all',
      };

      const result = PriceService.applyBulkAdjustment(prices, config);
      expect(result[0]['Price Adjustment']).toBe(8); // 7.5% of 100 = 7.5, rounded to 8
      expect(result[1]['Price Adjustment']).toBe(15); // 7.5% of 200 = 15
    });
  });

  describe('Helper Functions', () => {
    it('should create empty form', () => {
      const form = PriceService.createEmptyForm();
      expect(form.productCode).toBe('');
      expect(form.tiers).toHaveLength(4);
      expect(form.priceAdjustment).toBe(0);
      expect(form.tiers[0].lowerLimit).toBe(0);
    });

    it('should create empty price', () => {
      const price = PriceService.createEmptyPrice();
      expect(price['Product Code']).toBe('');
      expect(price['Lower Limit']).toBe(0);
      expect(price['Upper Limit']).toBe(0);
      expect(price['Prices']).toBe(0);
      expect(price['Price Adjustment']).toBe(0);
    });

    it('should create search index', () => {
      const price: PriceData = {
        id: 1,
        'Product Code': 'TEST001',
        'Lower Limit': 1,
        'Upper Limit': 10,
        'Prices': 100,
        'Price Adjustment': 5,
      };

      const index = PriceService.createSearchIndex(price);
      expect(index).toContain('test001');
      expect(index).toContain('1');
      expect(index).toContain('10');
      expect(index).toContain('100');
      expect(index).toContain('5');
    });
  });
});
