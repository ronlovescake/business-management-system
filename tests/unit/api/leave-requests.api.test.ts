import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  leaveRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  employee: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock mass deletion validation
vi.mock('@/lib/safety/mass-deletion', () => ({
  validateMassDeleteConfirmation: vi.fn(() => null), // Returns null = validation passes
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// Mock date utility
vi.mock('@/utils/date', () => ({
  getCurrentDateISO: vi.fn(() => '2025-10-22'),
}));

// Import route handlers after mocks
import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/leave-requests/route';
import {
  GET as GET_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/leave-requests/[id]/route';

describe('Leave Requests API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all leave requests', async () => {
    const mockRequests = [
      {
        id: 1,
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        paymentStatus: 'paid',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        numberOfDays: 3,
        reason: 'Medical appointment',
        status: 'approved',
        appliedDate: '2025-10-15',
        approvedBy: 'manager1',
        notes: 'Doctor note attached',
      },
      {
        id: 2,
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        leaveType: 'Vacation Leave',
        paymentStatus: 'paid',
        startDate: '2025-11-01',
        endDate: '2025-11-05',
        numberOfDays: 5,
        reason: 'Family vacation',
        status: 'pending',
        appliedDate: '2025-10-20',
        approvedBy: null,
        notes: null,
      },
    ];

    mockPrisma.leaveRequest.findMany.mockResolvedValue(mockRequests);

    const request = new NextRequest('http://localhost/api/leave-requests');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('1'); // Integer ID converted to string
    expect(data[0].employeeName).toBe('John Doe');
    expect(data[1].id).toBe('2');
  });

  it('should filter by employeeId', async () => {
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/leave-requests?employeeId=emp1'
    );
    await GET(request);

    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp1' },
      orderBy: { startDate: 'desc' },
    });
  });

  it('should handle empty employeeId filter', async () => {
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/leave-requests?employeeId='
    );
    await GET(request);

    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { startDate: 'desc' },
    });
  });

  it('should convert null fields to undefined in response', async () => {
    const mockRequests = [
      {
        id: 1,
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        paymentStatus: 'paid',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        numberOfDays: 3,
        reason: 'Medical',
        status: 'pending',
        appliedDate: '2025-10-15',
        approvedBy: null,
        notes: null,
      },
    ];

    mockPrisma.leaveRequest.findMany.mockResolvedValue(mockRequests);

    const request = new NextRequest('http://localhost/api/leave-requests');
    const response = await GET(request);
    const data = await response.json();

    expect(data[0].approvedBy).toBeUndefined();
    expect(data[0].notes).toBeUndefined();
  });

  it('should handle errors', async () => {
    mockPrisma.leaveRequest.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/leave-requests');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch leave requests');
  });
});

describe('Leave Requests API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a single leave request', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        paymentStatus: 'paid',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical appointment',
        status: 'pending',
        appliedDate: '2025-10-15',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.message).toContain('1 leave request records');
    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          employeeId: 'emp1',
          employeeName: 'John Doe',
          leaveType: 'Sick Leave',
          status: 'pending',
        }),
      ]),
    });
  });

  it('should handle bulk creation', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
      { id: 2, employeeId: 'emp2', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 2 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify([
        {
          employeeId: 'emp1',
          employeeName: 'John Doe',
          leaveType: 'Sick Leave',
          startDate: '2025-10-20',
          endDate: '2025-10-22',
          reason: 'Medical',
        },
        {
          employeeId: 'emp2',
          employeeName: 'Jane Smith',
          leaveType: 'Vacation Leave',
          startDate: '2025-11-01',
          endDate: '2025-11-05',
          reason: 'Family vacation',
        },
      ]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.message).toContain('2 leave request records');
  });

  it('should calculate numberOfDays from date range', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        // numberOfDays not provided - should be calculated
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          numberOfDays: 3, // Oct 20, 21, 22 = 3 days
        }),
      ]),
    });
  });

  it('should use provided numberOfDays if valid', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        numberOfDays: 2, // Manual override
        reason: 'Medical',
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          numberOfDays: 2,
        }),
      ]),
    });
  });

  it('should normalize status values', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        status: 'APPROVED', // Uppercase
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          status: 'approved',
        }),
      ]),
    });
  });

  it('should default to pending for invalid status', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        status: 'invalid-status',
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
        }),
      ]),
    });
  });

  it('should normalize payment status values', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        paymentStatus: 'NOT-APPLICABLE', // Uppercase with hyphen
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          paymentStatus: 'not-applicable',
        }),
      ]),
    });
  });

  it('should default to unpaid for invalid payment status', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        paymentStatus: 'invalid',
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          paymentStatus: 'unpaid',
        }),
      ]),
    });
  });

  it('should use current date for appliedDate if not provided', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, employeeId: 'emp1', deletedAt: null },
    ]);
    mockPrisma.leaveRequest.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
        // appliedDate not provided
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.leaveRequest.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          appliedDate: '2025-10-22', // From mocked getCurrentDateISO
        }),
      ]),
    });
  });

  it('should return 400 for empty request body', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify([]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      'Request body must contain one or more leave requests'
    );
  });

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        // Missing required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Failed to import leave requests');
    expect(data.details).toContain('Missing required fields');
  });

  it('should handle errors', async () => {
    mockPrisma.leaveRequest.createMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        reason: 'Medical',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to import leave requests');
  });
});

