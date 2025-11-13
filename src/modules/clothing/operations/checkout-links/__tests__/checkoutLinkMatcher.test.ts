/**
 * Checkout Link Matcher Tests
 */

import { describe, it, expect } from 'vitest';
import {
  findCheckoutLinkByWeight,
  batchFindCheckoutLinks,
  type CheckoutLinkRecord,
} from '../utils/checkoutLinkMatcher';

describe('Checkout Link Matcher', () => {
  const mockCheckoutLinks: CheckoutLinkRecord[] = [
    { weight: '0.50', checkoutLinks: 'https://shopee.ph/product/1' },
    { weight: '1.00', checkoutLinks: 'https://shopee.ph/product/2' },
    { weight: '1.50', checkoutLinks: 'https://shopee.ph/product/3' },
    { weight: '2.00', checkoutLinks: 'https://shopee.ph/product/4' },
    { weight: '21.50', checkoutLinks: 'https://shopee.ph/product/21' },
    { weight: '41.50', checkoutLinks: '' }, // Empty link case
  ];

  describe('findCheckoutLinkByWeight', () => {
    it('finds exact match for decimal weight', () => {
      const result = findCheckoutLinkByWeight('21.5', mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/21');
    });

    it('finds match when weight format differs (21.5 vs 21.50)', () => {
      const result = findCheckoutLinkByWeight(21.5, mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/21');
    });

    it('finds match for string number input', () => {
      const result = findCheckoutLinkByWeight('1.5', mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/3');
    });

    it('finds match for number input', () => {
      const result = findCheckoutLinkByWeight(2, mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/4');
    });

    it('returns empty string when no match found', () => {
      const result = findCheckoutLinkByWeight('99.5', mockCheckoutLinks);
      expect(result).toBe('');
    });

    it('returns empty string for invalid weight', () => {
      expect(findCheckoutLinkByWeight(null, mockCheckoutLinks)).toBe('');
      expect(findCheckoutLinkByWeight(undefined, mockCheckoutLinks)).toBe('');
      expect(findCheckoutLinkByWeight('', mockCheckoutLinks)).toBe('');
      expect(findCheckoutLinkByWeight(0, mockCheckoutLinks)).toBe('');
      expect(findCheckoutLinkByWeight(-5, mockCheckoutLinks)).toBe('');
    });

    it('returns empty string when checkout link is empty in data', () => {
      const result = findCheckoutLinkByWeight('41.5', mockCheckoutLinks);
      expect(result).toBe('');
    });

    it('returns empty string when checkoutLinksData is empty', () => {
      const result = findCheckoutLinkByWeight('21.5', []);
      expect(result).toBe('');
    });

    it('handles weights with trailing zeros correctly', () => {
      const result = findCheckoutLinkByWeight('0.50', mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/1');
    });

    it('matches using numerical comparison (handles rounding)', () => {
      // Test that 1.5000001 matches 1.50 (within tolerance)
      const result = findCheckoutLinkByWeight(1.5000001, mockCheckoutLinks);
      expect(result).toBe('https://shopee.ph/product/3');
    });
  });

  describe('batchFindCheckoutLinks', () => {
    it('processes multiple weights efficiently', () => {
      const weights = ['21.5', '1.5', '2', '99.9'];
      const resultMap = batchFindCheckoutLinks(weights, mockCheckoutLinks);

      expect(resultMap.get('21.5')).toBe('https://shopee.ph/product/21');
      expect(resultMap.get('1.5')).toBe('https://shopee.ph/product/3');
      expect(resultMap.get('2')).toBe('https://shopee.ph/product/4');
      expect(resultMap.get('99.9')).toBe('');
    });

    it('handles duplicate weights without re-processing', () => {
      const weights = ['21.5', '21.5', '21.5'];
      const resultMap = batchFindCheckoutLinks(weights, mockCheckoutLinks);

      expect(resultMap.size).toBe(1);
      expect(resultMap.get('21.5')).toBe('https://shopee.ph/product/21');
    });

    it('handles mixed string and number inputs', () => {
      const weights = ['1.5', 2, '21.50'];
      const resultMap = batchFindCheckoutLinks(weights, mockCheckoutLinks);

      expect(resultMap.get('1.5')).toBe('https://shopee.ph/product/3');
      expect(resultMap.get('2')).toBe('https://shopee.ph/product/4');
      expect(resultMap.get('21.50')).toBe('https://shopee.ph/product/21');
    });

    it('returns empty map for empty weights array', () => {
      const resultMap = batchFindCheckoutLinks([], mockCheckoutLinks);
      expect(resultMap.size).toBe(0);
    });
  });
});
