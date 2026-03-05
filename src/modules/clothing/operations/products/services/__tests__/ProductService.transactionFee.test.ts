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
  it('clears shipment-derived fields when shipment code is removed', () => {
    const previousForm = ProductService.createEmptyForm();
    Object.assign(previousForm, {
      shipmentCode: 'KPC 23930A-00226',
      product: 'Onesie Dress',
      postingDate: '2026-03-05',
      unitPrice: 100,
      quantity: 1,
      exchangeRates: 1,
      actualPrice: 120,
      applyTransactionFee: false,
    });

    const existingProduct = ProductService.formToProductData(
      previousForm,
      true
    );
    existingProduct['CV Number'] = 'GW020';
    existingProduct['No. Of Sacks'] = 3;
    existingProduct['Total CBM'] = 0.35;
    existingProduct.Weight = 80;
    existingProduct['Shipment Status'] = 'Sorting';

    const form = ProductService.createEmptyForm();

    Object.assign(form, {
      shipmentCode: '',
      product: 'Onesie Dress',
      postingDate: '2026-03-05',
      unitPrice: 100,
      quantity: 1,
      exchangeRates: 1,
      alibabaShippingCost: 0,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 120,
      applyTransactionFee: false,
    });

    const data = ProductService.formToProductData(form, true, existingProduct);

    expect(data['Shipment Code']).toBe('');
    expect(data['CV Number']).toBe('');
    expect(data['No. Of Sacks']).toBe(0);
    expect(data['Total CBM']).toBe(0);
    expect(data.Weight).toBe(0);
    expect(data['Shipment Status']).toBe('');
  });

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
