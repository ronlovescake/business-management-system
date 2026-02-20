import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject } as Deferred<T>;
};

const { mockRequireAdmin, mockExistsSync, mockReadFileSync, mockPrisma } =
  vi.hoisted(() => ({
    mockRequireAdmin: vi.fn().mockResolvedValue(undefined),
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockPrisma: {
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn(),
    },
  }));

vi.mock('@/lib/auth/session', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

import { POST as restorePost } from '@/app/api/restore/route';

describe('Backup/Restore atomic hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockExistsSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('MANIFEST.json')) {
        return false;
      }
      if (filePath.endsWith('.json')) {
        return true;
      }
      return false;
    });

    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        tables: {
          customers: { data: [{ id: 1, name: 'Alice' }] },
          transactions: { data: [{ id: 10, customerId: 1, totalAmount: 100 }] },
        },
      })
    );
  });

  it('aborts restore in atomic mode when one table fails', async () => {
    const customerDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    const transactionDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockRejectedValue(new Error('Simulated failure')),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        customer: customerDelegate,
        transaction: transactionDelegate,
      };
      return callback(tx as never);
    });

    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers', 'transactions'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.abortedAt).toBe('transactions');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(customerDelegate.createMany).toHaveBeenCalled();
    expect(transactionDelegate.createMany).toHaveBeenCalled();
  });

  it('continues restore in partial mode and reports per-table errors', async () => {
    const customerDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    const transactionDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockRejectedValue(new Error('Simulated failure')),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        customer: customerDelegate,
        transaction: transactionDelegate,
      };
      return callback(tx as never);
    });

    const response = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers', 'transactions'],
          forceOverwrite: true,
          stopOnError: false,
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.results.customers.count).toBe(1);
    expect(payload.results.transactions.count).toBe(0);
    expect(payload.results.transactions.error).toContain('Simulated failure');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects a second concurrent mutating restore while one is running', async () => {
    const customerDelegate = {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    };

    const firstTxDeferred = createDeferred<Record<string, unknown>>();
    mockPrisma.$transaction.mockImplementationOnce(async (callback) => {
      const tx = {
        customer: customerDelegate,
      };

      await firstTxDeferred.promise;
      return callback(tx as never);
    });

    const firstRestorePromise = restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );

    await Promise.resolve();

    const secondResponse = await restorePost(
      new NextRequest('http://localhost/api/restore', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: '2026-02-11T10-10-10',
          file: 'backup-2026-02-11T10-10-10.json',
          tables: ['customers'],
          forceOverwrite: true,
          stopOnError: true,
        }),
      })
    );

    const secondPayload = await secondResponse.json();
    expect(secondResponse.status).toBe(409);
    expect(secondPayload.success).toBe(false);
    expect(secondPayload.error).toContain('already in progress');

    firstTxDeferred.resolve({});
    const firstResponse = await firstRestorePromise;
    const firstPayload = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.success).toBe(true);
  });
});
