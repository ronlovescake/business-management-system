import fs from 'fs';
import path from 'path';

import { getBackupDirectory } from '@/lib/backup-storage';
import { sortTablesForRestore } from '@/app/api/restore/restore-order';
import { RESTORE_MODEL_MAP } from '@/app/api/restore/restoreModelMap';
import {
  getModelDelegate,
  processTableRestore,
} from '@/app/api/restore/restoreTableService';
import type { RowRecord } from '@/app/api/restore/restorePreviewUtils';
import type { RestorePlan } from '@/lib/backup/restorePlanner';

type ReplayJsonTable = {
  data?: RowRecord[];
};

type ReplayJsonBackup = {
  tables?: Record<string, ReplayJsonTable>;
};

type ReplayTableResult = {
  count: number;
  updated?: number;
  beforeCount?: number;
  afterCount?: number;
  attempted?: number;
  skipped?: number;
};

export type ReplayStepResult = {
  folder: string;
  strategy: string;
  artifactPath: string;
  tableResults: Record<string, ReplayTableResult>;
};

export type ReplayExecutionResult = {
  targetFolder: string;
  appliedSteps: number;
  stepResults: ReplayStepResult[];
};

export interface ReplayExecutorClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}

function readJsonBackup(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ReplayJsonBackup;
}

export async function executeReplayPlan(
  plan: RestorePlan,
  prismaClient: ReplayExecutorClient,
  backupDir = getBackupDirectory()
) {
  if (plan.status === 'invalid') {
    throw new Error(
      `Cannot replay invalid restore plan for ${plan.targetFolder}`
    );
  }

  const stepResults: ReplayStepResult[] = [];

  for (const step of plan.steps) {
    if (step.action === 'restore-full-dump') {
      continue;
    }

    if (!step.artifactPath) {
      throw new Error(
        `Replay step ${step.folder} is missing an artifact path in the restore plan.`
      );
    }

    const filePath = path.join(backupDir, step.artifactPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Replay artifact not found: ${filePath}`);
    }

    const backup = readJsonBackup(filePath);
    const tables = backup.tables ?? {};
    const tableResults: Record<string, ReplayTableResult> = {};
    const tableNames = sortTablesForRestore(Object.keys(tables));

    for (const tableName of tableNames) {
      const modelName = RESTORE_MODEL_MAP[tableName];
      if (!modelName) {
        throw new Error(
          `Replay does not know how to restore table ${tableName}`
        );
      }

      const tableData = tables[tableName];
      const rows = Array.isArray(tableData?.data) ? tableData.data : [];

      if (!rows.length) {
        tableResults[tableName] = {
          count: 0,
          updated: 0,
          attempted: 0,
          skipped: 0,
        };
        continue;
      }

      const result = await prismaClient.$transaction(async (tx) => {
        const delegate = getModelDelegate(tx, modelName);
        return processTableRestore(delegate, { data: rows }, false);
      });

      tableResults[tableName] = result;
    }

    stepResults.push({
      folder: step.folder,
      strategy: step.strategy,
      artifactPath: step.artifactPath,
      tableResults,
    });
  }

  return {
    targetFolder: plan.targetFolder,
    appliedSteps: stepResults.length,
    stepResults,
  } satisfies ReplayExecutionResult;
}
