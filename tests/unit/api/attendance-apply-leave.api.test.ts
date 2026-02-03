import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      employee: {
        findFirst: vi.fn(),
      },
      attendance: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { POST } from '@/app/api/attendance/apply-leave/route';

describe('Attendance Apply Leave API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Mock current date to Oct 22, 2025 for consistent date filtering
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-10-22T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockEmployee = {
    employeeId: 'EMP-001',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    department: 'Engineering',
    position: 'Software Engineer',
    deletedAt: null,
  };

  const createMockRequest = (body: unknown): NextRequest => {
    return {
      json: async () => body,
    } as NextRequest;
  };

  describe('POST /api/attendance/apply-leave', () => {
    it('should create attendance records only for dates up to today', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20', // Past
        endDate: '2025-10-25', // Future (beyond Oct 22)
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 3 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(3); // Only Oct 20, 21, 22

      // Verify only dates up to today were created
      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      const createdDates = createCall.data.map(
        (record: { date: string }) => record.date
      );

      expect(createdDates).toEqual(['2025-10-20', '2025-10-21', '2025-10-22']);
      expect(createdDates).not.toContain('2025-10-23');
      expect(createdDates).not.toContain('2025-10-24');
      expect(createdDates).not.toContain('2025-10-25');
    });

    it('should return success with 0 records when leave is entirely in the future', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Vacation',
        startDate: '2025-11-01', // Future
        endDate: '2025-11-05', // Future
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(0);
      expect(data.createdCount).toBe(0);
      expect(data.totalAffected).toBe(0);
      expect(data.message).toContain('future dates only');

      // Should not query or modify attendance records
      expect(mockPrisma.attendance.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.attendance.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.attendance.updateMany).not.toHaveBeenCalled();
    });

    it('should create all attendance records when leave is entirely in the past', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-15',
        endDate: '2025-10-18',
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 4 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(4); // Oct 15, 16, 17, 18

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      const createdDates = createCall.data.map(
        (record: { date: string }) => record.date
      );

      expect(createdDates).toEqual([
        '2025-10-15',
        '2025-10-16',
        '2025-10-17',
        '2025-10-18',
      ]);
    });

    it('should update existing attendance records for past dates only', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Emergency Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-25', // Future
      });

      // Mock existing attendance for Oct 20 and 21
      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([
        { id: 'att-1', date: '2025-10-20' },
        { id: 'att-2', date: '2025-10-21' },
      ]);
      mockPrisma.attendance.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(2); // Oct 20, 21 updated
      expect(data.createdCount).toBe(1); // Oct 22 created
      expect(data.totalAffected).toBe(3);

      // Verify only past dates were queried
      expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { in: ['2025-10-20', '2025-10-21', '2025-10-22'] },
          }),
        })
      );

      // Verify update only for existing dates
      expect(mockPrisma.attendance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { in: ['2025-10-20', '2025-10-21'] },
          }),
          data: expect.objectContaining({
            status: 'on-leave',
            timeIn: '00:00',
            timeOut: '00:00',
            totalHours: 0,
          }),
        })
      );
    });

    it('should set correct leave label based on leave type', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Vacation',
        startDate: '2025-10-22',
        endDate: '2025-10-22',
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      expect(createCall.data[0].details).toBe('On Vacation');
    });

    it('should use generic label when leave type is not provided', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        startDate: '2025-10-22',
        endDate: '2025-10-22',
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      expect(createCall.data[0].details).toBe('On Leave');
    });

    it('should return error when employee ID is missing', async () => {
      const request = createMockRequest({
        employeeName: 'John Doe',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Employee ID is required');
    });

    it('should return error when dates are missing', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Start date and end date are required');
    });

    it('should return error when date is invalid', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        startDate: 'invalid-date', // Invalid date becomes empty string
        endDate: '2025-10-22',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      // Invalid dates are caught by the "dates required" validation
      expect(data.error).toContain('Start date and end date are required');
    });

    it('should handle reversed date range (end before start)', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-22',
        endDate: '2025-10-20', // End before start
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 3 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(3); // Should still create for Oct 20, 21, 22

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      const createdDates = createCall.data.map(
        (record: { date: string }) => record.date
      );

      expect(createdDates).toEqual(['2025-10-20', '2025-10-21', '2025-10-22']);
    });

    it('should use employee record details when available', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        startDate: '2025-10-22',
        endDate: '2025-10-22',
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      const record = createCall.data[0];

      expect(record.employeeName).toBe('John Doe');
      expect(record.department).toBe('Engineering');
      expect(record.position).toBe('Software Engineer');
    });

    it('should handle database errors gracefully', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
      });

      mockPrisma.employee.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to apply leave to attendance records');
      expect(data.details).toBe('Database connection failed');
    });

    it('should handle single day leave correctly', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-22',
        endDate: '2025-10-22', // Same day
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(1);

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0].date).toBe('2025-10-22');
    });

    it('should filter out future dates when leave spans past and future', async () => {
      const request = createMockRequest({
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-18',
        endDate: '2025-10-28', // Spans 11 days, but only 5 are past/today
      });

      mockPrisma.employee.findFirst.mockResolvedValue(mockEmployee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.attendance.createMany.mockResolvedValue({ count: 5 });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(5); // Oct 18, 19, 20, 21, 22 only

      const createCall = mockPrisma.attendance.createMany.mock.calls[0][0];
      const createdDates = createCall.data.map(
        (record: { date: string }) => record.date
      );

      expect(createdDates).toEqual([
        '2025-10-18',
        '2025-10-19',
        '2025-10-20',
        '2025-10-21',
        '2025-10-22',
      ]);

      // Verify future dates are NOT included
      expect(createdDates).not.toContain('2025-10-23');
      expect(createdDates).not.toContain('2025-10-24');
      expect(createdDates).not.toContain('2025-10-28');
    });
  });
});
