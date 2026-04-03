import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import {
  collectRestoreVerificationSnapshot,
  compareRestoreVerificationSnapshots,
  type RestoreVerificationSnapshot,
} from '@/lib/backup/restoreVerification';

const { validateDumpBackup } = require('./docker/validate-dump-backup.js');

type ParsedArgs = {
  dumpPath?: string;
  manifestPath?: string;
  databaseUrl?: string;
  envFile?: string;
};

function printUsage() {
  console.error(
    [
      'Usage: npm run restore:verify -- --dump <backup.dump>',
      '   or: npm run restore:verify -- --manifest <path/to/MANIFEST.json>',
      '',
      'Optional flags:',
      '  --database-url <url>   Override DATABASE_URL for this verification run',
      '  --env-file <path>      Load environment variables from a specific file',
    ].join('\n')
  );
}

function parseArgs(argv: string[]) {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--dump' && next) {
      parsed.dumpPath = next;
      index += 1;
      continue;
    }

    if (arg === '--manifest' && next) {
      parsed.manifestPath = next;
      index += 1;
      continue;
    }

    if (arg === '--database-url' && next) {
      parsed.databaseUrl = next;
      index += 1;
      continue;
    }

    if (arg === '--env-file' && next) {
      parsed.envFile = next;
      index += 1;
      continue;
    }
  }

  return parsed;
}

function loadEnvFile(envFile?: string) {
  const selectedEnvFile = envFile || process.env.RESTORE_VERIFY_ENV_FILE;
  if (selectedEnvFile && fs.existsSync(selectedEnvFile)) {
    dotenv.config({ path: selectedEnvFile, override: false });
    return;
  }

  if (!process.env.DATABASE_URL && fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local', override: false });
  }
}

function readManifest(manifestPath: string) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw) as {
    restoreVerification?: RestoreVerificationSnapshot;
    timestamp?: string;
    format?: string;
    strategy?: string;
  };
}

function resolveManifestPath(args: ParsedArgs) {
  if (args.dumpPath) {
    const result = validateDumpBackup(path.resolve(args.dumpPath));
    return result.manifestPath as string;
  }

  if (args.manifestPath) {
    return path.resolve(args.manifestPath);
  }

  throw new Error('A dump file or manifest path is required');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dumpPath && !args.manifestPath) {
    printUsage();
    process.exit(1);
  }

  loadEnvFile(args.envFile);

  if (args.databaseUrl) {
    process.env.DATABASE_URL = args.databaseUrl;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  const manifestPath = resolveManifestPath(args);
  const manifest = readManifest(manifestPath);
  const expectedSnapshot = manifest.restoreVerification;

  if (!expectedSnapshot || !expectedSnapshot.entries.length) {
    throw new Error(
      'Backup manifest does not contain restore verification metadata. Create a new full dump backup before running restore verification.'
    );
  }

  const actualSnapshot = await collectRestoreVerificationSnapshot();
  const comparison = compareRestoreVerificationSnapshots(
    expectedSnapshot,
    actualSnapshot
  );

  console.log(`Restore verification manifest: ${manifestPath}`);
  console.log(
    `Expected entries: ${expectedSnapshot.entries.length}, matched: ${comparison.matchedEntries.length}`
  );

  if (comparison.mismatchedEntries.length > 0) {
    console.error('\nCount mismatches:');
    for (const mismatch of comparison.mismatchedEntries) {
      console.error(
        `- ${mismatch.expected.key}: expected ${mismatch.expected.count}, got ${mismatch.actual.count}`
      );
    }
  }

  if (comparison.missingEntries.length > 0) {
    console.error('\nMissing tables after restore:');
    for (const missing of comparison.missingEntries) {
      console.error(`- ${missing.key} (${missing.schema}.${missing.table})`);
    }
  }

  if (comparison.unexpectedEntries.length > 0) {
    console.warn('\nUnexpected tables counted during verification:');
    for (const unexpected of comparison.unexpectedEntries) {
      console.warn(
        `- ${unexpected.key} (${unexpected.schema}.${unexpected.table})`
      );
    }
  }

  await prisma.$disconnect();

  if (
    comparison.mismatchedEntries.length > 0 ||
    comparison.missingEntries.length > 0
  ) {
    process.exit(1);
  }

  console.log('\nRestore verification passed.');
}

main().catch(async (error) => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  console.error(
    error instanceof Error ? error.message : 'Restore verification failed'
  );
  await prisma.$disconnect();
  process.exit(1);
});
