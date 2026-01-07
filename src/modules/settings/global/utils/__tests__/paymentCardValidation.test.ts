import { describe, expect, it } from 'vitest';
import { normalizePaymentCardPayload } from '../paymentCardValidation';

describe('normalizePaymentCardPayload', () => {
  it('returns trimmed data when payload is valid', () => {
    const result = normalizePaymentCardPayload({
      bank: '  BPI  ',
      label: ' Main Card ',
      nameOnCard: ' Ron Tester ',
      last4: '1234',
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      bank: 'BPI',
      label: 'Main Card',
      nameOnCard: 'Ron Tester',
      last4: '1234',
    });
  });

  it('flags missing required fields and invalid last4', () => {
    const result = normalizePaymentCardPayload({
      bank: '',
      label: 'Ops',
      nameOnCard: '',
      last4: '12',
    });

    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.errors?.bank).toBeDefined();
    expect(result.errors?.nameOnCard).toBeDefined();
    expect(result.errors?.last4).toBeDefined();
  });
});
