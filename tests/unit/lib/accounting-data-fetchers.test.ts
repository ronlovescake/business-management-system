import { describe, it, expect } from 'vitest';
import { getPaidAtDate } from '@/lib/accounting/data-fetchers';

// This is intentionally a minimal shape to avoid DB coupling.

describe('accounting data-fetchers - getPaidAtDate', () => {
  it('prefers packedDate (completion) over other dates', () => {
    const tx = {
      orderDate: '2025-12-07',
      packedDate: '2026-01-15',
      statusChanges: [
        { newStatus: 'shipped', changedAt: new Date('2026-01-14') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('prefers paid-status change timestamps over orderDate when packedDate is missing', () => {
    const tx = {
      orderDate: '2025-12-07',
      statusChanges: [
        { newStatus: 'shipped', changedAt: new Date('2026-01-14') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-14');
  });

  it('falls back to earliest paid-status change when orderDate is missing', () => {
    const tx = {
      orderDate: null,
      statusChanges: [
        { newStatus: 'shipped', changedAt: new Date('2026-01-10') },
        { newStatus: 'shipped', changedAt: new Date('2026-01-11') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-10');
  });

  it('for post-cutover transactions, prefers the paid-status change timestamp over orderDate', () => {
    const tx = {
      orderDate: '2026-01-20',
      statusChanges: [
        { newStatus: 'shipped', changedAt: new Date('2026-02-10') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-02-10');
  });
});
