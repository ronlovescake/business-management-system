import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  truckingSchedule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  truckingEmployee: {
    findMany: vi.fn(),
  },
}));

const mockValidateSchedule = vi.hoisted(() => vi.fn());

vi.mock('crypto', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    randomUUID: vi.fn(() => 'uuid-1'),
  };
});

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
    name: vi.fn((value: unknown) => String(value ?? '')),
  },
}));

vi.mock('@/lib/validations/schedule.validation', () => ({
  validateSchedule: mockValidateSchedule,
  formatValidationErrors: vi.fn(() => ({ employeeId: 'invalid' })),
  scheduleUpdateSchema: {
    safeParse: vi.fn(() => ({ success: true, data: {} })),
  },
}));

import { GET, POST } from '@/app/api/trucking/schedules/route';

describe('Trucking Schedules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSchedule.mockImplementation((input: unknown) => ({
      success: true,
      data: input,
    }));
  });

  it('returns trucking schedules from the business-specific delegate', async () => {
    mockPrisma.truckingSchedule.findMany.mockResolvedValue([
      {
        id: 'sched-1',
        employeeId: 'DRV-1',
        employeeName: 'Driver One',
        date: '2025-02-18',
        shiftType: 'morning',
        startTime: '08:00',
        break1: null,
        lunch: null,
        break2: null,
        endTime: '17:00',
        position: 'Driver',
        department: 'Operations',
        status: 'scheduled',
        notes: null,
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
      },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/trucking/schedules')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].employeeId).toBe('DRV-1');
    expect(mockPrisma.truckingSchedule.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        date: true,
        shiftType: true,
        startTime: true,
        break1: true,
        lunch: true,
        break2: true,
        endTime: true,
        position: true,
        department: true,
        status: true,
        notes: true,
        source: true,
        templateId: true,
        recurrenceId: true,
        isOverride: true,
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });
  });

  it('creates a trucking schedule batch with generated ids', async () => {
    const payload = {
      employeeId: 'DRV-2',
      employeeName: 'Driver Two',
      date: '2025-02-19',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '17:00',
      position: 'Driver',
      department: 'Operations',
      status: 'scheduled',
      notes: '',
      source: 'manual',
      isOverride: false,
    };

    mockPrisma.truckingSchedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'uuid-1', ...payload }]);
    mockPrisma.truckingEmployee.findMany.mockResolvedValue([
      { employeeId: 'DRV-2' },
    ]);
    mockPrisma.truckingSchedule.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/trucking/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(1);
    expect(body.data.schedules[0].employeeId).toBe('DRV-2');
    expect(mockPrisma.truckingEmployee.findMany).toHaveBeenCalledWith({
      where: {
        employeeId: { in: ['DRV-2'] },
        deletedAt: null,
      },
      select: { employeeId: true },
    });
    expect(mockPrisma.truckingSchedule.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: expect.any(String),
          employeeId: 'DRV-2',
          employeeName: 'Driver Two',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('rejects duplicate employee-date pairs inside a trucking request batch', async () => {
    const request = new NextRequest('http://localhost/api/trucking/schedules', {
      method: 'POST',
      body: JSON.stringify([
        {
          employeeId: 'DRV-3',
          employeeName: 'Driver Three',
          date: '2025-02-20',
          shiftType: 'morning',
          startTime: '08:00',
          endTime: '17:00',
          position: 'Driver',
          department: 'Operations',
        },
        {
          employeeId: 'DRV-3',
          employeeName: 'Driver Three',
          date: '2025-02-20',
          shiftType: 'night',
          startTime: '18:00',
          endTime: '23:00',
          position: 'Driver',
          department: 'Operations',
        },
      ]),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Duplicate schedules in request');
    expect(mockPrisma.truckingSchedule.createMany).not.toHaveBeenCalled();
  });
});
