import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

const {
  validateDumpBackup,
} = require('../../../scripts/docker/validate-dump-backup.js');

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

const tempDirs: string[] = [];

function createBackupFixture({
  strategy = 'full',
  format = 'dump',
  withManifest = true,
  checksum = null,
}: {
  strategy?: string;
  format?: string;
  withManifest?: boolean;
  checksum?: string | null;
}) {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'validate-dump-backup-')
  );
  tempDirs.push(fixtureRoot);

  const dumpPath = path.join(fixtureRoot, 'backup-2026-04-04T02-00-00.dump');
  const dumpBuffer = Buffer.from('PGDMP-test-content');
  fs.writeFileSync(dumpPath, dumpBuffer);

  if (withManifest) {
    fs.writeFileSync(
      path.join(fixtureRoot, 'MANIFEST.json'),
      JSON.stringify({
        format,
        strategy,
        files: [
          {
            name: path.basename(dumpPath),
            checksum: checksum ?? sha256(dumpBuffer),
          },
        ],
      })
    );
  }

  return dumpPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

describe('validate-dump-backup', () => {
  it('accepts a full dump with a matching manifest checksum', () => {
    const dumpPath = createBackupFixture({});

    const result = validateDumpBackup(dumpPath);

    expect(result.checksumVerified).toBe(true);
    expect(result.dumpBasename).toMatch(/\.dump$/);
    expect(result.manifest.strategy).toBe('full');
  });

  it('accepts a full backup with format all when the dump artifact is listed', () => {
    const dumpPath = createBackupFixture({ format: 'all' });

    const result = validateDumpBackup(dumpPath);

    expect(result.checksumVerified).toBe(true);
    expect(result.manifest.format).toBe('all');
  });

  it('rejects a dump when the manifest is missing', () => {
    const dumpPath = createBackupFixture({ withManifest: false });

    expect(() => validateDumpBackup(dumpPath)).toThrow(/manifest not found/i);
  });

  it('rejects non-full strategies for disaster recovery', () => {
    const dumpPath = createBackupFixture({ strategy: 'differential' });

    expect(() => validateDumpBackup(dumpPath)).toThrow(
      /only full dump backups are supported/i
    );
  });

  it('rejects checksum mismatches', () => {
    const dumpPath = createBackupFixture({ checksum: 'bad-checksum' });

    expect(() => validateDumpBackup(dumpPath)).toThrow(
      /checksum verification failed/i
    );
  });
});
