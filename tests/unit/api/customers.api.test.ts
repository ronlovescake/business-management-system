import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoist mocks to avoid initialization issues
const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      customer: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/customers/route';

describe('Customers API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure DATABASE_URL is set for tests
    process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
  });

  describe('GET /api/customers', () => {
    it('should return all customers successfully', async () => {
      const mockCustomers = [
        {
          id: 1,
          date: '2024-01-01',
          customerName: 'John Doe',
          phoneNumber: '123-456-7890',
          address: '123 Main St',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'Active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0]['Customer Name']).toBe('John Doe');
    });

    it('should return empty array on database error', async () => {
      mockPrisma.customer.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('POST /api/customers', () => {
    it('should create a new customer successfully', async () => {
      const newCustomer = {
        Date: '2024-01-01',
        'Customer Name': 'Jane Smith',
        'Phone Number': '987-654-3210',
        Address: '456 Oak Ave',
        Facebook: '',
        'Email Address': '',
        'Business Name': '',
        'Tax Number': '',
        'Business Address': '',
        'Business Contact Number': '',
        'Customer Status': 'Active',
      };

      const createdCustomer = {
        id: 3,
        date: '2024-01-01',
        customerName: 'Jane Smith',
        phoneNumber: '987-654-3210',
        address: '456 Oak Ave',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.customer.create.mockResolvedValue(createdCustomer);

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(3);
    });

    it('should return 400 for invalid customer data', async () => {
      const invalidCustomer = {
        'Customer Name': 'AB',
        'Phone Number': '12345',
        Address: '',
        Status: 'InvalidStatus',
      };

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        body: JSON.stringify(invalidCustomer),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/customers', () => {
    it('should replace all customers successfully', async () => {
      const bulkCustomers = [
        {
          Date: '2024-01-01',
          'Customer Name': 'Customer 1',
          'Phone Number': '111-111-1111',
          Address: 'Address 1',
          Facebook: '',
          'Email Address': '',
          'Business Name': '',
          'Tax Number': '',
          'Business Address': '',
          'Business Contact Number': '',
          'Customer Status': 'Active',
        },
      ];

      mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }]);

      const request = new NextRequest('http://localhost:3000/api/customers', {
        method: 'PUT',
        body: JSON.stringify(bulkCustomers),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.count).toBe(1);
    });
  });

  describe('DELETE /api/customers', () => {
    it('should delete all customers successfully', async () => {
      mockPrisma.customer.deleteMany.mockResolvedValue({ count: 5 });

      const response = await DELETE();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(5);
    });
  });
});
