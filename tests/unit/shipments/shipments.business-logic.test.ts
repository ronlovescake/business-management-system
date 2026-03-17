/**
 * Shipments Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/operations-shipments.md
 * Covers: form validation, duration calculation, statistics aggregation.
 */

import { describe, it, expect } from 'vitest';
import { ShipmentService } from '@/modules/clothing/operations/shipments/services/ShipmentService';
import type {
  ShipmentData,
  ShipmentFormData,
} from '@/modules/clothing/operations/shipments/types/shipment.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validForm = (): ShipmentFormData => ({
  shipmentCode: 'SHP-001',
  cvNumber: '',
  noOfSacks: 10,
  totalCBM: 2.5,
  weight: 50,
  fee: 1000,
  shipmentStatus: 'In Transit',
  dateCreated: new Date('2025-01-15'),
  dateDelivered: null,
  notes: '',
});

const makeShipment = (status: string, fee: number = 500): ShipmentData => ({
  id: Math.floor(Math.random() * 10000),
  'Shipment Code': 'SHP-T',
  'CV Number': '',
  'No. Of Sacks': 5,
  'Total CBM': 1,
  Weight: 20,
  Fee: fee,
  'Shipment Status': status,
  'Date Created': '2025-01-01',
  'Date Delivered': '',
  Duration: '',
  Notes: '',
});

// ---------------------------------------------------------------------------
// Section A — Validation
// ---------------------------------------------------------------------------

