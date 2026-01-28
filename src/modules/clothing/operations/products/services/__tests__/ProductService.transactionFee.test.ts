import { describe, expect, it, vi } from 'vitest';
import { ProductService } from '../ProductService';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProductService transaction fee toggle', () => {
  it('sets Transaction Fee = 0 when applyTransactionFee is false', () => {
    const form = ProductService.createEmptyForm();

    Object.assign(form, {
      product: 'Local Purchase',
      postingDate: '2026-01-26',
      unitPrice: 100,
      quantity: 2,
      exchangeRates: 1,
      alibabaShippingCost: 50,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 135,
      applyTransactionFee: false,
    });

    const data = ProductService.formToProductData(form, false);

    expect(data['Sub Total (PHP)']).toBeCloseTo(250, 6);
    expect(data['Transaction Fee']).toBeCloseTo(0, 6);
    expect(data['Grand Total']).toBeCloseTo(250, 6);
  });

  it('applies 2.99% when applyTransactionFee is true', () => {
    const form = ProductService.createEmptyForm();

    Object.assign(form, {
      product: 'Online Purchase',
      postingDate: '2026-01-26',
      unitPrice: 100,
      quantity: 2,
      exchangeRates: 1,
      alibabaShippingCost: 50,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 135,
      applyTransactionFee: true,
    });

    const data = ProductService.formToProductData(form, false);

    expect(data['Sub Total (PHP)']).toBeCloseTo(250, 6);
    expect(data['Transaction Fee']).toBeCloseTo(250 * 0.0299, 6);
    expect(data['Grand Total']).toBeCloseTo(250 + 250 * 0.0299, 6);
  });
});
