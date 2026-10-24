import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { createShipmentDetailRoutes } from '../shipmentDetailRouteFactory';
import type { ShipmentDB } from '@/types';

function buildShipment(overrides: Partial<ShipmentDB> = {}): ShipmentDB {
  return {
    id: 1,
    shipmentCode: 'KPC-OLD',
    cvNumber: null,
    noOfSacks: 1,
    totalCBM: 1,
    weight: 1,
    fee: 0,
    shipmentStatus: 'In Transit',
    dateCreated: '2026-01-01',
    dateDelivered: null,
    duration: null,
    notes: null,
    deletedAt: null,
    ...overrides,
  } as ShipmentDB;
}

describe('shipment detail route factory', () => {
  it('blocks shipment-code changes while active accounting entries exist', async () => {
    const currentShipment = buildShipment();
    const shipmentModel = {
      findUnique: vi.fn().mockResolvedValue(currentShipment),
      count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      update: vi.fn(),
    };
    const productModel = {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    };
    const routes = createShipmentDetailRoutes({
      shipmentModel,
      productModel,
      hasActiveAccountingEntriesForShipmentCode: vi
        .fn()
        .mockResolvedValue(true),
    });
    const request = new NextRequest(getTestApiUrl('/api/shipments/1'), {
      method: 'PUT',
      body: JSON.stringify({
        id: 1,
        'Shipment Code': 'KPC-NEW',
        'CV Number': '',
        'No. Of Sacks': 1,
        'Total CBM': 1,
        Weight: 1,
        Fee: 0,
        'Shipment Status': 'In Transit',
        'Date Created': '2026-01-01',
        'Date Delivered': '',
        Duration: '',
        Notes: '',
      }),
    });

    const response = await routes.PUT(request, { params: { id: '1' } });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('active transit-build or reclass entries');
    expect(shipmentModel.update).not.toHaveBeenCalled();
    expect(productModel.updateMany).not.toHaveBeenCalled();
  });
});