describe('Shipments — Validation', () => {
  it('accepts a fully valid form', () => {
    const result = ShipmentService.validateShipment(validForm());
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('rejects blank shipment code', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      shipmentCode: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.shipmentCode).toBeTruthy();
  });

  it('rejects whitespace-only shipment code', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      shipmentCode: '   ',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.shipmentCode).toBeTruthy();
  });

  it('rejects blank shipment status', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      shipmentStatus: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.shipmentStatus).toBeTruthy();
  });

  it('rejects null noOfSacks', () => {
    const form = { ...validForm(), noOfSacks: null as unknown as number };
    const result = ShipmentService.validateShipment(form);
    expect(result.errors.noOfSacks).toBeTruthy();
  });

  it('rejects negative noOfSacks', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      noOfSacks: -1,
    });
    expect(result.errors.noOfSacks).toBeTruthy();
  });

  it('accepts zero noOfSacks', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      noOfSacks: 0,
    });
    expect(result.errors.noOfSacks).toBeUndefined();
  });

  it('rejects null totalCBM', () => {
    const form = { ...validForm(), totalCBM: null as unknown as number };
    const result = ShipmentService.validateShipment(form);
    expect(result.errors.totalCBM).toBeTruthy();
  });

  it('rejects negative totalCBM', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      totalCBM: -0.1,
    });
    expect(result.errors.totalCBM).toBeTruthy();
  });

  it('rejects null weight', () => {
    const form = { ...validForm(), weight: null as unknown as number };
    const result = ShipmentService.validateShipment(form);
    expect(result.errors.weight).toBeTruthy();
  });

  it('rejects negative weight', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      weight: -5,
    });
    expect(result.errors.weight).toBeTruthy();
  });

  it('rejects null fee', () => {
    const form = { ...validForm(), fee: null as unknown as number };
    const result = ShipmentService.validateShipment(form);
    expect(result.errors.fee).toBeTruthy();
  });

  it('rejects negative fee', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      fee: -100,
    });
    expect(result.errors.fee).toBeTruthy();
  });

  it('rejects missing dateCreated', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      dateCreated: null,
    });
    expect(result.errors.dateCreated).toBeTruthy();
  });

  it('allows dateDelivered = null (optional)', () => {
    const result = ShipmentService.validateShipment({
      ...validForm(),
      dateDelivered: null,
    });
    expect(result.errors.dateDelivered).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section B — Duration Calculation
// ---------------------------------------------------------------------------

describe('Shipments — Duration Calculation', () => {
  it('returns empty string when startDate is null', () => {
    expect(
      ShipmentService.calculateDuration(null, new Date('2025-01-10'))
    ).toBe('');
  });

  it('returns empty string when endDate is null', () => {
    expect(
      ShipmentService.calculateDuration(new Date('2025-01-01'), null)
    ).toBe('');
  });

  it('calculates exact days between two dates', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-01-11');
    expect(ShipmentService.calculateDuration(start, end)).toBe('10');
  });

  it('calculates 1 day for same-day to next-day', () => {
    const start = new Date('2025-03-01');
    const end = new Date('2025-03-02');
    expect(ShipmentService.calculateDuration(start, end)).toBe('1');
  });

  it('calculateDurationFromStrings: returns empty when source is blank', () => {
    expect(ShipmentService.calculateDurationFromStrings('', '2025-01-10')).toBe(
      ''
    );
    expect(ShipmentService.calculateDurationFromStrings('2025-01-01', '')).toBe(
      ''
    );
  });

  it('calculateDurationFromStrings: parses ISO strings correctly', () => {
    const result = ShipmentService.calculateDurationFromStrings(
      '2025-01-01',
      '2025-01-11'
    );
    expect(result).toBe('10');
  });

  it('calculateDurationFromStrings: returns empty for invalid date string', () => {
    expect(
      ShipmentService.calculateDurationFromStrings('not-a-date', '2025-01-10')
    ).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Section C — Statistics Aggregation
// ---------------------------------------------------------------------------

describe('Shipments — Statistics Aggregation', () => {
  it('returns zeros for empty array', () => {
    const stats = ShipmentService.calculateStatistics([]);
    expect(stats.totalShipments).toBe(0);
    expect(stats.totalFees).toBe(0);
    expect(stats.totalSacks).toBe(0);
    expect(stats.totalCBM).toBe(0);
    expect(stats.totalWeight).toBe(0);
  });

  it('counts totalShipments = array length', () => {
    const shipments = [makeShipment('In Transit'), makeShipment('Delivered')];
    expect(ShipmentService.calculateStatistics(shipments).totalShipments).toBe(
      2
    );
  });

  it('totals fees correctly (numeric)', () => {
    const shipments = [
      makeShipment('In Transit', 300),
      makeShipment('Delivered', 700),
    ];
    expect(ShipmentService.calculateStatistics(shipments).totalFees).toBe(1000);
  });

  it('totals fees correctly when stored as "₱1,500" strings', () => {
    const s = { ...makeShipment('Delivered'), Fee: '₱1,500' };
    const stats = ShipmentService.calculateStatistics([s]);
    expect(stats.totalFees).toBe(1500);
  });

  it('counts inTransitShipments (case-insensitive)', () => {
    const shipments = [
      makeShipment('in transit'),
      makeShipment('In Transit'),
      makeShipment('Delivered'),
    ];
    expect(
      ShipmentService.calculateStatistics(shipments).inTransitShipments
    ).toBe(2);
  });

  it('counts deliveredShipments', () => {
    const shipments = [
      makeShipment('Delivered'),
      makeShipment('Delivered'),
      makeShipment('In Transit'),
    ];
    expect(
      ShipmentService.calculateStatistics(shipments).deliveredShipments
    ).toBe(2);
  });

  it('counts manilaPortShipments', () => {
    const s = makeShipment('Manila Port');
    expect(ShipmentService.calculateStatistics([s]).manilaPortShipments).toBe(
      1
    );
  });

  it('counts withPierGatepassShipments', () => {
    const s = makeShipment('With Pier Gatepass');
    expect(
      ShipmentService.calculateStatistics([s]).withPierGatepassShipments
    ).toBe(1);
  });

  it('counts phWarehouseShipments', () => {
    const s = makeShipment('PH Warehouse');
    expect(ShipmentService.calculateStatistics([s]).phWarehouseShipments).toBe(
      1
    );
  });

  it('counts forPickupShipments', () => {
    const s = makeShipment('For Pickup');
    expect(ShipmentService.calculateStatistics([s]).forPickupShipments).toBe(1);
  });

  it('sums totalSacks from numeric strings', () => {
    const shipments: ShipmentData[] = [
      { ...makeShipment('Delivered'), 'No. Of Sacks': 10 },
      { ...makeShipment('In Transit'), 'No. Of Sacks': 5 },
    ];
    expect(ShipmentService.calculateStatistics(shipments).totalSacks).toBe(15);
  });

  it('sums totalCBM', () => {
    const shipments: ShipmentData[] = [
      { ...makeShipment('Delivered'), 'Total CBM': 1.5 },
      { ...makeShipment('In Transit'), 'Total CBM': 2.5 },
    ];
    expect(ShipmentService.calculateStatistics(shipments).totalCBM).toBeCloseTo(
      4,
      5
    );
  });

  it('sums totalWeight', () => {
    const shipments: ShipmentData[] = [
      { ...makeShipment('Delivered'), Weight: 25 },
      { ...makeShipment('In Transit'), Weight: 15 },
    ];
    expect(ShipmentService.calculateStatistics(shipments).totalWeight).toBe(40);
  });
});
