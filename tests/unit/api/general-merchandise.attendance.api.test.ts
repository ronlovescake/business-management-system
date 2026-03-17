import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseAttendance: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
  },
  generalMerchandiseEmployee: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/validations/attendance.validation', () => ({
  validateAttendance: vi.fn((body) => ({ success: true, data: body })),
  validateAttendanceUpdate: vi.fn((body) => ({ success: true, data: body })),
  formatValidationErrors: vi.fn(() => ({ field: 'invalid' })),
}));

import {
  GET,
  POST,
  DELETE,
} from '@/app/api/general-merchandise/attendance/route';
import { POST as APPLY_LEAVE_POST } from '@/app/api/general-merchandise/attendance/apply-leave/route';

const ATTENDANCE_SELECT = {
  id: true,
  employeeId: true,
  employeeName: true,
  department: true,
  position: true,
  date: true,
  timeIn: true,
  timeOut: true,
  totalHours: true,
  status: true,
  details: true,
  break1Start: true,
  break1End: true,
  lunchStart: true,
  lunchEnd: true,
  break2Start: true,
  break2End: true,
};

describe('General merchandise attendance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T08:00:00.000Z'));
    mockPrisma.$transaction.mockImplementation(async (operations) =>
      Promise.all(operations)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies GM attendance filters on GET', async () => {
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue([]);

    await GET(
      new NextRequest(
        'http://localhost/api/general-merchandise/attendance?employeeId=gm-1&status=present&startDate=2026-03-01&endDate=2026-03-15'
      )
    );

    expect(
      mockPrisma.generalMerchandiseAttendance.findMany
    ).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        employeeId: 'GM-1',
        status: 'present',
        date: {
          gte: '2026-03-01',
          lte: '2026-03-15',
        },
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('rejects batch imports when referenced GM employees are missing', async () => {
    mockPrisma.generalMerchandiseEmployee.findMany.mockResolvedValue([
      { employeeId: 'GM-001' },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/attendance', {
        method: 'POST',
        body: JSON.stringify([
          {
            employeeId: 'GM-001',
            employeeName: 'Alpha',
            department: 'Ops',
            position: 'Picker',
            date: '2026-03-10',
            status: 'present',
          },
          {
            employeeId: 'GM-002',
            employeeName: 'Beta',
            department: 'Ops',
            position: 'Cashier',
            date: '2026-03-10',
            status: 'present',
          },
        ]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Referenced employees not found');
    expect(body.meta.missingEmployeeIds).toEqual(['GM-002']);
  });

  it('creates a single GM attendance record when the employee exists', async () => {
    mockPrisma.generalMerchandiseEmployee.findFirst.mockResolvedValue({
      employeeId: 'GM-001',
    });
    mockPrisma.generalMerchandiseAttendance.create.mockResolvedValue({
      id: 'att-1',
      employeeId: 'GM-001',
      status: 'present',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'GM-001',
          employeeName: 'Gamma',
          department: 'Ops',
          position: 'Picker',
          date: '2026-03-10',
          status: 'present',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(
      expect.objectContaining({ id: 'att-1', employeeId: 'GM-001' })
    );
    expect(mockPrisma.generalMerchandiseAttendance.create).toHaveBeenCalledWith(
      {
        data: expect.objectContaining({ employeeId: 'GM-001' }),
      }
    );
  });

  it('requires an attendance id on DELETE', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/general-merchandise/attendance')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Attendance ID is required');
  });

  it('returns a no-op response for future-only leave ranges', async () => {
    const request = {
      json: async () => ({
        employeeId: 'GM-001',
        employeeName: 'Gamma',
        leaveType: 'Vacation',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
      }),
    } as NextRequest;

    const response = await APPLY_LEAVE_POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.totalAffected).toBe(0);
    expect(body.message).toContain('future dates only');
    expect(
      mockPrisma.generalMerchandiseAttendance.findMany
    ).not.toHaveBeenCalled();
  });

  it('updates existing GM leave attendance rows and creates missing dates up to today', async () => {
    mockPrisma.generalMerchandiseEmployee.findFirst.mockResolvedValue({
      employeeId: 'GM-001',
      name: 'Gamma Worker',
      department: 'Operations',
      position: 'Picker',
    });
    mockPrisma.generalMerchandiseAttendance.findMany.mockResolvedValue([
      { id: 'att-1', date: '2026-03-15' },
    ]);
    mockPrisma.generalMerchandiseAttendance.updateMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.generalMerchandiseAttendance.createMany.mockResolvedValue({
      count: 2,
    });

    const request = {
      json: async () => ({
        employeeId: 'GM-001',
        leaveType: 'Sick Leave',
        startDate: '2026-03-15',
        endDate: '2026-03-17',
      }),
    } as NextRequest;

    const response = await APPLY_LEAVE_POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updatedCount).toBe(1);
    expect(body.createdCount).toBe(2);
    expect(
      mockPrisma.generalMerchandiseAttendance.updateMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'GM-001',
          deletedAt: null,
          date: { in: ['2026-03-15'] },
        }),
        data: expect.objectContaining({
          status: 'on-leave',
          details: 'On Sick Leave',
        }),
      })
    );
    expect(
      mockPrisma.generalMerchandiseAttendance.createMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ date: '2026-03-16' }),
          expect.objectContaining({ date: '2026-03-17' }),
        ],
      })
    );
  });
});
