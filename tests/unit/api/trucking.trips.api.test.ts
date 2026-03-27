import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingTrip: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  truckingExpense: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    randomUUID: vi.fn(() => 'trip-uuid-1'),
  };
});

import { GET, POST } from '@/app/api/trucking/trips/route';
import {
  DELETE as DELETE_BY_ID,
  PUT as PUT_BY_ID,
} from '@/app/api/trucking/trips/[id]/route';
import { POST as FINALIZE } from '@/app/api/trucking/trips/[id]/finalize/route';

describe('Trucking trips API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([
      { column_name: 'id' },
      { column_name: 'date' },
      { column_name: 'truckId' },
      { column_name: 'destination' },
      { column_name: 'driver' },
      { column_name: 'helper' },
      { column_name: 'grossRevenue' },
      { column_name: 'fuelLiters' },
      { column_name: 'fuelCost' },
      { column_name: 'maintenance' },
      { column_name: 'tollFees' },
      { column_name: 'miscExpenses' },
      { column_name: 'totalExpenses' },
      { column_name: 'remarks' },
      { column_name: 'status' },
      { column_name: 'completedAt' },
      { column_name: 'customerId' },
      { column_name: 'invoiceId' },
      { column_name: 'createdAt' },
      { column_name: 'deletedAt' },
    ]);
    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        truckingExpense: mockPrisma.truckingExpense,
        $executeRawUnsafe: mockPrisma.$executeRawUnsafe,
      })
    );
  });

  it('lists trucking trips through the delegate when schema is aligned', async () => {
    mockPrisma.truckingTrip.findMany.mockResolvedValue([
      {
        id: 'trip-1',
        date: '2026-03-01',
        truckId: 'TRK-1',
        destination: 'Port',
        driver: 'Driver One',
        helper: '',
        grossRevenue: 1000,
        fuelLiters: 20,
        fuelCost: 500,
        maintenance: 50,
        tollFees: 30,
        miscExpenses: 20,
        totalExpenses: 600,
        remarks: '',
        status: 'draft',
        completedAt: null,
        customerId: null,
        invoiceId: null,
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].id).toBe('trip-1');
    expect(mockPrisma.truckingTrip.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  });

  it('creates a trucking trip through the delegate', async () => {
    mockPrisma.truckingTrip.create.mockResolvedValue({
      id: 'trip-uuid-1',
      date: '2026-03-01',
      truckId: 'TRK-1',
      destination: 'Port',
      driver: 'Driver One',
      helper: null,
      grossRevenue: 1000,
      fuelLiters: 20,
      fuelCost: 500,
      maintenance: 50,
      tollFees: 30,
      miscExpenses: 20,
      totalExpenses: 600,
      remarks: null,
      status: 'draft',
      completedAt: null,
      customerId: null,
      invoiceId: null,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/trips', {
        method: 'POST',
        body: JSON.stringify({
          date: '2026-03-01',
          truckId: 'TRK-1',
          destination: 'Port',
          driver: 'Driver One',
          grossRevenue: 1000,
          fuelLiters: 20,
          fuelCost: 500,
          maintenance: 50,
          tollFees: 30,
          miscExpenses: 20,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('trip-uuid-1');
  });

  it('updates and soft deletes a trucking trip by id', async () => {
    mockPrisma.truckingTrip.findFirst.mockResolvedValue({ id: 'trip-2' });
    mockPrisma.truckingTrip.update
      .mockResolvedValueOnce({
        id: 'trip-2',
        date: '2026-03-02',
        truckId: 'TRK-2',
        destination: 'Warehouse',
        driver: 'Driver Two',
        helper: '',
        grossRevenue: 1200,
        fuelLiters: 18,
        fuelCost: 450,
        maintenance: 0,
        tollFees: 40,
        miscExpenses: 10,
        totalExpenses: 500,
        remarks: '',
        status: 'draft',
        completedAt: null,
        customerId: null,
        invoiceId: null,
      })
      .mockResolvedValueOnce({
        id: 'trip-2',
        date: '2026-03-02',
        truckId: 'TRK-2',
        destination: 'Warehouse',
        driver: 'Driver Two',
        helper: '',
        grossRevenue: 1200,
        fuelLiters: 18,
        fuelCost: 450,
        maintenance: 0,
        tollFees: 40,
        miscExpenses: 10,
        totalExpenses: 500,
        remarks: '',
        status: 'draft',
        completedAt: null,
        customerId: null,
        invoiceId: null,
      });

    const updateResponse = await PUT_BY_ID(
      new NextRequest('http://localhost/api/trucking/trips/trip-2', {
        method: 'PUT',
        body: JSON.stringify({
          date: '2026-03-02',
          truckId: 'TRK-2',
          destination: 'Warehouse',
          driver: 'Driver Two',
          grossRevenue: 1200,
          fuelLiters: 18,
          fuelCost: 450,
          maintenance: 0,
          tollFees: 40,
          miscExpenses: 10,
        }),
      }),
      { params: { id: 'trip-2' } }
    );

    const deleteResponse = await DELETE_BY_ID(
      new NextRequest('http://localhost/api/trucking/trips/trip-2', {
        method: 'DELETE',
      }),
      { params: { id: 'trip-2' } }
    );

    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(mockPrisma.truckingTrip.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'trip-2' },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });

  it('finalizes a trip into trucking expense lines', async () => {
    mockPrisma.truckingTrip.findUnique.mockResolvedValue({
      id: 'trip-3',
      date: '2026-03-03',
      truckId: 'TRK-3',
      destination: 'City Hub',
      fuelCost: 300,
      maintenance: 40,
      tollFees: 20,
      miscExpenses: 10,
      status: 'draft',
      completedAt: null,
    });

    const response = await FINALIZE(
      new NextRequest('http://localhost/api/trucking/trips/trip-3/finalize', {
        method: 'POST',
      }),
      { params: { id: 'trip-3' } }
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.truckingExpense.create).toHaveBeenCalledTimes(4);
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
  });
});
