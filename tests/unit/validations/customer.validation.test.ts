import { describe, it, expect } from 'vitest';
import {
  validateCustomerForm,
  validateCustomerData,
  validatePartialCustomerData,
  validateBulkCustomers,
  validateCustomerQuery,
  validateCustomerWithBusinessRules,
  formatValidationErrors,
  isDisposableEmail,
  customerFormSchema,
} from '@/lib/validations/customer.validation';

describe('Customer Validation', () => {
  describe('customerFormSchema', () => {
    it('should validate a complete valid customer form', () => {
      const validCustomer = {
        customerName: 'John Doe',
        phoneNumber: '(123) 456-7890',
        address: '123 Main St, City, State 12345',
        facebook: 'https://facebook.com/johndoe',
        emailAddress: 'john@example.com',
        businessName: 'Doe Enterprises',
        taxNumber: 'TAX-12345',
        businessAddress: '456 Business Blvd',
        businessContactNumber: '987-654-3210',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(validCustomer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('John Doe');
        expect(result.data.customerStatus).toBe('Active');
      }
    });

    it('should reject customer name shorter than 2 characters', () => {
      const invalidCustomer = {
        customerName: 'J',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(invalidCustomer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('at least 2 characters');
      }
    });

    it('should reject customer name longer than 100 characters', () => {
      const invalidCustomer = {
        customerName: 'A'.repeat(101),
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(invalidCustomer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must not exceed 100 characters');
      }
    });

    it('should accept various phone number formats', () => {
      const phoneFormats = [
        '(123) 456-7890',
        '123-456-7890',
        '123.456.7890',
        '+1234567890',
        '1234567890',
        '',
      ];

      phoneFormats.forEach((phone) => {
        const customer = {
          customerName: 'Test User',
          phoneNumber: phone,
          address: '',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'Active',
        };

        const result = validateCustomerForm(customer);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid phone number format', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: 'abc-def-ghij',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid phone number format');
      }
    });

    it('should reject invalid email address', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: 'not-an-email',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid email');
      }
    });

    it('should accept empty email address', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '123-456-7890',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL for facebook', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: 'not-a-url',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid URL');
      }
    });

    it('should accept valid customer statuses', () => {
      const statuses = ['Active', 'Inactive', 'Prospect', 'VIP'];

      statuses.forEach((status) => {
        const customer = {
          customerName: 'Test User',
          phoneNumber: '',
          address: '',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: status,
        };

        const result = validateCustomerForm(customer);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid customer status', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'InvalidStatus',
      };

      const result = customerFormSchema.safeParse(customer);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tax number format', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: 'abc',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid tax number format');
      }
    });

    it('should accept valid tax number format', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: 'TAX-12345',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace from string fields', () => {
      const customer = {
        customerName: '  John Doe  ',
        phoneNumber: '  123-456-7890  ',
        address: '  123 Main St  ',
        facebook: '',
        emailAddress: 'john@example.com',
        businessName: '  Doe Enterprises  ',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerForm(customer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe('John Doe');
        expect(result.data.phoneNumber).toBe('123-456-7890');
        expect(result.data.address).toBe('123 Main St');
      }
    });
  });

  describe('customerDataSchema', () => {
    it('should validate full customer data with API field names', () => {
      const validData = {
        id: 1,
        Date: '2024-01-15',
        'Customer Name': 'Jane Smith',
        'Phone Number': '555-0123',
        Address: '789 Oak Lane',
        Facebook: 'https://facebook.com/janesmith',
        'Email Address': 'jane@example.com',
        'Business Name': 'Smith Corp',
        'Tax Number': 'TAX-67890',
        'Business Address': '321 Corporate Dr',
        'Business Contact Number': '555-9876',
        'Customer Status': 'VIP',
      };

      const result = validateCustomerData(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(1);
        expect(result.data['Customer Name']).toBe('Jane Smith');
        expect(result.data['Customer Status']).toBe('VIP');
      }
    });

    it('should accept ISO datetime format for Date field', () => {
      const validData = {
        Date: '2024-01-15T10:30:00.000Z',
        'Customer Name': 'Test User',
        'Phone Number': '',
        Address: '',
        Facebook: '',
        'Email Address': '',
        'Business Name': '',
        'Tax Number': '',
        'Business Address': '',
        'Business Contact Number': '',
        'Customer Status': 'Active',
      };

      const result = validateCustomerData(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('partialCustomerDataSchema', () => {
    it('should validate partial customer data for updates', () => {
      const partialData = {
        'Customer Name': 'Updated Name',
        'Phone Number': '999-888-7777',
      };

      const result = validatePartialCustomerData(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Customer Name']).toBe('Updated Name');
        expect(result.data['Phone Number']).toBe('999-888-7777');
      }
    });

    it('should accept empty partial data', () => {
      const result = validatePartialCustomerData({});
      expect(result.success).toBe(true);
    });
  });

  describe('bulkCustomerSchema', () => {
    it('should validate array of customers for bulk import', () => {
      const bulkData = [
        {
          Date: '2024-01-15',
          'Customer Name': 'Customer 1',
          'Phone Number': '111-222-3333',
          Address: '',
          Facebook: '',
          'Email Address': '',
          'Business Name': '',
          'Tax Number': '',
          'Business Address': '',
          'Business Contact Number': '',
          'Customer Status': 'Active',
        },
        {
          Date: '2024-01-16',
          'Customer Name': 'Customer 2',
          'Phone Number': '444-555-6666',
          Address: '',
          Facebook: '',
          'Email Address': '',
          'Business Name': '',
          'Tax Number': '',
          'Business Address': '',
          'Business Contact Number': '',
          'Customer Status': 'Prospect',
        },
      ];

      const result = validateBulkCustomers(bulkData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should reject empty array for bulk import', () => {
      const result = validateBulkCustomers([]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one customer is required');
      }
    });
  });

  describe('customerQuerySchema', () => {
    it('should validate query parameters', () => {
      const query = {
        page: '1',
        limit: '50',
        search: 'John',
        status: 'Active',
        sortBy: 'Customer Name',
        sortOrder: 'asc',
      };

      const result = validateCustomerQuery(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('John');
      }
    });

    it('should transform string numbers to numbers', () => {
      const query = {
        page: '2',
        limit: '100',
      };

      const result = validateCustomerQuery(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page).toBe('number');
        expect(typeof result.data.limit).toBe('number');
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(100);
      }
    });
  });

  describe('formatValidationErrors', () => {
    it('should format Zod errors into user-friendly messages', () => {
      const invalidData = {
        customerName: 'J',
        phoneNumber: 'invalid',
        customerStatus: 'InvalidStatus',
      };

      const result = customerFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);
        expect(typeof formatted).toBe('object');
        expect(Object.keys(formatted).length).toBeGreaterThan(0);
      }
    });
  });

  describe('isDisposableEmail', () => {
    it('should detect disposable email domains', () => {
      expect(isDisposableEmail('test@tempmail.com')).toBe(true);
      expect(isDisposableEmail('user@throwaway.email')).toBe(true);
      expect(isDisposableEmail('spam@10minutemail.com')).toBe(true);
      expect(isDisposableEmail('fake@guerrillamail.com')).toBe(true);
    });

    it('should not flag legitimate email domains', () => {
      expect(isDisposableEmail('user@gmail.com')).toBe(false);
      expect(isDisposableEmail('contact@company.com')).toBe(false);
      expect(isDisposableEmail('admin@business.org')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isDisposableEmail('test@TempMail.com')).toBe(true);
      expect(isDisposableEmail('user@THROWAWAY.EMAIL')).toBe(true);
    });
  });

  describe('validateCustomerWithBusinessRules', () => {
    it('should reject disposable email addresses', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: 'test@tempmail.com',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Disposable email addresses are not allowed');
      }
    });

    it('should require at least one contact method', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '123 Main St',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one contact method');
      }
    });

    it('should accept customer with phone number as contact method', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '123-456-7890',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(true);
    });

    it('should accept customer with email as contact method', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: 'valid@example.com',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(true);
    });

    it('should accept customer with facebook as contact method', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: 'https://facebook.com/user',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(true);
    });

    it('should accept customer with business contact number as contact method', () => {
      const customer = {
        customerName: 'Test User',
        phoneNumber: '',
        address: '',
        facebook: '',
        emailAddress: '',
        businessName: '',
        taxNumber: '',
        businessAddress: '',
        businessContactNumber: '999-888-7777',
        customerStatus: 'Active',
      };

      const result = validateCustomerWithBusinessRules(customer);
      expect(result.success).toBe(true);
    });
  });
});
