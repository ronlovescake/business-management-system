/**
 * CheckoutLinks Service Tests
 * TODO: Implement tests when repository is ready
 */

import { describe, it, expect } from 'vitest';
import { checkoutLinksService } from '../services';

describe('CheckoutLinksService', () => {
  describe('findAll', () => {
    it('should return empty array', async () => {
      const result = await checkoutLinksService.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return null', async () => {
      const result = await checkoutLinksService.findById(1);
      expect(result).toBeNull();
    });
  });
});
