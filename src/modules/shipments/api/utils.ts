import type { ZodError } from 'zod';
import { sanitizers } from '@/lib/security/sanitize';
import {
  shipmentRecordSchema,
  type ShipmentRecordInput,
} from '@/modules/shipments/api/schemas';

type ShipmentRecord = Record<string, unknown>;

type ValidationIssue = {
  index: number;
  issues: Record<string, string>;
};

function sanitizeDateField(value: unknown): string | null {
  const sanitized = sanitizers.date(value);
  return sanitized || null;
}

function sanitizeOptionalString(value: unknown): string | null {
  const sanitized = sanitizers.name(value);
  return sanitized ? sanitized : null;
}

function sanitizeDuration(value: unknown): string | null {
  const sanitized = sanitizers.name(value);
  if (!sanitized) {
    return null;
  }
  return sanitized.length > 20 ? sanitized.slice(0, 20) : sanitized;
}

function sanitizeNotes(value: unknown): string | null {
  const sanitized = sanitizers.notes(value);
  return sanitized ? sanitized : null;
}

const SHIPMENT_STATUS_MAP: Record<
  string,
  ShipmentRecordInput['Shipment Status']
> = {
  pending: 'Pending',
  'in transit': 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  processing: 'Processing',
  'on hold': 'On Hold',
  '': '',
};

function sanitizeShipmentStatus(
  value: unknown
): ShipmentRecordInput['Shipment Status'] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const sanitized = sanitizers.name(value)?.trim();
  if (!sanitized) {
    return '';
  }

  const mapped = SHIPMENT_STATUS_MAP[sanitized.toLowerCase()];
  return mapped ?? undefined;
}

function buildValidationErrors(error: ZodError): Record<string, string> {
  return error.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    acc[key] = issue.message;
    return acc;
  }, {});
}

export function sanitizeShipmentRecord(
  record: ShipmentRecord
): ShipmentRecordInput {
  const numberOrZero = (value: unknown, decimals = 2): number =>
    sanitizers.number(value, { min: 0, decimals }) ?? 0;

  const sacks = numberOrZero(record['No. Of Sacks'], 0);
  const totalCBM = numberOrZero(record['Total CBM']);
  const weight = numberOrZero(record['Weight']);
  const fee = numberOrZero(record['Fee']);

  const status = sanitizeShipmentStatus(record['Shipment Status']);
  const duration = sanitizeDuration(record['Duration']);
  const notes = sanitizeNotes(record['Notes']);

  return {
    id:
      typeof record.id === 'number' && Number.isFinite(record.id)
        ? record.id
        : undefined,
    'Shipment Code': sanitizers.productCode(record['Shipment Code']) || '',
    'CV Number': sanitizeOptionalString(record['CV Number']) ?? undefined,
    'No. Of Sacks': Math.round(sacks),
    'Total CBM': totalCBM,
    Weight: weight,
    Fee: fee,
    'Shipment Status': status,
    'Date Created': sanitizeDateField(record['Date Created']) ?? undefined,
    'Date Delivered': sanitizeDateField(record['Date Delivered']) ?? undefined,
    Duration: duration ?? undefined,
    Notes: notes ?? undefined,
  } satisfies ShipmentRecordInput;
}

export function validateSingleShipment(payload: unknown):
  | { success: true; shipment: ShipmentRecordInput }
  | {
      success: false;
      errors: Record<string, string>;
    } {
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      errors: { payload: 'Invalid shipment payload' },
    };
  }

  const sanitized = sanitizeShipmentRecord(payload as ShipmentRecord);
  const validation = shipmentRecordSchema.safeParse(sanitized);

  if (!validation.success) {
    return {
      success: false,
      errors: buildValidationErrors(validation.error),
    };
  }

  return { success: true, shipment: validation.data };
}

export function validateShipmentRecords(payload: unknown[]): {
  valid: ShipmentRecordInput[];
  invalid: ValidationIssue[];
} {
  const valid: ShipmentRecordInput[] = [];
  const invalid: ValidationIssue[] = [];

  payload.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      invalid.push({ index, issues: { payload: 'Invalid shipment entry' } });
      return;
    }

    const sanitized = sanitizeShipmentRecord(entry as ShipmentRecord);
    const result = shipmentRecordSchema.safeParse(sanitized);

    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index, issues: buildValidationErrors(result.error) });
    }
  });

  return { valid, invalid };
}
