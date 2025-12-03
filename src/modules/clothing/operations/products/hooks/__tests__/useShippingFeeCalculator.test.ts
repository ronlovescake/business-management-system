import { describe, expect, it } from 'vitest';
import {
  buildResultSummary,
  calculateShippingRows,
  normalizeMultipliers,
  type ShippingActualInputs,
  type ShippingFeeRawRow,
  type ShippingFeeData,
} from '../useShippingFeeCalculator';

describe('useShippingFeeCalculator helpers', () => {
  it('distributes actual inputs based on approximate quantity ratios', () => {
    const rows: ShippingFeeRawRow[] = [
      { productCode: 'PROD-1', actualQuantity: 10, multiplier: 2 },
      { productCode: 'PROD-2', actualQuantity: 5, multiplier: 1 },
      { productCode: 'PROD-3', actualQuantity: 5, multiplier: null },
    ];

    const inputs: ShippingActualInputs = {
      alibaba: 1000,
      forwarders: 500,
      lalamove: 250,
    };

    const result = calculateShippingRows(rows, inputs);

    expect(result).toHaveLength(3);

    // PROD-1: 10 * 2 = 20 (80% of total 25)
    expect(result[0]).toMatchObject({
      aproxQuantity: 20,
      percentage: 0.8,
    });
    expect(result[0].alibabaShippingCost).toBeCloseTo(800);
    expect(result[0].forwardersFee).toBeCloseTo(400);
    expect(result[0].lalamove).toBeCloseTo(200);
    expect(result[0].packaging).toBeCloseTo(result[0].lalamove ?? 0);

    // PROD-2: 5 * 1 = 5 (20% share)
    expect(result[1]).toMatchObject({
      aproxQuantity: 5,
      percentage: 0.2,
    });
    expect(result[1].alibabaShippingCost).toBeCloseTo(200);
    expect(result[1].forwardersFee).toBeCloseTo(100);
    expect(result[1].lalamove).toBeCloseTo(50);

    // PROD-3 lacks multiplier so it should not receive allocations
    expect(result[2]).toMatchObject({
      aproxQuantity: null,
      percentage: null,
      alibabaShippingCost: null,
      forwardersFee: null,
      lalamove: null,
      packaging: null,
    });
  });

  it('returns zeroed totals when approximate quantity is missing', () => {
    const rows: ShippingFeeRawRow[] = [
      { productCode: 'NO-ALLOC', actualQuantity: null, multiplier: null },
    ];

    const inputs: ShippingActualInputs = {
      alibaba: 1500,
      forwarders: 700,
      lalamove: 350,
    };

    const result = calculateShippingRows(rows, inputs);
    expect(result[0]).toMatchObject({
      aproxQuantity: null,
      percentage: null,
      alibabaShippingCost: null,
      forwardersFee: null,
      lalamove: null,
      packaging: null,
    });
  });

  it('aggregates totals for summary cards', () => {
    const rows: ShippingFeeData[] = [
      {
        productCode: 'ITEM-1',
        actualQuantity: 10,
        multiplier: 2,
        aproxQuantity: 20,
        percentage: 0.8,
        alibabaShippingCost: 800,
        forwardersFee: 400,
        lalamove: 200,
        packaging: 200,
      },
      {
        productCode: 'ITEM-2',
        actualQuantity: 5,
        multiplier: 1,
        aproxQuantity: 5,
        percentage: 0.2,
        alibabaShippingCost: 200,
        forwardersFee: 100,
        lalamove: 50,
        packaging: 50,
      },
      {
        productCode: '',
        actualQuantity: null,
        multiplier: null,
        aproxQuantity: null,
        percentage: null,
        alibabaShippingCost: null,
        forwardersFee: null,
        lalamove: null,
        packaging: null,
      },
    ];

    const summary = buildResultSummary(rows);

    expect(summary).toEqual({
      totalProducts: 2,
      totalActualQuantity: 15,
      totalApproxQuantity: 25,
      totalAlibabaShipping: 1000,
      totalForwardersFee: 500,
      totalLalamove: 250,
      totalPackaging: 250,
    });
  });

  it('normalizes persisted multipliers and discards malformed entries', () => {
    const normalized = normalizeMultipliers({
      ' PROD-1 ': '1.25',
      '': '3',
      'PROD-2': 'abc',
      'PROD-3': 2,
      'PROD-4': 0,
    });

    expect(normalized).toEqual({
      'PROD-1': 1.25,
      'PROD-3': 2,
      'PROD-4': 0,
    });
  });
});
