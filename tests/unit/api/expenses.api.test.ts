import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  expense: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Import route handlers after mocks
import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/expenses/route';

describe('Expenses API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all expenses ordered by date desc', async () => {
    const mockExpenses = [
      {
        id: 1,
        date: '2025-10-22',
        amount: 500.0,
        description: 'Office supplies',
        category: 'Office',
        notes: 'Pens and paper',
        receipt: 'receipt1.pdf',
        status: 'approved',
        employeeName: 'John Doe',
      },
      {
        id: 2,
        date: '2025-10-20',
        amount: 150.0,
        description: 'Travel',
        category: 'Transportation',
        notes: null,
        receipt: null,
        status: 'pending',
        employeeName: null,
      },
    ];

    mockPrisma.expense.findMany.mockResolvedValue(mockExpenses);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('1'); // Integer ID converted to string
    expect(data[0].amount).toBe(500.0);
    expect(data[0].notes).toBe('Pens and paper');
    expect(data[1].notes).toBe(''); // null converted to empty string
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
      orderBy: { date: 'desc' },
    });
  });

  it('should convert null values to empty strings or undefined', async () => {
    const mockExpenses = [
      {
        id: 1,
        date: '2025-10-22',
        amount: 500.0,
        description: 'Office supplies',
        category: 'Office',
        notes: null,
        receipt: null,
        status: 'approved',
        employeeName: null,
      },
    ];

    mockPrisma.expense.findMany.mockResolvedValue(mockExpenses);

    const response = await GET();
    const data = await response.json();

    expect(data[0].notes).toBe(''); // null notes becomes empty string
    expect(data[0].receipt).toBeNull(); // null receipt stays null
    expect(data[0].employeeName).toBeUndefined(); // null employeeName becomes undefined
  });

  it('should handle errors', async () => {
    mockPrisma.expense.findMany.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch expenses');
  });
});

describe('Expenses API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create multiple expenses from CSV import', async () => {
    mockPrisma.expense.createMany.mockResolvedValue({ count: 2 });

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: 500,
          description: 'Office supplies',
          category: 'Office',
          notes: 'Pens and paper',
          receipt: 'receipt1.pdf',
          status: 'approved',
          employeeName: 'John Doe',
        },
        {
          date: '2025-10-20',
          amount: 150,
          description: 'Travel',
          category: 'Transportation',
          notes: '',
          receipt: '',
          status: 'pending',
          employeeName: '',
        },
      ]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.message).toContain('2 expense records');
    expect(mockPrisma.expense.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          date: '2025-10-22',
          amount: 500,
          description: 'Office supplies',
          status: 'approved',
        }),
      ]),
    });
  });

  it('should parse currency symbols from amount', async () => {
    mockPrisma.expense.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: '₱1,500.50', // With peso symbol and comma
          description: 'Office supplies',
          category: 'Office',
        },
      ]),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.expense.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          amount: 1500.5,
        }),
      ]),
    });
  });

  it('should parse dollar symbols from amount', async () => {
    mockPrisma.expense.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: '$2,000.00', // With dollar symbol and comma
          description: 'Equipment',
          category: 'Office',
        },
      ]),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.expense.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          amount: 2000.0,
        }),
      ]),
    });
  });

  it('should default status to pending if not provided', async () => {
    mockPrisma.expense.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: 500,
          description: 'Office supplies',
          category: 'Office',
          // status not provided
        },
      ]),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.expense.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
        }),
      ]),
    });
  });

  it('should convert empty strings to null for optional fields', async () => {
    mockPrisma.expense.createMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: 500,
          description: 'Office supplies',
          category: 'Office',
          notes: '',
          receipt: '',
          employeeName: '',
        },
      ]),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.expense.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          notes: null,
          receipt: null,
          employeeName: null,
        }),
      ]),
    });
  });

  it('should return 400 for non-array data', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify({
        date: '2025-10-22',
        amount: 500,
        description: 'Office supplies',
        category: 'Office',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Expected array');
  });

  it('should return 400 for empty array', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Expected array');
  });

  it('should handle errors', async () => {
    mockPrisma.expense.createMany.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: JSON.stringify([
        {
          date: '2025-10-22',
          amount: 500,
          description: 'Office supplies',
          category: 'Office',
        },
      ]),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to import expense data to database');
  });
});

