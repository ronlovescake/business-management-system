import type { BackupCoverageClass } from './backupModelRegistry';
import { BACKUP_MODEL_CLASSIFICATION } from './backupModelRegistry';

export type BackupCoverageAuditResult = {
  missingModels: string[];
  unknownRegistryModels: string[];
  duplicateModels: string[];
  classifiedModels: Record<string, BackupCoverageClass>;
};

export function evaluateBackupCoverage(schemaModels: string[]) {
  const duplicateModels = Array.from(
    schemaModels.reduce((duplicates, modelName, index) => {
      if (schemaModels.indexOf(modelName) !== index) {
        duplicates.add(modelName);
      }
      return duplicates;
    }, new Set<string>())
  ).sort();

  const schemaModelSet = new Set(schemaModels);
  const registryModels = Object.keys(BACKUP_MODEL_CLASSIFICATION);

  const missingModels = schemaModels
    .filter((modelName) => !BACKUP_MODEL_CLASSIFICATION[modelName])
    .sort();

  const unknownRegistryModels = registryModels
    .filter((modelName) => !schemaModelSet.has(modelName))
    .sort();

  return {
    missingModels,
    unknownRegistryModels,
    duplicateModels,
    classifiedModels: BACKUP_MODEL_CLASSIFICATION,
  } satisfies BackupCoverageAuditResult;
}

export function formatBackupCoverageAuditErrors(
  result: BackupCoverageAuditResult
) {
  const lines: string[] = [];

  if (result.missingModels.length) {
    lines.push(
      `Missing backup classifications: ${result.missingModels.join(', ')}`
    );
  }

  if (result.unknownRegistryModels.length) {
    lines.push(
      `Unknown registry models: ${result.unknownRegistryModels.join(', ')}`
    );
  }

  if (result.duplicateModels.length) {
    lines.push(
      `Duplicate schema model names: ${result.duplicateModels.join(', ')}`
    );
  }

  return lines;
}
