import type {
  CustomerData,
  CustomerFormData,
  CustomerStats,
  ValidationResult,
  CSVImportResult,
  CustomerWithSearchIndex,
  CustomerStatusOption,
} from '../types/customer.types';
import { logger } from '@/lib/logger';

/**
 * Customer Service
 * Handles all customer-related business logic including CRUD operations,
 * CSV import/export, validation, and statistics calculation
 */
class CustomerService {
  /**
   * Customer status options for dropdown
   */
  static getStatusOptions(): CustomerStatusOption[] {
    return [
      { label: '✅ Active', value: 'Active' },
      { label: '⏸️ Inactive', value: 'Inactive' },
      { label: '🎯 Prospect', value: 'Prospect' },
      { label: '⭐ VIP', value: 'VIP' },
      { label: '🚫 Banned', value: 'Banned' },
    ];
  }

  /**
   * Validate customer form data
   */
  static validateCustomer(form: CustomerFormData): ValidationResult {
    const errors: string[] = [];

    // Customer name is required
    if (!form.customerName.trim()) {
      errors.push('Customer name is required');
    }

    // Email validation (if provided)
    if (form.emailAddress.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.emailAddress.trim())) {
        errors.push('Invalid email address format');
      }
    }

    // Phone number validation (if provided) - basic format check
    if (form.phoneNumber.trim()) {
      const phoneRegex = /^[\d\s\-+()]+$/;
      if (!phoneRegex.test(form.phoneNumber.trim())) {
        errors.push('Invalid phone number format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert form data to customer data
   */
  static formToCustomerData(form: CustomerFormData): CustomerData {
    return {
      Date: new Date().toISOString().slice(0, 10),
      'Customer Name': form.customerName.trim(),
      'Phone Number': form.phoneNumber.trim(),
      Address: form.address.trim(),
      Facebook: form.facebook.trim(),
      'Email Address': form.emailAddress.trim(),
      'Business Name': form.businessName.trim(),
      'Tax Number': form.taxNumber.trim(),
      'Business Address': form.businessAddress.trim(),
      'Business Contact Number': form.businessContactNumber.trim(),
      'Customer Status': form.customerStatus.trim(),
    };
  }

  /**
   * Create empty customer form data
   */
  static createEmptyForm(): CustomerFormData {
    return {
      customerName: '',
      phoneNumber: '',
      address: '',
      facebook: '',
      emailAddress: '',
      businessName: '',
      taxNumber: '',
      businessAddress: '',
      businessContactNumber: '',
      customerStatus: '',
    };
  }

  /**
   * Create empty customer data
   */
  static createEmptyCustomer(): CustomerData {
    return {
      Date: '',
      'Customer Name': '',
      'Phone Number': '',
      Address: '',
      Facebook: '',
      'Email Address': '',
      'Business Name': '',
      'Tax Number': '',
      'Business Address': '',
      'Business Contact Number': '',
      'Customer Status': '',
    };
  }

  /**
   * Auto-fill business information from existing customer
   */
  static autoFillBusinessInfo(
    customerName: string,
    existingCustomers: CustomerData[]
  ): Partial<CustomerFormData> {
    const match = existingCustomers.find(
      (c) =>
        c['Customer Name'].trim().toLowerCase() ===
        customerName.trim().toLowerCase()
    );

    if (match) {
      return {
        businessName: match['Business Name'] || '',
        taxNumber: match['Tax Number'] || '',
        businessAddress: match['Business Address'] || '',
        businessContactNumber: match['Business Contact Number'] || '',
      };
    }

    return {};
  }

  /**
   * Calculate customer statistics
   */
  static calculateStats(
    allCustomers: CustomerData[],
    filteredCustomers: CustomerData[]
  ): CustomerStats {
    const total = allCustomers.length;
    const filtered = filteredCustomers.length;
    const uniqueBusinesses = new Set(
      allCustomers.map((c) => (c['Business Name'] || '').trim()).filter(Boolean)
    ).size;
    const contactable = allCustomers.filter(
      (c) =>
        (c['Email Address'] && c['Email Address'].trim()) ||
        (c['Phone Number'] && c['Phone Number'].trim())
    ).length;
    const contactablePct =
      total > 0 ? Math.round((contactable / total) * 100) : 0;

    return { total, filtered, uniqueBusinesses, contactable, contactablePct };
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Import customers from CSV file
   */
  static async importFromCSV(file: File): Promise<CSVImportResult> {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        return {
          success: false,
          error: 'CSV file must have headers and at least one data row',
        };
      }

      // Skip header row
      this.parseCSVLine(lines[0]).map((h) => h.replace(/"/g, ''));
      const parsedData: CustomerData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]).map((v) =>
          v.replace(/"/g, '')
        );

        if (values.length >= 11) {
          const customer: CustomerData = {
            Date: values[0] || '',
            'Customer Name': values[1] || '',
            'Phone Number': values[2] || '',
            Address: values[3] || '',
            Facebook: values[4] || '',
            'Email Address': values[5] || '',
            'Business Name': values[6] || '',
            'Tax Number': values[7] || '',
            'Business Address': values[8] || '',
            'Business Contact Number': values[9] || '',
            'Customer Status': values[10] || '',
          };
          parsedData.push(customer);
        }
      }

      return {
        success: true,
        data: parsedData,
        rowsImported: parsedData.length,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error importing CSV file. Please check the file format.',
      };
    }
  }

  /**
   * Search customers across all fields
   */
  static searchCustomers(
    customers: CustomerData[],
    query: string
  ): CustomerData[] {
    if (!query.trim()) {
      return customers;
    }

    const searchTerm = query.toLowerCase();
    return customers.filter((customer) => {
      return (
        customer.Date.toLowerCase().includes(searchTerm) ||
        customer['Customer Name'].toLowerCase().includes(searchTerm) ||
        customer['Phone Number'].toLowerCase().includes(searchTerm) ||
        customer.Address.toLowerCase().includes(searchTerm) ||
        customer.Facebook.toLowerCase().includes(searchTerm) ||
        customer['Email Address'].toLowerCase().includes(searchTerm) ||
        customer['Business Name'].toLowerCase().includes(searchTerm) ||
        customer['Tax Number'].toLowerCase().includes(searchTerm) ||
        customer['Business Address'].toLowerCase().includes(searchTerm) ||
        customer['Business Contact Number']
          .toLowerCase()
          .includes(searchTerm) ||
        customer['Customer Status'].toLowerCase().includes(searchTerm)
      );
    });
  }

  /**
   * Create search index for performance optimization
   */
  static createSearchIndex(
    customers: CustomerData[]
  ): CustomerWithSearchIndex[] {
    return customers.map((customer) => ({
      ...customer,
      _searchIndex: [
        customer['Customer Name'],
        customer['Phone Number'],
        customer.Address,
        customer.Facebook,
        customer['Email Address'],
        customer['Business Name'],
      ]
        .filter(Boolean)
        .join('|')
        .toLowerCase(),
    }));
  }

  /**
   * API: Load all customers
   */
  static async loadCustomers(): Promise<CustomerData[]> {
    try {
      const res = await fetch('/api/customers', {
        next: { revalidate: 30 },
      });
      if (!res.ok) {
        throw new Error('Failed to load customers');
      }
      return await res.json();
    } catch (error) {
      logger.error('Failed to load customers', error);
      throw error;
    }
  }

  /**
   * API: Add new customer
   */
  static async addCustomer(customer: CustomerData): Promise<void> {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to add customer');
      }
    } catch (error) {
      logger.error('Failed to add customer', error);
      throw error;
    }
  }

  /**
   * API: Bulk update customers (for CSV import or paste mode)
   */
  static async bulkUpdateCustomers(customers: CustomerData[]): Promise<void> {
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customers),
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to update customers');
      }
    } catch (error) {
      logger.error('Failed to update customers', error);
      throw error;
    }
  }
}

const customerService = new CustomerService();
export default customerService;
export { CustomerService };
