import { getBackupDirectory } from '@/lib/backup-storage';
import {
  listBackupFoldersDescending,
  parseTimestampToDate,
  readManifest,
  type BackupManifestFile,
  type BackupStrategy,
} from '@/app/api/backup/backupRouteUtils';

export type BackupCatalogEntry = {
  folder: string;
  manifest: BackupManifestFile;
  date: Date | null;
};

export type RestorePlanStatus = 'ready' | 'advisory' | 'invalid';

export type RestorePlanStepAction =
  | 'restore-full-dump'
  | 'apply-differential-json'
  | 'apply-log-json';

export type RestorePlanStep = {
  folder: string;
  timestamp: string;
  strategy: BackupStrategy;
  format: string;
  action: RestorePlanStepAction;
  supported: boolean;
  artifactName?: string;
  artifactPath?: string;
  reason?: string;
};

export type RestorePlan = {
  status: RestorePlanStatus;
  targetFolder: string;
  targetTimestamp: string;
  targetStrategy: BackupStrategy;
  chainFolders: string[];
  steps: RestorePlanStep[];
  warnings: string[];
  errors: string[];
  requiresReplayEngine: boolean;
  disasterRecoveryReady: boolean;
};

type PlannedCatalogEntry = {
  entry: BackupCatalogEntry;
  source: 'explicit' | 'inferred-full' | 'inferred-differential';
};

function normalizeStrategy(manifest: BackupManifestFile): BackupStrategy {
  return manifest.strategy ?? 'full';
}

function normalizeTimestampKey(value?: string | null) {
  return value?.trim() || null;
}

function sameTimestamp(left?: string | null, right?: string | null) {
  const leftDate = parseTimestampToDate(left);
  const rightDate = parseTimestampToDate(right);

  if (leftDate && rightDate) {
    return leftDate.getTime() === rightDate.getTime();
  }

  return normalizeTimestampKey(left) === normalizeTimestampKey(right);
}

function findCatalogEntry(
  catalog: BackupCatalogEntry[],
  reference: { folder?: string | null; timestamp?: string | null }
) {
  const folder = reference.folder?.trim();
  const timestamp = reference.timestamp?.trim();

  return (
    catalog.find((entry) => (folder ? entry.folder === folder : false)) ||
    catalog.find((entry) =>
      sameTimestamp(entry.manifest.timestamp, timestamp)
    ) ||
    null
  );
}

function getDumpArtifact(manifest: BackupManifestFile) {
  return manifest.files.find((file) => file.name.endsWith('.dump'));
}

function getJsonArtifact(manifest: BackupManifestFile) {
  return manifest.files.find((file) => file.name.endsWith('.json'));
}

function buildStep(entry: PlannedCatalogEntry): RestorePlanStep {
  const { manifest } = entry.entry;
  const strategy = normalizeStrategy(manifest);

  if (strategy === 'full') {
    const dumpArtifact = getDumpArtifact(manifest);
    return {
      folder: entry.entry.folder,
      timestamp: manifest.timestamp,
      strategy,
      format: manifest.format,
      action: 'restore-full-dump',
      supported: !!dumpArtifact,
      artifactName: dumpArtifact?.name,
      artifactPath: dumpArtifact?.path,
      reason: dumpArtifact
        ? undefined
        : 'Full backup manifest does not include a PostgreSQL dump artifact.',
    };
  }

  const jsonArtifact = getJsonArtifact(manifest) ?? manifest.files[0];
  return {
    folder: entry.entry.folder,
    timestamp: manifest.timestamp,
    strategy,
    format: manifest.format,
    action:
      strategy === 'differential'
        ? 'apply-differential-json'
        : 'apply-log-json',
    supported: false,
    artifactName: jsonArtifact?.name,
    artifactPath: jsonArtifact?.path,
    reason:
      strategy === 'differential'
        ? 'Differential replay planning is available, but replay execution is not implemented yet.'
        : 'Log replay planning is available, but replay execution is not implemented yet.',
  };
}

