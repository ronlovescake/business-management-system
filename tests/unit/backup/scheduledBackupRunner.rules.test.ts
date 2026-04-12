/**
 * Scheduled Backup Runner — Business-Rule-Mapped Tests
 *
 * Tests the pure functions exported (or accessible) from scheduledBackupRunner.ts
 *
 * Since the pure functions are not exported individually, we test them via
 * the exported runScheduledBackupJob() and ScheduledBackupConfigurationError.
 * We also mock dependencies to isolate schedule logic.
 *
 * Rules Covered (admin-backup-restore.md):
 *  Schedule parsing: parseScheduleTime, parseScheduleCadence, parseScheduleDayOfWeek
 *  Period calculation: buildDateKey, shiftDateKey, getSchedulePeriodKey
 *  Due check: isCurrentScheduledPeriodDueNow
 *  Catch-up: buildMissedDateKeys
 *  Skip: findExistingBackupForToday dedup
 *  Config errors: ScheduledBackupConfigurationError
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — isolate from filesystem / DB
// ---------------------------------------------------------------------------
const mockGetBackupDirectory = vi.hoisted(() => vi.fn().mockReturnValue('/tmp/backups'));
const mockPruneExpiredBackups = vi.hoisted(() => vi.fn().mockReturnValue({ deleted: 0 }));
const mockCreateBackupJob = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    backup: { timestamp: '2026-04-08T12-00-00', strategy: 'full' },
    manifest: { strategy: 'full', files: [], scheduler: null },
  })
);
const mockWriteFileAtomic = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockFindLatestBackupByStrategy = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockListBackupFoldersDescending = vi.hoisted(() => vi.fn().mockReturnValue([]));
const mockParseTimestampToDate = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockReadManifest = vi.hoisted(() => vi.fn().mockReturnValue(null));

vi.mock('@/lib/backup-storage', () => ({
  getBackupDirectory: mockGetBackupDirectory,
}));
vi.mock('@/lib/backup/backupRetention', () => ({
  pruneExpiredBackups: mockPruneExpiredBackups,
}));
vi.mock('@/app/api/backup/route', () => ({
  createBackupJob: mockCreateBackupJob,
}));
vi.mock('@/app/api/backup/backupRouteFileOps', () => ({
  writeFileAtomic: mockWriteFileAtomic,
}));
vi.mock('@/app/api/backup/backupRouteUtils', () => ({
  findLatestBackupByStrategy: mockFindLatestBackupByStrategy,
  listBackupFoldersDescending: mockListBackupFoldersDescending,
  parseTimestampToDate: mockParseTimestampToDate,
  readManifest: mockReadManifest,
}));
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false) },
  existsSync: vi.fn().mockReturnValue(false),
}));

import {
  runScheduledBackupJob,
  ScheduledBackupConfigurationError,
} from '@/lib/backup/scheduledBackupRunner';
import type { SchedulerRequestBody } from '@/lib/backup/scheduledBackupRunner';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function withTime(isoString: string) {
  vi.setSystemTime(new Date(isoString));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scheduled Backup Runner', () => {
  // =========================================================================
  // Configuration Error
  // =========================================================================
  describe('ScheduledBackupConfigurationError', () => {
    it('is an instance of Error with correct name', () => {
      const err = new ScheduledBackupConfigurationError('bad config');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ScheduledBackupConfigurationError');
      expect(err.message).toBe('bad config');
    });
  });

  // =========================================================================
  // Schedule Time Parsing (via config error on invalid time)
  // =========================================================================
  describe('parseScheduleTime validation', () => {
    it('throws ScheduledBackupConfigurationError for invalid scheduleTime format', async () => {
      withTime('2026-04-08T12:00:00Z');
      await expect(
        runScheduledBackupJob({ scheduleTime: 'not-a-time' })
      ).rejects.toThrow(ScheduledBackupConfigurationError);
    });

    it('throws for time with single-digit hour', async () => {
      withTime('2026-04-08T12:00:00Z');
      await expect(
        runScheduledBackupJob({ scheduleTime: '9:00' })
      ).rejects.toThrow(ScheduledBackupConfigurationError);
    });

    it('accepts valid HH:MM schedule time (does not throw config error)', async () => {
      withTime('2026-04-08T22:00:00Z');
      // With no existing backups, the job should either skip (not due) or run
      const result = await runScheduledBackupJob({
        scheduleTime: '22:00',
        scheduleCadence: 'daily',
        timeZone: 'UTC',
      });
      // Should not throw config error — result has backup data from createBackupJob
      expect(mockCreateBackupJob).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Schedule Cadence Parsing
  // =========================================================================
  describe('parseScheduleCadence', () => {
    it('weekly cadence with invalid dayOfWeek throws a configuration error', async () => {
      withTime('2026-04-08T12:00:00Z');
      // parseScheduleDayOfWeek('invalid-day') returns null
      // which triggers a ScheduledBackupConfigurationError.
      await expect(
        runScheduledBackupJob({
          scheduleCadence: 'weekly',
          scheduleDayOfWeek: 'invalid-day',
          scheduleTime: '22:00',
        })
      ).rejects.toThrow(
        'BACKUP_AUTO_DAY_OF_WEEK must be a weekday name or 0-6'
      );
    });

    it('daily cadence does not require dayOfWeek', async () => {
      withTime('2026-04-08T12:30:00Z');
      const result = await runScheduledBackupJob({
        scheduleCadence: 'daily',
        scheduleTime: '12:00',
        timeZone: 'UTC',
      });
      // Due at 12:00, current is 12:30, should run
      expect(mockCreateBackupJob).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Skip Logic — Dedup (skipIfAlreadyCompletedToday)
  // =========================================================================
  describe('skip-if-already-completed dedup', () => {
    it('skips when existing backup found for same period', async () => {
      withTime('2026-04-08T12:30:00Z');
      // Simulate existing backup found
      mockListBackupFoldersDescending.mockReturnValue([
        '2026-04-08T12-00-00',
      ]);
      mockReadManifest.mockReturnValue({
        strategy: 'full',
        format: 'dump',
        timestamp: '2026-04-08T12-00-00',
        files: [{ name: 'backup.dump', size: 1024 }],
      });
      mockParseTimestampToDate.mockReturnValue(new Date('2026-04-08T12:00:00Z'));

      const result = await runScheduledBackupJob({
        strategy: 'full',
        scheduleCadence: 'daily',
        scheduleTime: '12:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: true,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/already exists/i);
      expect(mockCreateBackupJob).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Not Due Yet — Skip
  // =========================================================================
  describe('not-due-yet logic', () => {
    it('skips when scheduled time has not arrived (daily)', async () => {
      withTime('2026-04-08T08:00:00Z');

      const result = await runScheduledBackupJob({
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
        allowCatchUpBeforeScheduledTime: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/not due yet/i);
    });

    it('runs when scheduled time has arrived (daily)', async () => {
      withTime('2026-04-08T22:15:00Z');

      const result = await runScheduledBackupJob({
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
      });

      expect(mockCreateBackupJob).toHaveBeenCalledTimes(1);
      expect(result.prune).toBeDefined();
    });
  });

  // =========================================================================
  // Weekly cadence with dayOfWeek
  // =========================================================================
  describe('weekly scheduling', () => {
    it('skips when not the scheduled day of week', async () => {
      // April 8, 2026 is a Wednesday (day 3)
      withTime('2026-04-08T22:30:00Z');

      const result = await runScheduledBackupJob({
        strategy: 'full',
        scheduleCadence: 'weekly',
        scheduleDayOfWeek: 'sunday', // 0
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
        allowCatchUpBeforeScheduledTime: false,
      });

      expect(result.skipped).toBe(true);
    });

    it('runs on the scheduled day of week at the right time', async () => {
      // April 12, 2026 is a Sunday (day 0)
      withTime('2026-04-12T22:30:00Z');

      const result = await runScheduledBackupJob({
        strategy: 'full',
        scheduleCadence: 'weekly',
        scheduleDayOfWeek: 'sunday',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
      });

      expect(result.skipped).toBeUndefined();
      expect(mockCreateBackupJob).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Catch-Up Logic
  // =========================================================================
  describe('catch-up for missed schedules', () => {
    it('runs catch-up when there are missed periods', async () => {
      // It's 08:00 UTC (before 22:00 schedule), but last backup was 3 days ago
      withTime('2026-04-08T08:00:00Z');
      mockFindLatestBackupByStrategy.mockReturnValue({
        folder: '2026-04-05T22-00-00',
        manifest: { strategy: 'full', timestamp: '2026-04-05T22-00-00', files: [] },
      });
      mockParseTimestampToDate.mockReturnValue(new Date('2026-04-05T22:00:00Z'));

      const result = await runScheduledBackupJob({
        strategy: 'full',
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
        allowCatchUpBeforeScheduledTime: true,
      });

      expect(result.skipped).toBeUndefined();
      expect(mockCreateBackupJob).toHaveBeenCalledTimes(1);
      // Scheduler metadata should include catchUp flag
      const callArgs = mockCreateBackupJob.mock.calls[0][0];
      expect(callArgs.scheduler.catchUp).toBe(true);
      expect(callArgs.scheduler.missedDateKeys.length).toBeGreaterThan(0);
    });

    it('does not catch up when allowCatchUpBeforeScheduledTime is false', async () => {
      withTime('2026-04-08T08:00:00Z');
      mockFindLatestBackupByStrategy.mockReturnValue({
        folder: '2026-04-05T22-00-00',
        manifest: { strategy: 'full', timestamp: '2026-04-05T22-00-00', files: [] },
      });
      mockParseTimestampToDate.mockReturnValue(new Date('2026-04-05T22:00:00Z'));

      const result = await runScheduledBackupJob({
        strategy: 'full',
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
        allowCatchUpBeforeScheduledTime: false,
      });

      expect(result.skipped).toBe(true);
    });
  });

  // =========================================================================
  // Differential Strategy
  // =========================================================================
  describe('differential strategy', () => {
    it('skips when no full backup baseline exists', async () => {
      withTime('2026-04-08T12:30:00Z');
      mockFindLatestBackupByStrategy.mockReturnValue(null);

      const result = await runScheduledBackupJob({
        strategy: 'differential',
        scheduleCadence: 'daily',
        scheduleTime: '12:00',
        timeZone: 'UTC',
        skipIfAlreadyCompletedToday: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/full backup baseline/i);
    });
  });

  // =========================================================================
  // Retention + Prune
  // =========================================================================
  describe('retention & pruning', () => {
    it('prunes after successful backup', async () => {
      withTime('2026-04-08T22:30:00Z');

      const result = await runScheduledBackupJob({
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
        retentionDays: 7,
      });

      expect(result.prune).toBeDefined();
      expect(mockPruneExpiredBackups).toHaveBeenCalledWith(7);
    });

    it('uses default 30-day retention when not specified', async () => {
      withTime('2026-04-08T22:30:00Z');

      await runScheduledBackupJob({
        scheduleCadence: 'daily',
        scheduleTime: '22:00',
        timeZone: 'UTC',
      });

      expect(mockPruneExpiredBackups).toHaveBeenCalledWith(30);
    });
  });
});
