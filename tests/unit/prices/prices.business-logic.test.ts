/**
 * Prices Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/operations-prices.md
 * Covers: tier validation, statistics, bulk adjustment.
 */

import { describe, it, expect } from 'vitest';
import { PriceService } from '@/modules/clothing/operations/prices/services/PriceService';
import type {
  PriceData,
  PriceFormData,
} from '@/modules/clothing/operations/prices/types/price.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyTiers = () => [
  { lowerLimit: 0, upperLimit: 0, price: 0 },
  { lowerLimit: 0, upperLimit: 0, price: 0 },
  { lowerLimit: 0, upperLimit: 0, price: 0 },
];

const validForm = (): PriceFormData => ({
  productCode: 'KTS-010425',
  tiers: [
    { lowerLimit: 1, upperLimit: 50, price: 150 },
    { lowerLimit: 0, upperLimit: 0, price: 0 },
    { lowerLimit: 0, upperLimit: 0, price: 0 },
  ],
  priceAdjustment: 0,
});

const makePrice = (price: number, adjustment: number = 0): PriceData => ({
  'Product Code': 'TST-001',
  'Lower Limit': 1,
  'Upper Limit': 100,
  Prices: price,
  'Price Adjustment': adjustment,
});

// ---------------------------------------------------------------------------
// Section A — Validation
// ---------------------------------------------------------------------------

describe('Prices — Validation', () => {
  it('accepts a fully valid single-tier form', () => {
    const result = PriceService.validatePrice(validForm());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects blank product code', () => {
    const result = PriceService.validatePrice({
      ...validForm(),
      productCode: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Product code is required');
  });

  it('rejects whitespace-only product code', () => {
    const result = PriceService.validatePrice({
      ...validForm(),
      productCode: '   ',
    });
    expect(result.errors).toContain('Product code is required');
  });

  it('rejects form with all-zero tiers', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: emptyTiers(),
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(result.errors).toContain('At least one pricing tier is required');
  });

  it('rejects partially filled tier — missing lowerLimit', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: [
        { lowerLimit: 0, upperLimit: 50, price: 150 }, // lowerLimit missing
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(
      result.errors.some((e) => e.includes('Lower limit is required'))
    ).toBe(true);
  });

  it('rejects partially filled tier — missing upperLimit', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: [
        { lowerLimit: 1, upperLimit: 0, price: 150 }, // upperLimit missing
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(
      result.errors.some((e) => e.includes('Upper limit is required'))
    ).toBe(true);
  });

  it('rejects tier where lowerLimit >= upperLimit', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: [
        { lowerLimit: 50, upperLimit: 50, price: 150 }, // equal
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(
      result.errors.some((e) =>
        e.includes('Lower limit must be less than upper limit')
      )
    ).toBe(true);
  });

  it('rejects non-ascending tier order', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: [
        { lowerLimit: 100, upperLimit: 200, price: 150 },
        { lowerLimit: 50, upperLimit: 100, price: 130 }, // lower than previous tier
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(
      result.errors.some((e) =>
        e.includes("greater than previous tier's lower limit")
      )
    ).toBe(true);
  });

  it('accepts multi-tier form with valid ascending tiers', () => {
    const form: PriceFormData = {
      productCode: 'ABC',
      tiers: [
        { lowerLimit: 1, upperLimit: 50, price: 150 },
        { lowerLimit: 51, upperLimit: 100, price: 130 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
    const result = PriceService.validatePrice(form);
    expect(result.isValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section B — Statistics
// ---------------------------------------------------------------------------

describe('Prices — Statistics', () => {
  it('total = all prices count', () => {
    const all = [makePrice(100), makePrice(200), makePrice(300)];
    const filtered = all.slice(0, 2);
    const stats = PriceService.calculateStats(all, filtered);
    expect(stats.total).toBe(3);
    expect(stats.filtered).toBe(2);
  });

  it('avgPrice is rounded mean of filtered Prices', () => {
    const prices = [makePrice(100), makePrice(200), makePrice(300)];
    const stats = PriceService.calculateStats(prices, prices);
    expect(stats.avgPrice).toBe(200);
  });

  it('avgPrice = 0 when filteredPrices is empty', () => {
    const stats = PriceService.calculateStats([makePrice(500)], []);
    expect(stats.avgPrice).toBe(0);
  });

  it('totalAdjustments counts non-zero adjustments', () => {
    const prices = [makePrice(100, 10), makePrice(200, -20), makePrice(300, 0)];
    const stats = PriceService.calculateStats(prices, prices);
    expect(stats.totalAdjustments).toBe(2);
  });

  it('priceIncreases counts positive adjustments only', () => {
    const prices = [makePrice(100, 10), makePrice(200, -20), makePrice(300, 5)];
    const stats = PriceService.calculateStats(prices, prices);
    expect(stats.priceIncreases).toBe(2);
  });

  it('priceDecreases counts negative adjustments only', () => {
    const prices = [
      makePrice(100, -10),
      makePrice(200, -20),
      makePrice(300, 0),
    ];
    const stats = PriceService.calculateStats(prices, prices);
    expect(stats.priceDecreases).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Section C — Bulk Adjustment
// ---------------------------------------------------------------------------

describe('Prices — Bulk Adjustment', () => {
  it('percentage adjustment sets Price Adjustment to % of Prices (rounded)', () => {
    const prices = [makePrice(200)];
    const result = PriceService.applyBulkAdjustment(prices, {
      type: 'percentage',
      value: 10,
      applyTo: 'all',
    });
    // 200 * 0.10 = 20
    expect(result[0]['Price Adjustment']).toBe(20);
  });

  it('percentage: rounds adjustment to integer', () => {
    const prices = [makePrice(100)];
    const result = PriceService.applyBulkAdjustment(prices, {
      type: 'percentage',
      value: 3.5,
      applyTo: 'all',
    });
    // 100 * 0.035 = 3.5, Math.round = 4
    expect(result[0]['Price Adjustment']).toBe(4);
  });

  it('fixed adjustment sets Price Adjustment to rounded fixed value', () => {
    const prices = [makePrice(200), makePrice(350)];
    const result = PriceService.applyBulkAdjustment(prices, {
      type: 'fixed',
      value: 50,
      applyTo: 'all',
    });
    expect(result[0]['Price Adjustment']).toBe(50);
    expect(result[1]['Price Adjustment']).toBe(50);
  });

  it('does not mutate original array', () => {
    const prices = [makePrice(200)];
    PriceService.applyBulkAdjustment(prices, {
      type: 'fixed',
      value: 25,
      applyTo: 'all',
    });
    expect(prices[0]['Price Adjustment']).toBe(0);
  });
});
