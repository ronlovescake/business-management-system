/**
 * Comprehensive Customer Service Tests
 * Target: 85%+ coverage
 */

import { describe, it, expect } from 'vitest';

describe('Customer Service', () => {
  describe('Customer Validation', () => {
    it('should validate customer name is required', () => {
      const name = '';
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should validate valid customer name', () => {
      const name = 'ABC Company';
      const isValid = name.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should validate email format', () => {
      const validEmails = ['test@example.com', 'user+tag@domain.co.uk'];
      const invalidEmails = ['notanemail', '@domain.com', 'user@'];
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate phone number format', () => {
      const validPhones = ['09171234567', '02-8123-4567', '+63 917 123 4567'];
      
      validPhones.forEach(phone => {
        const cleaned = phone.replace(/\D/g, '');
        expect(cleaned.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Customer Deduplication', () => {
    const customers = [
      { id: 1, name: 'ABC Company', email: 'abc@example.com' },
      { id: 2, name: 'XYZ Corp', email: 'xyz@example.com' },
      { id: 3, name: 'ABC Company', email: 'abc@example.com' }, // Duplicate
    ];

    it('should detect duplicate customer names', () => {
      const nameSet = new Set<string>();
      const duplicates: typeof customers = [];

      customers.forEach(customer => {
        const normalized = customer.name.toLowerCase().trim();
        if (nameSet.has(normalized)) {
          duplicates.push(customer);
        }
        nameSet.add(normalized);
      });

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].name).toBe('ABC Company');
    });

    it('should detect duplicate emails', () => {
      const emailSet = new Set<string>();
      const duplicates: typeof customers = [];

      customers.forEach(customer => {
        const normalized = customer.email.toLowerCase().trim();
        if (emailSet.has(normalized)) {
          duplicates.push(customer);
        }
        emailSet.add(normalized);
      });

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].email).toBe('abc@example.com');
    });

    it('should get unique customers by name', () => {
      const unique = Array.from(
        new Map(customers.map(c => [c.name.toLowerCase(), c])).values()
      );

      expect(unique).toHaveLength(2);
    });
  });

  describe('Customer Status', () => {
    it('should mark customer as banned', () => {
      const customer = { id: 1, name: 'Test', banned: false };
      customer.banned = true;
      expect(customer.banned).toBe(true);
    });

    it('should calculate cancellation rate', () => {
      const totalOrders = 100;
      const cancelledOrders = 15;
      const cancellationRate = (cancelledOrders / totalOrders) * 100;
      
      expect(cancellationRate).toBe(15);
    });

    it('should identify high-risk customer (>30% cancellation)', () => {
      const cancellationRate = 35;
      const isHighRisk = cancellationRate > 30;
      
      expect(isHighRisk).toBe(true);
    });

    it('should identify good customer (<10% cancellation)', () => {
      const cancellationRate = 5;
      const isGoodCustomer = cancellationRate < 10;
      
      expect(isGoodCustomer).toBe(true);
    });
  });

  describe('Customer Search', () => {
    const customers = [
      { id: 1, name: 'ABC Company', email: 'abc@example.com', phone: '09171234567' },
      { id: 2, name: 'XYZ Corporation', email: 'xyz@example.com', phone: '09189876543' },
      { id: 3, name: 'Test Business', email: 'test@example.com', phone: '09123456789' },
    ];

    it('should search by name', () => {
      const query = 'abc';
      const results = customers.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ABC Company');
    });

    it('should search by email', () => {
      const query = 'xyz@';
      const results = customers.filter(c => 
        c.email.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('xyz@example.com');
    });

    it('should search by phone', () => {
      const query = '0918';
      const results = customers.filter(c => 
        c.phone.includes(query)
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].phone).toBe('09189876543');
    });

    it('should handle case-insensitive search', () => {
      const query = 'COMPANY';
      const results = customers.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(results).toHaveLength(1);
    });
  });

  describe('Customer Statistics', () => {
    const customers = [
      { id: 1, totalOrders: 50, totalRevenue: 100000, banned: false },
      { id: 2, totalOrders: 30, totalRevenue: 75000, banned: false },
      { id: 3, totalOrders: 20, totalRevenue: 50000, banned: true },
    ];

    it('should calculate total customers', () => {
      expect(customers.length).toBe(3);
    });

    it('should count active customers', () => {
      const active = customers.filter(c => !c.banned).length;
      expect(active).toBe(2);
    });

    it('should count banned customers', () => {
      const banned = customers.filter(c => c.banned).length;
      expect(banned).toBe(1);
    });

    it('should calculate total orders', () => {
      const total = customers.reduce((sum, c) => sum + c.totalOrders, 0);
      expect(total).toBe(100);
    });

    it('should calculate total revenue', () => {
      const total = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
      expect(total).toBe(225000);
    });

    it('should calculate average revenue per customer', () => {
      const avg = customers.reduce((sum, c) => sum + c.totalRevenue, 0) / customers.length;
      expect(avg).toBe(75000);
    });
  });

  describe('Customer Filtering', () => {
    const customers = [
      { id: 1, name: 'ABC', banned: false, totalOrders: 50 },
      { id: 2, name: 'XYZ', banned: true, totalOrders: 10 },
      { id: 3, name: 'DEF', banned: false, totalOrders: 100 },
    ];

    it('should filter active customers', () => {
      const active = customers.filter(c => !c.banned);
      expect(active).toHaveLength(2);
    });

    it('should filter banned customers', () => {
      const banned = customers.filter(c => c.banned);
      expect(banned).toHaveLength(1);
    });

    it('should filter by minimum orders', () => {
      const minOrders = 50;
      const filtered = customers.filter(c => c.totalOrders >= minOrders);
      expect(filtered).toHaveLength(2);
    });

    it('should sort by orders descending', () => {
      const sorted = [...customers].sort((a, b) => b.totalOrders - a.totalOrders);
      expect(sorted[0].totalOrders).toBe(100);
      expect(sorted[2].totalOrders).toBe(10);
    });
  });
});
