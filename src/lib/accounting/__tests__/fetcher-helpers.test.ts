import { describe, expect, it, vi } from 'vitest';

import {
  fetchOptionalModelRows,
  findChangedAtForStatuses,
  getCancelledAtDateFromStatusChanges,
  isMissingTableError,
} from '@/lib/accounting/fetcher-helpers';

describe('accounting fetcher helpers', () => {
  it('finds the first matching status change timestamp', () => {
    const paidAt = new Date('2026-04-10T03:00:00.000Z');
    const result = findChangedAtForStatuses(
      [
        { newStatus: 'Draft', changedAt: new Date('2026-04-09T03:00:00.000Z') },
        { newStatus: 'Paid', changedAt: paidAt },
        { newStatus: 'Approved', changedAt: new Date('2026-04-11T03:00:00.000Z') },
      ],
      ['Paid', 'Approved']
    );

    expect(result).toBe(paidAt);
  });

  it('prefers forfeited over cancelled when resolving cancellation date', () => {
    const forfeitedAt = new Date('2026-04-10T03:00:00.000Z');
    const cancelledAt = new Date('2026-04-11T03:00:00.000Z');

    const result = getCancelledAtDateFromStatusChanges({
      statusChanges: [
        { newStatus: 'Cancelled', changedAt: cancelledAt },
        { newStatus: 'Forfeited', changedAt: forfeitedAt },
      ],
      updatedAt: new Date('2026-04-12T03:00:00.000Z'),
    });

    expect(result).toBe(forfeitedAt);
  });

  it('treats Prisma missing-table errors as recoverable', () => {
    expect(
      isMissingTableError({ code: 'P2021', message: 'table does not exist' })
    ).toBe(true);
    expect(isMissingTableError(new Error('other failure'))).toBe(false);
  });

  it('returns an empty array when an optional model is unavailable', async () => {
    const query = vi.fn();

    const result = await fetchOptionalModelRows({
      model: undefined,
      unavailableLogMessage: 'missing model',
      unavailableHint: 'hint',
      query,
    });

    expect(result).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});