function resolveExplicitChain(
  catalog: BackupCatalogEntry[],
  target: BackupCatalogEntry,
  errors: string[]
) {
  const chain: PlannedCatalogEntry[] = [{ entry: target, source: 'explicit' }];
  const visited = new Set<string>([target.folder]);
  let current = target;

  while (
    current.manifest.baseFolder?.trim() ||
    current.manifest.baseTimestamp?.trim()
  ) {
    const baseEntry = findCatalogEntry(catalog, {
      folder: current.manifest.baseFolder,
      timestamp: current.manifest.baseTimestamp,
    });

    if (!baseEntry) {
      errors.push(
        `Backup ${current.folder} references a missing base backup (${current.manifest.baseFolder || current.manifest.baseTimestamp}).`
      );
      break;
    }

    if (visited.has(baseEntry.folder)) {
      errors.push(
        `Restore chain contains a cycle at backup ${baseEntry.folder}.`
      );
      break;
    }

    visited.add(baseEntry.folder);
    chain.unshift({ entry: baseEntry, source: 'explicit' });
    current = baseEntry;
  }

  return chain;
}

function inferFullBaseline(
  catalog: BackupCatalogEntry[],
  anchor: BackupCatalogEntry
) {
  const anchorDate =
    parseTimestampToDate(anchor.manifest.changeWindow?.since) ?? anchor.date;

  if (!anchorDate) {
    return null;
  }

  return (
    catalog
      .filter(
        (entry) =>
          normalizeStrategy(entry.manifest) === 'full' &&
          !!entry.date &&
          entry.date.getTime() <= anchorDate.getTime()
      )
      .sort(
        (left, right) =>
          (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0)
      )[0] || null
  );
}

function inferDifferentialBaseline(
  catalog: BackupCatalogEntry[],
  fullBaseline: BackupCatalogEntry,
  firstLogEntry: BackupCatalogEntry
) {
  const firstLogTime = firstLogEntry.date?.getTime();
  const fullTime = fullBaseline.date?.getTime();

  if (!firstLogTime || !fullTime) {
    return null;
  }

  return (
    catalog
      .filter((entry) => {
        if (
          normalizeStrategy(entry.manifest) !== 'differential' ||
          !entry.date
        ) {
          return false;
        }

        const entryTime = entry.date.getTime();
        if (entryTime < fullTime || entryTime > firstLogTime) {
          return false;
        }

        return (
          entry.manifest.baseFolder === fullBaseline.folder ||
          sameTimestamp(
            entry.manifest.baseTimestamp,
            fullBaseline.manifest.timestamp
          )
        );
      })
      .sort(
        (left, right) =>
          (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0)
      )[0] || null
  );
}

function validateLogContinuity(
  chain: PlannedCatalogEntry[],
  errors: string[],
  warnings: string[]
) {
  const logEntries = chain.filter(
    (planned) => normalizeStrategy(planned.entry.manifest) === 'log'
  );

  for (let index = 0; index < logEntries.length; index += 1) {
    const current = logEntries[index]?.entry;
    const previous = logEntries[index - 1]?.entry;

    if (!current) {
      continue;
    }

    if (index === 0) {
      if (!current.manifest.baseFolder && !current.manifest.baseTimestamp) {
        warnings.push(
          `Log backup ${current.folder} does not explicitly anchor to a prior backup; the planner inferred its baseline by timestamp.`
        );
      }
      continue;
    }

    if (!previous) {
      continue;
    }

    const baseMatches =
      current.manifest.baseFolder === previous.folder ||
      sameTimestamp(
        current.manifest.baseTimestamp,
        previous.manifest.timestamp
      );

    if (!baseMatches) {
      errors.push(
        `Log backup ${current.folder} does not chain directly to previous log backup ${previous.folder}.`
      );
    }

    const previousUntil = normalizeTimestampKey(
      previous.manifest.changeWindow?.until
    );
    const currentSince = normalizeTimestampKey(
      current.manifest.changeWindow?.since
    );

    if (
      previousUntil &&
      currentSince &&
      !sameTimestamp(previousUntil, currentSince)
    ) {
      errors.push(
        `Log backup ${current.folder} has a change-window gap or overlap relative to ${previous.folder}.`
      );
    }
  }
}

