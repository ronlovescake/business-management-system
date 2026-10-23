import { describe, expect, it } from 'vitest';
import { calculateAccountsReceivableDueDate } from '../accounts-receivable';

describe('calculateAccountsReceivableDueDate', () => {
  it('adds two calendar months and preserves the UTC time', () => {
    const shippedAt = new Date('2026-08-12T09:30:45.000Z');

    expect(calculateAccountsReceivableDueDate(shippedAt).toISOString()).toBe(
      '2026-10-12T09:30:45.000Z'
    );
  });

  it('clamps to the final day when the target month is shorter', () => {
    const shippedAt = new Date('2026-12-31T18:00:00.000Z');

    expect(calculateAccountsReceivableDueDate(shippedAt).toISOString()).toBe(
      '2027-02-28T18:00:00.000Z'
    );
  });

  it('does not mutate the shipment date', () => {
    const shippedAt = new Date('2026-10-23T12:00:00.000Z');

    calculateAccountsReceivableDueDate(shippedAt);

    expect(shippedAt.toISOString()).toBe('2026-10-23T12:00:00.000Z');
  });
});
