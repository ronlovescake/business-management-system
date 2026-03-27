import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingAttendance: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
  },
  truckingEmployee: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value: unknown) => String(value ?? '').trim()),
    date: vi.fn((value: unknown) => String(value ?? '').trim()),
  },
}));

import { POST } from '@/app/api/trucking/attendance/apply-leave/route';

describe('Trucking attendance apply-leave API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates the employee id requirement', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/trucking/attendance/apply-leave', {
        method: 'POST',
        body: JSON.stringify({
          startDate: '2026-03-01',
          endDate: '2026-03-03',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Employee ID is required');
  });

  it('updates existing leave attendance rows and creates missing days', async () => {
    mockPrisma.truckingEmployee.findFirst.mockResolvedValue({
      employeeId: 'DRV-01',
      name: 'Driver One',
      department: 'Operations',
      position: 'Driver',
    });
    mockPrisma.truckingAttendance.findMany.mockResolvedValue([
      { id: 'att-1', date: '2026-03-01' },
    ]);
    mockPrisma.truckingAttendance.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.truckingAttendance.createMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      new NextRequest('http://localhost/api/trucking/attendance/apply-leave', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'DRV-01',
          employeeName: 'Driver One',
          leaveType: 'Vacation Leave',
          startDate: '2026-03-01',
          endDate: '2026-03-03',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updatedCount).toBe(1);
    expect(body.createdCount).toBe(2);
    expect(mockPrisma.truckingAttendance.updateMany).toHaveBeenCalledWith({
      where: {
        employeeId: 'DRV-01',
        date: { in: ['2026-03-01'] },
        deletedAt: null,
      },
      data: expect.objectContaining({
        status: 'on-leave',
        details: 'On Vacation Leave',
      }),
    });
    expect(mockPrisma.truckingAttendance.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ date: '2026-03-02', employeeId: 'DRV-01' }),
        expect.objectContaining({ date: '2026-03-03', employeeId: 'DRV-01' }),
      ],
    });
  });
});
