import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseLeaveRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockValidateMassDeleteConfirmation = vi.hoisted(() => vi.fn(() => null));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/utils/date', () => ({
  getCurrentDateISO: vi.fn(() => '2026-03-17'),
}));

vi.mock('@/lib/safety/mass-deletion', () => ({
  validateMassDeleteConfirmation: mockValidateMassDeleteConfirmation,
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from '@/app/api/general-merchandise/leave-requests/route';
import {
  GET as GET_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/general-merchandise/leave-requests/[id]/route';

describe('General merchandise leave requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateMassDeleteConfirmation.mockReturnValue(null);
  });

  it('filters leave requests by employee id and stringifies ids on GET', async () => {
    mockPrisma.generalMerchandiseLeaveRequest.findMany.mockResolvedValue([
      {
        id: 12,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        leaveType: 'Vacation Leave',
        paymentStatus: 'paid',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        numberOfDays: 3,
        reason: 'Trip',
        status: 'approved',
        appliedDate: '2026-03-17',
        approvedBy: null,
        notes: null,
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests?employeeId=GM-001'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: '12',
        employeeId: 'GM-001',
      }),
    ]);
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.findMany
    ).toHaveBeenCalledWith({
      where: { employeeId: 'GM-001' },
      orderBy: { startDate: 'desc' },
    });
  });

  it('creates leave requests with normalized status, payment status, and calculated days', async () => {
    mockPrisma.generalMerchandiseLeaveRequest.createMany.mockResolvedValue({
      count: 1,
    });

    const response = await POST(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeId: 'GM-001',
            employeeName: 'Gamma Worker',
            leaveType: 'Vacation Leave',
            paymentStatus: 'PAID',
            startDate: '2026-03-20',
            endDate: '2026-03-22',
            reason: 'Trip',
            status: 'APPROVED',
          }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.count).toBe(1);
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          employeeId: 'GM-001',
          paymentStatus: 'paid',
          status: 'approved',
          appliedDate: '2026-03-17',
          numberOfDays: 3,
        }),
      ],
    });
  });

  it('updates a GM leave request by numeric id', async () => {
    mockPrisma.generalMerchandiseLeaveRequest.update.mockResolvedValue({
      id: 12,
      status: 'approved',
      notes: 'Approved',
    });

    const response = await PUT(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests',
        {
          method: 'PUT',
          body: JSON.stringify({
            id: 12,
            status: 'APPROVED',
            notes: 'Approved',
          }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('12');
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.update
    ).toHaveBeenCalledWith({
      where: { id: 12 },
      data: expect.objectContaining({
        status: 'approved',
        notes: 'Approved',
      }),
    });
  });

  it('soft deletes GM leave requests after confirmation passes', async () => {
    mockPrisma.generalMerchandiseLeaveRequest.updateMany.mockResolvedValue({
      count: 4,
    });

    const response = await DELETE(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests',
        {
          method: 'DELETE',
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(4);
    expect(mockValidateMassDeleteConfirmation).toHaveBeenCalled();
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.updateMany
    ).toHaveBeenCalledWith({
      where: { deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('supports GM leave-request [id] fetch and soft-delete flows', async () => {
    mockPrisma.generalMerchandiseLeaveRequest.findFirst
      .mockResolvedValueOnce({
        id: 8,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 8,
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        deletedAt: null,
      });
    mockPrisma.generalMerchandiseLeaveRequest.update.mockResolvedValue({
      id: 8,
      deletedAt: new Date('2026-04-06T00:00:00.000Z'),
    });

    const fetchResponse = await GET_BY_ID(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests/8'
      ),
      { params: { id: '8' } }
    );
    const fetchBody = await fetchResponse.json();

    const deleteResponse = await DELETE_BY_ID(
      new NextRequest(
        'http://localhost/api/general-merchandise/leave-requests/8',
        {
          method: 'DELETE',
        }
      ),
      { params: { id: '8' } }
    );
    const deleteBody = await deleteResponse.json();

    expect(fetchResponse.status).toBe(200);
    expect(fetchBody.id).toBe('8');
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.message).toBe('Leave request deleted successfully');
    expect(
      mockPrisma.generalMerchandiseLeaveRequest.update
    ).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
