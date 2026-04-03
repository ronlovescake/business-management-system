#!/usr/bin/env node
/* eslint-disable no-console */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function computeFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

function validateDumpBackup(filePath, options = {}) {
  const resolvedFilePath = path.resolve(filePath);
  const requireFullStrategy = options.requireFullStrategy !== false;

  if (!fs.existsSync(resolvedFilePath)) {
    throw new Error(`Dump file not found: ${resolvedFilePath}`);
  }

  if (path.extname(resolvedFilePath) !== '.dump') {
    throw new Error(
      'Only PostgreSQL .dump files are supported for disaster-recovery restore'
    );
  }

  const backupDir = path.dirname(resolvedFilePath);
  const dumpBasename = path.basename(resolvedFilePath);
  const manifestPath = path.join(backupDir, 'MANIFEST.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Backup manifest not found next to dump file: ${manifestPath}`
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (requireFullStrategy && manifest.strategy !== 'full') {
    throw new Error(
      `Only full dump backups are supported for disaster recovery (found strategy: ${manifest.strategy || 'unknown'})`
    );
  }

  const manifestEntry = Array.isArray(manifest.files)
    ? manifest.files.find((entry) => entry && entry.name === dumpBasename)
    : null;

  if (!manifestEntry) {
    throw new Error(
      `Backup manifest does not reference dump file: ${dumpBasename}`
    );
  }

  if (
    manifest.format !== 'dump' &&
    !(
      manifest.strategy === 'full' &&
      path.extname(manifestEntry.name || '') === '.dump'
    )
  ) {
    throw new Error('Backup manifest is not for a PostgreSQL dump backup');
  }

  const expectedChecksum =
    manifestEntry.checksum ||
    (manifest.integrity && manifest.integrity.fileChecksums
      ? manifest.integrity.fileChecksums[dumpBasename]
      : undefined);

  if (!expectedChecksum) {
    throw new Error(`Backup manifest is missing checksum for ${dumpBasename}`);
  }

  const actualChecksum = computeFileSha256(resolvedFilePath);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Backup checksum verification failed for ${dumpBasename}`);
  }

  return {
    dumpFile: resolvedFilePath,
    dumpBasename,
    backupDir,
    manifestPath,
    manifest,
    checksumVerified: true,
  };
}

if (require.main === module) {
  const dumpFile = process.argv[2];

  if (!dumpFile) {
    console.error(
      'Usage: node scripts/docker/validate-dump-backup.js <dump-file>'
    );
    process.exit(1);
  }

  try {
    const result = validateDumpBackup(dumpFile);
    console.log(
      `Validated full dump backup: ${result.dumpBasename} (manifest: ${result.manifestPath})`
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Dump validation failed'
    );
    process.exit(1);
  }
}

module.exports = {
  computeFileSha256,
  validateDumpBackup,
};
