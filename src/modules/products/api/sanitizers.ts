import { sanitizers } from '@/lib/security/sanitize';
import type { ProductDTO } from './dto';

export type ProductImportRecord = Record<string, unknown>;

function getStringField(
  record: ProductImportRecord,
  key: string
): string | null {
  const value = record[key];
  const sanitized = sanitizers.name(value);
  return sanitized.length === 0 ? null : sanitized;
}

function getNumberField(record: ProductImportRecord, key: string): number {
  const value = record[key];
  const sanitized = sanitizers.number(value, { min: 0, decimals: 2 });
  return sanitized ?? 0;
}

export function sanitizeProductRecord(entry: unknown): ProductDTO {
  if (typeof entry !== 'object' || entry === null) {
    return defaultRecord();
  }

  const record = entry as ProductImportRecord;

  return {
    id: typeof record.id === 'number' ? record.id : undefined,
    'Shipment Code': sanitizers.productCode(record['Shipment Code']) || null,
    'CV Number': getStringField(record, 'CV Number'),
    'No. Of Sacks': getNumberField(record, 'No. Of Sacks'),
    'Total CBM': getNumberField(record, 'Total CBM'),
    Weight: getNumberField(record, 'Weight'),
    'Shipment Status': getStringField(record, 'Shipment Status'),
    'Posting Date': sanitizers.date(record['Posting Date']) || null,
    'Order Date': sanitizers.date(record['Order Date']) || null,
    Payment: getStringField(record, 'Payment'),
    'Payment Method': getStringField(record, 'Payment Method'),
    'Payment Card Id': getStringField(record, 'Payment Card Id'),
    Product: getStringField(record, 'Product'),
    'Product Code': sanitizers.productCode(record['Product Code']) || '',
    'Age Range': getStringField(record, 'Age Range'),
    Unit: getStringField(record, 'Unit'),
    'Unit Price': getNumberField(record, 'Unit Price'),
    Quantity: getNumberField(record, 'Quantity'),
    'Alibaba Shipping Cost': getNumberField(record, 'Alibaba Shipping Cost'),
    'Exchange Rates': getNumberField(record, 'Exchange Rates'),
    PHP: getNumberField(record, 'PHP'),
    'Sub Total (PHP)': getNumberField(record, 'Sub Total (PHP)'),
    'Transaction Fee': getNumberField(record, 'Transaction Fee'),
    'Grand Total': getNumberField(record, 'Grand Total'),
    "Forwarder's Fee": getNumberField(record, "Forwarder's Fee"),
    Lalamove: getNumberField(record, 'Lalamove'),
    'Packaging Cost': getNumberField(record, 'Packaging Cost'),
    'Suggested Price': getNumberField(record, 'Suggested Price'),
    'Actual Price': getNumberField(record, 'Actual Price'),
    'Base Price': getNumberField(record, 'Base Price'),
    COGS: getNumberField(record, 'COGS'),
    'Projected Sales': getNumberField(record, 'Projected Sales'),
    'Projected Profit': getNumberField(record, 'Projected Profit'),
    'Projected Profit (%)': getNumberField(record, 'Projected Profit (%)'),
    'Total Markup': getNumberField(record, 'Total Markup'),
    'Link To Post': sanitizers.url(record['Link To Post']) || null,
    'Bulk Quantity': getNumberField(record, 'Bulk Quantity'),
    'Bulk Weight': getNumberField(record, 'Bulk Weight'),
    'Weight Per Piece': getNumberField(record, 'Weight Per Piece'),
  };
}

function defaultRecord(): ProductDTO {
  return {
    id: undefined,
    'Shipment Code': null,
    'CV Number': null,
    'No. Of Sacks': 0,
    'Total CBM': 0,
    Weight: 0,
    'Shipment Status': null,
    'Posting Date': null,
    'Order Date': null,
    Payment: null,
    'Payment Method': null,
    'Payment Card Id': null,
    Product: null,
    'Product Code': '',
    'Age Range': null,
    Unit: null,
    'Unit Price': 0,
    Quantity: 0,
    'Alibaba Shipping Cost': 0,
    'Exchange Rates': 0,
    PHP: 0,
    'Sub Total (PHP)': 0,
    'Transaction Fee': 0,
    'Grand Total': 0,
    "Forwarder's Fee": 0,
    Lalamove: 0,
    'Packaging Cost': 0,
    'Suggested Price': 0,
    'Actual Price': 0,
    'Base Price': 0,
    COGS: 0,
    'Projected Sales': 0,
    'Projected Profit': 0,
    'Projected Profit (%)': 0,
    'Total Markup': 0,
    'Link To Post': null,
    'Bulk Quantity': 0,
    'Bulk Weight': 0,
    'Weight Per Piece': 0,
  };
}
