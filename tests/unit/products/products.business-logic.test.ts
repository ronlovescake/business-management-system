/**
 * Products Business Logic Tests
 *
 * Tests derived directly from docs/business-logic/clothing/operations-products.md
 * Covers: financial calculations, validation, product code generation, age range logic.
 */

import { describe, it, expect } from 'vitest';
import { calculateProductFinancials } from '@/lib/productCalculations';
import { ProductService } from '@/modules/clothing/operations/products/services/ProductService';
import {
  buildProductInitials,
  generateFormattedProductCode,
  buildAgeRangeLabel,
  formatPostingDateForProductCode,
} from '@/modules/clothing/operations/products/services/productServiceHelpers';
import type { ProductFormData } from '@/modules/clothing/operations/products/types/product.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultForm = (): ProductFormData => ({
  shipmentCode: '',
  product: 'Test Product',
  ageRange: '',
  ageRangeStart: '',
  ageRangeEnd: '',
  ageRangeUnit: '',
  unit: '',
  postingDate: '2025-01-04',
  orderDate: '',
  payment: 'Paid',
  paymentMethod: 'CASH',
  paymentCardId: '',
  unitPrice: 100,
  quantity: 10,
  exchangeRates: 7.5,
  applyTransactionFee: false,
  alibabaShippingCost: 0,
  forwardersFee: 0,
  lalamove: 0,
  packagingCost: 0,
  actualPrice: 0,
  linkToPost: '',
  bulkQuantity: 0,
  bulkWeight: 0,
  weightPerPiece: 0,
  previousProductCode: '',
});

// ---------------------------------------------------------------------------
// Section A — Validation Rules (rules 1–9)
// ---------------------------------------------------------------------------

