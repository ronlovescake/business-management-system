import type {
  CustomerData,
  CustomerFormData,
  CustomerStats,
  ValidationResult,
  CSVImportResult,
  CustomerWithSearchIndex,
  CustomerStatusOption,
} from '../types/customer.types';
import { api } from '@/lib/api/client';
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
   * Export customers to CSV file (basic format - no additional info)
   */
  static exportToCSV(
    customers: CustomerData[],
    filename = 'customers.csv'
  ): void {
    try {
      // Create CSV header
      const headers = [
        'Date',
        'Customer Name',
        'Phone Number',
        'Address',
        'Facebook',
        'Email Address',
        'Business Name',
        'Tax Number',
        'Business Address',
        'Business Contact Number',
        'Customer Status',
      ];

      // Create CSV rows
      const rows = customers.map((customer) => {
        return [
          customer.Date || '',
          customer['Customer Name'] || '',
          customer['Phone Number'] || '',
          customer.Address || '',
          customer.Facebook || '',
          customer['Email Address'] || '',
          customer['Business Name'] || '',
          customer['Tax Number'] || '',
          customer['Business Address'] || '',
          customer['Business Contact Number'] || '',
          customer['Customer Status'] || '',
        ].map((field) => {
          // Escape fields that contain commas, quotes, or newlines
          if (
            field.includes(',') ||
            field.includes('"') ||
            field.includes('\n')
          ) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        });
      });

      // Combine header and rows
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      logger.info(`Exported ${customers.length} customers to ${filename}`);
    } catch (error) {
      logger.error('Failed to export customers to CSV', error);
      throw error;
    }
  }

  /**
   * Export customers with additional info using numbered columns format
   * Example: Shopee Username 1, Shopee Username 2, ..., Additional Address 1, Additional Address 2, ...
   *
   * This is the recommended format for most users (90% of customers have ≤5 items per type)
   */
  static async exportToCSVDetailed(
    filename = 'customers-detailed.csv',
    maxColumns = 5
  ): Promise<{ success: boolean; warning?: string }> {
    try {
      // Fetch customers with all additional info
      const response = await api.get<{
        success: boolean;
        data: Array<{
          id: number;
          date: string;
          customerName: string;
          phoneNumber: string;
          address: string;
          facebook: string;
          emailAddress: string;
          businessName: string;
          taxNumber: string;
          businessAddress: string;
          businessContactNumber: string;
          customerStatus: string;
          shopeeUsernames: string[];
          additionalAddresses: string[];
          additionalPhones: string[];
        }>;
        stats: {
          maxShopeeUsernames: number;
          maxAdditionalAddresses: number;
          maxAdditionalPhones: number;
        };
      }>('/api/customers/export');

      if (!response.success) {
        throw new Error('Failed to fetch customers for export');
      }

      const customers = response.data;
      const stats = response.stats;

      // Check if any customer exceeds the column limit
      const hasOverflow =
        stats.maxShopeeUsernames > maxColumns ||
        stats.maxAdditionalAddresses > maxColumns ||
        stats.maxAdditionalPhones > maxColumns;

      // Create headers with numbered columns
      const baseHeaders = [
        'ID',
        'Date',
        'Customer Name',
        'Phone Number',
        'Address',
        'Facebook',
        'Email Address',
        'Business Name',
        'Tax Number',
        'Business Address',
        'Business Contact Number',
        'Customer Status',
      ];

      const shopeeHeaders = Array.from(
        { length: maxColumns },
        (_, i) => `Shopee Username ${i + 1}`
      );
      const addressHeaders = Array.from(
        { length: maxColumns },
        (_, i) => `Additional Address ${i + 1}`
      );
      const phoneHeaders = Array.from(
        { length: maxColumns },
        (_, i) => `Additional Phone ${i + 1}`
      );

      const headers = [
        ...baseHeaders,
        ...shopeeHeaders,
        ...addressHeaders,
        ...phoneHeaders,
      ];

      // Create CSV rows
      const rows = customers.map((customer) => {
        const baseFields = [
          customer.id.toString(),
          customer.date || '',
          customer.customerName || '',
          customer.phoneNumber || '',
          customer.address || '',
          customer.facebook || '',
          customer.emailAddress || '',
          customer.businessName || '',
          customer.taxNumber || '',
          customer.businessAddress || '',
          customer.businessContactNumber || '',
          customer.customerStatus || '',
        ];

        // Pad arrays to maxColumns length
        const shopeeFields = Array.from(
          { length: maxColumns },
          (_, i) => customer.shopeeUsernames[i] || ''
        );
        const addressFields = Array.from(
          { length: maxColumns },
          (_, i) => customer.additionalAddresses[i] || ''
        );
        const phoneFields = Array.from(
          { length: maxColumns },
          (_, i) => customer.additionalPhones[i] || ''
        );

        return [
          ...baseFields,
          ...shopeeFields,
          ...addressFields,
          ...phoneFields,
        ].map((field) => {
          // Escape fields that contain commas, quotes, or newlines
          if (
            field.includes(',') ||
            field.includes('"') ||
            field.includes('\n')
          ) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        });
      });

      // Combine header and rows
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      logger.info(
        `Exported ${customers.length} customers with additional info to ${filename}`,
        { maxColumns, hasOverflow, stats }
      );

      return {
        success: true,
        warning: hasOverflow
          ? `Some customers have more than ${maxColumns} items per type. Data will be truncated. Consider using the "For Analysis (Duplicate Rows)" export format.`
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to export customers with additional info', error);
      throw error;
    }
  }

  /**
   * Export customers with additional info using duplicate rows format
   * Each additional info item creates a new row for the same customer
   *
   * This format is ideal for analysis/reporting when customers have many additional items
   */
  static async exportToCSVDuplicateRows(
    filename = 'customers-analysis.csv'
  ): Promise<void> {
    try {
      // Fetch customers with all additional info
      const response = await api.get<{
        success: boolean;
        data: Array<{
          id: number;
          date: string;
          customerName: string;
          phoneNumber: string;
          address: string;
          facebook: string;
          emailAddress: string;
          businessName: string;
          taxNumber: string;
          businessAddress: string;
          businessContactNumber: string;
          customerStatus: string;
          shopeeUsernames: string[];
          additionalAddresses: string[];
          additionalPhones: string[];
        }>;
      }>('/api/customers/export');

      if (!response.success) {
        throw new Error('Failed to fetch customers for export');
      }

      const customers = response.data;

      // Create headers
      const headers = [
        'ID',
        'Date',
        'Customer Name',
        'Phone Number',
        'Address',
        'Facebook',
        'Email Address',
        'Business Name',
        'Tax Number',
        'Business Address',
        'Business Contact Number',
        'Customer Status',
        'Additional Info Type',
        'Additional Info Value',
      ];

      // Create CSV rows - one row for primary data, additional rows for each extra item
      const rows: string[][] = [];

      customers.forEach((customer) => {
        const baseFields = [
          customer.id.toString(),
          customer.date || '',
          customer.customerName || '',
          customer.phoneNumber || '',
          customer.address || '',
          customer.facebook || '',
          customer.emailAddress || '',
          customer.businessName || '',
          customer.taxNumber || '',
          customer.businessAddress || '',
          customer.businessContactNumber || '',
          customer.customerStatus || '',
        ];

        // Primary row (no additional info)
        if (
          customer.shopeeUsernames.length === 0 &&
          customer.additionalAddresses.length === 0 &&
          customer.additionalPhones.length === 0
        ) {
          rows.push([...baseFields, '', '']);
        } else {
          // Rows for Shopee usernames
          customer.shopeeUsernames.forEach((username) => {
            rows.push([...baseFields, 'Shopee Username', username]);
          });

          // Rows for additional addresses
          customer.additionalAddresses.forEach((address) => {
            rows.push([...baseFields, 'Additional Address', address]);
          });

          // Rows for additional phones
          customer.additionalPhones.forEach((phone) => {
            rows.push([...baseFields, 'Additional Phone', phone]);
          });
        }
      });

      // Escape and format rows
      const formattedRows = rows.map((row) =>
        row.map((field) => {
          // Escape fields that contain commas, quotes, or newlines
          if (
            field.includes(',') ||
            field.includes('"') ||
            field.includes('\n')
          ) {
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        })
      );

      // Combine header and rows
      const csvContent = [
        headers.join(','),
        ...formattedRows.map((row) => row.join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      logger.info(
        `Exported ${customers.length} customers (${rows.length} total rows) with duplicate rows format to ${filename}`
      );
    } catch (error) {
      logger.error(
        'Failed to export customers with duplicate rows format',
        error
      );
      throw error;
    }
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
      return await api.get<CustomerData[]>('/api/customers');
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
      await api.post('/api/customers', customer);
    } catch (error) {
      logger.error('Failed to add customer', error);
      throw error;
    }
  }

  /**
   * API: Bulk update customers (for CSV import or paste mode)
   */
  static async bulkUpdateCustomers(customers: CustomerData[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
    skippedDetails?: Array<{
      row: number;
      customerName: string;
      issues: Record<string, string>;
    }>;
  }> {
    try {
      const json = await api.put<{
        created: number;
        updated: number;
        skipped: number;
        skippedDetails?: Array<{
          row: number;
          customerName: string;
          issues: Record<string, string>;
        }>;
      }>('/api/customers', customers);

      // Log skipped customers if any
      if (json.skipped > 0 && json.skippedDetails) {
        logger.warn(
          `⚠️ ${json.skipped} customers were SKIPPED during import:`,
          json.skippedDetails
        );

        // Also log to browser console for visibility
        logger.warn(`\n${'='.repeat(80)}`);
        logger.warn(`⚠️  ${json.skipped} CUSTOMERS WERE SKIPPED DURING IMPORT`);
        logger.warn(`${'='.repeat(80)}\n`);

        logger.group(`⚠️ ${json.skipped} customers were SKIPPED during import`);
        json.skippedDetails.forEach(
          (item: {
            row: number;
            customerName: string;
            issues: Record<string, string>;
          }) => {
            logger.group(`❌ Row ${item.row}: ${item.customerName}`);
            Object.entries(item.issues).forEach(([field, message]) => {
              logger.debug('CustomerService', `  • ${field}: ${message}`);
            });
            logger.groupEnd();
          }
        );
        logger.groupEnd();

        logger.warn(`\n${'='.repeat(80)}\n`);
      } else if (json.skipped > 0) {
        // If we have skipped count but no details
        logger.warn(
          `⚠️ ${json.skipped} customers were skipped but no details available`
        );
        logger.debug('CustomerService', 'Response:', json);
      }

      return {
        created: json.created || 0,
        updated: json.updated || 0,
        skipped: json.skipped || 0,
        skippedDetails: json.skippedDetails,
      };
    } catch (error) {
      logger.error('Failed to update customers', error);
      throw error;
    }
  }
}

const customerService = new CustomerService();
export default customerService;
export { CustomerService };
