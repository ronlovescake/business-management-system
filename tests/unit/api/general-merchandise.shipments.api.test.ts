import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl, mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma, mockPostExpenseForShipment } = vi.hoisted(() => ({
  mockPrisma: {
    generalMerchandiseShipment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    generalMerchandiseProduct: {
      groupBy: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    generalMerchandiseTransaction: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockPostExpenseForShipment: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/modules/shipments/api/expenses', () => ({
  postExpenseForShipment: mockPostExpenseForShipment,
}));

import { GET, POST } from '@/app/api/general-merchandise/shipments/route';
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
} from '@/app/api/general-merchandise/shipments/[id]/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('GM shipments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma)
    );
  });

  it('returns GM shipments with linked product counts on GET', async () => {
    mockPrisma.generalMerchandiseShipment.findMany.mockResolvedValue([
      {
        id: 1,
        shipmentCode: 'GM-SH-001',
        cvNumber: 'CV-1',
        noOfSacks: 10,
        totalCBM: 5,
        weight: 100,
        fee: 500,
        shipmentStatus: 'In Transit',
        dateCreated: '2026-03-01',
        dateDelivered: null,
        duration: null,
        notes: null,
      },
    ]);
    mockPrisma.generalMerchandiseProduct.groupBy.mockResolvedValue([
      {
        shipmentCode: 'GM-SH-001',
        _count: { _all: 2 },
        _sum: {
          grandTotal: 100,
          forwardersFee: 20,
          lalamove: 10,
          packagingCost: 5,
        },
      },
    ]);

    const response = await GET(
      buildRequest('/api/general-merchandise/shipments')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0].linkedProductCount).toBe(2);
    expect(body.data[0].linkedProductCogsTotal).toBe(135);
  });

  it('creates a single GM shipment on POST', async () => {
    mockPrisma.generalMerchandiseShipment.create.mockResolvedValue({
      id: 1,
      shipmentCode: 'GM-SH-002',
      cvNumber: null,
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: 'In Transit',
      dateCreated: null,
      dateDelivered: null,
      duration: null,
      notes: null,
    });

    const response = await POST(
      buildRequest('/api/general-merchandise/shipments', {
        method: 'POST',
        body: JSON.stringify({
          'Shipment Code': 'GM-SH-002',
          'Shipment Status': 'In Transit',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Shipment created');
  });

  it('imports GM shipments in bulk on POST array payloads', async () => {
    mockPrisma.generalMerchandiseShipment.findFirst.mockResolvedValueOnce(null);
    mockPrisma.generalMerchandiseShipment.create.mockResolvedValue({ id: 1 });

    const response = await POST(
      buildRequest('/api/general-merchandise/shipments', {
        method: 'POST',
        body: JSON.stringify([
          {
            'Shipment Code': 'GM-SH-003',
            'Shipment Status': 'In Transit',
          },
        ]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.created).toBe(1);
  });

  it('fetches a GM shipment by id', async () => {
    mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'GM-SH-001',
      cvNumber: null,
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: 'In Transit',
      dateCreated: null,
      dateDelivered: null,
      duration: null,
      notes: null,
    });

    const response = await GET_BY_ID(
      buildRequest('/api/general-merchandise/shipments/1'),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data['Shipment Code']).toBe('GM-SH-001');
  });

  it('updates a GM shipment by id and cascades changes to products and transactions', async () => {
    mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValueOnce({
      id: 1,
      shipmentCode: 'GM-SH-001',
    });
    mockPrisma.generalMerchandiseShipment.update.mockResolvedValue({
      id: 1,
      shipmentCode: 'GM-SH-001',
      cvNumber: 'CV-2',
      noOfSacks: 12,
      totalCBM: 6,
      weight: 120,
      fee: 600,
      shipmentStatus: 'Delivered',
      dateCreated: null,
      dateDelivered: null,
      duration: null,
      notes: null,
    });
    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
      { productCode: 'GM-PRD-1' },
    ]);
    mockPrisma.generalMerchandiseTransaction.updateMany.mockResolvedValue({
      count: 1,
    });

    const response = await PUT_BY_ID(
      buildRequest('/api/general-merchandise/shipments/1', {
        method: 'PUT',
        body: JSON.stringify({
          'Shipment Code': 'GM-SH-001',
          'CV Number': 'CV-2',
          'No. Of Sacks': 12,
          'Total CBM': 6,
          Weight: 120,
          Fee: 600,
          'Shipment Status': 'Delivered',
        }),
      }),
      { params: { id: '1' } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.generalMerchandiseProduct.updateMany).toHaveBeenCalled();
    expect(
      mockPrisma.generalMerchandiseTransaction.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { orderStatus: 'Warehouse' },
      })
    );
    expect(mockPostExpenseForShipment).toHaveBeenCalled();
  });
});
