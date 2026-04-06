import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingAttendance: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  truckingEmployee: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockValidateAttendance = vi.hoisted(() => vi.fn());
const mockValidateAttendanceUpdate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    productCode: vi.fn((value: unknown) => String(value ?? '')),
    name: vi.fn((value: unknown) => String(value ?? '')),
    date: vi.fn((value: unknown) => String(value ?? '')),
  },
}));

vi.mock('@/lib/validations/attendance.validation', () => ({
  validateAttendance: mockValidateAttendance,
  validateAttendanceUpdate: mockValidateAttendanceUpdate,
  formatValidationErrors: vi.fn(() => ({ employeeId: 'invalid' })),
}));

import { DELETE, GET, PATCH, POST } from '@/app/api/trucking/attendance/route';

describe('Trucking Attendance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAttendance.mockReturnValue({ success: true, data: {} });
    mockValidateAttendanceUpdate.mockReturnValue({ success: true, data: {} });
  });

  it('filters trucking attendance records by normalized query fields', async () => {
    mockPrisma.truckingAttendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/trucking/attendance?employeeId=driver-1&status=present&startDate=2025-02-01&endDate=2025-02-28'
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.truckingAttendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        employeeId: 'DRIVER-1',
        status: 'present',
        date: {
          gte: '2025-02-01',
          lte: '2025-02-28',
        },
      },
      select: {
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
      },
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('creates a trucking attendance record after employee validation', async () => {
    const payload = {
      employeeId: 'DRV-7',
      employeeName: 'Driver Seven',
      date: '2025-02-15',
      status: 'present',
    };

    mockValidateAttendance.mockReturnValue({ success: true, data: payload });
    mockPrisma.truckingEmployee.findFirst.mockResolvedValue({ id: 'emp-7' });
    mockPrisma.truckingAttendance.create.mockResolvedValue({
      id: 'att-7',
      ...payload,
    });

    const request = new NextRequest(
      'http://localhost/api/trucking/attendance',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('att-7');
    expect(mockPrisma.truckingEmployee.findFirst).toHaveBeenCalledWith({
      where: {
        employeeId: 'DRV-7',
        deletedAt: null,
      },
    });
    expect(mockPrisma.truckingAttendance.create).toHaveBeenCalledWith({
      data: payload,
    });
  });

  it('soft deletes a trucking attendance record', async () => {
    mockPrisma.truckingAttendance.findUnique.mockResolvedValue({
      id: 'att-9',
      deletedAt: null,
    });
    mockPrisma.truckingAttendance.update.mockResolvedValue({
      id: 'att-9',
      deletedAt: new Date('2025-02-20T00:00:00Z'),
    });

    const request = new NextRequest(
      'http://localhost/api/trucking/attendance?id=att-9',
      { method: 'DELETE' }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPrisma.truckingAttendance.update).toHaveBeenCalledWith({
      where: { id: 'att-9', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('rejects PATCH requests without an attendance ID', async () => {
    const request = new NextRequest(
      'http://localhost/api/trucking/attendance',
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'absent' }),
      }
    );

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Attendance ID is required');
  });
});
