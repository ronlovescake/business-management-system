import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma, mockExistsSync, mockReadFileSync } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    },
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { POST } from '@/app/api/restore/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (body: unknown, init?: NextRequestInit) =>
  new NextRequest('http://localhost/api/restore', {
    method: 'POST',
    body: JSON.stringify(body),
    ...init,
  });

describe('Restore API hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  it('rejects invalid timestamps', async () => {
    const response = await POST(
      buildRequest({
        timestamp: '../2026-02-11',
        file: 'backup.json',
        tables: ['transactions'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid timestamp format');
  });

  it('rejects invalid backup filenames', async () => {
    const response = await POST(
      buildRequest({
        timestamp: '2026-02-11T10-10-10',
        file: '../backup.json',
        tables: ['transactions'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid backup filename');
  });

  it('wraps table restore in a transaction', async () => {
    const backupData = {
      tables: {
        transactions: {
          data: [{ id: 1, Customers: 'Alice' }],
        },
      },
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(backupData));

    const txDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = { transaction: txDelegate } as unknown as Parameters<
        typeof callback
      >[0];
      return callback(tx);
    });

    const response = await POST(
      buildRequest({
        timestamp: '2026-02-11T10-10-10',
        file: 'backup.json',
        tables: ['transactions'],
        forceOverwrite: true,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(txDelegate.deleteMany).toHaveBeenCalled();
    expect(txDelegate.createMany).toHaveBeenCalled();
  });
});