describe('Products — Validation (rules 1–9)', () => {
  it('[rule 1] rejects blank product name', () => {
    const form = { ...defaultForm(), product: '' };
    const result = ProductService.validateProduct(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Product name is required');
  });

  it('[rule 1] rejects whitespace-only product name', () => {
    const form = { ...defaultForm(), product: '   ' };
    const result = ProductService.validateProduct(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Product name is required');
  });

  it('[rule 2] rejects negative unit price', () => {
    const form = { ...defaultForm(), unitPrice: -1 };
    const result = ProductService.validateProduct(form);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Unit price cannot be negative');
  });

  it('[rule 2] allows zero unit price', () => {
    const form = { ...defaultForm(), unitPrice: 0 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).not.toContain('Unit price cannot be negative');
  });

  it('[rule 3] rejects negative quantity', () => {
    const form = { ...defaultForm(), quantity: -5 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Quantity cannot be negative');
  });

  it('[rule 4] rejects zero exchange rate', () => {
    const form = { ...defaultForm(), exchangeRates: 0 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Exchange rate must be greater than 0');
  });

  it('[rule 4] rejects negative exchange rate', () => {
    const form = { ...defaultForm(), exchangeRates: -1 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Exchange rate must be greater than 0');
  });

  it('[rule 5] rejects negative bulk quantity', () => {
    const form = { ...defaultForm(), bulkQuantity: -1 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Bulk quantity cannot be negative');
  });

  it('[rule 6] rejects negative bulk weight', () => {
    const form = { ...defaultForm(), bulkWeight: -0.5 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Bulk weight cannot be negative');
  });

  it('[rule 7] rejects negative weight per piece', () => {
    const form = { ...defaultForm(), weightPerPiece: -0.1 };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain('Weight per piece cannot be negative');
  });

  it('[rule 8] rejects CARD payment without cardId', () => {
    const form = { ...defaultForm(), paymentMethod: 'CARD', paymentCardId: '' };
    const result = ProductService.validateProduct(form);
    expect(result.errors).toContain(
      'Select a saved card when payment method is Card'
    );
  });

  it('[rule 8] accepts CARD payment when cardId is provided', () => {
    const form = {
      ...defaultForm(),
      paymentMethod: 'CARD',
      paymentCardId: 'card-001',
    };
    const result = ProductService.validateProduct(form);
    expect(result.errors).not.toContain(
      'Select a saved card when payment method is Card'
    );
  });

  it('returns isValid:true for fully valid form', () => {
    const form = defaultForm();
    const result = ProductService.validateProduct(form);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Section B — Financial Calculations (rules 10–25)
// ---------------------------------------------------------------------------

describe('Products — Financial Calculations (rules 10–25)', () => {
  it('[rule 10] PHP = unitPrice × exchangeRate', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      exchangeRates: 7.5,
      quantity: 1,
      alibabaShippingCost: 0,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    expect(result.php).toBe(750);
  });

  it('[rule 11] subTotalPHP = (unitPrice × qty + alibabaShipping) × exchangeRate', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 5,
      alibabaShippingCost: 50,
      exchangeRates: 2,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    // (100*5 + 50) * 2 = 550 * 2 = 1100
    expect(result.subTotalPHP).toBe(1100);
  });

  it('[rule 12] transaction fee is 2.99% when enabled', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: true,
    });
    // subTotal = 100*10*1 = 1000; fee = 1000 * 0.0299 = 29.9
    expect(result.transactionFee).toBeCloseTo(29.9, 2);
  });

  it('[rule 12] transaction fee is 0 when disabled', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    expect(result.transactionFee).toBe(0);
  });

  it('[rule 13] grandTotal = subTotal + transactionFee', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: true,
    });
    expect(result.grandTotal).toBeCloseTo(
      result.subTotalPHP + result.transactionFee,
      5
    );
  });

  it('[rule 15] landedUnitCost = (grandTotal + logistics) / quantity', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 100,
      lalamove: 50,
      packagingCost: 50,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    // grandTotal = 1000, logistics = 200, landed = 1200/10 = 120
    expect(result.basePrice).toBeCloseTo(120, 5);
  });

  it('[rule 15] landedUnitCost is 0 when quantity is 0', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 0,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    expect(result.basePrice).toBe(0);
  });

  it('[rule 16] COGS = landedUnitCost × quantity', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    expect(result.cogs).toBeCloseTo(result.basePrice * 10, 5);
  });

  it('[rule 17] suggestedPrice = ceil(landedUnitCost × 1.22)', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    // basePrice = 1000/10 = 100; suggested = ceil(100*1.22) = ceil(122) = 122
    expect(result.suggestedPrice).toBe(122);
  });

  it('[rule 18] projectedSales = actualPrice × quantity', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 200,
      applyTransactionFee: false,
    });
    expect(result.projectedSales).toBe(2000);
  });

  it('[rule 19] projectedProfit = projectedSales - COGS', () => {
    const result = calculateProductFinancials({
      unitPrice: 100,
      quantity: 10,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 200,
      applyTransactionFee: false,
    });
    expect(result.projectedProfit).toBeCloseTo(
      result.projectedSales - result.cogs,
      5
    );
  });

  it('[rule 20] projectedProfitPercent = 0 when COGS is 0', () => {
    const result = calculateProductFinancials({
      unitPrice: 0,
      quantity: 0,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
    });
    expect(result.projectedProfitPercent).toBe(0);
  });

  it('[rule 22] weightPerPiece = bulkWeight / bulkQuantity', () => {
    const result = calculateProductFinancials({
      unitPrice: 0,
      quantity: 1,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
      bulkWeight: 12,
      bulkQuantity: 4,
    });
    expect(result.weightPerPiece).toBe(3);
  });

  it('[rule 22] weightPerPiece is 0 when bulkQuantity is 0', () => {
    const result = calculateProductFinancials({
      unitPrice: 0,
      quantity: 1,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: false,
      bulkWeight: 10,
      bulkQuantity: 0,
    });
    expect(result.weightPerPiece).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Section C — Product Code Generation (rules 26–31)
// ---------------------------------------------------------------------------

describe('Products — Product Code Generation (rules 26–31)', () => {
  it('[rule 27] extracts first letter of each significant word', () => {
    expect(buildProductInitials('Kids Shirt')).toBe('KS');
  });

  it('[rule 27] skips stop-words: and, the, of', () => {
    expect(buildProductInitials('Top and Bottom')).toBe('TB');
    expect(buildProductInitials('Shirt the Great')).toBe('SG');
    expect(buildProductInitials('Bag of Tricks')).toBe('BT');
  });

  it('[rule 28] 2-PC expands to 2PC', () => {
    expect(buildProductInitials('Kids Shirt 2-PC')).toBe('KS2PC');
  });

  it('[rule 28] 3-PC expands to 3PC', () => {
    expect(buildProductInitials('Baby Set 3-PC')).toBe('BS3PC');
  });

  it('[rule 28] 4-PC expands to 4PC', () => {
    expect(buildProductInitials('Baby Set 4-PC')).toBe('BS4PC');
  });

  it('[rule 30] posting date YYYY-MM-DD formats to MMDDYY', () => {
    expect(formatPostingDateForProductCode('2025-01-04')).toBe('010425');
    expect(formatPostingDateForProductCode('2025-12-31')).toBe('123125');
  });

  it('[rule 31] full generated code format is "Name (INITIALS-MMDDYY)"', () => {
    // 'Kids T-Shirt' — 'T-Shirt' is a single hyphenated word, first letter = 'T'
    // so initials = KT
    const code = generateFormattedProductCode('Kids T-Shirt', '2025-01-04');
    expect(code).toBe('Kids T-Shirt (KT-010425)');
  });

  it('[rule 31] 2-PC special case in full code', () => {
    // 'Kids T-Shirt 2-PC' — initials from K + T + 2PC (special) = KT2PC
    const code = generateFormattedProductCode(
      'Kids T-Shirt 2-PC',
      '2025-01-04'
    );
    expect(code).toBe('Kids T-Shirt 2-PC (KT2PC-010425)');
  });

  it('returns empty string when product name or date is missing', () => {
    expect(generateFormattedProductCode('', '2025-01-04')).toBe('');
    expect(generateFormattedProductCode('Kids Shirt', '')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Section D — Age Range (rules 32–34)
// ---------------------------------------------------------------------------

describe('Products — Age Range (rules 32–34)', () => {
  const base = defaultForm();

  it('[rule 32] start + end + unit produces "N-N unit" label', () => {
    const form = {
      ...base,
      ageRangeStart: '3',
      ageRangeEnd: '6',
      ageRangeUnit: 'months',
    };
    expect(buildAgeRangeLabel(form)).toBe('3-6 months');
  });

  it('[rule 34] start-only + unit label', () => {
    const form = {
      ...base,
      ageRangeStart: '12',
      ageRangeEnd: '',
      ageRangeUnit: 'months',
    };
    expect(buildAgeRangeLabel(form)).toBe('12 months');
  });

  it('[rule 34] end-only + unit label', () => {
    const form = {
      ...base,
      ageRangeStart: '',
      ageRangeEnd: '6',
      ageRangeUnit: 'years',
    };
    expect(buildAgeRangeLabel(form)).toBe('6 years');
  });

  it('falls back to ageRange field when no parts provided', () => {
    const form = {
      ...base,
      ageRange: '0-3 months',
      ageRangeStart: '',
      ageRangeEnd: '',
      ageRangeUnit: '',
    };
    expect(buildAgeRangeLabel(form)).toBe('0-3 months');
  });
});
