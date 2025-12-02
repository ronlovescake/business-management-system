import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

// Mock CashAdvanceService before importing the route
const mockCashAdvanceService = vi.hoisted(() => ({
  findAll: vi.fn(),
  findWithFilters: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/modules/clothing/employees/cash-advance/api/service', () => ({
  cashAdvanceService: mockCashAdvanceService,
}));

// Mock cash advance schedule functions
const mockCashAdvanceSchedule = vi.hoisted(() => ({
  determineCycleFromDate: vi.fn((date: Date) => {
    return date.getUTCDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
  }),
  ensureNextPayday: vi.fn((approvedDate: Date) => {
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
        date: new Date(Date.UTC(year, month + 1, 0)),
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
        id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.findAll.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data?.[0].amount).toBe('5000');
    expect(payload.data?.[0].monthlyPayment).toBe('1666.67');
    expect(payload.data?.[0].settledAmount).toBe('1666.67');
    expect(payload.data?.[0].remainingBalance).toBe('3333.33');
  });

  it('should filter by status', async () => {
    mockCashAdvanceService.findWithFilters.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?status=approved'
    );
    await GET(request);

    expect(mockCashAdvanceService.findWithFilters).toHaveBeenCalledWith({
      status: 'approved',
      employeeId: undefined,
    });
  });

  it('should filter by employeeId', async () => {
    mockCashAdvanceService.findWithFilters.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?employeeId=emp1'
    );
    await GET(request);

    expect(mockCashAdvanceService.findWithFilters).toHaveBeenCalledWith({
      status: undefined,
      employeeId: 'emp1',
    });
  });

  it('should handle "all" status filter', async () => {
    mockCashAdvanceService.findAll.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?status=all'
    );
    await GET(request);

    expect(mockCashAdvanceService.findAll).toHaveBeenCalled();
  });

  it('should return remainingBalance as provided by service', async () => {
    const mockRecords = [
      {
        id: 'clfhj3k8n0000xyz000000001',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: new Prisma.Decimal(10000),
        termsMonths: null,
        monthlyPayment: null,
        settledAmount: new Prisma.Decimal(3000),
        remainingBalance: new Prisma.Decimal(7000), // Provided by service
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockCashAdvanceService.findAll.mockResolvedValue(mockRecords);

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.[0].remainingBalance).toBe('7000');
  });

  it('should handle errors', async () => {
    mockCashAdvanceService.findAll.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to fetch cash advances');
  });
});

describe('Cash Advances API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a pending cash advance', async () => {
    const mockRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.create.mockResolvedValue(mockRecord);

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
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe('pending');
    expect(payload.data?.amount).toBe('5000');
    expect(mockCashAdvanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp1',
        status: 'pending',
        deductionCycle: undefined,
        nextDeductionDate: undefined,
      })
    );
  });

  it('should create approved cash advance with deduction schedule', async () => {
    const approvedDate = new Date('2025-10-05');
    const mockRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.create.mockResolvedValue(mockRecord);

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
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe('approved');
    expect(mockCashAdvanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        employeeId: 'emp1',
        employeeName: 'John Doe',
        amount: 5000,
      })
    );
  });

  it('should auto-set approvedDate when status is approved', async () => {
    const mockRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.create.mockResolvedValue(mockRecord);

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
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data?.approvedDate).toBeTruthy();
  });

  it('should handle employee name from "employee" field', async () => {
    const mockRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.create.mockResolvedValue(mockRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp1',
        employee: 'John Doe', // Alternative field name
        amount: 5000,
      }),
    });

    const response = await POST(request);

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(mockCashAdvanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeName: 'John Doe',
      })
    );
  });

  it('should handle errors', async () => {
    mockCashAdvanceService.create.mockRejectedValue(
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
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to create cash advance');
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
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Cash advance ID is required');
  });

  it('should return 404 if record not found', async () => {
    mockCashAdvanceService.update.mockRejectedValue(
      new Error('Cash advance not found')
    );

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000000', // Valid CUID format
        amount: 5000,
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('not found');
  });

  it('should update cash advance fields', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        amount: 6000,
        notes: 'Updated notes',
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.amount).toBe('6000');
    expect(payload.data?.notes).toBe('Updated notes');
  });

  it('should auto-set approvedDate when status changes to approved', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        status: 'approved',
        approvedBy: 'admin',
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe('approved');
    expect(mockCashAdvanceService.update).toHaveBeenCalledWith(
      'clfhj3k8n0000xyz000000001',
      expect.objectContaining({
        status: 'approved',
        approvedBy: 'admin',
      })
    );
  });

  it('should set deduction schedule when status changes to approved', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        status: 'approved',
        approvedDate: '2025-10-05',
      }),
    });

    await PUT(request);

    expect(mockCashAdvanceService.update).toHaveBeenCalledWith(
      'clfhj3k8n0000xyz000000001',
      expect.objectContaining({
        status: 'approved',
        approvedDate: expect.any(Date),
      })
    );
  });

  it('should clear deduction schedule when status changes from approved', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        status: 'rejected',
        rejectedBy: 'admin',
        rejectionReason: 'Not approved',
      }),
    });

    await PUT(request);

    expect(mockCashAdvanceService.update).toHaveBeenCalledWith(
      'clfhj3k8n0000xyz000000001',
      expect.objectContaining({
        status: 'rejected',
        rejectedBy: 'admin',
        rejectionReason: 'Not approved',
      })
    );
  });

  it('should auto-change status to paid when remainingBalance reaches 0', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        settledAmount: 5000,
        remainingBalance: 0,
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe('paid');
    expect(payload.data?.remainingBalance).toBe('0');
    expect(mockCashAdvanceService.update).toHaveBeenCalledWith(
      'clfhj3k8n0000xyz000000001',
      expect.objectContaining({
        settledAmount: 5000,
        remainingBalance: 0,
      })
    );
  });

  it('should handle manual deductionCycle and nextDeductionDate updates', async () => {
    const existingRecord = {
      id: 'clfhj3k8n0000xyz000000001',
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

    mockCashAdvanceService.update.mockResolvedValue(updatedRecord);

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        deductionCycle: 'SECOND_HALF',
        nextDeductionDate: '2025-10-31',
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.deductionCycle).toBe('SECOND_HALF');
  });

  it('should handle errors', async () => {
    mockCashAdvanceService.update.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/cash-advances', {
      method: 'PUT',
      body: JSON.stringify({
        id: 'clfhj3k8n0000xyz000000001',
        amount: 5000,
      }),
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to update cash advance');
  });
});

describe('Cash Advances API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/cash-advances');
    const response = await DELETE(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Cash advance ID is required');
  });

  it('should delete cash advance', async () => {
    mockCashAdvanceService.delete.mockResolvedValue({
      id: 'clfhj3k8n0000xyz000000001',
    } as never);

    const request = new NextRequest(
      'http://localhost/api/cash-advances?id=clfhj3k8n0000xyz000000001'
    );
    const response = await DELETE(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(mockCashAdvanceService.delete).toHaveBeenCalledWith(
      'clfhj3k8n0000xyz000000001'
    );
  });

  it('should handle errors', async () => {
    mockCashAdvanceService.delete.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest(
      'http://localhost/api/cash-advances?id=clfhj3k8n0000xyz000000001'
    );
    const response = await DELETE(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Failed to delete cash advance');
  });
});
