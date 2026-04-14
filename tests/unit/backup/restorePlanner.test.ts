import { describe, expect, it } from 'vitest';

import {
  planRestoreFromCatalog,
  type BackupCatalogEntry,
} from '@/lib/backup/restorePlanner';

function buildEntry({
  folder,
  timestamp,
  strategy,
  format = strategy === 'full' ? 'dump' : 'json',
  baseFolder = null,
  baseTimestamp = null,
  since = null,
  until = timestamp,
}: {
  folder: string;
  timestamp: string;
  strategy: 'full' | 'differential' | 'log';
  format?: string;
  baseFolder?: string | null;
  baseTimestamp?: string | null;
  since?: string | null;
  until?: string | null;
}) {
  return {
    folder,
    date: new Date(timestamp),
    manifest: {
      timestamp,
      database: 'business_management',
      format,
      strategy,
      baseFolder,
      baseTimestamp,
      changeWindow:
        strategy === 'full'
          ? null
          : {
              since,
              until: until || timestamp,
            },
      files:
        strategy === 'full'
          ? [
              {
                name: `backup-${folder}.dump`,
                size: 100,
                path: `${folder}/backup-${folder}.dump`,
              },
            ]
          : [
              {
                name: `backup-${folder}.json`,
                size: 50,
                path: `${folder}/backup-${folder}.json`,
              },
            ],
    },
  } satisfies BackupCatalogEntry;
}

describe('restore planner', () => {
  it('returns a ready plan for a full dump backup', () => {
    const full = buildEntry({
      folder: '2026-04-01T02-00-00',
      timestamp: '2026-04-01T02:00:00.000Z',
      strategy: 'full',
    });

    const plan = planRestoreFromCatalog([full], { folder: full.folder });

    expect(plan.status).toBe('ready');
    expect(plan.requiresReplayEngine).toBe(false);
    expect(plan.disasterRecoveryReady).toBe(true);
    expect(plan.steps).toEqual([
      expect.objectContaining({
        action: 'restore-full-dump',
        supported: true,
        folder: full.folder,
      }),
    ]);
  });

  it('builds a ready chain for a differential backup', () => {
    const full = buildEntry({
      folder: '2026-04-01T02-00-00',
      timestamp: '2026-04-01T02:00:00.000Z',
      strategy: 'full',
    });
    const differential = buildEntry({
      folder: '2026-04-02T02-00-00',
      timestamp: '2026-04-02T02:00:00.000Z',
      strategy: 'differential',
      baseFolder: full.folder,
      baseTimestamp: full.manifest.timestamp,
      since: full.manifest.timestamp,
    });

    const plan = planRestoreFromCatalog([full, differential], {
      folder: differential.folder,
    });

    expect(plan.status).toBe('ready');
    expect(plan.chainFolders).toEqual([full.folder, differential.folder]);
    expect(plan.requiresReplayEngine).toBe(false);
    expect(plan.disasterRecoveryReady).toBe(true);
    expect(plan.steps[1]).toEqual(
      expect.objectContaining({
        action: 'apply-differential-json',
        supported: true,
      })
    );
  });

  it('infers a full and differential baseline for a log backup', () => {
    const full = buildEntry({
      folder: '2026-04-01T02-00-00',
      timestamp: '2026-04-01T02:00:00.000Z',
      strategy: 'full',
    });
    const differential = buildEntry({
      folder: '2026-04-02T02-00-00',
      timestamp: '2026-04-02T02:00:00.000Z',
      strategy: 'differential',
      baseFolder: full.folder,
      baseTimestamp: full.manifest.timestamp,
      since: full.manifest.timestamp,
    });
    const log1 = buildEntry({
      folder: '2026-04-02T08-00-00',
      timestamp: '2026-04-02T08:00:00.000Z',
      strategy: 'log',
      since: differential.manifest.timestamp,
      until: '2026-04-02T08:00:00.000Z',
    });
    const log2 = buildEntry({
      folder: '2026-04-02T12-00-00',
      timestamp: '2026-04-02T12:00:00.000Z',
      strategy: 'log',
      baseFolder: log1.folder,
      baseTimestamp: log1.manifest.timestamp,
      since: '2026-04-02T08:00:00.000Z',
      until: '2026-04-02T12:00:00.000Z',
    });

    const plan = planRestoreFromCatalog([full, differential, log1, log2], {
      folder: log2.folder,
    });

    expect(plan.status).toBe('ready');
    expect(plan.requiresReplayEngine).toBe(false);
    expect(plan.disasterRecoveryReady).toBe(true);
    expect(plan.chainFolders).toEqual([
      full.folder,
      differential.folder,
      log1.folder,
      log2.folder,
    ]);
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('inferred full baseline'),
        expect.stringContaining('selected differential backup'),
      ])
    );
  });

  it('returns an invalid plan when a referenced base backup is missing', () => {
    const differential = buildEntry({
      folder: '2026-04-02T02-00-00',
      timestamp: '2026-04-02T02:00:00.000Z',
      strategy: 'differential',
      baseFolder: '2026-04-01T02-00-00',
      baseTimestamp: '2026-04-01T02:00:00.000Z',
      since: '2026-04-01T02:00:00.000Z',
    });

    const plan = planRestoreFromCatalog([differential], {
      folder: differential.folder,
    });

    expect(plan.status).toBe('invalid');
    expect(plan.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('references a missing base backup'),
      ])
    );
  });
});
