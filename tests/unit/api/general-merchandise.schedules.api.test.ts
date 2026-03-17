import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseSchedule: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/validations/schedule.validation', () => ({
  validateSchedule: vi.fn((body) => ({ success: true, data: body })),
  formatValidationErrors: vi.fn(() => ({ date: 'invalid' })),
  scheduleUpdateSchema: {
    safeParse: vi.fn((body) => ({ success: true, data: body })),
  },
}));

import {
  GET,
  POST,
  PUT,
  DELETE,
} from '@/app/api/general-merchandise/schedules/route';

describe('General merchandise schedules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches non-deleted GM schedules ordered by date desc', async () => {
    mockPrisma.generalMerchandiseSchedule.findMany.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
    expect(mockPrisma.generalMerchandiseSchedule.findMany).toHaveBeenCalledWith(
      {
        where: { deletedAt: null },
        select: expect.any(Object),
        orderBy: { date: 'desc' },
      }
    );
  });

  it('creates a GM schedule and normalizes shift, status, and source values', async () => {
    mockPrisma.generalMerchandiseSchedule.create.mockResolvedValue({
      id: 'sch-1',
      employeeId: 'GM-001',
      employeeName: 'Gamma Worker',
      date: '2026-03-20',
      shiftType: 'morning',
      startTime: '08:00',
      break1: null,
      lunch: null,
      break2: null,
      endTime: '17:00',
      position: 'Picker',
      department: 'Operations',
      status: 'scheduled',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/schedules', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'GM-001',
          employeeName: 'Gamma Worker',
          date: '2026-03-20',
          shiftType: 'INVALID',
          startTime: '08:00',
          endTime: '17:00',
          position: 'Picker',
          department: 'Operations',
          status: 'INVALID',
          source: 'INVALID',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual([
      expect.objectContaining({
        id: 'sch-1',
        shiftType: 'morning',
        status: 'scheduled',
        source: 'manual',
      }),
    ]);
    expect(mockPrisma.generalMerchandiseSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'GM-001',
        shiftType: 'morning',
        status: 'scheduled',
        source: 'manual',
      }),
    });
  });

  it('returns validation failures for invalid GM schedule payloads', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/general-merchandise/schedules', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'GM-001',
          employeeName: 'Gamma Worker',
          date: '2026-03-20',
          startTime: '08:00',
          endTime: '17:00',
          department: 'Operations',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.createdCount).toBe(0);
  });

  it('updates and soft-deletes GM schedules by id', async () => {
    mockPrisma.generalMerchandiseSchedule.update
      .mockResolvedValueOnce({
        id: 'sch-1',
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        date: '2026-03-20',
        shiftType: 'afternoon',
        startTime: '12:00',
        break1: null,
        lunch: null,
        break2: null,
        endTime: '17:00',
        position: 'Picker',
        department: 'Operations',
        status: 'completed',
        notes: null,
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
      })
      .mockResolvedValueOnce({
        id: 'sch-1',
        employeeId: 'GM-001',
        employeeName: 'Gamma Worker',
        date: '2026-03-20',
        shiftType: 'afternoon',
        startTime: '12:00',
        break1: null,
        lunch: null,
        break2: null,
        endTime: '17:00',
        position: 'Picker',
        department: 'Operations',
        status: 'completed',
        notes: null,
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
        deletedAt: new Date('2026-03-17T00:00:00.000Z'),
      });

    const updateResponse = await PUT(
      new NextRequest('http://localhost/api/general-merchandise/schedules', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'sch-1',
          shiftType: 'afternoon',
          status: 'completed',
        }),
      })
    );
    const updateBody = await updateResponse.json();

    const deleteResponse = await DELETE(
      new NextRequest('http://localhost/api/general-merchandise/schedules', {
        method: 'DELETE',
        body: JSON.stringify({ id: 'sch-1' }),
      })
    );
    const deleteBody = await deleteResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateBody.status).toBe('completed');
    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.id).toBe('sch-1');
    expect(
      mockPrisma.generalMerchandiseSchedule.update
    ).toHaveBeenNthCalledWith(1, {
      where: { id: 'sch-1' },
      data: expect.objectContaining({
        shiftType: 'afternoon',
        status: 'completed',
      }),
    });
    expect(
      mockPrisma.generalMerchandiseSchedule.update
    ).toHaveBeenNthCalledWith(2, {
      where: { id: 'sch-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
