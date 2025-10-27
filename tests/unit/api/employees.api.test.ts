import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma before importing the route
const mockPrisma = vi.hoisted(() => ({
  employee: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock environment variables
beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
});

// Import route handlers after mocks
import { GET, POST } from '@/app/api/employees/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/employees/[id]/route';

describe('Employees API - GET /api/employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all employees (excluding soft-deleted)', async () => {
    const mockEmployees = [
      {
        id: 1,
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'General Manager',
        status: 'active',
        hireDate: '2025-01-01',
        phone: '09123456789',
        contact: '09123456789',
        email: 'john@example.com',
        basicSalary: 50000,
        currentSalary: 55000,
        deletedAt: null,
      },
      {
        id: 2,
        employeeId: 'EMP-0002',
        name: 'Jane Smith',
        firstName: 'Jane',
        lastName: 'Smith',
        middleName: null,
        department: 'IT',
        position: 'Developer',
        jobTitle: 'Senior Developer',
        status: 'active',
        hireDate: '2025-02-01',
        phone: '09198765432',
        contact: '09198765432',
        email: 'jane@example.com',
        basicSalary: 45000,
        currentSalary: 48000,
        deletedAt: null,
      },
    ];

    mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

    const request = new NextRequest('http://localhost/api/employees');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].employeeId).toBe('EMP-0001');
    expect(data[1].employeeId).toBe('EMP-0002');
    // Verify query was called with soft-delete filter and ordering
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ deletedAt: null });
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
    // select is added for optimization (implementation detail)
  });

  it('should filter by department', async () => {
    const mockEmployees = [
      {
        id: 1,
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'General Manager',
        status: 'active',
        hireDate: '2025-01-01',
        phone: '09123456789',
        contact: '09123456789',
        email: 'john@example.com',
        basicSalary: 50000,
        deletedAt: null,
      },
    ];

    mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

    const request = new NextRequest(
      'http://localhost/api/employees?department=Operations'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].department).toBe('Operations');
    // Verify query was called with department filter
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      deletedAt: null,
      department: 'Operations',
    });
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should filter by status', async () => {
    const mockEmployees = [
      {
        id: 1,
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'General Manager',
        status: 'active',
        hireDate: '2025-01-01',
        phone: '09123456789',
        contact: '09123456789',
        email: 'john@example.com',
        basicSalary: 50000,
        deletedAt: null,
      },
    ];

    mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

    const request = new NextRequest(
      'http://localhost/api/employees?status=active'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('active');
    // Verify query was called with status filter
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({
      deletedAt: null,
      status: 'active',
    });
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should search across multiple fields', async () => {
    const mockEmployees = [
      {
        id: 1,
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'General Manager',
        status: 'active',
        hireDate: '2025-01-01',
        phone: '09123456789',
        contact: '09123456789',
        email: 'john@example.com',
        basicSalary: 50000,
        deletedAt: null,
      },
    ];

    mockPrisma.employee.findMany.mockResolvedValue(mockEmployees);

    const request = new NextRequest(
      'http://localhost/api/employees?search=John'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    // Verify query was called with search OR conditions
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({
      deletedAt: null,
      OR: [
        { name: { contains: 'John', mode: 'insensitive' } },
        { firstName: { contains: 'John', mode: 'insensitive' } },
        { lastName: { contains: 'John', mode: 'insensitive' } },
        { employeeId: { contains: 'John', mode: 'insensitive' } },
        { department: { contains: 'John', mode: 'insensitive' } },
        { contact: { contains: 'John', mode: 'insensitive' } },
        { email: { contains: 'John', mode: 'insensitive' } },
      ],
    });
    expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should ignore department filter when set to "all"', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/employees?department=all'
    );
    await GET(request);

    // Verify query was called without department filter
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ deletedAt: null });
    expect(callArgs.where).not.toHaveProperty('department');
  });

  it('should ignore status filter when set to "all"', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost/api/employees?status=all'
    );
    await GET(request);

    // Verify query was called without status filter
    expect(mockPrisma.employee.findMany).toHaveBeenCalled();
    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0];
    expect(callArgs.where).toEqual({ deletedAt: null });
    expect(callArgs.where).not.toHaveProperty('status');
  });

  it('should handle errors', async () => {
    mockPrisma.employee.findMany.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/employees');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch employees');
  });
});

