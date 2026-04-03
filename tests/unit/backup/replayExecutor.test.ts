import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeReplayPlan } from '@/lib/backup/replayExecutor';
import type { ReplayExecutorClient } from '@/lib/backup/replayExecutor';
import type { RestorePlan } from '@/lib/backup/restorePlanner';

const tempDirs: string[] = [];

function createTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-executor-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

describe('replay executor', () => {
  it('replays differential tables in restore order', async () => {
    const backupDir = createTempDir();
    const artifactPath = '2026-04-02T02-00-00/backup-2026-04-02T02-00-00.json';
    fs.mkdirSync(path.join(backupDir, '2026-04-02T02-00-00'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(backupDir, artifactPath),
      JSON.stringify({
        tables: {
          transactions: {
            data: [{ id: 10, customerId: 1, totalAmount: 100 }],
          },
          customers: {
            data: [{ id: 1, name: 'Alice' }],
          },
        },
      })
    );

    const callOrder: string[] = [];
    const customerDelegate = {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        callOrder.push(`customers:${data.length}`);
        return { count: data.length };
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    };
    const transactionDelegate = {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn().mockImplementation(async ({ data }) => {
        callOrder.push(`transactions:${data.length}`);
        return { count: data.length };
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    };

    const replayClient: ReplayExecutorClient = {
      $transaction: async <T>(callback: (tx: unknown) => Promise<T>) =>
        callback({
          customer: customerDelegate,
          transaction: transactionDelegate,
        }),
    };

    const plan: RestorePlan = {
      status: 'advisory',
      targetFolder: '2026-04-02T02-00-00',
      targetTimestamp: '2026-04-02T02:00:00.000Z',
      targetStrategy: 'differential',
      chainFolders: ['2026-04-01T02-00-00', '2026-04-02T02-00-00'],
      warnings: [],
      errors: [],
      requiresReplayEngine: true,
      disasterRecoveryReady: false,
      steps: [
        {
          folder: '2026-04-01T02-00-00',
          timestamp: '2026-04-01T02:00:00.000Z',
          strategy: 'full',
          format: 'dump',
          action: 'restore-full-dump',
          supported: true,
          artifactPath: '2026-04-01T02-00-00/backup-2026-04-01T02-00-00.dump',
        },
        {
          folder: '2026-04-02T02-00-00',
          timestamp: '2026-04-02T02:00:00.000Z',
          strategy: 'differential',
          format: 'json',
          action: 'apply-differential-json',
          supported: false,
          artifactPath,
        },
      ],
    };

    const result = await executeReplayPlan(plan, replayClient, backupDir);

    expect(result.appliedSteps).toBe(1);
    expect(callOrder).toEqual(['customers:1', 'transactions:1']);
    expect(result.stepResults[0]?.tableResults.customers.count).toBe(1);
    expect(result.stepResults[0]?.tableResults.transactions.count).toBe(1);
  });

  it('fails when a replay artifact is missing', async () => {
    const backupDir = createTempDir();
    const replayClient: ReplayExecutorClient = {
      $transaction: async <T>(_callback: (tx: unknown) => Promise<T>) => {
        throw new Error('unexpected transaction');
      },
    };

    const plan: RestorePlan = {
      status: 'advisory',
      targetFolder: '2026-04-02T02-00-00',
      targetTimestamp: '2026-04-02T02:00:00.000Z',
      targetStrategy: 'differential',
      chainFolders: ['2026-04-01T02-00-00', '2026-04-02T02-00-00'],
      warnings: [],
      errors: [],
      requiresReplayEngine: true,
      disasterRecoveryReady: false,
      steps: [
        {
          folder: '2026-04-01T02-00-00',
          timestamp: '2026-04-01T02:00:00.000Z',
          strategy: 'full',
          format: 'dump',
          action: 'restore-full-dump',
          supported: true,
          artifactPath: '2026-04-01T02-00-00/backup-2026-04-01T02-00-00.dump',
        },
        {
          folder: '2026-04-02T02-00-00',
          timestamp: '2026-04-02T02:00:00.000Z',
          strategy: 'differential',
          format: 'json',
          action: 'apply-differential-json',
          supported: false,
          artifactPath: '2026-04-02T02-00-00/missing.json',
        },
      ],
    };

    await expect(
      executeReplayPlan(plan, replayClient, backupDir)
    ).rejects.toThrow(/Replay artifact not found/i);
  });
});
