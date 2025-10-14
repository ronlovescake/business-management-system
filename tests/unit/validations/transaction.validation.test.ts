import { describe, it, expect } from 'vitest';
import {
  validateTransactionData,
  validatePartialTransactionData,
  validateTransactionForm,
  validateBulkTransactions,
  validateTransactionQuery,
  validatePriceTier,
  calculateLineTotal,
  validateAndCalculateLineTotal,
  validateTransactionWithBusinessRules,
  formatValidationErrors,
  transactionDataSchema,
} from '@/lib/validations/transaction.validation';

describe('Transaction Validation', () => {
  describe('transactionDataSchema', () => {
    it('should validate a complete valid transaction', () => {
      const validTransaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 10,
        'Unit Price': 100.50,
        Discount: 5.00,
        Adjustment: 2.50,
        'Line Total': 1002.50,
        'Order Status': 'Pending',
        Notes: 'Test notes',
        'Invoice Date': '2024-01-16',
        'Packed Date': '2024-01-17',
        'Shipment Code': 'SHIP-001',
      };

      const result = validateTransactionData(validTransaction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Customers).toBe('Test Customer');
        expect(result.data.Quantity).toBe(10);
        expect(result.data['Unit Price']).toBe(100.50);
      }
    });

    it('should validate line total calculation', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 50,
        Adjustment: 0,
        'Line Total': 950,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(true);
    });

    it('should reject transaction with incorrect line total', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 500,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Line total does not match');
      }
    });

    it('should reject invoice date before order date', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '2024-01-10',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invoice date cannot be before order date');
      }
    });

    it('should reject packed date before order date', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '2024-01-10',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Packed date cannot be before order date');
      }
    });

    it('should accept null values for optional numeric fields', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(true);
    });

    it('should reject negative quantity', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: -5,
        'Unit Price': 100,
        Discount: 0,
        Adjustment: 0,
        'Line Total': -500,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = transactionDataSchema.safeParse(transaction);
      expect(result.success).toBe(false);
    });

    it('should reject invalid product code format', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'INVALID@CODE!',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 1000,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Product code must contain only');
      }
    });

    it('should reject notes longer than 1000 characters', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: 'A'.repeat(1001),
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionData(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must not exceed 1000 characters');
      }
    });
  });

  describe('partialTransactionDataSchema', () => {
    it('should validate partial transaction data for updates', () => {
      const partialData = {
        Quantity: 20,
        'Order Status': 'Shipped',
      };

      const result = validatePartialTransactionData(partialData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.Quantity).toBe(20);
        expect(result.data['Order Status']).toBe('Shipped');
      }
    });

    it('should accept empty partial data', () => {
      const result = validatePartialTransactionData({});
      expect(result.success).toBe(true);
    });
  });

  describe('transactionFormSchema', () => {
    it('should validate transaction form with camelCase fields', () => {
      const formData = {
        orderDate: '2024-01-15',
        customers: 'Test Customer',
        productCode: 'PROD-123',
        quantity: 10,
        unitPrice: 100,
        discount: 0,
        adjustment: 0,
        lineTotal: 1000,
        orderStatus: 'Pending',
        notes: '',
        invoiceDate: '',
        packedDate: '',
        shipmentCode: '',
      };

      const result = validateTransactionForm(formData);
      expect(result.success).toBe(true);
    });
  });

  describe('bulkTransactionSchema', () => {
    it('should validate array of transactions for bulk import', () => {
      const bulkData = [
        {
          'Order Date': '2024-01-15',
          Customers: 'Customer 1',
          'Product Code': 'PROD-001',
          Quantity: null,
          'Unit Price': null,
          Discount: null,
          Adjustment: null,
          'Line Total': null,
          'Order Status': 'Pending',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '',
        },
        {
          'Order Date': '2024-01-16',
          Customers: 'Customer 2',
          'Product Code': 'PROD-002',
          Quantity: null,
          'Unit Price': null,
          Discount: null,
          Adjustment: null,
          'Line Total': null,
          'Order Status': 'Shipped',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '',
        },
      ];

      const result = validateBulkTransactions(bulkData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('should reject empty array for bulk import', () => {
      const result = validateBulkTransactions([]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('At least one transaction is required');
      }
    });

    it('should reject bulk import exceeding 10,000 transactions', () => {
      const bulkData = new Array(10001).fill({
        'Order Date': '2024-01-15',
        Customers: 'Test',
        'Product Code': 'PROD-001',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      });

      const result = validateBulkTransactions(bulkData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('cannot exceed 10,000');
      }
    });
  });

  describe('transactionQuerySchema', () => {
    it('should validate query parameters', () => {
      const query = {
        page: '1',
        limit: '50',
        search: 'test',
        status: 'Pending',
        sortBy: 'Order Date',
        sortOrder: 'desc',
      };

      const result = validateTransactionQuery(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });
  });

  describe('priceTierSchema', () => {
    it('should validate price tier data', () => {
      const priceTier = {
        'Product Code': 'PROD-123',
        'Lower Limit': 0,
        'Upper Limit': 100,
        Prices: 50.00,
      };

      const result = validatePriceTier(priceTier);
      expect(result.success).toBe(true);
    });
  });

  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      const result = calculateLineTotal(10, 100, 50, 25);
      expect(result).toBe(975);
    });

    it('should handle null discount and adjustment', () => {
      const result = calculateLineTotal(10, 100, null, null);
      expect(result).toBe(1000);
    });

    it('should return null if quantity or unit price is null', () => {
      expect(calculateLineTotal(null, 100, 0, 0)).toBeNull();
      expect(calculateLineTotal(10, null, 0, 0)).toBeNull();
      expect(calculateLineTotal(null, null, 0, 0)).toBeNull();
    });
  });

  describe('validateAndCalculateLineTotal', () => {
    it('should auto-calculate line total if not provided', () => {
      const data = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 0,
        Adjustment: 0,
        'Line Total': null,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateAndCalculateLineTotal(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data['Line Total']).toBe(1000);
      }
    });
  });

  describe('validateTransactionWithBusinessRules', () => {
    it('should reject discount exceeding line total', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 10,
        'Unit Price': 100,
        Discount: 1500,
        Adjustment: 0,
        'Line Total': -500,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionWithBusinessRules(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Discount cannot exceed line total');
      }
    });

    it('should warn about unusually high quantity', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 150000,
        'Unit Price': 10,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 1500000,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionWithBusinessRules(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Quantity seems unusually high');
      }
    });

    it('should warn about unusually high unit price', () => {
      const transaction = {
        'Order Date': '2024-01-15',
        Customers: 'Test Customer',
        'Product Code': 'PROD-123',
        Quantity: 1,
        'Unit Price': 200000,
        Discount: 0,
        Adjustment: 0,
        'Line Total': 200000,
        'Order Status': 'Pending',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '',
      };

      const result = validateTransactionWithBusinessRules(transaction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Unit price seems unusually high');
      }
    });
  });

  describe('formatValidationErrors', () => {
    it('should format Zod errors into user-friendly messages', () => {
      const invalidData = {
        'Order Date': '2024-01-15',
        Customers: '',
        'Product Code': 'INVALID@CODE',
      };

      const result = transactionDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);
        expect(typeof formatted).toBe('object');
        expect(Object.keys(formatted).length).toBeGreaterThan(0);
      }
    });
  });
});
