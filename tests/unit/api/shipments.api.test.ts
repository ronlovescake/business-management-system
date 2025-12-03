/**
 * API Tests for Shipments Endpoints
 *
 * Tests:
 * - GET /api/shipments - Fetch all shipments
 * - POST /api/shipments - Create single shipment
 * - POST /api/shipments - Bulk import (delete all + create many)
 * - DELETE /api/shipments - Delete all shipments
 * - GET /api/shipments/[id] - Fetch specific shipment
 * - PUT /api/shipments/[id] - Update shipment (+ cascade to products)
 * - DELETE /api/shipments/[id] - Delete specific shipment
 *
 * Features tested:
 * - Currency parsing (₱ symbol, commas)
 * - Number cleaning (commas in numeric values)
 * - Integer rounding (No. Of Sacks must be Int)
 * - Optional field handling (nulls for empty strings)
 * - Bulk import replaces all data
 * - Product cascade updates on shipment update
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import {
  GET as getShipments,
  POST as createShipments,
  DELETE as deleteAllShipments,
} from '@/app/api/shipments/route';
import {
  GET as getShipmentById,
  PUT as updateShipment,
  DELETE as deleteShipment,
} from '@/app/api/shipments/[id]/route';
import { prisma } from '@/lib/db';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    shipment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

describe('Shipments API - /api/shipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shipments', () => {
    it('should fetch all shipments ordered by ID', async () => {
      const mockShipments = [
        {
          id: 1,
          shipmentCode: 'SH-001',
          cvNumber: 'CV-12345',
          noOfSacks: 100,
          totalCBM: 15.5,
          weight: 500.25,
          fee: 5000,
          shipmentStatus: 'In Transit',
          dateCreated: '2025-01-01',
          dateDelivered: null,
          duration: '5 days',
          notes: 'Test shipment',
        },
        {
          id: 2,
          shipmentCode: 'SH-002',
          cvNumber: null,
          noOfSacks: 50,
          totalCBM: 8.2,
          weight: 250.5,
          fee: 2500,
          shipmentStatus: 'Delivered',
          dateCreated: '2025-01-02',
          dateDelivered: '2025-01-07',
          duration: '5 days',
          notes: null,
        },
      ];

      vi.mocked(prisma.shipment.findMany).mockResolvedValue(
        mockShipments as any
      );

      const response = await getShipments(buildRequest('/api/shipments'));
      const payload = await response.json();
      const data = payload.data;

      expect(payload.success).toBe(true);
      expect(prisma.shipment.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
      });
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        id: 1,
        'Shipment Code': 'SH-001',
        'CV Number': 'CV-12345',
        'No. Of Sacks': 100,
        'Total CBM': 15.5,
        Weight: 500.25,
        Fee: 5000,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 1, 2025',
        'Date Delivered': '',
        Duration: '5 days',
        Notes: 'Test shipment',
      });
    });

    it('should return empty array when no shipments exist', async () => {
      vi.mocked(prisma.shipment.findMany).mockResolvedValue([]);

      const response = await getShipments(buildRequest('/api/shipments'));
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.data).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.shipment.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      const response = await getShipments(buildRequest('/api/shipments'));
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Failed to fetch shipments');
    });
  });

  describe('POST /api/shipments - Single Shipment', () => {
    it('should create a single shipment with all fields', async () => {
      const newShipment = {
        'Shipment Code': 'SH-003',
        'CV Number': 'CV-99999',
        'No. Of Sacks': 75,
        'Total CBM': 12.3,
        Weight: 350.5,
        Fee: 3500,
        'Shipment Status': 'In Transit',
        'Date Created': 'Jan 10, 2025',
        'Date Delivered': '',
        Duration: '',
        Notes: 'Urgent delivery',
      };

      const createdShipment = {
        id: 3,
        shipmentCode: 'SH-003',
        cvNumber: 'CV-99999',
        noOfSacks: 75,
        totalCBM: 12.3,
        weight: 350.5,
        fee: 3500,
        shipmentStatus: 'In Transit',
        dateCreated: '2025-01-10',
        dateDelivered: null,
        duration: null,
        notes: 'Urgent delivery',
      };

      vi.mocked(prisma.shipment.create).mockResolvedValue(
        createdShipment as any
      );

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      const response = await createShipments(request as any);
      const payload = await response.json();

      expect(response.status).toBe(201);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Shipment created');
      expect(payload.data['Shipment Code']).toBe('SH-003');
      expect(payload.data['CV Number']).toBe('CV-99999');
      expect(payload.data['No. Of Sacks']).toBe(75);
    });

    it('should handle currency symbols in Fee field (₱)', async () => {
      const newShipment = {
        'Shipment Code': 'SH-004',
        Fee: '₱5,500.00', // Peso symbol + comma
        'Shipment Status': 'In Transit',
      };

      const createdShipment = {
        id: 4,
        shipmentCode: 'SH-004',
        cvNumber: null,
        noOfSacks: 0,
        totalCBM: 0,
        weight: 0,
        fee: 5500,
        shipmentStatus: 'In Transit',
        dateCreated: null,
        dateDelivered: null,
        duration: null,
        notes: null,
      };

      vi.mocked(prisma.shipment.create).mockResolvedValue(
        createdShipment as any
      );

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      await createShipments(request as any);

      expect(prisma.shipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fee: 5500,
        }),
      });
    });

    it('should clean commas from numeric fields', async () => {
      const newShipment = {
        'Shipment Code': 'SH-005',
        'No. Of Sacks': '1,234', // String with comma
        'Total CBM': '15,678.90',
        Weight: '2,500.50',
      };

      const createdShipment = {
        id: 5,
        shipmentCode: 'SH-005',
        noOfSacks: 1234,
        totalCBM: 15678.9,
        weight: 2500.5,
        fee: 0,
        shipmentStatus: '',
        cvNumber: null,
        dateCreated: null,
        dateDelivered: null,
        duration: null,
        notes: null,
      };

      vi.mocked(prisma.shipment.create).mockResolvedValue(
        createdShipment as any
      );

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      await createShipments(request as any);

      expect(prisma.shipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          noOfSacks: 1234,
          totalCBM: 15678.9,
          weight: 2500.5,
        }),
      });
    });

    it('should round No. Of Sacks to integer', async () => {
      const newShipment = {
        'Shipment Code': 'SH-006',
        'No. Of Sacks': 123.7, // Float value
      };

      const createdShipment = {
        id: 6,
        shipmentCode: 'SH-006',
        noOfSacks: 124, // Rounded
        cvNumber: null,
        totalCBM: 0,
        weight: 0,
        fee: 0,
        shipmentStatus: '',
        dateCreated: null,
        dateDelivered: null,
        duration: null,
        notes: null,
      };

      vi.mocked(prisma.shipment.create).mockResolvedValue(
        createdShipment as any
      );

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      await createShipments(request as any);

      expect(prisma.shipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          noOfSacks: 124,
        }),
      });
    });

    it('should convert empty strings to null for optional fields', async () => {
      const newShipment = {
        'Shipment Code': 'SH-007',
        'CV Number': '',
        'Date Delivered': '',
        Duration: '',
        Notes: '',
      };

      const createdShipment = {
        id: 7,
        shipmentCode: 'SH-007',
        cvNumber: null,
        noOfSacks: 0,
        totalCBM: 0,
        weight: 0,
        fee: 0,
        shipmentStatus: '',
        dateCreated: null,
        dateDelivered: null,
        duration: null,
        notes: null,
      };

      vi.mocked(prisma.shipment.create).mockResolvedValue(
        createdShipment as any
      );

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      await createShipments(request as any);

      expect(prisma.shipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cvNumber: null,
          dateDelivered: null,
          duration: null,
          notes: null,
        }),
      });
    });
  });

  describe('POST /api/shipments - Bulk Import', () => {
    it('should delete all existing shipments and create new ones', async () => {
      const bulkShipments = [
        {
          'Shipment Code': 'SH-100',
          'No. Of Sacks': 50,
          'Shipment Status': 'In Transit',
        },
        {
          'Shipment Code': 'SH-101',
          'No. Of Sacks': 75,
          'Shipment Status': 'Delivered',
        },
      ];

      // Mock transaction to execute the callback with shipment + product contexts
      const txShipmentCreate = vi.fn().mockResolvedValue({ id: 1 });
      const txContext = {
        shipment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: txShipmentCreate,
          update: vi.fn().mockResolvedValue({ id: 1 }),
        },
        product: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as unknown as Prisma.TransactionClient;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(txContext);
      });

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(bulkShipments),
      });

      const response = await createShipments(request as any);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Shipments imported successfully');
      expect(payload.data.total).toBe(2);
    });

    it('should handle bulk import with currency and comma cleaning', async () => {
      const bulkShipments = [
        {
          'Shipment Code': 'SH-200',
          'No. Of Sacks': '1,000',
          Fee: '₱10,500.50',
        },
      ];

      // Mock transaction to execute the callback
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const txClient = {
          shipment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation((args) => {
              // Verify the cleaned data
              expect(args.data.noOfSacks).toBe(1000);
              expect(args.data.fee).toBe(10500.5);
              return Promise.resolve({ id: 1 });
            }),
            update: vi.fn().mockResolvedValue({ id: 1 }),
          },
        } as unknown as Prisma.TransactionClient;

        return callback(txClient);
      });

      const request = new Request('http://localhost/api/shipments', {
        method: 'POST',
        body: JSON.stringify(bulkShipments),
      });

      await createShipments(request as any);
    });
  });

  describe('DELETE /api/shipments', () => {
    it('should delete all shipments', async () => {
      vi.mocked(prisma.shipment.count).mockResolvedValue(0);
      vi.mocked(prisma.shipment.updateMany).mockResolvedValue({
        count: 10,
      } as any);

      const request = new Request(
        'http://localhost/api/shipments?confirm=DELETE_ALL_SHIPMENTS',
        {
          method: 'DELETE',
        }
      ) as any;

      const response = await deleteAllShipments(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Shipments soft deleted');
      expect(payload.data.deleted).toBe(10);
    });

    it('should handle deleting when no shipments exist', async () => {
      vi.mocked(prisma.shipment.count).mockResolvedValue(0);
      vi.mocked(prisma.shipment.updateMany).mockResolvedValue({
        count: 0,
      } as any);

      const request = new Request(
        'http://localhost/api/shipments?confirm=DELETE_ALL_SHIPMENTS',
        {
          method: 'DELETE',
        }
      ) as any;

      const response = await deleteAllShipments(request);
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(payload.data.deleted).toBe(0);
    });
  });
});

describe('Shipments API - /api/shipments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/shipments/[id]', () => {
    it('should fetch a specific shipment by ID', async () => {
      const mockShipment = {
        id: 1,
        shipmentCode: 'SH-001',
        cvNumber: 'CV-12345',
        noOfSacks: 100,
        totalCBM: 15.5,
        weight: 500.25,
        fee: 5000,
        shipmentStatus: 'In Transit',
        dateCreated: '2025-01-01',
        dateDelivered: null,
        duration: '5 days',
        notes: 'Test shipment',
      };

      vi.mocked(prisma.shipment.findUnique).mockResolvedValue(
        mockShipment as any
      );

      const request = new Request('http://localhost/api/shipments/1') as any;
      const response = await getShipmentById(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(payload.success).toBe(true);
      expect(prisma.shipment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(payload.data['Shipment Code']).toBe('SH-001');
      expect(payload.data['CV Number']).toBe('CV-12345');
    });

    it('should return 404 when shipment not found', async () => {
      vi.mocked(prisma.shipment.findUnique).mockResolvedValue(null);

      const request = new Request('http://localhost/api/shipments/999') as any;
      const response = await getShipmentById(request, {
        params: { id: '999' },
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Shipment not found');
    });

    it('should return 400 for invalid ID format', async () => {
      const request = new Request('http://localhost/api/shipments/abc') as any;
      const response = await getShipmentById(request, {
        params: { id: 'abc' },
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid shipment ID');
    });
  });

  describe('PUT /api/shipments/[id]', () => {
    it('should update a shipment and cascade to products', async () => {
      const currentShipment = {
        id: 1,
        shipmentCode: 'SH-001',
        cvNumber: 'CV-OLD',
        noOfSacks: 50,
        totalCBM: 10,
        weight: 200,
        fee: 2000,
        shipmentStatus: 'In Transit',
      };

      const updateData = {
        'Shipment Code': 'SH-001',
        'CV Number': 'CV-NEW',
        'No. Of Sacks': 100,
        'Total CBM': 20,
        Weight: 400,
        Fee: 4000,
        'Shipment Status': 'Delivered',
      };

      const updatedShipment = {
        id: 1,
        shipmentCode: 'SH-001',
        cvNumber: 'CV-NEW',
        noOfSacks: 100,
        totalCBM: 20,
        weight: 400,
        fee: 4000,
        shipmentStatus: 'Delivered',
        dateCreated: null,
        dateDelivered: null,
        duration: null,
        notes: null,
      };

      vi.mocked(prisma.shipment.findUnique).mockResolvedValue(
        currentShipment as any
      );
      vi.mocked(prisma.shipment.update).mockResolvedValue(
        updatedShipment as any
      );
      vi.mocked(prisma.product.updateMany).mockResolvedValue({
        count: 5,
      } as any);

      const request = new Request('http://localhost/api/shipments/1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      }) as any;

      const response = await updateShipment(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(prisma.shipment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          cvNumber: 'CV-NEW',
          noOfSacks: 100,
          shipmentStatus: 'Delivered',
        }),
      });

      // Verify product cascade update
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { shipmentCode: 'SH-001' },
        data: expect.objectContaining({
          cvNumber: 'CV-NEW',
          noOfSacks: 100,
          shipmentStatus: 'Delivered',
        }),
      });

      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Shipment updated');
      expect(payload.data['CV Number']).toBe('CV-NEW');
    });

    it('should return 404 when updating non-existent shipment', async () => {
      vi.mocked(prisma.shipment.findUnique).mockResolvedValue(null);

      const request = new Request('http://localhost/api/shipments/999', {
        method: 'PUT',
        body: JSON.stringify({ 'Shipment Code': 'SH-999' }),
      }) as any;

      const response = await updateShipment(request, { params: { id: '999' } });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Shipment not found');
    });
  });

  describe('DELETE /api/shipments/[id]', () => {
    it('should delete a specific shipment', async () => {
      vi.mocked(prisma.shipment.delete).mockResolvedValue({} as any);

      const request = new Request('http://localhost/api/shipments/1') as any;
      const response = await deleteShipment(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(prisma.shipment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Shipment deleted successfully');
      expect(payload.data.id).toBe(1);
    });

    it('should return 400 for invalid ID', async () => {
      const request = new Request('http://localhost/api/shipments/xyz') as any;
      const response = await deleteShipment(request, { params: { id: 'xyz' } });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid shipment ID');
    });
  });
});
