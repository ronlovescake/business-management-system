import { afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  autoResolveStaleAlertsInStore,
  getOpenClothingTransactionAlertsInStore,
} from '@/lib/ai/store';

const prisma = new PrismaClient();
const rollback = new Error('Monitoring test rollback');

afterAll(() => prisma.$disconnect());

describe('clothing monitoring snapshot precision', () => {
  it('resolves exact microsecond snapshots but preserves refreshed and acknowledged alerts', async () => {
    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          CREATE TEMP TABLE monitoring_precision (
            id TEXT PRIMARY KEY, "dedupeKey" TEXT NOT NULL,
            "updatedAt" TIMESTAMPTZ(6) NOT NULL,
            "businessUnit" TEXT NOT NULL, category TEXT NOT NULL,
            status TEXT NOT NULL, "evidenceJson" JSONB,
            "resolvedAt" TIMESTAMPTZ(6)
          ) ON COMMIT DROP
        `;
        await transaction.$executeRaw`
          INSERT INTO monitoring_precision
            (id, "dedupeKey", "updatedAt", "businessUnit", category, status, "evidenceJson")
          VALUES ('precision', 'clothing:line-formula-mismatch:1',
            '2026-10-30T12:00:00.123456Z', 'clothing', 'ACCOUNTING_MISMATCH',
            'OPEN', '{"transactionId":1}'::jsonb)
        `;

        const redirect = (
          query: TemplateStringsArray | Prisma.Sql,
          values: unknown[]
        ) => {
          const strings = 'strings' in query ? query.strings : query;
          return Prisma.sql(
            strings.map((part) =>
              part.replace(
                'public.ai_monitoring_alerts',
                'pg_temp.monitoring_precision'
              )
            ),
            ...('strings' in query ? query.values : values)
          );
        };
        const client = {
          $queryRaw: <Result = unknown>(
            query: TemplateStringsArray | Prisma.Sql,
            ...values: unknown[]
          ) => transaction.$queryRaw<Result>(redirect(query, values)),
          $executeRaw: (
            query: TemplateStringsArray | Prisma.Sql,
            ...values: unknown[]
          ) => transaction.$executeRaw(redirect(query, values)),
        };

        const snapshots = await getOpenClothingTransactionAlertsInStore(client);
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].updatedAtToken).toMatch(/\.123456$/);
        const rows = await transaction.$queryRaw<Array<{ updatedAt: Date }>>`
          SELECT "updatedAt" FROM monitoring_precision
        `;
        expect(
          await transaction.$executeRaw`
          UPDATE monitoring_precision SET status = 'RESOLVED'
          WHERE "updatedAt" = ${rows[0].updatedAt}
        `
        ).toBe(0);

        await transaction.$executeRaw`
          UPDATE monitoring_precision SET "updatedAt" = "updatedAt" + interval '1 microsecond'
        `;
        expect(
          await autoResolveStaleAlertsInStore(snapshots, new Date(), client)
        ).toBe(0);

        const refreshed = await getOpenClothingTransactionAlertsInStore(client);
        await transaction.$executeRaw`UPDATE monitoring_precision SET status = 'ACKNOWLEDGED'`;
        expect(
          await autoResolveStaleAlertsInStore(refreshed, new Date(), client)
        ).toBe(0);
        expect(await getOpenClothingTransactionAlertsInStore(client)).toEqual(
          []
        );

        await transaction.$executeRaw`UPDATE monitoring_precision SET status = 'OPEN'`;
        expect(
          await autoResolveStaleAlertsInStore(refreshed, new Date(), client)
        ).toBe(1);
        expect(await getOpenClothingTransactionAlertsInStore(client)).toEqual(
          []
        );
        throw rollback;
      })
    ).rejects.toBe(rollback);
  });
});
