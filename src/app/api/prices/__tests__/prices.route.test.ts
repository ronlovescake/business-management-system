import { describe, expect, it } from 'vitest';
import {
  convertPriceDataToDb,
  sanitizePriceRecord,
  validatePriceRecords,
} from '@/modules/prices/api/utils';
import type { PriceDataInput } from '@/lib/validations/price.validation';

describe('prices API helpers', () => {
  it('sanitizes price records and normalizes booleans', () => {
    const sanitized = sanitizePriceRecord({
      id: '123',
      'Product Code': '  WX-9 ',
      'Lower Limit': '10.555',
      'Upper Limit': 20,
      Prices: '99.99',
      'Price Adjustment': '5',
      description: '  test description   ',
      category: 'Category Name that is very long and should be trimmed '.repeat(
        2
      ),
      isActive: 'false',
    });

    expect(sanitized).toEqual({
      id: undefined,
      'Product Code': 'WX-9',
      'Lower Limit': 10.55,
      'Upper Limit': 20,
      Prices: 99.99,
      'Price Adjustment': 5,
      description: 'test description',
      category: expect.stringMatching(/^Category Name/),
      isActive: false,
    });
  });

  it('validates payloads and separates invalid rows', () => {
    const { valid, invalid } = validatePriceRecords([
      {
        'Product Code': 'WX-9',
        'Lower Limit': 10,
        'Upper Limit': 20,
        Prices: 50,
        'Price Adjustment': 0,
      },
      {
        'Product Code': '',
        'Lower Limit': -1,
        'Upper Limit': 5,
        Prices: 'abc',
        'Price Adjustment': 'xyz',
      },
    ]);

    expect(valid).toHaveLength(1);
    expect(valid[0]['Product Code']).toBe('WX-9');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].issues).toMatchObject({
      'Product Code': expect.any(String),
    });
  });

  it('converts price DTO to Prisma payload using cents', () => {
    const payload = convertPriceDataToDb({
      'Product Code': 'WX-9',
      'Lower Limit': 10.5,
      'Upper Limit': 20.01,
      Prices: 45.5,
      'Price Adjustment': 5.25,
      description: 'Test',
      category: 'Category',
      isActive: true,
    } as PriceDataInput);

    expect(payload).toMatchObject({
      productCode: 'WX-9',
      lowerLimit: 1050,
      upperLimit: 2001,
      currentPrice: 4550,
      priceAdjustment: 525,
      description: 'Test',
      category: 'Category',
      isActive: true,
    });
  });
});
