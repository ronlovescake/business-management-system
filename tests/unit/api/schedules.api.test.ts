import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { mockLogger } from '@/core/testing/test-helpers';

// Helper to create Prisma error
const createPrismaError = (code: string, message: string) => {
  const error = new Error(message) as any;
  error.code = code;
  // Make it pass instanceof check
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  return error;
};

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  schedule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  employee: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// Mock sanitizers
vi.mock('@/lib/security/sanitize', () => ({
  sanitizers: {
    name: vi.fn((value) => String(value ?? '')),
  },
}));

// Import route handlers after mocks
import { GET, POST, PATCH, DELETE } from '@/app/api/schedules/route';

describe('Schedules API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all non-deleted schedules', async () => {
    const mockSchedules = [
      {
        id: 'sch1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        status: 'scheduled',
        notes: 'Regular shift',
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
        deletedAt: null,
        createdAt: new Date('2025-10-20'),
        updatedAt: new Date('2025-10-20'),
      },
      {
        id: 'sch2',
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        date: '2025-10-25',
        shiftType: 'afternoon',
        startTime: '12:00',
        endTime: '17:00',
        position: 'Manager',
        department: 'HR',
        status: 'scheduled',
        notes: null,
        source: 'template',
        templateId: 'tmpl1',
        recurrenceId: null,
        isOverride: false,
        deletedAt: null,
        createdAt: new Date('2025-10-20'),
        updatedAt: new Date('2025-10-20'),
      },
    ];

    mockPrisma.schedule.findMany.mockResolvedValue(mockSchedules);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('sch1');
    expect(data[0].shiftType).toBe('morning');
    expect(data[1].id).toBe('sch2');
    // Verify query was called with soft-delete filter and ordering
    expect(mockPrisma.schedule.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.schedule.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ deletedAt: null });
    expect(callArgs.orderBy).toEqual([{ date: 'desc' }, { startTime: 'asc' }]);
    // select is added for optimization (implementation detail)
  });

  it('should exclude deleted schedules', async () => {
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    await GET();

    // Verify query was called with soft-delete filter
    expect(mockPrisma.schedule.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.schedule.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ deletedAt: null });
    expect(callArgs.orderBy).toEqual([{ date: 'desc' }, { startTime: 'asc' }]);
  });

  it('should handle empty schedules list', async () => {
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('should handle errors', async () => {
    mockPrisma.schedule.findMany.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch schedules');
    expect(data.details).toBe('Database error');
  });
});

describe('Schedules API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a single schedule', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: 'Regular shift',
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        status: 'scheduled',
        notes: 'Regular shift',
        source: 'manual',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.schedules).toHaveLength(1);
    expect(data.schedules[0].employeeId).toBe('emp1');
    expect(mockPrisma.schedule.createMany).toHaveBeenCalled();
  });

  it('should handle bulk schedule creation', async () => {
    const mockSchedules = [
      {
        id: 'sch1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        status: 'scheduled',
        notes: null,
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
        deletedAt: null,
        createdAt: new Date('2025-10-20'),
        updatedAt: new Date('2025-10-20'),
      },
      {
        id: 'sch2',
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        date: '2025-10-25',
        shiftType: 'afternoon',
        startTime: '12:00',
        endTime: '17:00',
        position: 'Manager',
        department: 'HR',
        status: 'scheduled',
        notes: null,
        source: 'manual',
        templateId: null,
        recurrenceId: null,
        isOverride: false,
        deletedAt: null,
        createdAt: new Date('2025-10-20'),
        updatedAt: new Date('2025-10-20'),
      },
    ];

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([
      { employeeId: 'emp1' },
      { employeeId: 'emp2' },
    ]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockSchedules);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify([
        {
          employeeId: 'emp1',
          employeeName: 'John Doe',
          date: '2025-10-25',
          shiftType: 'morning',
          startTime: '08:00',
          endTime: '12:00',
          position: 'Developer',
          department: 'IT',
        },
        {
          employeeId: 'emp2',
          employeeName: 'Jane Smith',
          date: '2025-10-25',
          shiftType: 'afternoon',
          startTime: '12:00',
          endTime: '17:00',
          position: 'Manager',
          department: 'HR',
        },
      ]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.schedules).toHaveLength(2);
    expect(data.message).toBe('Successfully saved 2 schedule(s)');
  });

  it('should normalize shift types', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'MORNING', // Uppercase
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedules[0].shiftType).toBe('morning');
  });

  it('should default to morning for invalid shift types', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'invalid-shift', // Invalid
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedules[0].shiftType).toBe('morning');
  });

  it('should normalize status values', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'completed',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        status: 'COMPLETED', // Uppercase
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedules[0].status).toBe('completed');
  });

  it('should normalize source values', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: null,
      source: 'template',
      templateId: 'tmpl1',
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        source: 'TEMPLATE', // Uppercase
        templateId: 'tmpl1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedules[0].source).toBe('template');
  });

  it('should parse boolean isOverride field', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: true,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-20'),
    };

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeId: 'emp1' }]);
    mockPrisma.schedule.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.schedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockSchedule]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
        isOverride: 'true', // String
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.schedules[0].isOverride).toBe(true);
  });

  it('should return 400 for empty request body', async () => {
    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify([]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Request body must contain schedule data');
  });

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        // Missing required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed for multiple records');
    expect(data.details[0].errors._error).toContain(
      'Missing required schedule fields'
    );
  });

  it('should handle errors', async () => {
    mockPrisma.schedule.createMany.mockRejectedValue(
      new Error('Database error')
    );
    mockPrisma.schedule.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-25',
        shiftType: 'morning',
        startTime: '08:00',
        endTime: '12:00',
        position: 'Developer',
        department: 'IT',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create schedules');
  });
});

