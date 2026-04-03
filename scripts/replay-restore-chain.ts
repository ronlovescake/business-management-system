import fs from 'fs';

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import { getBackupDirectory } from '@/lib/backup-storage';
import { readManifest } from '@/app/api/backup/backupRouteUtils';
import { planRestoreChain } from '@/lib/backup/restorePlanner';
import { executeReplayPlan } from '@/lib/backup/replayExecutor';
import {
  collectRestoreVerificationSnapshot,
  compareRestoreVerificationSnapshots,
} from '@/lib/backup/restoreVerification';

type ParsedArgs = {
  folder?: string;
  timestamp?: string;
  databaseUrl?: string;
  envFile?: string;
};

function printUsage() {
  console.error(
    [
      'Usage: npm run restore:replay -- --folder <backup-folder>',
      '   or: npm run restore:replay -- --timestamp <backup-timestamp>',
      '',
      'Optional flags:',
      '  --database-url <url>   Override DATABASE_URL for this replay run',
      '  --env-file <path>      Load environment variables from a specific file',
    ].join('\n')
  );
}

function parseArgs(argv: string[]) {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--folder' && next) {
      parsed.folder = next;
      index += 1;
      continue;
    }

    if (arg === '--timestamp' && next) {
      parsed.timestamp = next;
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
  const selectedEnvFile = envFile || process.env.RESTORE_REPLAY_ENV_FILE;
  if (selectedEnvFile && fs.existsSync(selectedEnvFile)) {
    dotenv.config({ path: selectedEnvFile, override: false });
    return;
  }

  if (!process.env.DATABASE_URL && fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local', override: false });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.folder && !args.timestamp) {
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

  try {
    const plan = planRestoreChain({
      folder: args.folder,
      timestamp: args.timestamp,
    });

    if (plan.status === 'invalid') {
      throw new Error(
        `Replay plan is invalid for ${plan.targetFolder}: ${plan.errors.join('; ')}`
      );
    }

    const result = await executeReplayPlan(plan, prisma);
    console.log(`Replay target: ${plan.targetFolder}`);
    console.log(`Applied replay steps: ${result.appliedSteps}`);

    const backupDir = getBackupDirectory();
    const targetManifest = readManifest(backupDir, plan.targetFolder);
    if (!targetManifest?.restoreVerification) {
      console.warn(
        'Target backup manifest does not include restore verification metadata; replay completed without final snapshot verification.'
      );
      await prisma.$disconnect();
      process.exit(0);
    }

    const actualSnapshot = await collectRestoreVerificationSnapshot(prisma);
    const comparison = compareRestoreVerificationSnapshots(
      targetManifest.restoreVerification,
      actualSnapshot
    );

    if (
      comparison.mismatchedEntries.length > 0 ||
      comparison.missingEntries.length > 0
    ) {
      console.error('Replay verification failed.');
      for (const mismatch of comparison.mismatchedEntries) {
        console.error(
          `- ${mismatch.expected.key}: expected ${mismatch.expected.count}, got ${mismatch.actual.count}`
        );
      }
      for (const missing of comparison.missingEntries) {
        console.error(`- Missing ${missing.key}`);
      }
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('Replay verification passed.');
    await prisma.$disconnect();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Replay failed');
    await prisma.$disconnect();
    process.exit(1);
  }
}

void main();