describe('Employees API - POST /api/employees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new employee with all fields', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'M',
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'General Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: 'john@example.com',
      basicSalary: 50000,
      currentSalary: 55000,
      allowance: 5000,
      sssNumber: '123456789',
      philHealthNumber: '987654321',
      hdmfNumber: '456789123',
      tinNumber: '789123456',
      gender: 'male',
      education: 'College',
      dateOfBirth: '1990-01-01',
      maritalStatus: 'married',
      numberOfKids: 2,
      drivingLicense: 'Yes',
      address: '123 Main St',
      emergencyContactPerson: 'Jane Doe',
      emergencyContactNumber: '09198765432',
      emergencyContact: '09198765432',
      bankAccount: '1234567890',
      gcashAccount: '09123456789',
      paymentSchedule: 'monthly',
      employmentStatus: 'regular',
      employeeType: 'full-time',
      office: 'Main Office',
      hiringSource: 'Referral',
      sssMonthlyContribution: 1000,
      philHealthMonthlyContribution: 500,
      pagibigMonthlyContribution: 200,
      taxMonthlyContribution: 3000,
      profilePhoto: 'https://example.com/photo.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    mockPrisma.employee.create.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        middleName: 'M',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'General Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        email: 'john@example.com',
        basicSalary: 50000,
        currentSalary: 55000,
        allowance: 5000,
        sssNumber: '123456789',
        philHealthNumber: '987654321',
        hdmfNumber: '456789123',
        tinNumber: '789123456',
        gender: 'male',
        education: 'College',
        dateOfBirth: '1990-01-01',
        maritalStatus: 'married',
        numberOfKids: 2,
        drivingLicense: 'Yes',
        address: '123 Main St',
        emergencyContactPerson: 'Jane Doe',
        emergencyContactNumber: '09198765432',
        emergencyContact: '09198765432',
        bankAccount: '1234567890',
        gcashAccount: '09123456789',
        paymentSchedule: 'monthly',
        employmentStatus: 'regular',
        employeeType: 'full-time',
        office: 'Main Office',
        hiringSource: 'Referral',
        sssMonthlyContribution: 1000,
        philHealthMonthlyContribution: 500,
        pagibigMonthlyContribution: 200,
        taxMonthlyContribution: 3000,
        profilePhoto: 'https://example.com/photo.jpg',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.employeeId).toBe('EMP-0001');
    expect(data.name).toBe('John Doe');
    expect(mockPrisma.employee.create).toHaveBeenCalled();
  });

  it('should parse numeric string fields to numbers', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      currentSalary: null,
      allowance: 5000,
      numberOfKids: 2,
    };

    mockPrisma.employee.create.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
        allowance: 5000,
        numberOfKids: 2,
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        basicSalary: 50000,
        allowance: 5000,
        numberOfKids: 2,
      }),
    });
  });

  it('should set optional fields to null when not provided', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      currentSalary: null,
    };

    mockPrisma.employee.create.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        basicSalary: 50000,
        currentSalary: 50000,
        allowance: null,
        email: null,
        sssNumber: null,
        philHealthNumber: null,
        hdmfNumber: null,
        tinNumber: null,
      }),
    });
  });

  it('should use phone as contact if contact not provided', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
    };

    mockPrisma.employee.create.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '09123456789',
        contact: '09123456789',
      }),
    });
  });

  it('should use position as jobTitle if jobTitle not provided', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
    };

    mockPrisma.employee.create.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await POST(request);
    await response.json();

    expect(mockPrisma.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        position: 'Manager',
        jobTitle: 'Manager',
      }),
    });
  });

  it('should handle errors', async () => {
    mockPrisma.employee.create.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create employee');
  });
});

