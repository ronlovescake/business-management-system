import { describe, it, expect } from 'vitest';
import { calculateCashAdvanceMonthlyPayment } from '@/modules/shared/employees/cash-advance/api/calculations';

describe('calculateCashAdvanceMonthlyPayment', () => {
  it('divides amount by terms and rounds to 2 decimal places', () => {
    expect(calculateCashAdvanceMonthlyPayment(12000, 12)).toBe(1000);
  });

  it('rounds to 2 decimal places', () => {
    expect(calculateCashAdvanceMonthlyPayment(10000, 3)).toBe(3333.33);
  });

  it('returns undefined for terms = 0', () => {
    expect(calculateCashAdvanceMonthlyPayment(10000, 0)).toBeUndefined();
  });

  it('returns undefined for negative terms', () => {
    expect(calculateCashAdvanceMonthlyPayment(10000, -1)).toBeUndefined();
  });

  it('returns undefined when amount is 0 (payment would be 0 which is not positive)', () => {
    expect(calculateCashAdvanceMonthlyPayment(0, 12)).toBeUndefined();
  });

  it('returns undefined when resulting payment is not finite (Infinity)', () => {
    expect(calculateCashAdvanceMonthlyPayment(Infinity, 3)).toBeUndefined();
  });

  it('handles a typical cash advance of 5000 over 5 months', () => {
    expect(calculateCashAdvanceMonthlyPayment(5000, 5)).toBe(1000);
  });

  it('handles a cash advance of 15000 over 6 months', () => {
    expect(calculateCashAdvanceMonthlyPayment(15000, 6)).toBe(2500);
  });

  it('handles fractional result with rounding', () => {
    // 1000 / 3 = 333.333... → 333.33
    expect(calculateCashAdvanceMonthlyPayment(1000, 3)).toBe(333.33);
  });

  it('returns undefined for NaN terms', () => {
    expect(calculateCashAdvanceMonthlyPayment(1000, NaN)).toBeUndefined();
  });
});
