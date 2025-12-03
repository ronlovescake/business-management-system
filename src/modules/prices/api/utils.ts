import type { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { sanitizers } from '@/lib/security/sanitize';
import {
  priceRecordSchema,
  type PriceRecordInput,
} from '@/modules/prices/api/schemas';

export type PriceRecord = Record<string, unknown>;
export type PriceValidationIssue = {
  index: number;
  issues: Record<string, string>;
};

type PriceDbPayload = Prisma.PriceCreateManyInput;

const DESCRIPTION_MAX_LENGTH = 500;
const CATEGORY_MAX_LENGTH = 100;

const parseNumericField = (value: unknown): number =>
  sanitizers.number(value, { min: 0, decimals: 2 }) ?? 0;

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
  }
  return true;
};

const sanitizeOptionalDescription = (value: unknown): string | undefined => {
  const sanitized = sanitizers.description(value);
  if (!sanitized) {
    return undefined;
  }
  return sanitized.slice(0, DESCRIPTION_MAX_LENGTH);
};

const sanitizeOptionalCategory = (value: unknown): string | undefined => {
  const sanitized = sanitizers.name(value);
  if (!sanitized) {
    return undefined;
  }
  return sanitized.slice(0, CATEGORY_MAX_LENGTH);
};

const toCents = (value: number): number => Math.round(value * 100);

export function sanitizePriceRecord(record: PriceRecord): PriceRecordInput {
  return {
    id:
      typeof record.id === 'number' && Number.isFinite(record.id)
        ? record.id
        : undefined,
    'Product Code': sanitizers.productCode(record['Product Code']) || '',
    'Lower Limit': parseNumericField(record['Lower Limit']),
    'Upper Limit': parseNumericField(record['Upper Limit']),
    Prices: parseNumericField(record['Prices']),
    'Price Adjustment': parseNumericField(record['Price Adjustment']),
    description: sanitizeOptionalDescription(record.description),
    category: sanitizeOptionalCategory(record.category),
    isActive: normalizeBoolean(record.isActive),
  } satisfies PriceRecordInput;
}

export function buildValidationErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    acc[key] = issue.message;
    return acc;
  }, {});
}

export function validatePriceRecords(payload: unknown[]): {
  valid: PriceRecordInput[];
  invalid: PriceValidationIssue[];
} {
  const valid: PriceRecordInput[] = [];
  const invalid: PriceValidationIssue[] = [];

  payload.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      invalid.push({ index, issues: { payload: 'Invalid price entry' } });
      return;
    }

    const sanitized = sanitizePriceRecord(entry as PriceRecord);
    const result = priceRecordSchema.safeParse(sanitized);

    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index, issues: buildValidationErrors(result.error) });
    }
  });

  return { valid, invalid };
}

export function convertPriceDataToDb(price: PriceRecordInput): PriceDbPayload {
  return {
    productCode: price['Product Code'],
    lowerLimit: toCents(price['Lower Limit']),
    upperLimit: toCents(price['Upper Limit']),
    currentPrice: toCents(price.Prices),
    priceAdjustment: toCents(price['Price Adjustment']),
    description: price.description ?? null,
    category: price.category ?? null,
    isActive: price.isActive ?? true,
  } satisfies PriceDbPayload;
}
