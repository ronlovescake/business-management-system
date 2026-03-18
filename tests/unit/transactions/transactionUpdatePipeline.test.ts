import { describe, expect, it } from 'vitest';
import { sanitizeTransactionUpdateRecord } from '@/modules/transactions/api/sanitizers';
import {
  buildUpdatePayload,
  shouldRecalculateLineTotal,
} from '@/modules/transactions/api/updateHelpers';

describe('transaction update pipeline', () => {
  it('preserves Adjustment during update sanitization', () => {
    const result = sanitizeTransactionUpdateRecord({
      id: 42,
      Adjustment: '125.50',
    });

    expect(result).toEqual({
      id: 42,
      values: {
        Adjustment: 125.5,
      },
    });
  });

  it('maps Adjustment into prisma update data', () => {
    const payload = buildUpdatePayload({
      Adjustment: 75,
    });

    expect(payload).toEqual({
      adjustment: 75,
    });
  });

  it('recalculates line total when Adjustment changes', () => {
    expect(
      shouldRecalculateLineTotal({
        Adjustment: 10,
      })
    ).toBe(true);
  });
});
