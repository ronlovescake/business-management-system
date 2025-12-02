import { describe, expect, it } from 'vitest';
import {
  sanitizeShipmentRecord,
  validateShipmentRecords,
  validateSingleShipment,
} from '@/app/api/shipments/route';

function buildBasePayload(overrides: Record<string, unknown> = {}) {
  return {
    'Shipment Code': 'SHP-001',
    'CV Number': 'CV-100',
    'No. Of Sacks': 10,
    'Total CBM': 25,
    Weight: 100,
    Fee: 500,
    'Shipment Status': 'Pending',
    'Date Created': '2024-01-01',
    ...overrides,
  };
}

describe('Shipments route validation helpers', () => {
  it('sanitizes shipment payload values', () => {
    const record = sanitizeShipmentRecord({
      id: '123',
      'Shipment Code': ' shp-001 ',
      'CV Number': ' CV-9 ',
      'No. Of Sacks': '10.7',
      'Total CBM': '25.55',
      Weight: '1,250.75',
      Fee: '₱4,500.80',
      'Shipment Status': ' In Transit ',
      'Date Created': '2024-01-05',
      'Date Delivered': '2024-01-10',
      Duration: ' 5 days ',
      Notes: '<b>Fragile</b>',
    });

    expect(record['Shipment Code']).toBe('shp-001');
    expect(record['No. Of Sacks']).toBe(11);
    expect(record.Fee).toBeCloseTo(4500.8);
    expect(record['Shipment Status']).toBe('In Transit');
    expect(record.Notes).toBeTruthy();
  });

  it('validates a correct shipment payload', () => {
    const result = validateSingleShipment(buildBasePayload());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shipment['Shipment Code']).toBe('SHP-001');
      expect(result.shipment['No. Of Sacks']).toBe(10);
    }
  });

  it('flags invalid shipment entries in batch validation', () => {
    const { valid, invalid } = validateShipmentRecords([
      buildBasePayload({ 'Shipment Code': '' }),
      buildBasePayload({
        'Shipment Code': 'SHP-200',
        'No. Of Sacks': '5',
        'Total CBM': '10',
        Weight: '20',
        Fee: '100',
        'Shipment Status': 'Delivered',
        'Date Delivered': '2024-01-02',
      }),
    ]);

    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].issues['Shipment Code']).toBeDefined();
    expect(valid[0]['Shipment Code']).toBe('SHP-200');
    expect(valid[0]['No. Of Sacks']).toBe(5);
  });

  it('allows delivered shipments without a delivery date', () => {
    const result = validateSingleShipment(
      buildBasePayload({
        'Shipment Status': 'Delivered',
        'Date Delivered': undefined,
      })
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shipment['Shipment Status']).toBe('Delivered');
      expect(result.shipment['Date Delivered']).toBeUndefined();
    }
  });

  it('returns validation errors for malformed payloads', () => {
    const malformed = validateSingleShipment('not-an-object');
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.errors.payload).toBeDefined();
    }
  });
});
