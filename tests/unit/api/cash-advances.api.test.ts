import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  cashAdvanceRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock cash advance schedule functions
const mockCashAdvanceSchedule = vi.hoisted(() => ({
  determineCycleFromDate: vi.fn((date: Date) => {
    return date.getUTCDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
  }),
  ensureNextPayday: vi.fn((approvedDate: Date) => {
    // If date is before 15th, next payday is 15th of same month
    // If date is after 15th, next payday is last day of same month
    // If date is after last day, next payday is 15th of next month
    const day = approvedDate.getUTCDate();
    const year = approvedDate.getUTCFullYear();
    const month = approvedDate.getUTCMonth();

    if (day < 15) {
      return {
        date: new Date(Date.UTC(year, month, 15)),
        cycle: 'FIRST_HALF' as const,
      };
    } else if (day < 28) {
      return {
        date: new Date(Date.UTC(year, month + 1, 0)), // Last day of month
        cycle: 'SECOND_HALF' as const,
      };
    } else {
      return {
        date: new Date(Date.UTC(year, month + 1, 15)),
        cycle: 'FIRST_HALF' as const,
      };
    }
  }),
}));

vi.mock('@/lib/payroll/cashAdvanceSchedule', () => mockCashAdvanceSchedule);

// Import route handlers after mocks
import { GET, POST, PUT, DELETE } from '@/app/api/cash-advances/route';

describe('Cash Advances API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all cash advance records', async () => {
    const mockRecords = [
      {
        id: 'ca1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: new Prisma.Decimal(5000),
        termsMonths: 3,
        monthlyPayment: new Prisma.Decimal(1666.67),
        settledAmount: new Prisma.Decimal(1666.67),
        remainingBalance: new Prisma.Decimal(3333.33),
        purpose: 'Emergency',
        notes: 'Medical',
        requestDate: new Date('2025-10-01'),
        status: 'approved',
        approvedBy: 'admin',
        approvedDate: new Date('2025-10-02'),
        rejectedBy: null,
        rejectedDate: null,
        rejectionReason: null,
        deductionCycle: 'FIRST_HALF',
        nextDeductionDate: new Date('2025-11-15'),
        lastDeductedDate: new Date('2025-10-15'),
        createdAt: new Date('2025-10-01'),
        updatedAt: new Date('2025-10-02'),
      },
    ];

    mockPrisma.cashAdvanceRecord.findMany.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].amount).toBe(5000);
    expect(data[0].monthlyPayment).toBe(1666.67);
    expect(data[0].settledAmount).toBe(1666.67);
    expect(data[0].remainingBalance).toBe(3333.33);
  });

  it('should filter by status', async () => {
    mockPrisma.cashAdvanceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?status=approved'
    );
    await GET(request);

    expect(mockPrisma.cashAdvanceRecord.findMany).toHaveBeenCalledWith({
      where: {
        status: 'approved',
        employeeId: undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  });

  it('should filter by employeeId', async () => {
    mockPrisma.cashAdvanceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?employeeId=emp1'
    );
    await GET(request);

    expect(mockPrisma.cashAdvanceRecord.findMany).toHaveBeenCalledWith({
      where: {
        status: undefined,
        employeeId: 'emp1',
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  });

  it('should handle "all" status filter', async () => {
    mockPrisma.cashAdvanceRecord.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?status=all'
    );
    await GET(request);

    expect(mockPrisma.cashAdvanceRecord.findMany).toHaveBeenCalledWith({
      where: {
        status: undefined,
        employeeId: undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  });

  it('should calculate remainingBalance from amount and settledAmount', async () => {
    const mockRecords = [
      {
        id: 'ca1',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: new Prisma.Decimal(10000),
        termsMonths: null,
        monthlyPayment: null,
        settledAmount: new Prisma.Decimal(3000),
        remainingBalance: null, // null to test calculation
        purpose: null,
        notes: null,
        requestDate: null,
        status: 'approved',
        approvedBy: null,
        approvedDate: null,
        rejectedBy: null,
        rejectedDate: null,
        rejectionReason: null,
        deductionCycle: null,
        nextDeductionDate: null,
        lastDeductedDate: null,
        createdAt: new Date('2025-10-01'),
        updatedAt: new Date('2025-10-01'),
      },
    ];

    mockPrisma.cashAdvanceRecord.findMany.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const data = await response.json();

    expect(data[0].remainingBalance).toBe(7000); // 10000 - 3000
  });

  it('should handle errors', async () => {
    mockPrisma.cashAdvanceRecord.findMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch cash advances');
  });
});

describe('Cash Advances API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a pending cash advance', async () => {
    const mockRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: 3,
      monthlyPayment: new Prisma.Decimal(1666.67),
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: 'Emergency',
      notes: null,
      requestDate: new Date('2025-10-01'),
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date('2025-10-01'),
      updatedAt: new Date('2025-10-01'),
    };

    mockPrisma.cashAdvanceRecord.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        termsMonths: 3,
        monthlyPayment: 1666.67,
        purpose: 'Emergency',
        requestDate: '2025-10-01',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe('pending');
    expect(data.amount).toBe(5000);
    expect(mockPrisma.cashAdvanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'emp1',
          status: 'pending',
          deductionCycle: undefined, // No cycle for pending
          nextDeductionDate: undefined, // No date for pending
        }),
      })
    );
  });

  it('should create approved cash advance with deduction schedule', async () => {
    const approvedDate = new Date('2025-10-05');
    const mockRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: 3,
      monthlyPayment: new Prisma.Decimal(1666.67),
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: 'Emergency',
      notes: null,
      requestDate: new Date('2025-10-01'),
      status: 'approved',
      approvedBy: 'admin',
      approvedDate,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
      lastDeductedDate: null,
      createdAt: new Date('2025-10-01'),
      updatedAt: new Date('2025-10-05'),
    };

    mockPrisma.cashAdvanceRecord.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        termsMonths: 3,
        monthlyPayment: 1666.67,
        purpose: 'Emergency',
        requestDate: '2025-10-01',
        status: 'approved',
        approvedBy: 'admin',
        approvedDate: '2025-10-05',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe('approved');
    expect(mockCashAdvanceSchedule.ensureNextPayday).toHaveBeenCalled();
    expect(mockPrisma.cashAdvanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'approved',
          deductionCycle: 'FIRST_HALF',
          nextDeductionDate: expect.any(Date),
        }),
      })
    );
  });

  it('should auto-set approvedDate when status is approved', async () => {
    const mockRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'approved',
      approvedBy: 'admin',
      approvedDate: new Date(),
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
      lastDeductedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.cashAdvanceRecord.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
        status: 'approved',
        approvedBy: 'admin',
        // No approvedDate provided - should be auto-set
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.approvedDate).toBeTruthy();
  });

  it('should handle employee name from "employee" field', async () => {
    const mockRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.cashAdvanceRecord.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employee: 'John Doe', // Alternative field name
        amount: 5000,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockPrisma.cashAdvanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeName: 'John Doe',
        }),
      })
    );
  });

  it('should handle errors', async () => {
    mockPrisma.cashAdvanceRecord.create.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create cash advance');
  });
});

