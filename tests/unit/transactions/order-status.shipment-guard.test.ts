import { describe, expect, it } from 'vitest';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';

const warehouseShipmentStatuses = new Set([
  'for pickup',
  'sorting',
  'delivered',
]);

function canSetInTransitForShipmentStatus(shipmentStatus: string): boolean {
  const normalized = normalizeOrderStatus(shipmentStatus);
  return !warehouseShipmentStatuses.has(normalized);
}

describe('transaction order status backward guard semantics', () => {
  it('treats warehouse-stage shipment statuses as blocked for In Transit', () => {
    expect(canSetInTransitForShipmentStatus('For Pickup')).toBe(false);
    expect(canSetInTransitForShipmentStatus('Sorting')).toBe(false);
    expect(canSetInTransitForShipmentStatus('Delivered')).toBe(false);
  });

  it('allows In Transit for pre-warehouse shipment statuses', () => {
    expect(canSetInTransitForShipmentStatus('In Transit')).toBe(true);
    expect(canSetInTransitForShipmentStatus('Manila Port')).toBe(true);
    expect(canSetInTransitForShipmentStatus('With Pier Gatepass')).toBe(true);
    expect(canSetInTransitForShipmentStatus('PH Warehouse')).toBe(true);
  });
});
