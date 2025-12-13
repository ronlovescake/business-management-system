import { sanitizers } from '@/lib/security/sanitize';

export const EMPTY_SHIPMENT_MARKER = '-';

const TEMPLATE_STATUS = 'prepared';

export interface TransactionRecord {
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
  'Order Status': string;
  Notes: string | null;
  'Invoice Date': string | null;
  'Packed Date': string | null;
  'Shipment Code': string | null;
}

export interface TransactionUpdateRecord {
  id: number;
  values: Partial<TransactionRecord>;
}

export function parseNumeric(value: unknown): number {
  return sanitizers.number(value, { min: 0, decimals: 2 }) ?? 0;
}

export function parseTrimmed(value: unknown): string {
  return sanitizers.name(value);
}

export function parseOptional(value: unknown): string | null {
  const trimmed = parseTrimmed(value);
  return trimmed.length === 0 ? null : trimmed;
}

export function sanitizeTransactionRecord(entry: unknown): TransactionRecord {
  if (!entry || typeof entry !== 'object') {
    return defaultRecord();
  }

  const record = entry as Record<string, unknown>;

  return {
    'Order Date': parseTrimmed(record['Order Date']),
    Customers: parseTrimmed(record['Customers']),
    'Product Code': parseTrimmed(record['Product Code']),
    Quantity: parseNumeric(record['Quantity']),
    'Unit Price': parseNumeric(record['Unit Price']),
    Discount: parseNumeric(record['Discount']),
    Adjustment: parseNumeric(record['Adjustment']),
    'Line Total': parseNumeric(record['Line Total']),
    'Order Status': parseTrimmed(record['Order Status']),
    Notes: parseOptional(record['Notes']),
    'Invoice Date': parseOptional(record['Invoice Date']),
    'Packed Date': parseOptional(record['Packed Date']),
    'Shipment Code': normalizeShipmentCode(record['Shipment Code']),
  };
}

export function sanitizeTransactionUpdateRecord(
  entry: unknown
): TransactionUpdateRecord {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Invalid transaction update payload');
  }

  const record = entry as Record<string, unknown>;
  const id = Number(record.id);
  if (!Number.isFinite(id)) {
    throw new Error('Transaction ID is required');
  }

  const values: Partial<TransactionRecord> = {};

  if ('Order Date' in record) {
    values['Order Date'] = parseTrimmed(record['Order Date']);
  }
  if ('Customers' in record) {
    values.Customers = parseTrimmed(record['Customers']);
  }
  if ('Product Code' in record) {
    values['Product Code'] = parseTrimmed(record['Product Code']);
  }
  if ('Quantity' in record) {
    values.Quantity = parseNumeric(record['Quantity']);
  }
  if ('Unit Price' in record) {
    values['Unit Price'] = parseNumeric(record['Unit Price']);
  }
  if ('Discount' in record) {
    values.Discount = parseNumeric(record['Discount']);
  }
  if ('Adjustment' in record) {
    values.Adjustment = parseNumeric(record['Adjustment']);
  }
  if ('Line Total' in record) {
    values['Line Total'] = parseNumeric(record['Line Total']);
  }
  if ('Order Status' in record) {
    values['Order Status'] = parseTrimmed(record['Order Status']);
  }
  if ('Notes' in record) {
    values.Notes = parseOptional(record['Notes']);
  }
  if ('Invoice Date' in record) {
    values['Invoice Date'] = parseOptional(record['Invoice Date']);
  }
  if ('Packed Date' in record) {
    values['Packed Date'] = parseOptional(record['Packed Date']);
  }
  if ('Shipment Code' in record) {
    values['Shipment Code'] = normalizeShipmentCode(record['Shipment Code']);
  }

  return { id, values };
}

const isZero = (value: number | undefined): boolean => value === 0;

const allNumericZero = (row: TransactionRecord): boolean =>
  isZero(row.Quantity) &&
  isZero(row['Unit Price']) &&
  isZero(row['Line Total']) &&
  isZero(row.Discount) &&
  isZero(row.Adjustment);

const lacksCoreIdentifiers = (row: TransactionRecord): boolean =>
  row['Order Date'].length === 0 &&
  row.Customers.length === 0 &&
  row['Product Code'].length === 0;

export function isTemplatePreparedRow(row: TransactionRecord): boolean {
  const status = row['Order Status']?.trim().toLowerCase() ?? '';
  if (status !== TEMPLATE_STATUS) {
    return false;
  }

  const missingIdentifiers =
    row.Customers.length === 0 || row['Product Code'].length === 0;
  return allNumericZero(row) && missingIdentifiers;
}

export function isEmptyRow(row: TransactionRecord): boolean {
  if (isTemplatePreparedRow(row)) {
    return true;
  }

  const shipmentCode = row['Shipment Code'] ?? '';
  const shipmentIsPlaceholder =
    shipmentCode.length === 0 || shipmentCode === EMPTY_SHIPMENT_MARKER;

  if (lacksCoreIdentifiers(row) && shipmentIsPlaceholder) {
    return true;
  }

  return (
    shipmentIsPlaceholder &&
    allNumericZero(row) &&
    (row.Customers.length === 0 || row['Product Code'].length === 0)
  );
}

export function isValidRow(row: TransactionRecord): boolean {
  return (
    row['Order Date'].length > 0 &&
    row.Customers.length > 0 &&
    row['Product Code'].length > 0
  );
}

function normalizeShipmentCode(value: unknown): string | null {
  const trimmed = parseTrimmed(value);
  return trimmed.length === 0 ? null : trimmed;
}

function defaultRecord(): TransactionRecord {
  return {
    'Order Date': '',
    Customers: '',
    'Product Code': '',
    Quantity: 0,
    'Unit Price': 0,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 0,
    'Order Status': '',
    Notes: null,
    'Invoice Date': null,
    'Packed Date': null,
    'Shipment Code': null,
  };
}