describe('Cash Advances API - PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        amount: 5000,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cash advance ID is required');
  });

  it('should return 404 if record not found', async () => {
    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'nonexistent',
        amount: 5000,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Cash advance not found');
  });

  it('should update cash advance fields', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: 3,
      monthlyPayment: new Prisma.Decimal(1666.67),
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: 'Emergency',
      notes: null,
      requestDate: new Date('2025-10-01'),
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date('2025-10-01'),
      updatedAt: new Date('2025-10-01'),
    };

    const updatedRecord = {
      ...existingRecord,
      amount: new Prisma.Decimal(6000),
      notes: 'Updated notes',
      updatedAt: new Date('2025-10-02'),
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        amount: 6000,
        notes: 'Updated notes',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.amount).toBe(6000);
    expect(data.notes).toBe('Updated notes');
  });

  it('should auto-set approvedDate when status changes to approved', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: 3,
      monthlyPayment: new Prisma.Decimal(1666.67),
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: 'Emergency',
      notes: null,
      requestDate: new Date('2025-10-01'),
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date('2025-10-01'),
      updatedAt: new Date('2025-10-01'),
    };

    const updatedRecord = {
      ...existingRecord,
      status: 'approved',
      approvedBy: 'admin',
      approvedDate: new Date('2025-10-05'),
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
      updatedAt: new Date('2025-10-05'),
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        status: 'approved',
        approvedBy: 'admin',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('approved');
    expect(mockCashAdvanceSchedule.ensureNextPayday).toHaveBeenCalled();
  });

  it('should set deduction schedule when status changes to approved', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'pending',
      approvedBy: null,
      approvedDate: null,
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: null,
      nextDeductionDate: null,
      lastDeductedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRecord = {
      ...existingRecord,
      status: 'approved',
      approvedDate: new Date('2025-10-05'),
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        status: 'approved',
        approvedDate: '2025-10-05', // Provide explicit date before 15th
      }),
    });

    await PUT(request);

    expect(mockPrisma.cashAdvanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deductionCycle: 'FIRST_HALF',
          nextDeductionDate: expect.any(Date),
        }),
      })
    );
  });

  it('should clear deduction schedule when status changes from approved', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(2000),
      remainingBalance: new Prisma.Decimal(3000),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'approved',
      approvedBy: 'admin',
      approvedDate: new Date('2025-10-05'),
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
      lastDeductedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRecord = {
      ...existingRecord,
      status: 'rejected',
      rejectedBy: 'admin',
      rejectedDate: new Date('2025-10-06'),
      rejectionReason: 'Not approved',
      deductionCycle: null,
      nextDeductionDate: null,
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        status: 'rejected',
        rejectedBy: 'admin',
        rejectionReason: 'Not approved',
      }),
    });

    await PUT(request);

    expect(mockPrisma.cashAdvanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'rejected',
          nextDeductionDate: null,
          deductionCycle: null,
        }),
      })
    );
  });

  it('should auto-change status to paid when remainingBalance reaches 0', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: 3,
      monthlyPayment: new Prisma.Decimal(1666.67),
      settledAmount: new Prisma.Decimal(3333.33),
      remainingBalance: new Prisma.Decimal(1666.67),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'approved',
      approvedBy: 'admin',
      approvedDate: new Date('2025-10-05'),
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-11-15'),
      lastDeductedDate: new Date('2025-10-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRecord = {
      ...existingRecord,
      settledAmount: new Prisma.Decimal(5000),
      remainingBalance: new Prisma.Decimal(0),
      status: 'paid',
      deductionCycle: null,
      nextDeductionDate: null,
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        settledAmount: 5000,
        remainingBalance: 0,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('paid');
    expect(data.remainingBalance).toBe(0);
    expect(mockPrisma.cashAdvanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'paid',
          nextDeductionDate: null,
          deductionCycle: null,
        }),
      })
    );
  });

  it('should handle manual deductionCycle and nextDeductionDate updates', async () => {
    const existingRecord = {
      id: 'ca1',
      employeeId: 'emp1',
      employeeName: 'John Doe',
      amount: new Prisma.Decimal(5000),
      termsMonths: null,
      monthlyPayment: null,
      settledAmount: new Prisma.Decimal(0),
      remainingBalance: new Prisma.Decimal(5000),
      purpose: null,
      notes: null,
      requestDate: null,
      status: 'approved',
      approvedBy: 'admin',
      approvedDate: new Date('2025-10-05'),
      rejectedBy: null,
      rejectedDate: null,
      rejectionReason: null,
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2025-10-15'),
      lastDeductedDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRecord = {
      ...existingRecord,
      deductionCycle: 'SECOND_HALF',
      nextDeductionDate: new Date('2025-10-31'),
    };

    mockPrisma.cashAdvanceRecord.findUnique.mockResolvedValue(existingRecord);
    mockPrisma.cashAdvanceRecord.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        deductionCycle: 'SECOND_HALF',
        nextDeductionDate: '2025-10-31',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deductionCycle).toBe('SECOND_HALF');
  });

  it('should handle errors', async () => {
    mockPrisma.cashAdvanceRecord.findUnique.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'ca1',
        amount: 5000,
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update cash advance');
  });
});

describe('Cash Advances API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Cash advance ID is required');
  });

  it('should delete cash advance', async () => {
    mockPrisma.cashAdvanceRecord.delete.mockResolvedValue({
      id: 'ca1',
    } as never);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?id=ca1'
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.cashAdvanceRecord.delete).toHaveBeenCalledWith({
      where: { id: 'ca1' },
    });
  });

  it('should handle errors', async () => {
    mockPrisma.cashAdvanceRecord.delete.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest(
      'http://localhost/api/cash-advances?id=ca1'
    );
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete cash advance');
  });
});
