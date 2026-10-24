import { describe, expect, it } from 'vitest';
import {
  parseCheckoutLinksCsv,
  serializeCheckoutLinksCsv,
} from '@/modules/clothing/operations/checkout-links/lib/csv';

const row = {
  weight: '1',
  width: '2',
  length: '3',
  height: '4',
  checkoutLinks: 'https://example.test/checkout?name=a,b',
  productPortals: 'https://example.test/portal',
  productNames: 'Shirt "A", size M\nSecond line',
};

describe('checkout links CSV contract', () => {
  it('round-trips quotes, commas and embedded newlines', () => {
    expect(parseCheckoutLinksCsv(serializeCheckoutLinksCsv([row]))).toEqual([
      row,
    ]);
  });
  it('accepts reordered legacy camelCase headers', () => {
    expect(
      parseCheckoutLinksCsv(
        'productNames,height,checkoutLinks,width,length,weight,productPortals\r\nShirt,4,https://example.test,2,3,1,portal'
      )
    ).toEqual([
      {
        ...row,
        checkoutLinks: 'https://example.test',
        productPortals: 'portal',
        productNames: 'Shirt',
      },
    ]);
  });
  it.each([
    '',
    'WEIGHT,WIDTH\n1,2',
    'WEIGHT,WIDTH,LENGTH,HEIGHT,CHECKOUT LINKS,PRODUCT PORTALS,PRODUCT NAMES\n1,2,3',
    'WEIGHT,WIDTH,LENGTH,HEIGHT,CHECKOUT LINKS,PRODUCT PORTALS,PRODUCT NAMES\n1,2,3,4,,,"unterminated',
    'WEIGHT,WIDTH,LENGTH,HEIGHT,CHECKOUT LINKS,PRODUCT PORTALS,PRODUCT NAMES\n,2,3,4,,,name',
  ])('rejects invalid CSV without silently dropping rows: %s', (text) => {
    expect(() => parseCheckoutLinksCsv(text)).toThrow();
  });
});
