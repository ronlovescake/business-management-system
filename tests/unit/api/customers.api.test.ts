import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockCustomerService, mockPrisma } = vi.hoisted(() => {
  return {
    mockCustomerService: {
      findActive: vi.fn(),
      bulkSync: vi.fn(),
      create: vi.fn(),
      softDeleteAll: vi.fn(),
    },
    mockPrisma: {
      customer: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

vi.mock('@/modules/customers/api/service', () => ({
  customerService: mockCustomerService,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
  },
}));

import { GET, POST, PUT, DELETE } from '@/app/api/customers/route';
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from '@/app/api/customers/[id]/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Customers API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      'postgresql://testuser:testpass@localhost:5432/testdb';
    Object.values(mockCustomerService).forEach((fn) => fn.mockReset());
    Object.values(mockPrisma.customer).forEach((fn) => fn.mockReset());
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

      mockCustomerService.findActive.mockResolvedValue(
        mockCustomers.map((customer) => ({
          id: customer.id,
          Date: customer.date,
          'Customer Name': customer.customerName,
          'Phone Number': customer.phoneNumber,
          Address: customer.address,
          Facebook: customer.facebook,
          'Email Address': customer.emailAddress,
          'Business Name': customer.businessName,
          'Tax Number': customer.taxNumber,
          'Business Address': customer.businessAddress,
          'Business Contact Number': customer.businessContactNumber,
          'Customer Status': customer.customerStatus,
        }))
      );

      const response = await GET(buildRequest('/api/customers'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0]['Customer Name']).toBe('John Doe');
    });

    it('should return error response on database failure', async () => {
      mockCustomerService.findActive.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET(buildRequest('/api/customers'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch customers');
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

      mockCustomerService.create.mockResolvedValue(createdCustomer);

      const request = new NextRequest(getTestApiUrl('/api/customers'), {
        method: 'POST',
        body: JSON.stringify(newCustomer),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(3);
      expect(mockCustomerService.create).toHaveBeenCalled();
    });

    it('should normalize invalid status to Active and create customer', async () => {
      const customerWithInvalidStatus = {
        'Customer Name': 'Test Customer',
        'Phone Number': '123-456-7890',
        Address: '123 Main St',
        Status: 'InvalidStatus', // This will be normalized to 'Active'
      };

      const mockCreatedCustomer = {
        id: 3,
        Date: '',
        'Customer Name': 'Test Customer',
        'Phone Number': '123-456-7890',
        Address: '123 Main St',
        Facebook: '',
        'Email Address': '',
        'Business Name': '',
        'Tax Number': '',
        'Business Address': '',
        'Business Contact Number': '',
        'Customer Status': 'Active',
      };

      mockCustomerService.create.mockResolvedValue(mockCreatedCustomer);

      const request = new NextRequest(getTestApiUrl('/api/customers'), {
        method: 'POST',
        body: JSON.stringify(customerWithInvalidStatus),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data['Customer Status']).toBe('Active');
      expect(mockCustomerService.create).toHaveBeenCalledWith(
        expect.objectContaining({ 'Customer Status': 'Active' })
      );
    });
  });

  describe('PUT /api/customers', () => {
    it('should upsert customers successfully and report counts', async () => {
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

      mockCustomerService.bulkSync.mockResolvedValue({
        created: 1,
        updated: 0,
      });

      const request = new NextRequest(getTestApiUrl('/api/customers'), {
        method: 'PUT',
        body: JSON.stringify(bulkCustomers),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.created).toBe(1);
      expect(data.data.updated).toBe(0);
      expect(data.data.skipped).toBe(0);
      expect(Array.isArray(data.data.skippedDetails)).toBe(true);
      expect(data.data.skippedDetails.length).toBe(0);
      expect(mockCustomerService.bulkSync).toHaveBeenCalledWith(bulkCustomers);
    });

    it('should return 400 when all rows are invalid', async () => {
      const bulkCustomers = [
        {
          Date: '',
          'Customer Name': '',
          'Phone Number': '',
          Address: '',
          Facebook: 'not-a-url',
          'Email Address': 'invalid-email',
          'Business Name': '',
          'Tax Number': '',
          'Business Address': '',
          'Business Contact Number': '',
          'Customer Status': '',
        },
      ];

      mockCustomerService.bulkSync.mockResolvedValue({
        created: 0,
        updated: 0,
      });

      const request = new NextRequest(getTestApiUrl('/api/customers'), {
        method: 'PUT',
        body: JSON.stringify(bulkCustomers),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.validationErrors?.customers).toContain(
        'All rows failed validation'
      );
    });
  });

  describe('DELETE /api/customers', () => {
    it('should delete all customers successfully', async () => {
      mockCustomerService.softDeleteAll.mockResolvedValue({
        deleted: 5,
        alreadyDeleted: 0,
      });

      const request = new NextRequest(
        getTestApiUrl('/api/customers', { confirm: 'DELETE_ALL_CUSTOMERS' }),
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(5);
    });
  });

  describe('Customers API - /api/customers/[id]', () => {
    const baseCustomer = {
      id: 1,
      date: '2024-01-01',
      customerName: 'John Doe',
      phoneNumber: '1234567890',
      address: '123 Main St',
      facebook: '',
      emailAddress: 'john@example.com',
      businessName: 'Acme Inc',
      taxNumber: 'ABC-12345',
      businessAddress: '123 Main St',
      businessContactNumber: '1234567890',
      customerStatus: 'Active',
    };

    it('should fetch customer by ID', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(baseCustomer);

      const response = await GET_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/1')),
        { params: { id: '1' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data['Customer Name']).toBe('John Doe');
      expect(payload.message).toBe('Customer fetched');
    });

    it('should return 400 for invalid customer ID on GET', async () => {
      const response = await GET_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/invalid')),
        { params: { id: 'invalid' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
      expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
    });

    it('should return 404 when customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const response = await GET_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/999')),
        { params: { id: '999' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Customer not found');
    });

    it('should update customer successfully', async () => {
      const updatePayload = {
        'Customer Name': 'Jane Doe',
        'Customer Status': 'VIP',
      };

      mockPrisma.customer.findUnique.mockResolvedValue(baseCustomer);
      mockPrisma.customer.update.mockResolvedValue({
        ...baseCustomer,
        customerName: 'Jane Doe',
        customerStatus: 'VIP',
      });

      const response = await PUT_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/1'), {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        }),
        { params: { id: '1' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Customer updated successfully');
      expect(payload.data['Customer Name']).toBe('Jane Doe');
      expect(mockPrisma.customer.update).toHaveBeenCalled();
    });

    it('should return 400 when update validation fails', async () => {
      const invalidPayload = {
        'Customer Name': '',
      };

      const response = await PUT_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/1'), {
          method: 'PUT',
          body: JSON.stringify(invalidPayload),
        }),
        { params: { id: '1' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Validation failed');
      expect(payload.validationErrors).toBeDefined();
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const response = await PUT_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/999'), {
          method: 'PUT',
          body: JSON.stringify({ 'Customer Name': 'Ghost' }),
        }),
        { params: { id: '999' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Customer not found');
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('should delete customer successfully', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(baseCustomer);
      mockPrisma.customer.delete.mockResolvedValue(baseCustomer);

      const response = await DELETE_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/1'), {
          method: 'DELETE',
        }),
        { params: { id: '1' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.id).toBe(1);
      expect(payload.message).toBe('Customer deleted successfully');
      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 400 for invalid ID on delete', async () => {
      const response = await DELETE_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/not-a-number'), {
          method: 'DELETE',
        }),
        { params: { id: 'not-a-number' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
      expect(mockPrisma.customer.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent customer', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const response = await DELETE_BY_ID(
        new NextRequest(getTestApiUrl('/api/customers/404'), {
          method: 'DELETE',
        }),
        { params: { id: '404' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Customer not found');
      expect(mockPrisma.customer.delete).not.toHaveBeenCalled();
    });
  });
});