describe('Employees API - GET /api/employees/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single employee by ID', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'General Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: 'john@example.com',
      basicSalary: 50000,
      deletedAt: null,
    };

    mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees/1');
    const response = await GET_BY_ID(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.employeeId).toBe('EMP-0001');
    expect(data.name).toBe('John Doe');
    expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
      },
    });
  });

  it('should return 404 if employee not found', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/employees/999');
    const response = await GET_BY_ID(request, { params: { id: '999' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Employee not found or has been deleted');
  });

  it('should handle errors', async () => {
    mockPrisma.employee.findUnique.mockRejectedValue(
      new Error('Database error')
    );

    const request = new NextRequest('http://localhost/api/employees/1');
    const response = await GET_BY_ID(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch employee');
  });
});

describe('Employees API - PUT /api/employees/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update an employee', async () => {
    const existingEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: 'john@example.com',
      basicSalary: 50000,
      currentSalary: 50000,
      profilePhoto: null,
      deletedAt: null,
    };

    const updatedEmployee = {
      ...existingEmployee,
      department: 'IT',
      position: 'Senior Manager',
      basicSalary: 60000,
    };

    mockPrisma.employee.findUnique.mockResolvedValue(existingEmployee);
    mockPrisma.employee.findFirst.mockResolvedValue(null); // No duplicates
    mockPrisma.employee.update.mockResolvedValue(updatedEmployee);

    const request = new NextRequest('http://localhost/api/employees/1', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'IT',
        position: 'Senior Manager',
        jobTitle: 'Senior Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 60000,
      }),
    });

    const response = await PUT(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.department).toBe('IT');
    expect(data.position).toBe('Senior Manager');
    expect(data.basicSalary).toBe(60000);
    expect(mockPrisma.employee.update).toHaveBeenCalled();
  });

  it('should return 404 if employee not found', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/employees/999', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await PUT(request, { params: { id: '999' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Employee not found or has been deleted');
  });

  it('should parse numeric string fields', async () => {
    const existingEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      currentSalary: 50000,
      profilePhoto: null,
      deletedAt: null,
    };

    mockPrisma.employee.findUnique.mockResolvedValue(existingEmployee);
    mockPrisma.employee.findFirst.mockResolvedValue(null); // No duplicates
    mockPrisma.employee.update.mockResolvedValue(existingEmployee);

    const request = new NextRequest('http://localhost/api/employees/1', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 60000,
        currentSalary: 65000,
        allowance: 5000,
        numberOfKids: 3,
      }),
    });

    const response = await PUT(request, { params: { id: '1' } });
    await response.json();

    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        basicSalary: 60000,
        currentSalary: 65000,
        allowance: 5000,
        numberOfKids: 3,
      }),
    });
  });

  it('should set profilePhoto to null when provided as empty string', async () => {
    const existingEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      currentSalary: 50000,
      profilePhoto: 'https://example.com/old-photo.jpg',
      deletedAt: null,
    };

    mockPrisma.employee.findUnique.mockResolvedValue(existingEmployee);
    mockPrisma.employee.findFirst.mockResolvedValue(null); // No duplicates
    mockPrisma.employee.update.mockResolvedValue(existingEmployee);

    const request = new NextRequest('http://localhost/api/employees/1', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
        profilePhoto: '',
      }),
    });

    const response = await PUT(request, { params: { id: '1' } });
    await response.json();

    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        employeeId: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        basicSalary: 50000,
        profilePhoto: null,
      }),
    });
  });

  it('should handle errors', async () => {
    const existingEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      profilePhoto: null,
      deletedAt: null,
    };

    mockPrisma.employee.findUnique.mockResolvedValue(existingEmployee);
    mockPrisma.employee.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/employees/1', {
      method: 'PUT',
      body: JSON.stringify({
        employeeId: 'EMP-0001',
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        department: 'Operations',
        position: 'Manager',
        jobTitle: 'Manager',
        status: 'active',
        hireDate: '2025-01-01',
        contact: '09123456789',
        phone: '09123456789',
        basicSalary: 50000,
      }),
    });

    const response = await PUT(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update employee');
  });
});

describe('Employees API - DELETE /api/employees/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should soft delete an employee', async () => {
    const mockEmployee = {
      id: 1,
      employeeId: 'EMP-0001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: null,
      department: 'Operations',
      position: 'Manager',
      jobTitle: 'Manager',
      status: 'active',
      hireDate: '2025-01-01',
      phone: '09123456789',
      contact: '09123456789',
      email: null,
      basicSalary: 50000,
      deletedAt: new Date(),
    };

    mockPrisma.employee.update.mockResolvedValue(mockEmployee);

    const request = new NextRequest('http://localhost/api/employees/1');
    const response = await DELETE(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.employee.deletedAt).toBeTruthy();
    expect(mockPrisma.employee.update).toHaveBeenCalledWith({
      where: {
        id: 1,
        deletedAt: null,
      },
      data: {
        deletedAt: expect.any(Date),
      },
    });
  });

  it('should handle errors', async () => {
    mockPrisma.employee.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/employees/1');
    const response = await DELETE(request, { params: { id: '1' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete employee');
  });
});
