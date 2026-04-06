import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockValidateMassDeleteConfirmation } = vi.hoisted(() => ({
  mockPrisma: {
    truckingLeaveRequest: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    truckingEmployee: {
      findMany: vi.fn(),
    },
  },
  mockValidateMassDeleteConfirmation: vi.fn(() => null),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/safety/mass-deletion', () => ({
  validateMassDeleteConfirmation: mockValidateMassDeleteConfirmation,
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value: unknown) => String(value ?? '').trim()),
  },
}));

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from '@/app/api/trucking/leave-requests/route';
import {
  GET as GET_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/trucking/leave-requests/[id]/route';

describe('Trucking leave-requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMassDeleteConfirmation.mockReturnValue(null);
  });

  it('filters leave requests by employee id', async () => {
    mockPrisma.truckingLeaveRequest.findMany.mockResolvedValue([
      {
        id: 12,
        employeeId: 'DRV-001',
        employeeName: 'Driver One',
        leaveType: 'Vacation Leave',
        paymentStatus: 'paid',
        startDate: '2026-03-01',
        endDate: '2026-03-02',
        numberOfDays: 2,
        reason: 'Family trip',
        status: 'approved',
        appliedDate: '2026-02-28',
        approvedBy: null,
        notes: null,
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/trucking/leave-requests?employeeId=DRV-001'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].id).toBe('12');
    expect(mockPrisma.truckingLeaveRequest.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'DRV-001' },
      orderBy: { startDate: 'desc' },
    });
  });

  it('rejects imports when employee ids are missing from trucking employees', async () => {
    mockPrisma.truckingEmployee.findMany.mockResolvedValue([]);

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/leave-requests', {
        method: 'POST',
        body: JSON.stringify([
          {
            employeeId: 'DRV-404',
            employeeName: 'Missing Driver',
            leaveType: 'Sick Leave',
            paymentStatus: 'unpaid',
            startDate: '2026-03-05',
            endDate: '2026-03-05',
            reason: 'Flu',
          },
        ]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Referenced employees not found');
    expect(body.missingEmployeeIds).toEqual(['DRV-404']);
  });

  it('requires an id for leave request patches', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/trucking/leave-requests', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Leave request ID is required');
  });

  it('soft deletes leave requests after confirmation', async () => {
    mockPrisma.truckingLeaveRequest.updateMany.mockResolvedValue({ count: 3 });

    const response = await DELETE(
      new NextRequest('http://localhost/api/trucking/leave-requests', {
        method: 'DELETE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(3);
    expect(mockPrisma.truckingLeaveRequest.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('fetches and soft deletes a trucking leave request by id', async () => {
    mockPrisma.truckingLeaveRequest.findFirst
      .mockResolvedValueOnce({ id: 12, employeeId: 'DRV-001', deletedAt: null })
      .mockResolvedValueOnce({
        id: 12,
        employeeId: 'DRV-001',
        deletedAt: null,
      });
    mockPrisma.truckingLeaveRequest.update.mockResolvedValue({
      id: 12,
      deletedAt: new Date('2026-04-06T00:00:00.000Z'),
    });

    const fetchResponse = await GET_BY_ID(
      new NextRequest('http://localhost/api/trucking/leave-requests/12'),
      { params: { id: '12' } }
    );
    const deleteResponse = await DELETE_BY_ID(
      new NextRequest('http://localhost/api/trucking/leave-requests/12', {
        method: 'DELETE',
      }),
      { params: { id: '12' } }
    );

    expect(fetchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(mockPrisma.truckingLeaveRequest.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
