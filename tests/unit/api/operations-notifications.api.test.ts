import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/operations/notifications/route';

const query = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: query } }));

const entry = (
  id: string,
  changes: string,
  metadata: Record<string, unknown> | null = null
) => ({
  id,
  changes,
  metadata,
  category: 'transactions',
  user: 'Display name',
  createdAt: new Date('2026-10-25T03:00:00Z'),
});

describe('operations notification deduplication', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns ordinary entries in a shared minute exactly once', async () => {
    query.mockResolvedValue([
      entry('one', 'Imported records'),
      entry('two', 'Created records'),
    ]);
    const response = await GET(
      new NextRequest('http://localhost/api/operations/notifications')
    );
    expect(
      (await response.json()).map((row: { id: string }) => row.id)
    ).toEqual(['one', 'two']);
  });

  it('prefers the descriptive entry but retains unrelated entries exactly once', async () => {
    const metadata = { transactionId: 7, column: 'Quantity' };
    query.mockResolvedValue([
      entry(
        'raw',
        'Updated transaction #7 - Modified: Quantity: 1 ---> 2',
        metadata
      ),
      entry('descriptive', 'Transaction #7 \u2022 Quantity changed', metadata),
      entry('other', 'Imported transaction #7', { transactionId: 7 }),
    ]);
    const response = await GET(
      new NextRequest('http://localhost/api/operations/notifications')
    );
    expect(
      (await response.json()).map((row: { id: string }) => row.id)
    ).toEqual(['descriptive', 'other']);
  });
});
