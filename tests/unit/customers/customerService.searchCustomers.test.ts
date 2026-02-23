import { describe, expect, it } from 'vitest';
import { CustomerService } from '@/modules/clothing/operations/customers/services/CustomerService';
import type { CustomerData } from '@/modules/clothing/operations/customers/types/customer.types';

function buildCustomer(overrides: Partial<CustomerData>): CustomerData {
  return {
    Date: '2026-02-23',
    'Customer Name': 'Juan Dela Cruz',
    'Phone Number': '09171234567',
    Address: 'Quezon City',
    Facebook: 'fb.com/juan.delacruz',
    'Email Address': 'juan@example.com',
    'Business Name': 'JDC Trading',
    'Tax Number': 'TIN-123456789',
    'Business Address': 'Makati City',
    'Business Contact Number': '0287654321',
    'Customer Status': 'Active',
    ...overrides,
  };
}

describe('CustomerService.searchCustomers', () => {
  const customers: CustomerData[] = [
    buildCustomer({
      'Customer Name': 'Lyn Domingo',
      'Phone Number': '09180001111',
      Address: 'Cebu City',
      Facebook: 'fb.com/lyn.domingo',
      'Email Address': 'lyn@example.com',
      'Business Name': 'Lyn Apparel',
      'Tax Number': 'TIN-LYN-0001',
      'Business Address': 'Lapu-Lapu City',
    }),
    buildCustomer({
      'Customer Name': 'Shermie Lou Cabonuan',
      'Phone Number': '09189992222',
      Address: 'Davao City',
      Facebook: 'fb.com/shermie.lou',
      'Email Address': 'shermie@example.com',
      'Business Name': 'Cabonuan Retail',
      'Tax Number': 'TIN-SLC-0002',
      'Business Address': 'Tagum City',
    }),
  ];

  it('matches Customer Name, Phone Number, Address, Facebook, Email Address, Business Name, Tax Number, and Business Address', () => {
    expect(
      CustomerService.searchCustomers(customers, 'lyn domingo')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, '09189992222')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'cebu city')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'fb.com/shermie.lou')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'lyn@example.com')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'cabonuan retail')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'TIN-SLC-0002')
    ).toHaveLength(1);
    expect(
      CustomerService.searchCustomers(customers, 'lapu-lapu city')
    ).toHaveLength(1);
  });

  it('is case-insensitive and safe with non-string fields', () => {
    const withUnexpectedValue = buildCustomer({
      Address: null as unknown as string,
      Facebook: undefined as unknown as string,
    });

    const results = CustomerService.searchCustomers(
      [...customers, withUnexpectedValue],
      'LYN APPAREL'
    );

    expect(results).toHaveLength(1);
    expect(results[0]['Business Name']).toBe('Lyn Apparel');
  });
});
