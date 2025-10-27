import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  attendance: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  employee: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
  $use: vi.fn(), // Mock middleware method
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      meta?: Record<string, unknown>;
      constructor(
        message: string,
        options: { code: string; meta?: Record<string, unknown> }
      ) {
        super(message);
        this.code = options.code;
        this.meta = options.meta;
      }
    },
  },
}));

// Import route handlers after mocks
import { GET, POST, PATCH, DELETE } from '@/app/api/attendance/route';

// Expected select clause for attendance queries (sanitization fields)
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

describe('Attendance API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all non-deleted attendance records', async () => {
    const mockRecords = [
      {
        id: 'att1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        hoursWorked: 9,
        deletedAt: null,
        createdAt: new Date('2025-10-15'),
        updatedAt: new Date('2025-10-15'),
      },
      {
        id: 'att2',
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        hoursWorked: 9,
        deletedAt: null,
        createdAt: new Date('2025-10-15'),
        updatedAt: new Date('2025-10-15'),
      },
    ];

    mockPrisma.attendance.findMany.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/attendance');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should filter by employeeId', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?employeeId=emp1'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        employeeId: 'EMP1', // Normalized to uppercase
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should filter by status', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?status=present'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        status: 'present',
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should handle "all" status filter', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?status=all'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        // status should not be included
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should filter by date range', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?startDate=2025-10-01&endDate=2025-10-31'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        date: {
          gte: '2025-10-01',
          lte: '2025-10-31',
        },
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should filter by startDate only', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?startDate=2025-10-01'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        date: {
          gte: '2025-10-01',
        },
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should filter by endDate only', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?endDate=2025-10-31'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        date: {
          lte: '2025-10-31',
        },
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should combine multiple filters', async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/attendance?employeeId=emp1&status=present&startDate=2025-10-01&endDate=2025-10-31'
    );
    await GET(request);

    expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        employeeId: 'EMP1', // Normalized to uppercase
        status: 'present',
        date: {
          gte: '2025-10-01',
          lte: '2025-10-31',
        },
      },
      select: ATTENDANCE_SELECT,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });
  });

  it('should handle errors', async () => {
    mockPrisma.attendance.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/attendance');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch attendance records');
  });
});

describe('Attendance API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a single attendance record', async () => {
    const mockRecord = {
      id: 'att1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      department: 'IT',
      position: 'Developer',
      date: '2025-10-15',
      status: 'present',
      timeIn: '08:00',
      timeOut: '17:00',
      totalHours: 9,
      hoursWorked: 9,
      deletedAt: null,
      createdAt: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-15'),
    };

    mockPrisma.employee.findFirst.mockResolvedValue({
      employeeId: 'emp1',
      employeeName: 'John Doe',
    });
    mockPrisma.attendance.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 9,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('att1');
    expect(data.employeeId).toBe('emp1');
    expect(mockPrisma.attendance.create).toHaveBeenCalledWith({
      data: {
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 9,
      },
    });
  });

  it('should handle bulk create with transaction', async () => {
    const mockRecords = [
      {
        id: 'att1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        hoursWorked: 9,
        deletedAt: null,
        createdAt: new Date('2025-10-15'),
        updatedAt: new Date('2025-10-15'),
      },
      {
        id: 'att2',
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        hoursWorked: 9,
        deletedAt: null,
        createdAt: new Date('2025-10-15'),
        updatedAt: new Date('2025-10-15'),
      },
    ];

    // Mock employee existence check
    mockPrisma.employee.findMany.mockResolvedValue([
      { employeeId: 'emp1' },
      { employeeId: 'emp2' },
    ]);
    mockPrisma.$transaction.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'POST',
      body: JSON.stringify([
        {
          employeeId: 'emp1',
          employeeName: 'John Doe',
          department: 'IT',
          position: 'Developer',
          date: '2025-10-15',
          status: 'present',
          timeIn: '08:00',
          timeOut: '17:00',
          totalHours: 9,
        },
        {
          employeeId: 'emp2',
          employeeName: 'Jane Smith',
          department: 'IT',
          position: 'Designer',
          date: '2025-10-15',
          status: 'present',
          timeIn: '08:00',
          timeOut: '17:00',
          totalHours: 9,
        },
      ]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(2);
    expect(data.records).toHaveLength(2);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should handle empty bulk create', async () => {
    mockPrisma.$transaction.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'POST',
      body: JSON.stringify([]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.records).toHaveLength(0);
  });

  it('should handle errors', async () => {
    mockPrisma.attendance.create.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'present',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 9,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create attendance record');
  });
});

describe('Attendance API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'absent',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Attendance ID is required');
  });

  it('should update attendance record', async () => {
    const mockRecord = {
      id: 'att1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      department: 'IT',
      position: 'Developer',
      date: '2025-10-15',
      status: 'absent',
      timeIn: '08:00',
      timeOut: '17:00',
      totalHours: 0,
      hoursWorked: 0,
      deletedAt: null,
      createdAt: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-16'),
    };

    mockPrisma.attendance.update.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'att1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'absent',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 0,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('absent');
    expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
      where: { id: 'att1', deletedAt: null },
      data: {
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'absent',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 0,
      },
    });
  });

  it('should update partial fields', async () => {
    const mockRecord = {
      id: 'att1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      department: 'IT',
      position: 'Developer',
      date: '2025-10-15',
      status: 'late',
      timeIn: '09:30',
      timeOut: '17:00',
      totalHours: 7.5,
      hoursWorked: 7.5,
      deletedAt: null,
      createdAt: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-16'),
    };

    mockPrisma.attendance.update.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'att1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'late',
        timeIn: '09:30',
        timeOut: '17:00',
        totalHours: 7.5,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('late');
    expect(data.timeIn).toBe('09:30');
  });

  it('should handle errors', async () => {
    mockPrisma.attendance.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/attendance', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'att1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        department: 'IT',
        position: 'Developer',
        date: '2025-10-15',
        status: 'absent',
        timeIn: '08:00',
        timeOut: '17:00',
        totalHours: 0,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update attendance record');
  });
});

describe('Attendance API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/attendance');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Attendance ID is required');
  });

  it('should soft delete attendance record', async () => {
    const mockRecord = {
      id: 'att1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      date: '2025-10-15',
      status: 'present',
      timeIn: '08:00',
      timeOut: '17:00',
      hoursWorked: 9,
      deletedAt: new Date('2025-10-16'),
      createdAt: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-16'),
    };

    mockPrisma.attendance.update.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/attendance?id=att1');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deletedAt).toBeTruthy();
    expect(mockPrisma.attendance.update).toHaveBeenCalledWith({
      where: { id: 'att1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should handle errors', async () => {
    mockPrisma.attendance.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/attendance?id=att1');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete attendance record');
  });
});
