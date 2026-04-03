import { Prisma } from '@prisma/client';
import {
  evaluateBackupCoverage,
  formatBackupCoverageAuditErrors,
} from '../src/lib/backup/backupCoverageAudit';

const schemaModels = Prisma.dmmf.datamodel.models.map((model) => model.name);
const result = evaluateBackupCoverage(schemaModels);
const errors = formatBackupCoverageAuditErrors(result);

if (errors.length) {
  console.error('Backup schema coverage audit failed.');
  for (const line of errors) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log(
  `Backup schema coverage audit passed for ${schemaModels.length} Prisma models.`
);
