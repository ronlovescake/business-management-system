import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      customer: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
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

import { GET, PUT, DELETE } from '@/app/api/customers/[id]/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

describe('Customers By ID API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/customers/[id]', () => {
    it('should return single customer by ID', async () => {
      const mockCustomer = {
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
      };

      mockPrisma.customer.findUnique.mockResolvedValue(mockCustomer);

      const request = new NextRequest(getTestApiUrl('/api/customers/1'));
      const response = await GET(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data['Customer Name']).toBe('John Doe');
      expect(payload.message).toBe('Customer fetched');
    });

    it('should return 404 when customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      const request = new NextRequest(getTestApiUrl('/api/customers/999'));
      const response = await GET(request, { params: { id: '999' } });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Customer not found');
    });

    it('should return 400 for invalid customer ID', async () => {
      const request = new NextRequest(getTestApiUrl('/api/customers/invalid'));
      const response = await GET(request, { params: { id: 'invalid' } });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
    });
  });

  describe('PUT /api/customers/[id]', () => {
    it('should update customer successfully', async () => {
      const updateData = {
        'Customer Name': 'John Updated',
        'Phone Number': '999-999-9999',
        Address: 'New Address',
        Status: 'Inactive',
      };

      mockPrisma.customer.findUnique.mockResolvedValue({
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
      });

      const updatedCustomer = {
        id: 1,
        date: '2024-01-01',
        customerName: 'John Updated',
        phoneNumber: '999-999-9999',
        address: 'New Address',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Inactive',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.customer.update.mockResolvedValue(updatedCustomer);

      const request = new NextRequest(getTestApiUrl('/api/customers/1'), {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data['Customer Name']).toBe('John Updated');
      expect(payload.data['Phone Number']).toBe('999-999-9999');
      expect(payload.message).toBe('Customer updated successfully');
    });

    it('should return 400 for invalid customer ID', async () => {
      const updateData = {
        'Customer Name': 'Test',
        'Phone Number': '123-456-7890',
        Address: 'Test',
        Status: 'Active',
      };

      const request = new NextRequest(getTestApiUrl('/api/customers/invalid'), {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request, { params: { id: 'invalid' } });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
    });
  });

  describe('DELETE /api/customers/[id]', () => {
    it('should delete customer successfully', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
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
      });

      mockPrisma.customer.delete.mockResolvedValue({ id: 1 });

      const request = new NextRequest(getTestApiUrl('/api/customers/1'));
      const response = await DELETE(request, { params: { id: '1' } });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.data.id).toBe(1);
      expect(payload.message).toBe('Customer deleted successfully');
    });

    it('should return 400 for invalid customer ID', async () => {
      const request = new NextRequest(getTestApiUrl('/api/customers/invalid'));
      const response = await DELETE(request, { params: { id: 'invalid' } });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
    });
  });
});