describe('Schedules API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Schedule ID is required');
  });

  it('should return 400 if no valid fields to update', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'sch1',
      employeeId: 'emp1',
      date: '2025-10-25',
    });

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'sch1',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No valid fields supplied for update');
  });

  it('should update schedule fields', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'completed',
      notes: 'Shift completed',
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: null,
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-25'),
    };

    mockPrisma.schedule.findFirst
      .mockResolvedValueOnce(mockSchedule)
      .mockResolvedValueOnce(null);
    mockPrisma.schedule.update.mockResolvedValue(mockSchedule);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'sch1',
        status: 'completed',
        notes: 'Shift completed',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Schedule updated successfully');
    expect(data.schedule.status).toBe('completed');
    expect(data.schedule.notes).toBe('Shift completed');
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
      where: { id: 'sch1' },
      data: {
        status: 'completed',
        notes: 'Shift completed',
      },
    });
  });

  it('should return 404 if schedule not found', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'nonexistent',
        status: 'completed',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Schedule not found or already deleted');
  });

  it('should handle errors', async () => {
    mockPrisma.schedule.findFirst
      .mockResolvedValueOnce({
        id: 'sch1',
        employeeId: 'emp1',
        date: '2025-10-25',
      })
      .mockResolvedValueOnce(null);
    mockPrisma.schedule.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/schedules', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'sch1',
        status: 'completed',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update schedule');
  });
});

describe('Schedules API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/schedules');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Schedule ID is required');
  });

  it('should soft delete schedule', async () => {
    const mockSchedule = {
      id: 'sch1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-25',
      shiftType: 'morning',
      startTime: '08:00',
      endTime: '12:00',
      position: 'Developer',
      department: 'IT',
      status: 'scheduled',
      notes: null,
      source: 'manual',
      templateId: null,
      recurrenceId: null,
      isOverride: false,
      deletedAt: new Date('2025-10-22'),
      createdAt: new Date('2025-10-20'),
      updatedAt: new Date('2025-10-22'),
    };

    mockPrisma.schedule.update.mockResolvedValue(mockSchedule);

    const request = new NextRequest('http://localhost/api/schedules?id=sch1');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Schedule deleted successfully');
    expect(mockPrisma.schedule.update).toHaveBeenCalledWith({
      where: { id: 'sch1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should return 404 if schedule not found', async () => {
    mockPrisma.schedule.update.mockRejectedValue(
      createPrismaError('P2025', 'Record not found')
    );

    const request = new NextRequest(
      'http://localhost/api/schedules?id=nonexistent'
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Schedule not found or already deleted');
  });

  it('should handle errors', async () => {
    mockPrisma.schedule.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/schedules?id=sch1');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete schedule');
  });
});
