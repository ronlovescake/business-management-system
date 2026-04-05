import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    changeLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { queryChangeLogs } from '@/core/change-log/change-log.service';

describe('change-log search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.changeLog.findMany.mockResolvedValue([]);
    mockPrisma.changeLog.count.mockResolvedValue(0);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
  });

  it('searches business fields and excludes actor-name matching from the generic search bar', async () => {
    await queryChangeLogs({
      search: 'Missy',
      page: 1,
      limit: 25,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);

    const dataQuery = mockPrisma.$queryRaw.mock.calls[0]?.[0] as {
      strings?: string[];
      values?: unknown[];
    };

    expect(dataQuery).toBeDefined();
    expect(dataQuery.strings?.join(' ')).toContain('metadata ->>');
    expect(dataQuery.strings?.join(' ')).toContain('"oldValue" ->>');
    expect(dataQuery.strings?.join(' ')).toContain('"newValue" ->>');
    expect(dataQuery.strings?.join(' ')).toContain('ILIKE');
    expect(dataQuery.strings?.join(' ')).not.toContain(
      `COALESCE("userName", '') ILIKE`
    );
    expect(dataQuery.values).toEqual(
      expect.arrayContaining(['customers', 'productCode', 'notes', '%Missy%'])
    );
  });

  it('prioritizes prefix matches above mid-word substring matches', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await queryChangeLogs({
      search: 'ais',
      page: 1,
      limit: 25,
    });

    const dataQuery = mockPrisma.$queryRaw.mock.calls[0]?.[0] as {
      strings?: string[];
      values?: unknown[];
    };

    expect(dataQuery.strings?.join(' ')).toContain('AS search_rank');
    expect(dataQuery.strings?.join(' ')).toContain(
      'ORDER BY search_rank ASC, "createdAt" DESC'
    );
    expect(dataQuery.values).toEqual(
      expect.arrayContaining(['ais%', '%ais%', 'customers', 'productCode'])
    );
  });
});