describe('Expenses API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ID is missing', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PATCH',
      body: JSON.stringify({
        amount: 600,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Expense ID is required');
  });

  it('should return 400 if ID is not a number', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'invalid',
        amount: 600,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Expense ID must be a number');
  });

  it('should update expense fields', async () => {
    const mockExpense = {
      id: 1,
      date: '2025-10-22',
      amount: 600.0,
      description: 'Office supplies - updated',
      category: 'Office',
      notes: 'Updated notes',
      receipt: 'receipt1.pdf',
      status: 'approved',
      employeeName: 'John Doe',
    };

    mockPrisma.expense.update.mockResolvedValue(mockExpense);

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 1,
        amount: 600,
        description: 'Office supplies - updated',
        notes: 'Updated notes',
        status: 'approved',
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Expense updated successfully');
    expect(data.expense.amount).toBe(600.0);
    expect(mockPrisma.expense.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        amount: 600,
        description: 'Office supplies - updated',
        notes: 'Updated notes',
        status: 'approved',
      },
    });
  });

  it('should parse currency symbols in amount', async () => {
    const mockExpense = {
      id: 1,
      date: '2025-10-22',
      amount: 1500.5,
      description: 'Office supplies',
      category: 'Office',
      notes: null,
      receipt: null,
      status: 'pending',
      employeeName: null,
    };

    mockPrisma.expense.update.mockResolvedValue(mockExpense);

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 1,
        amount: '₱1,500.50',
      }),
    });

    const response = await PATCH(request);
    await response.json();

    expect(mockPrisma.expense.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        amount: 1500.5,
      },
    });
  });

  it('should handle errors', async () => {
    mockPrisma.expense.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 1,
        amount: 600,
      }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update expense');
  });
});

describe('Expenses API - PUT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should bulk update expenses', async () => {
    const mockExpenses = [
      {
        id: 1,
        date: '2025-10-22',
        amount: 600.0,
        description: 'Office supplies',
        category: 'Office',
        notes: null,
        receipt: null,
        status: 'approved',
        employeeName: null,
      },
      {
        id: 2,
        date: '2025-10-20',
        amount: 200.0,
        description: 'Travel',
        category: 'Transportation',
        notes: null,
        receipt: null,
        status: 'approved',
        employeeName: null,
      },
    ];

    mockPrisma.expense.update
      .mockResolvedValueOnce(mockExpenses[0])
      .mockResolvedValueOnce(mockExpenses[1]);

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PUT',
      body: JSON.stringify([
        {
          id: 1,
          status: 'approved',
        },
        {
          id: 2,
          status: 'approved',
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.message).toContain('2 expenses');
    expect(mockPrisma.expense.update).toHaveBeenCalledTimes(2);
  });

  it('should return 400 for non-array data', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PUT',
      body: JSON.stringify({
        id: 1,
        status: 'approved',
      }),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Expected array of expenses to update');
  });

  it('should return 400 for empty array', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PUT',
      body: JSON.stringify([]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Expected array of expenses to update');
  });

  it('should return 500 for invalid ID', async () => {
    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PUT',
      body: JSON.stringify([
        {
          id: 'invalid',
          status: 'approved',
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to bulk update expenses');
    expect(data.details).toContain('Invalid expense ID');
  });

  it('should handle errors', async () => {
    mockPrisma.expense.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/expenses', {
      method: 'PUT',
      body: JSON.stringify([
        {
          id: 1,
          status: 'approved',
        },
      ]),
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to bulk update expenses');
  });
});

describe('Expenses API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete all expenses', async () => {
    mockPrisma.expense.deleteMany.mockResolvedValue({ count: 10 });

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(10);
    expect(data.message).toContain('10 expense records');
    expect(mockPrisma.expense.deleteMany).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    mockPrisma.expense.deleteMany.mockRejectedValue(
      new Error('Database error')
    );

    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete expenses');
  });
});
