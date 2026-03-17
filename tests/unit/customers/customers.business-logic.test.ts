/**
 * Customers Business Logic Tests
 *
 * Tests derived from docs/business-logic/clothing/operations-customers.md
 * Covers: form validation, statistics.
 */

import { describe, it, expect } from 'vitest';
import { CustomerService } from '@/modules/clothing/operations/customers/services/CustomerService';
import type {
  CustomerData,
  CustomerFormData,
} from '@/modules/clothing/operations/customers/types/customer.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validForm = (): CustomerFormData => ({
  customerName: 'Jane Doe',
  phoneNumber: '',
  address: '',
  facebook: '',
  emailAddress: '',
  businessName: '',
  taxNumber: '',
  businessAddress: '',
  businessContactNumber: '',
  customerStatus: 'Active',
});

const makeCustomer = (
  name: string,
  business: string = '',
  email: string = '',
  phone: string = ''
): CustomerData => ({
  Date: '2025-01-01',
  'Customer Name': name,
  'Phone Number': phone,
  Address: '',
  Facebook: '',
  'Email Address': email,
  'Business Name': business,
  'Tax Number': '',
  'Business Address': '',
  'Business Contact Number': '',
  'Customer Status': 'Active',
});

// ---------------------------------------------------------------------------
// Section A — Validation
// ---------------------------------------------------------------------------

describe('Customers — Validation', () => {
  it('accepts a valid form with name only', () => {
    const result = CustomerService.validateCustomer(validForm());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects blank customer name', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      customerName: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Customer name is required');
  });

  it('rejects whitespace-only customer name', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      customerName: '   ',
    });
    expect(result.errors).toContain('Customer name is required');
  });

  it('accepts valid email when provided', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      emailAddress: 'jane@example.com',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      emailAddress: 'not-an-email',
    });
    expect(result.errors).toContain('Invalid email address format');
  });

  it('skips email validation when email is blank', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      emailAddress: '',
    });
    expect(result.errors).not.toContain('Invalid email address format');
  });

  it('accepts valid phone number', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      phoneNumber: '+63 912 345 6789',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects phone with letters/special chars', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      phoneNumber: 'abc-phone',
    });
    expect(result.errors).toContain('Invalid phone number format');
  });

  it('skips phone validation when blank', () => {
    const result = CustomerService.validateCustomer({
      ...validForm(),
      phoneNumber: '',
    });
    expect(result.errors).not.toContain('Invalid phone number format');
  });
});

// ---------------------------------------------------------------------------
// Section B — Statistics
// ---------------------------------------------------------------------------

describe('Customers — Statistics', () => {
  it('total = all customers length', () => {
    const all = [makeCustomer('Alice'), makeCustomer('Bob')];
    const stats = CustomerService.calculateStats(all, all);
    expect(stats.total).toBe(2);
  });

  it('filtered = filteredCustomers length', () => {
    const all = [
      makeCustomer('Alice'),
      makeCustomer('Bob'),
      makeCustomer('Carol'),
    ];
    const stats = CustomerService.calculateStats(all, all.slice(0, 1));
    expect(stats.filtered).toBe(1);
  });

  it('uniqueBusinesses counts distinct non-blank business names', () => {
    const all = [
      makeCustomer('Alice', 'ABC Corp'),
      makeCustomer('Bob', 'XYZ Ltd'),
      makeCustomer('Carol', 'ABC Corp'), // duplicate
      makeCustomer('Dave', ''), // no business
    ];
    const stats = CustomerService.calculateStats(all, all);
    expect(stats.uniqueBusinesses).toBe(2);
  });

  it('contactable = customers with email OR phone', () => {
    const all = [
      makeCustomer('Alice', '', 'a@ex.com', ''), // email
      makeCustomer('Bob', '', '', '09001234567'), // phone
      makeCustomer('Carol', '', '', ''), // neither
    ];
    const stats = CustomerService.calculateStats(all, all);
    expect(stats.contactable).toBe(2);
  });

  it('contactablePct = 0 when no customers', () => {
    const stats = CustomerService.calculateStats([], []);
    expect(stats.contactablePct).toBe(0);
  });

  it('contactablePct rounds to nearest integer', () => {
    const all = [
      makeCustomer('Alice', '', 'a@ex.com', ''),
      makeCustomer('Bob', '', '', ''),
      makeCustomer('Carol', '', '', ''),
    ];
    // 1/3 = 33%
    const stats = CustomerService.calculateStats(all, all);
    expect(stats.contactablePct).toBe(33);
  });
});
