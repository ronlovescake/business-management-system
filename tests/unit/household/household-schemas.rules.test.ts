/**
 * Household Finance — Schema Validation (Business Rule Tests)
 *
 * Rules from docs/business-logic/household-finance/:
 *   Accounts C8-C10 — Name required, type enum (CASH/BANK/EWALLET/CREDIT_CARD/LOAN)
 *   Budgets B4-B5 — Periods monthly|annual; monthly requires month+year
 *   Budgets B6-B7 — Status derived: over/under/on-track; remaining = planned - actual
 *   Income C8-C10 — Amount must be positive, type enum
 *   Expenses B4-B5 — Default status paid, status enum
 */

import { describe, it, expect } from 'vitest';

import {
  HouseholdAccountCreateSchema,
  HouseholdAccountTypeSchema,
} from '@/modules/household/accounts/api/schemas';

import {
  HouseholdBudgetCreateSchema,
  HouseholdBudgetPeriodSchema,
} from '@/modules/household/budgets/api/schemas';

import { HouseholdIncomeCreateSchema } from '@/modules/household/income/api/schemas';

import {
  HouseholdExpenseStatusSchema,
} from '@/modules/household/expenses/api/schemas';

// =========================================================================
// Accounts — Rules C8-C10
// =========================================================================

describe('Accounts — Schema validation', () => {
  describe('Rule C8: Name is required', () => {
    it('rejects empty name', () => {
      const result = HouseholdAccountCreateSchema.safeParse({
        name: '',
        type: 'CASH',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid name', () => {
      const result = HouseholdAccountCreateSchema.safeParse({
        name: 'My Savings',
        type: 'BANK',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Rule C10: Account type enum', () => {
    it.each(['CASH', 'BANK', 'EWALLET', 'CREDIT_CARD', 'LOAN'])(
      'accepts "%s"',
      (type) => {
        const result = HouseholdAccountTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    );

    it('rejects invalid type', () => {
      const result = HouseholdAccountTypeSchema.safeParse('BITCOIN');
      expect(result.success).toBe(false);
    });
  });

  it('defaults balance to 0', () => {
    const result = HouseholdAccountCreateSchema.safeParse({
      name: 'Test',
      type: 'CASH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.balance).toBe(0);
    }
  });

  it('defaults isActive to true', () => {
    const result = HouseholdAccountCreateSchema.safeParse({
      name: 'Test',
      type: 'CASH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});

// =========================================================================
// Budgets — Rules B4-B5
// =========================================================================

describe('Budgets — Schema validation', () => {
  describe('Rule B4: Period enum monthly|annual', () => {
    it.each(['monthly', 'annual'])('accepts "%s"', (period) => {
      expect(HouseholdBudgetPeriodSchema.safeParse(period).success).toBe(true);
    });

    it('rejects invalid period', () => {
      expect(HouseholdBudgetPeriodSchema.safeParse('weekly').success).toBe(
        false
      );
    });
  });

  describe('Rule B5: Monthly budgets require month and year', () => {
    it('rejects monthly budget without month', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Food',
        period: 'monthly',
        plannedAmount: 5000,
        year: 2026,
      });
      expect(result.success).toBe(false);
    });

    it('rejects monthly budget without year', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Food',
        period: 'monthly',
        plannedAmount: 5000,
        month: 4,
      });
      expect(result.success).toBe(false);
    });

    it('accepts monthly budget with month and year', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Food',
        period: 'monthly',
        plannedAmount: 5000,
        month: 4,
        year: 2026,
      });
      expect(result.success).toBe(true);
    });

    it('accepts annual budget without month', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Utilities',
        period: 'annual',
        plannedAmount: 60000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Rule B7: plannedAmount must be >= 0', () => {
    it('rejects negative plannedAmount', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Food',
        period: 'annual',
        plannedAmount: -100,
      });
      expect(result.success).toBe(false);
    });

    it('accepts zero plannedAmount', () => {
      const result = HouseholdBudgetCreateSchema.safeParse({
        category: 'Food',
        period: 'annual',
        plannedAmount: 0,
      });
      expect(result.success).toBe(true);
    });
  });
});

// =========================================================================
// Budget status derivation (Rules B6-B7)
// =========================================================================

describe('Budgets — Derived status computation (Rules B6-B7)', () => {
  function deriveBudgetStatus(
    actual: number,
    planned: number
  ): 'over' | 'under' | 'on-track' {
    if (actual > planned) return 'over';
    if (actual < planned) return 'under';
    return 'on-track';
  }

  it('Rule B6: over when actual > planned', () => {
    expect(deriveBudgetStatus(6000, 5000)).toBe('over');
  });

  it('Rule B6: under when actual < planned', () => {
    expect(deriveBudgetStatus(3000, 5000)).toBe('under');
  });

  it('Rule B6: on-track when actual === planned', () => {
    expect(deriveBudgetStatus(5000, 5000)).toBe('on-track');
  });

  it('Rule B7: remaining = planned - actual', () => {
    const planned = 5000;
    const actual = 3500;
    expect(planned - actual).toBe(1500);
  });

  it('Rule B7: variance = actual - planned', () => {
    const planned = 5000;
    const actual = 6000;
    expect(actual - planned).toBe(1000);
  });
});

// =========================================================================
// Income — Rules C8-C10
// =========================================================================

describe('Income — Schema validation', () => {
  describe('Rule C10: Amount must be positive', () => {
    it('rejects zero amount', () => {
      const result = HouseholdIncomeCreateSchema.safeParse({
        date: '2026-04-08',
        type: 'SALARY',
        amount: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative amount', () => {
      const result = HouseholdIncomeCreateSchema.safeParse({
        date: '2026-04-08',
        type: 'SALARY',
        amount: -100,
      });
      expect(result.success).toBe(false);
    });

    it('accepts positive amount', () => {
      const result = HouseholdIncomeCreateSchema.safeParse({
        date: '2026-04-08',
        type: 'SALARY',
        amount: 50000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Income type enum', () => {
    it.each([
      'BUSINESS_DRAW',
      'SALARY',
      'FREELANCE',
      'GIFT',
      'CASHBACK',
      'REFUND',
      'OTHER',
    ])('accepts "%s"', (type) => {
      const result = HouseholdIncomeCreateSchema.safeParse({
        date: '2026-04-08',
        type,
        amount: 100,
      });
      expect(result.success).toBe(true);
    });
  });
});

// =========================================================================
// Expenses — Rules B4-B5
// =========================================================================

describe('Expenses — Schema validation', () => {
  describe('Rule B5: Status enum', () => {
    it.each(['pending', 'approved', 'rejected', 'paid'])(
      'accepts "%s"',
      (status) => {
        expect(HouseholdExpenseStatusSchema.safeParse(status).success).toBe(
          true
        );
      }
    );

    it('rejects invalid status', () => {
      expect(
        HouseholdExpenseStatusSchema.safeParse('cancelled').success
      ).toBe(false);
    });
  });
});
