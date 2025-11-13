/**
 * Final Weight Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFinalWeight,
  calculateFinalWeightAsNumber,
} from '../utils/finalWeightCalculator';

describe('Final Weight Calculator', () => {
  describe('calculateFinalWeight', () => {
    it('returns empty string for invalid inputs', () => {
      expect(calculateFinalWeight(null)).toBe('');
      expect(calculateFinalWeight(undefined)).toBe('');
      expect(calculateFinalWeight('')).toBe('');
      expect(calculateFinalWeight(0)).toBe('');
      expect(calculateFinalWeight(-5)).toBe('');
      expect(calculateFinalWeight(Number.NaN)).toBe('');
    });

    describe('fixed tiers for weights ≤ 3kg', () => {
      it('rounds to 0.5kg for weights ≤ 0.5kg', () => {
        expect(calculateFinalWeight(0.1)).toBe('0.5');
        expect(calculateFinalWeight(0.3)).toBe('0.5');
        expect(calculateFinalWeight(0.5)).toBe('0.5');
      });

      it('rounds to 1kg for weights between 0.5 and 1kg', () => {
        expect(calculateFinalWeight(0.51)).toBe('1');
        expect(calculateFinalWeight(0.7)).toBe('1');
        expect(calculateFinalWeight(1)).toBe('1');
      });

      it('rounds to 1.5kg for weights between 1 and 1.5kg', () => {
        expect(calculateFinalWeight(1.01)).toBe('1.5');
        expect(calculateFinalWeight(1.3)).toBe('1.5');
        expect(calculateFinalWeight(1.5)).toBe('1.5');
      });

      it('rounds to 2kg for weights between 1.5 and 2kg', () => {
        expect(calculateFinalWeight(1.51)).toBe('2');
        expect(calculateFinalWeight(1.8)).toBe('2');
        expect(calculateFinalWeight(2)).toBe('2');
      });

      it('rounds to 2.5kg for weights between 2 and 2.5kg', () => {
        expect(calculateFinalWeight(2.01)).toBe('2.5');
        expect(calculateFinalWeight(2.3)).toBe('2.5');
        expect(calculateFinalWeight(2.5)).toBe('2.5');
      });

      it('rounds to 3kg for weights between 2.5 and 3kg', () => {
        expect(calculateFinalWeight(2.51)).toBe('3');
        expect(calculateFinalWeight(2.8)).toBe('3');
        expect(calculateFinalWeight(3)).toBe('3');
      });
    });

    describe('polynomial formula for weights > 3kg', () => {
      it('applies polynomial formula for weights greater than 3kg', () => {
        // Test case from user: 20.3kg should result in 21.5kg
        expect(calculateFinalWeight(20.3)).toBe('21.5');
      });

      it('calculates correctly for 3.5kg', () => {
        // 3.5kg actual weight
        // polynomial = 0.0012 * 12.25 + 0.0075 * 3.5 + 0.198 = 0.0147 + 0.02625 + 0.198 = 0.23895
        // total = 3.5 + 0.23895 + 0.25 = 3.98895
        // ROUNDUP(3.98895 * 2) / 2 = ROUNDUP(7.9779) / 2 = 8 / 2 = 4
        expect(calculateFinalWeight(3.5)).toBe('4');
      });

      it('calculates correctly for 5kg', () => {
        // 5kg actual weight
        // polynomial = 0.0012 * 25 + 0.0075 * 5 + 0.198 = 0.03 + 0.0375 + 0.198 = 0.2655
        // total = 5 + 0.2655 + 0.25 = 5.5155
        // ROUNDUP(5.5155 * 2) / 2 = ROUNDUP(11.031) / 2 = 12 / 2 = 6
        expect(calculateFinalWeight(5)).toBe('6');
      });

      it('calculates correctly for 10kg', () => {
        // 10kg actual weight
        // polynomial = 0.0012 * 100 + 0.0075 * 10 + 0.198 = 0.12 + 0.075 + 0.198 = 0.393
        // total = 10 + 0.393 + 0.25 = 10.643
        // ROUNDUP(10.643 * 2) / 2 = ROUNDUP(21.286) / 2 = 22 / 2 = 11
        expect(calculateFinalWeight(10)).toBe('11');
      });

      it('rounds up to nearest 0.5kg', () => {
        // Test that it always rounds UP, never down
        // 3.1kg: polynomial = 0.0012 * 9.61 + 0.0075 * 3.1 + 0.198 = 0.234052
        // total = 3.1 + 0.234052 + 0.25 = 3.584052
        // ROUNDUP(3.584052 * 2) / 2 = ROUNDUP(7.168104) / 2 = 8 / 2 = 4
        expect(calculateFinalWeight(3.1)).toBe('4');

        // 4.1kg: polynomial = 0.0012 * 16.81 + 0.0075 * 4.1 + 0.198 = 0.248922
        // total = 4.1 + 0.248922 + 0.25 = 4.598922
        // ROUNDUP(4.598922 * 2) / 2 = ROUNDUP(9.197844) / 2 = 10 / 2 = 5
        expect(calculateFinalWeight(4.1)).toBe('5');
      });
    });

    describe('string input handling', () => {
      it('handles string inputs correctly', () => {
        expect(calculateFinalWeight('0.5')).toBe('0.5');
        expect(calculateFinalWeight('1.5')).toBe('1.5');
        expect(calculateFinalWeight('20.3')).toBe('21.5');
      });

      it('handles empty string', () => {
        expect(calculateFinalWeight('')).toBe('');
      });
    });

    describe('edge cases', () => {
      it('handles very small weights', () => {
        expect(calculateFinalWeight(0.01)).toBe('0.5');
      });

      it('handles boundary at 3kg', () => {
        expect(calculateFinalWeight(3)).toBe('3');
        expect(calculateFinalWeight(3.01)).toBe('3.5');
      });

      it('handles large weights', () => {
        // 50kg: polynomial = 0.0012 * 2500 + 0.0075 * 50 + 0.198 = 3.573
        // total = 50 + 3.573 + 0.25 = 53.823
        // ROUNDUP(53.823 * 2) / 2 = ROUNDUP(107.646) / 2 = 108 / 2 = 54
        expect(calculateFinalWeight(50)).toBe('54');

        // 100kg: polynomial = 0.0012 * 10000 + 0.0075 * 100 + 0.198 = 12.948
        // total = 100 + 12.948 + 0.25 = 113.198
        // ROUNDUP(113.198 * 2) / 2 = ROUNDUP(226.396) / 2 = 227 / 2 = 113.5
        expect(calculateFinalWeight(100)).toBe('113.5');
      });
    });
  });

  describe('calculateFinalWeightAsNumber', () => {
    it('returns number instead of string', () => {
      const result = calculateFinalWeightAsNumber(20.3);
      expect(typeof result).toBe('number');
      expect(result).toBe(21.5);
    });

    it('returns 0 for invalid inputs', () => {
      expect(calculateFinalWeightAsNumber(null)).toBe(0);
      expect(calculateFinalWeightAsNumber('')).toBe(0);
      expect(calculateFinalWeightAsNumber(0)).toBe(0);
    });

    it('handles string inputs', () => {
      expect(calculateFinalWeightAsNumber('10')).toBe(11);
    });
  });
});
