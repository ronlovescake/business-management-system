/**
 * Accounting Settings API Route
 * Manages accounting behavior configuration
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';

type AccountingSettingsRecord = {
  id: string;
  clothingCutoverDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

function isMissingAccountingSettingsTable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return (
    code === 'P2021' || /accounting_settings|does not exist/i.test(message)
  );
}

async function ensureAccountingSettingsTable(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "public"."accounting_settings" (
      "id" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "clothingCutoverDate" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "accounting_settings_pkey" PRIMARY KEY ("id")
    )
  `;
}

async function fetchLatestSettings(): Promise<AccountingSettingsRecord | null> {
  const rows = await prisma.$queryRaw<AccountingSettingsRecord[]>`
    SELECT "id", "createdAt", "updatedAt", "clothingCutoverDate"
    FROM "public"."accounting_settings"
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function insertSettings(
  clothingCutoverDate: Date
): Promise<AccountingSettingsRecord> {
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const rows = await prisma.$queryRaw<AccountingSettingsRecord[]>`
    INSERT INTO "public"."accounting_settings" ("id", "updatedAt", "clothingCutoverDate")
    VALUES (${id}, CURRENT_TIMESTAMP, ${clothingCutoverDate})
    RETURNING "id", "createdAt", "updatedAt", "clothingCutoverDate"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create accounting settings row');
  }

  return row;
}

async function updateSettings(
  id: string,
  clothingCutoverDate: Date
): Promise<AccountingSettingsRecord> {
  const rows = await prisma.$queryRaw<AccountingSettingsRecord[]>`
    UPDATE "public"."accounting_settings"
    SET "clothingCutoverDate" = ${clothingCutoverDate}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING "id", "createdAt", "updatedAt", "clothingCutoverDate"
  `;

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to update accounting settings row');
  }

  return row;
}

function toDateOnlyUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function parseDateOnly(raw: string): Date | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) {
    return null;
  }

  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }

  return dt;
}

function formatDateOnly(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET() {
  try {
    await ensureAccountingSettingsTable();
    let settings = await fetchLatestSettings();

    if (!settings) {
      settings = await insertSettings(
        toDateOnlyUtc(getAccountingCutoverDate('clothing'))
      );
      logger.info('Created default accounting settings');
    }

    return NextResponse.json({
      ...settings,
      clothingCutoverDate: formatDateOnly(
        toDateOnlyUtc(settings.clothingCutoverDate)
      ),
    });
  } catch (error) {
    if (isMissingAccountingSettingsTable(error)) {
      const fallbackDate = toDateOnlyUtc(getAccountingCutoverDate('clothing'));
      return NextResponse.json({
        id: 'env-default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clothingCutoverDate: formatDateOnly(fallbackDate),
      });
    }

    logger.error('Error fetching accounting settings', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounting settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureAccountingSettingsTable();
    const body = await request.json();
    const parsedDate = parseDateOnly(String(body?.clothingCutoverDate ?? ''));

    if (!parsedDate) {
      return NextResponse.json(
        {
          error:
            'Invalid clothingCutoverDate. Use YYYY-MM-DD format with a valid calendar date.',
        },
        { status: 400 }
      );
    }

    const existing = await fetchLatestSettings();

    const nextDate = toDateOnlyUtc(parsedDate);

    const saved = existing
      ? await updateSettings(existing.id, nextDate)
      : await insertSettings(nextDate);

    logger.info('Updated accounting settings', {
      id: saved.id,
      clothingCutoverDate: formatDateOnly(nextDate),
    });

    return NextResponse.json({
      ...saved,
      clothingCutoverDate: formatDateOnly(
        toDateOnlyUtc(saved.clothingCutoverDate)
      ),
    });
  } catch (error) {
    if (isMissingAccountingSettingsTable(error)) {
      return NextResponse.json(
        {
          error:
            'Accounting settings table is missing. Apply database migration 20260302120000_add_accounting_settings_cutover.',
        },
        { status: 503 }
      );
    }

    logger.error('Error updating accounting settings', error);
    return NextResponse.json(
      { error: 'Failed to update accounting settings' },
      { status: 500 }
    );
  }
}
