import { useMemo } from 'react';
import type { Backup, BackupStrategy } from '../types';
import { STRATEGY_META, STRATEGY_SEQUENCE, parseTimestamp } from '../types';

export const resolveBackupStrategy = (backup: Backup): BackupStrategy => {
  const manifestStrategy = backup.manifest?.strategy;
  if (manifestStrategy === 'differential' || manifestStrategy === 'log') {
    return manifestStrategy;
  }
  if (manifestStrategy === 'full') {
    return manifestStrategy;
  }

  if (backup.strategy === 'differential' || backup.strategy === 'log') {
    return backup.strategy;
  }
  if (backup.strategy === 'full') {
    return backup.strategy;
  }

  return 'full';
};

export const useBackupSchedule = (backups: Backup[]) => {
  const strategyHistory = useMemo(() => {
    const latest: Partial<
      Record<BackupStrategy, { backup: Backup; date: Date }>
    > = {};

    backups.forEach((backup) => {
      const strategy = resolveBackupStrategy(backup);
      const referenceTimestamp =
        backup.manifest?.changeWindow?.until ??
        backup.manifest?.timestamp ??
        backup.timestamp;
      const date = parseTimestamp(referenceTimestamp);
      if (!date) {
        return;
      }

      const existing = latest[strategy];
      if (!existing || date > existing.date) {
        latest[strategy] = { backup, date };
      }
    });

    return latest;
  }, [backups]);

  const nextDueLookup = useMemo(() => {
    const next: Partial<Record<BackupStrategy, Date | null>> = {};

    STRATEGY_SEQUENCE.forEach((key) => {
      const lastRun = strategyHistory[key]?.date ?? null;
      if (!lastRun) {
        next[key] = null;
        return;
      }

      const clone = new Date(lastRun.getTime());
      if (key === 'full') {
        clone.setDate(clone.getDate() + 7);
        next[key] = clone;
      } else if (key === 'differential') {
        clone.setDate(clone.getDate() + 1);
        next[key] = clone;
      } else {
        next[key] = null;
      }
    });

    return next;
  }, [strategyHistory]);

  const strategySchedule = useMemo(
    () =>
      STRATEGY_SEQUENCE.map((key) => ({
        key,
        meta: STRATEGY_META[key],
        last: strategyHistory[key]?.date ?? null,
        next: nextDueLookup[key] ?? null,
      })),
    [nextDueLookup, strategyHistory]
  );

  return { strategyHistory, nextDueLookup, strategySchedule };
};
