import path from 'path';
import { config as loadEnv } from 'dotenv';
import { beforeAll, vi } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

vi.mock('sweetalert2', () => {
  const fire = vi.fn(async () => ({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
    dismiss: undefined,
    value: true,
  }));

  const mixin = vi.fn(() => ({ fire }));

  return {
    default: {
      fire,
      mixin,
      stopTimer: vi.fn(),
      resumeTimer: vi.fn(),
      close: vi.fn(),
      isVisible: vi.fn(() => false),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showValidationMessage: vi.fn(),
      getHtmlContainer: vi.fn(() => null),
      DismissReason: {
        cancel: 'cancel',
        close: 'close',
        timer: 'timer',
        backdrop: 'backdrop',
        esc: 'esc',
      },
    },
  };
});

const envFile = process.env.INTEGRATION_ENV_FILE || '.env.test';
loadEnv({ path: path.resolve(process.cwd(), envFile) });

const requiredTables = [
  'HealthCheck',
  'Customer',
  'transactions',
  'shipments',
  'audit_logs',
];

const globalState = globalThis as typeof globalThis & {
  __integrationDbInit?: Promise<void>;
};

const shouldResetForError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const prismaCode = (error as { code?: string }).code;
  if (prismaCode === 'P2021' || prismaCode === 'P2010') {
    return true;
  }

  const message = (error as { message?: string }).message || '';
  return message.includes('does not exist') || message.includes('relation');
};

const resetTestDatabase = () => {
  execSync('node scripts/reset-test-db.js --seed', {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_ENV_FILE: envFile,
    },
  });
};

beforeAll(async () => {
  if (!globalState.__integrationDbInit) {
    globalState.__integrationDbInit = (async () => {
      const prisma = new PrismaClient();
      let shouldReset = false;

      try {
        for (const tableName of requiredTables) {
          await prisma.$queryRawUnsafe(`SELECT 1 FROM "${tableName}" LIMIT 1`);
        }

        const healthCount = await prisma.healthCheck.count();
        const baselineCustomer = await prisma.customer.findFirst({
          where: { customerName: 'Alice Johnson' },
        });
        const baselineTransaction = await prisma.transaction.findFirst({
          where: { customers: 'Alice Johnson' },
        });

        if (healthCount === 0 || !baselineCustomer || !baselineTransaction) {
          shouldReset = true;
        }
      } catch (error) {
        if (shouldResetForError(error)) {
          shouldReset = true;
        } else {
          await prisma.$disconnect();
          throw error;
        }
      }

      await prisma.$disconnect();

      if (shouldReset) {
        resetTestDatabase();

        const verifyPrisma = new PrismaClient();
        const healthCount = await verifyPrisma.healthCheck.count();
        const baselineCustomer = await verifyPrisma.customer.findFirst({
          where: { customerName: 'Alice Johnson' },
        });
        const baselineTransaction = await verifyPrisma.transaction.findFirst({
          where: { customers: 'Alice Johnson' },
        });
        await verifyPrisma.$disconnect();

        if (healthCount === 0 || !baselineCustomer || !baselineTransaction) {
          throw new Error(
            'Integration database reset completed, but baseline seed data is missing.'
          );
        }
      }
    })();
  }

  await globalState.__integrationDbInit;
});