export function planRestoreFromCatalog(
  catalog: BackupCatalogEntry[],
  targetReference: { folder?: string; timestamp?: string }
): RestorePlan {
  const warnings: string[] = [];
  const errors: string[] = [];
  const targetEntry = findCatalogEntry(catalog, targetReference);

  if (!targetEntry) {
    return {
      status: 'invalid',
      targetFolder: targetReference.folder || '',
      targetTimestamp: targetReference.timestamp || '',
      targetStrategy: 'full',
      chainFolders: [],
      steps: [],
      warnings,
      errors: ['Target backup could not be found in the backup catalog.'],
      requiresReplayEngine: false,
      disasterRecoveryReady: false,
    };
  }

  const targetStrategy = normalizeStrategy(targetEntry.manifest);
  const plannedChain = resolveExplicitChain(catalog, targetEntry, errors);

  if (
    plannedChain[0] &&
    normalizeStrategy(plannedChain[0].entry.manifest) !== 'full'
  ) {
    const inferredFull = inferFullBaseline(catalog, plannedChain[0].entry);
    if (inferredFull) {
      plannedChain.unshift({ entry: inferredFull, source: 'inferred-full' });
      warnings.push(
        `Restore chain for ${targetEntry.folder} required an inferred full baseline (${inferredFull.folder}) because the target chain does not explicitly start from a full backup.`
      );
    } else {
      errors.push(
        `Unable to infer a full baseline for backup ${targetEntry.folder}.`
      );
    }
  }

  if (targetStrategy === 'log') {
    const firstLog = plannedChain.find(
      (planned) => normalizeStrategy(planned.entry.manifest) === 'log'
    )?.entry;
    const fullBaseline = plannedChain.find(
      (planned) => normalizeStrategy(planned.entry.manifest) === 'full'
    )?.entry;

    if (firstLog && fullBaseline) {
      const inferredDifferential = inferDifferentialBaseline(
        catalog,
        fullBaseline,
        firstLog
      );

      if (
        inferredDifferential &&
        !plannedChain.some(
          (planned) => planned.entry.folder === inferredDifferential.folder
        )
      ) {
        const firstLogIndex = plannedChain.findIndex(
          (planned) => planned.entry.folder === firstLog.folder
        );
        plannedChain.splice(firstLogIndex, 0, {
          entry: inferredDifferential,
          source: 'inferred-differential',
        });
        warnings.push(
          `Planner selected differential backup ${inferredDifferential.folder} as the latest compatible pre-log snapshot before replaying log backups.`
        );
      }
    }

    validateLogContinuity(plannedChain, errors, warnings);
  }

  const steps = plannedChain.map(buildStep);
  const requiresReplayEngine = steps.some((step) => !step.supported);

  if (targetStrategy !== 'full') {
    warnings.push(
      'Phase 3 planning can calculate the required backup chain, but Phase 2A disaster recovery still executes only full PostgreSQL dump restores. Differential and log replay remain future work.'
    );
  }

  const disasterRecoveryReady =
    errors.length === 0 &&
    steps.length === 1 &&
    steps[0]?.action === 'restore-full-dump' &&
    steps[0]?.supported === true;

  const status: RestorePlanStatus =
    errors.length > 0
      ? 'invalid'
      : requiresReplayEngine
        ? 'advisory'
        : disasterRecoveryReady
          ? 'ready'
          : 'invalid';

  return {
    status,
    targetFolder: targetEntry.folder,
    targetTimestamp: targetEntry.manifest.timestamp,
    targetStrategy,
    chainFolders: plannedChain.map((planned) => planned.entry.folder),
    steps,
    warnings,
    errors,
    requiresReplayEngine,
    disasterRecoveryReady,
  };
}

export function buildBackupCatalog(backupDir = getBackupDirectory()) {
  return listBackupFoldersDescending(backupDir)
    .map((folder) => {
      const manifest = readManifest(backupDir, folder);
      if (!manifest) {
        return null;
      }

      return {
        folder,
        manifest,
        date: parseTimestampToDate(manifest.timestamp ?? folder),
      } satisfies BackupCatalogEntry;
    })
    .filter((entry): entry is BackupCatalogEntry => !!entry)
    .sort(
      (left, right) =>
        (left.date?.getTime() ?? 0) - (right.date?.getTime() ?? 0)
    );
}

export function planRestoreChain(
  targetReference: { folder?: string; timestamp?: string },
  backupDir = getBackupDirectory()
) {
  return planRestoreFromCatalog(buildBackupCatalog(backupDir), targetReference);
}
