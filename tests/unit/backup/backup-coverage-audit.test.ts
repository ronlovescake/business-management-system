import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';

import {
  evaluateBackupCoverage,
  formatBackupCoverageAuditErrors,
} from '@/lib/backup/backupCoverageAudit';

describe('Backup coverage audit', () => {
  it('classifies every Prisma model explicitly', () => {
    const schemaModels = Prisma.dmmf.datamodel.models.map(
      (model) => model.name
    );
    const result = evaluateBackupCoverage(schemaModels);

    expect(formatBackupCoverageAuditErrors(result)).toEqual([]);
    expect(Object.keys(result.classifiedModels)).toHaveLength(
      schemaModels.length
    );
  });
});
