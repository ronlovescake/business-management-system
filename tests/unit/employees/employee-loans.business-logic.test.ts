/**
 * Employee Loans Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/employees-employee-loans.md
 * Covers: calculateLoanMonthlyPayment, getLoanStatusColor, getLoanTypeColor.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLoanMonthlyPayment,
  getLoanStatusColor,
  getLoanTypeColor,
} from '@/app/clothing/employees/employee-loans/hooks/employeeLoanUtils';

// ---------------------------------------------------------------------------
// Section A — calculateLoanMonthlyPayment
// ---------------------------------------------------------------------------

describe('Employee Loans — calculateLoanMonthlyPayment', () => {
  it('zero interest rate → principal / months', () => {
    expect(calculateLoanMonthlyPayment(12000, 0, 12)).toBeCloseTo(1000, 5);
  });

  it('zero rate with uneven division', () => {
    expect(calculateLoanMonthlyPayment(10000, 0, 3)).toBeCloseTo(3333.33, 2);
  });

  it('standard amortization formula with interest', () => {
    // principal=12000, annualRate=12%, months=12
    // monthlyRate = 0.01; 1.01^12 ≈ 1.12682503
    // payment = 12000 * 0.01 * 1.12682503 / (1.12682503 - 1) ≈ 1066.19
    const payment = calculateLoanMonthlyPayment(12000, 12, 12);
    expect(payment).toBeCloseTo(1066.19, 0);
  });

  it('6-month term with 6% annual rate', () => {
    // monthlyRate = 0.005
    // payment = 1000 * 0.005 * 1.005^6 / (1.005^6 - 1) ≈ 169.60
    const payment = calculateLoanMonthlyPayment(1000, 6, 6);
    expect(payment).toBeCloseTo(169.6, 0);
  });

  it('single payment (1 month, no interest)', () => {
    expect(calculateLoanMonthlyPayment(5000, 0, 1)).toBeCloseTo(5000, 5);
  });
});

// ---------------------------------------------------------------------------
// Section B — getLoanStatusColor
// ---------------------------------------------------------------------------

describe('Employee Loans — getLoanStatusColor', () => {
  it('pending → yellow', () => {
    expect(getLoanStatusColor('pending')).toBe('yellow');
  });

  it('approved → blue', () => {
    expect(getLoanStatusColor('approved')).toBe('blue');
  });

  it('active → green', () => {
    expect(getLoanStatusColor('active')).toBe('green');
  });

  it('completed → teal', () => {
    expect(getLoanStatusColor('completed')).toBe('teal');
  });

  it('rejected → red', () => {
    expect(getLoanStatusColor('rejected')).toBe('red');
  });

  it('unknown status → gray', () => {
    // TypeScript would restrict this but testing runtime behavior
    expect(getLoanStatusColor('' as never)).toBe('gray');
  });
});

// ---------------------------------------------------------------------------
// Section C — getLoanTypeColor
// ---------------------------------------------------------------------------

describe('Employee Loans — getLoanTypeColor', () => {
  it('personal → blue', () => {
    expect(getLoanTypeColor('personal')).toBe('blue');
  });

  it('emergency → red', () => {
    expect(getLoanTypeColor('emergency')).toBe('red');
  });

  it('educational → violet', () => {
    expect(getLoanTypeColor('educational')).toBe('violet');
  });

  it('housing → green', () => {
    expect(getLoanTypeColor('housing')).toBe('green');
  });

  it('vehicle → orange', () => {
    expect(getLoanTypeColor('vehicle')).toBe('orange');
  });

  it('unknown type → gray', () => {
    expect(getLoanTypeColor('' as never)).toBe('gray');
  });
});
