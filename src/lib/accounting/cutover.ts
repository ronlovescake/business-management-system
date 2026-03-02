import { prisma } from '@/lib/db';

const DEFAULT_ACCOUNTING_CUTOVER = new Date(Date.UTC(2026, 0, 17));

export type AccountingModule = 'clothing' | 'generalMerchandise';

function parseCutoverDate(raw: string): Date | null {
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
    !Number.isInteger(day)
  ) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) {
    return null;
  }

  // Guard against JS date rollover (e.g., 2026-02-31).
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }

  return dt;
}

function normalizeToUtcDateOnly(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

/**
 * Accounting cutover date in UTC midnight.
 *
 * Configure via env var `ACCOUNTING_CUTOVER_DATE` in `YYYY-MM-DD`.
 *
 * Optional per-module overrides:
 * - Clothing: `ACCOUNTING_CUTOVER_DATE_CLOTHING`
 * - General Merchandise: `ACCOUNTING_CUTOVER_DATE_GM`
 * Defaults to 2026-01-17.
 */
export function getAccountingCutoverDate(
  module: AccountingModule = 'clothing'
): Date {
  const raw =
    (module === 'generalMerchandise'
      ? process.env.ACCOUNTING_CUTOVER_DATE_GM
      : process.env.ACCOUNTING_CUTOVER_DATE_CLOTHING) ??
    process.env.ACCOUNTING_CUTOVER_DATE;
  if (!raw) {
    return DEFAULT_ACCOUNTING_CUTOVER;
  }

  return parseCutoverDate(raw) ?? DEFAULT_ACCOUNTING_CUTOVER;
}

/**
 * Runtime cutover resolver for server-side routes.
 *
 * Priority (clothing module):
 * 1) DB setting (if available)
 * 2) Environment variable(s)
 * 3) Default hardcoded fallback
 *
 * General Merchandise currently uses env/default only.
 */
export async function getRuntimeAccountingCutoverDate(
  module: AccountingModule = 'clothing'
): Promise<Date> {
  const fallback = getAccountingCutoverDate(module);

  if (module !== 'clothing') {
    return fallback;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ clothingCutoverDate: Date }>>`
      SELECT "clothingCutoverDate"
      FROM "public"."accounting_settings"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    const settings = rows[0] ?? null;

    if (!settings?.clothingCutoverDate) {
      return fallback;
    }

    const normalized = normalizeToUtcDateOnly(settings.clothingCutoverDate);
    if (Number.isNaN(normalized.getTime())) {
      return fallback;
    }

    return normalized;
  } catch {
    return fallback;
  }
}