describe('Leave Requests API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'approved',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Leave request ID is required');
  });

  it('should return 400 if no valid fields to update', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '1',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No valid fields supplied for update');
  });

  it('should update leave request fields', async () => {
    const mockRequest = {
      id: 1,
      employeeId: 'emp1',
      employeeName: 'John Doe',
      leaveType: 'Sick Leave',
      paymentStatus: 'paid',
      startDate: '2025-10-20',
      endDate: '2025-10-22',
      numberOfDays: 3,
      reason: 'Medical',
      status: 'approved',
      appliedDate: '2025-10-15',
      approvedBy: 'manager1',
      notes: 'Approved',
    };

    mockPrisma.leaveRequest.update.mockResolvedValue(mockRequest);

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '1',
        status: 'approved',
        approvedBy: 'manager1',
        notes: 'Approved',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Leave request updated successfully');
    expect(data.request.status).toBe('approved');
    expect(data.request.id).toBe('1'); // Integer converted to string
    expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'approved',
        approvedBy: 'manager1',
        notes: 'Approved',
      },
    });
  });

  it('should recalculate numberOfDays when dates are updated', async () => {
    const mockRequest = {
      id: 1,
      employeeId: 'emp1',
      employeeName: 'John Doe',
      leaveType: 'Sick Leave',
      paymentStatus: 'paid',
      startDate: '2025-10-20',
      endDate: '2025-10-25',
      numberOfDays: 6,
      reason: 'Medical',
      status: 'pending',
      appliedDate: '2025-10-15',
      approvedBy: null,
      notes: null,
    };

    mockPrisma.leaveRequest.update.mockResolvedValue(mockRequest);

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '1',
        startDate: '2025-10-20',
        endDate: '2025-10-25', // Extended from 10-22 to 10-25
      }),
    });

    await PATCH(request);

    expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        startDate: '2025-10-20',
        endDate: '2025-10-25',
        numberOfDays: 6, // Recalculated
      }),
    });
  });

  it('should handle errors', async () => {
    mockPrisma.leaveRequest.update.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '1',
        status: 'approved',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update leave request');
  });
});

describe('Leave Requests API - PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should bulk update leave requests', async () => {
    const mockRequests = [
      {
        id: 1,
        employeeId: 'emp1',
        employeeName: 'John Doe',
        leaveType: 'Sick Leave',
        paymentStatus: 'paid',
        startDate: '2025-10-20',
        endDate: '2025-10-22',
        numberOfDays: 3,
        reason: 'Medical',
        status: 'approved',
        appliedDate: '2025-10-15',
        approvedBy: 'manager1',
        notes: null,
      },
      {
        id: 2,
        employeeId: 'emp2',
        employeeName: 'Jane Smith',
        leaveType: 'Vacation Leave',
        paymentStatus: 'paid',
        startDate: '2025-11-01',
        endDate: '2025-11-05',
        numberOfDays: 5,
        reason: 'Vacation',
        status: 'approved',
        appliedDate: '2025-10-20',
        approvedBy: 'manager1',
        notes: null,
      },
    ];

    mockPrisma.leaveRequest.update
      .mockResolvedValueOnce(mockRequests[0])
      .mockResolvedValueOnce(mockRequests[1]);

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PUT',
      body: JSON.stringify([
        {
          id: '1',
          status: 'approved',
          approvedBy: 'manager1',
        },
        {
          id: '2',
          status: 'approved',
          approvedBy: 'manager1',
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.message).toContain('2 leave requests');
    expect(mockPrisma.leaveRequest.update).toHaveBeenCalledTimes(2);
  });

  it('should return 400 for empty array', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PUT',
      body: JSON.stringify([]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Expected array of leave requests to update');
  });

  it('should return 500 for missing ID', async () => {
    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PUT',
      body: JSON.stringify([
        {
          status: 'approved',
          // Missing id
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to bulk update leave requests');
    expect(data.details).toContain('ID is required');
  });

  it('should handle errors', async () => {
    mockPrisma.leaveRequest.update.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'PUT',
      body: JSON.stringify([
        {
          id: '1',
          status: 'approved',
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to bulk update leave requests');
  });
});

describe('Leave Requests API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete all leave requests', async () => {
    mockPrisma.leaveRequest.updateMany.mockResolvedValue({ count: 5 });

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(5);
    expect(data.message).toContain('5 leave request records');
    expect(mockPrisma.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should fetch and soft delete a leave request by id', async () => {
    mockPrisma.leaveRequest.findFirst
      .mockResolvedValueOnce({ id: 1, employeeId: 'emp1', deletedAt: null })
      .mockResolvedValueOnce({ id: 1, employeeId: 'emp1', deletedAt: null });
    mockPrisma.leaveRequest.update.mockResolvedValue({
      id: 1,
      employeeId: 'emp1',
      deletedAt: new Date('2026-04-06T00:00:00.000Z'),
    });

    const getResponse = await GET_BY_ID(
      new NextRequest('http://localhost/api/leave-requests/1'),
      { params: { id: '1' } }
    );
    const deleteResponse = await DELETE_BY_ID(
      new NextRequest('http://localhost/api/leave-requests/1', {
        method: 'DELETE',
      }),
      { params: { id: '1' } }
    );

    expect(getResponse.status).toBe(200);
    expect(mockPrisma.leaveRequest.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 1, deletedAt: null },
    });
    expect(deleteResponse.status).toBe(200);
    expect(mockPrisma.leaveRequest.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('should handle errors', async () => {
    mockPrisma.leaveRequest.updateMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/leave-requests', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete leave requests');
  });
});
