/**
 * Comprehensive Tests for Expense Service
 * Tests CSV parsing, validation, amount cleaning, category validation, export
 */

import { describe, it, expect } from 'vitest';
import { parseCSV, parseCSVLine, normalizeDate, cleanAmount, toCSV, escapeCSV } from '@/modules/clothing/employees/expenses/services/ExpensesCSV';
import { isValidCategory } from '@/modules/clothing/employees/expenses/utils/index';
import type { Expense } from '@/modules/clothing/employees/expenses/types/index';

describe('Expense Service', () => {
  describe('CSV Line Parsing', () => {
    it('should parse simple CSV line', () => {
      const line = 'a,b,c';
      const result = parseCSVLine(line);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values with commas', () => {
      const line = '"a,b",c,"d,e,f"';
      const result = parseCSVLine(line);
      expect(result).toEqual(['a,b', 'c', 'd,e,f']);
    });

    it('should handle escaped quotes', () => {
      const line = '"a""b",c';
      const result = parseCSVLine(line);
      expect(result).toEqual(['a"b', 'c']);
    });

    it('should trim whitespace', () => {
      const line = ' a , b , c ';
      const result = parseCSVLine(line);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty values', () => {
      const line = 'a,,c';
      const result = parseCSVLine(line);
      expect(result).toEqual(['a', '', 'c']);
    });
  });

  describe('Date Normalization', () => {
    it('should normalize valid dates', () => {
      expect(normalizeDate('2025-01-15')).toBe('2025-01-15');
      expect(normalizeDate('1/15/2025')).toBe('2025-01-15');
      expect(normalizeDate('January 15, 2025')).toBe('2025-01-15');
    });

    it('should handle invalid dates', () => {
      expect(normalizeDate('invalid')).toBeNull();
      expect(normalizeDate('2025-13-01')).toBeNull();
      expect(normalizeDate('')).toBeNull();
    });

    it('should pad single-digit months and days', () => {
      expect(normalizeDate('2025-1-5')).toBe('2025-01-05');
    });
  });

  describe('Amount Cleaning', () => {
    it('should clean currency symbols', () => {
      expect(cleanAmount('₱1,234.56')).toBe(1234.56);
      expect(cleanAmount('$1,234.56')).toBe(1234.56);
    });

    it('should remove commas', () => {
      expect(cleanAmount('1,234,567')).toBe(1234567);
    });

    it('should handle spaces', () => {
      expect(cleanAmount(' 1 234 ')).toBe(1234);
    });

    it('should handle plain numbers', () => {
      expect(cleanAmount('1234.56')).toBe(1234.56);
    });

    it('should return null for invalid amounts', () => {
      expect(cleanAmount('invalid')).toBeNull();
      expect(cleanAmount('abc123')).toBeNull();
      expect(cleanAmount('')).toBeNull();
    });

    it('should handle negative amounts', () => {
      expect(cleanAmount('-₱1,234.56')).toBe(-1234.56);
    });
  });

  describe('Category Validation', () => {
    it('should accept valid categories', () => {
      expect(isValidCategory('Transportation')).toBe(true);
      expect(isValidCategory('Fuel')).toBe(true);
      expect(isValidCategory('Meal')).toBe(true);
      expect(isValidCategory('Parking Fees')).toBe(true);
      expect(isValidCategory('Toll Fees')).toBe(true);
      expect(isValidCategory('Driver Pay')).toBe(true);
    });

    it('should reject invalid categories', () => {
      expect(isValidCategory('Invalid')).toBe(false);
      expect(isValidCategory('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidCategory('transportation')).toBe(true);
      expect(isValidCategory('TRANSPORTATION')).toBe(true);
      expect(isValidCategory('TrAnSpOrTaTiOn')).toBe(true);
    });
  });

  describe('CSV Import', () => {
    it('should import valid CSV', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,1000,Office Supplies,Fuel,pending
2025-01-16,500,Transportation,Transportation,approved`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(2);
      expect(result.summary.successCount).toBe(2);
      expect(result.summary.errorCount).toBe(0);
      expect(result.expenses[0].amount).toBe(1000);
      expect(result.expenses[1].status).toBe('approved');
    });

    it('should handle empty CSV', () => {
      const result = parseCSV('');
      expect(result.expenses).toHaveLength(0);
      expect(result.summary.errorCount).toBe(0);
      expect(result.summary.errors).toContain('CSV file is empty or invalid');
    });

    it('should detect missing required columns', () => {
      const csv = `Date,Amount
2025-01-15,1000`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(0);
      expect(result.summary.errors[0]).toContain('Missing required columns');
    });

    it('should skip rows with missing required fields', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,1000,Office Supplies,Fuel,pending
2025-01-16,,Transportation,Transportation,approved
2025-01-17,750,Equipment,Driver Pay,pending`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(2);
      expect(result.summary.successCount).toBe(2);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toContain('Row 3: Missing required field(s)');
    });

    it('should validate dates', () => {
      const csv = `Date,Amount,Description,Category,Status
invalid-date,1000,Office Supplies,Supplies,pending
2025-01-15,500,Transportation,Transportation,approved`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(1);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toContain('Invalid date');
    });

    it('should validate amounts', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,invalid,Office Supplies,Supplies,pending
2025-01-16,500,Transportation,Transportation,approved`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(1);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toContain('Invalid amount');
    });

    it('should validate categories', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,1000,Office Supplies,InvalidCategory,pending
2025-01-16,500,Transportation,Transportation,approved`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(1);
      expect(result.summary.errorCount).toBe(1);
      expect(result.summary.errors[0]).toContain('Invalid category');
    });

    it('should default invalid status to pending', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,1000,Office Supplies,Fuel,invalid-status`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0].status).toBe('pending');
    });

    it('should skip completely empty rows', () => {
      const csv = `Date,Amount,Description,Category,Status
2025-01-15,1000,Office Supplies,Fuel,pending

2025-01-17,750,Equipment,Meal,pending`;

      const result = parseCSV(csv);
      expect(result.expenses).toHaveLength(2);
      expect(result.summary.successCount).toBe(2);
    });

    it('should handle optional fields', () => {
      const csv = `Date,Amount,Description,Category,Notes,Receipt,Status,EmployeeName
2025-01-15,1000,Office Supplies,Fuel,Urgent,receipt.pdf,pending,John Doe`;

      const result = parseCSV(csv);
      expect(result.expenses[0].notes).toBe('Urgent');
      expect(result.expenses[0].receipt).toBe('receipt.pdf');
      expect(result.expenses[0].employeeName).toBe('John Doe');
    });

    it('should handle missing optional fields', () => {
      const csv = `Date,Amount,Description,Category
2025-01-15,1000,Office Supplies,Fuel`;

      const result = parseCSV(csv);
      expect(result.expenses[0].notes).toBe('');
      expect(result.expenses[0].receipt).toBeNull();
      expect(result.expenses[0].employeeName).toBe('Imported');
    });

    it('should handle quoted values in CSV', () => {
      const csv = `Date,Amount,Description,Category
2025-01-15,1000,"Office Supplies, urgent",Fuel`;

      const result = parseCSV(csv);
      expect(result.expenses[0].description).toBe('Office Supplies, urgent');
    });
  });

  describe('CSV Export', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2025-01-15',
        amount: 1000,
        description: 'Office Supplies',
        category: 'Supplies',
        notes: 'Urgent',
        receipt: 'receipt.pdf',
        status: 'pending',
        employeeName: 'John Doe',
      },
      {
        id: '2',
        date: '2025-01-16',
        amount: 500.50,
        description: 'Transportation',
        category: 'Transportation',
        notes: '',
        receipt: null,
        status: 'approved',
        employeeName: 'Jane Smith',
      },
    ];

    it('should export to CSV format', () => {
      const csv = toCSV(expenses);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
      expect(lines[0]).toContain('Date,Amount,Description,Category');
    });

    it('should format amounts correctly', () => {
      const csv = toCSV(expenses);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('1000.00');
      expect(lines[2]).toContain('500.50');
    });

    it('should handle empty values', () => {
      const csv = toCSV(expenses);
      const lines = csv.split('\n');
      expect(lines[1]).toContain(',Urgent,receipt.pdf,');
      expect(lines[2]).toContain(',,'); // empty notes and receipt
    });

    it('should escape special characters', () => {
      const expenseWithComma: Expense = {
        id: '3',
        date: '2025-01-17',
        amount: 750,
        description: 'Office Supplies, urgent',
        category: 'Supplies',
        notes: 'Note with "quotes"',
        receipt: null,
        status: 'pending',
        employeeName: 'Bob',
      };

      const csv = toCSV([expenseWithComma]);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('"Office Supplies, urgent"');
      expect(lines[1]).toContain('"Note with ""quotes"""');
    });
  });

  describe('CSV Value Escaping', () => {
    it('should handle normal values', () => {
      expect(escapeCSV('test')).toBe('test');
      expect(escapeCSV(123)).toBe('123');
    });

    it('should quote values with commas', () => {
      expect(escapeCSV('test,value')).toBe('"test,value"');
    });

    it('should quote values with quotes', () => {
      expect(escapeCSV('test"value')).toBe('"test""value"');
    });

    it('should quote values with newlines', () => {
      expect(escapeCSV('test\nvalue')).toBe('"test\nvalue"');
    });

    it('should handle null and undefined', () => {
      expect(escapeCSV(null)).toBe('');
      expect(escapeCSV(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(escapeCSV('')).toBe('');
    });
  });

  describe('Expense Statistics', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2025-01-15',
        amount: 1000,
        description: 'Office Supplies',
        category: 'Supplies',
        notes: '',
        receipt: null,
        status: 'pending',
        employeeName: 'John',
      },
      {
        id: '2',
        date: '2025-01-16',
        amount: 500,
        description: 'Transportation',
        category: 'Transportation',
        notes: '',
        receipt: null,
        status: 'approved',
        employeeName: 'Jane',
      },
      {
        id: '3',
        date: '2025-01-17',
        amount: 750,
        description: 'Equipment',
        category: 'Equipment',
        notes: '',
        receipt: null,
        status: 'rejected',
        employeeName: 'Bob',
      },
    ];

    it('should calculate total expenses', () => {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      expect(total).toBe(2250);
    });

    it('should count by status', () => {
      const pending = expenses.filter(e => e.status === 'pending').length;
      const approved = expenses.filter(e => e.status === 'approved').length;
      const rejected = expenses.filter(e => e.status === 'rejected').length;
      
      expect(pending).toBe(1);
      expect(approved).toBe(1);
      expect(rejected).toBe(1);
    });

    it('should calculate total by category', () => {
      const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<string, number>);
      
      expect(byCategory['Supplies']).toBe(1000);
      expect(byCategory['Transportation']).toBe(500);
      expect(byCategory['Equipment']).toBe(750);
    });

    it('should calculate average expense', () => {
      const avg = expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length;
      expect(avg).toBe(750);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amounts', () => {
      const csv = `Date,Amount,Description,Category
2025-01-15,1000000000,Large Purchase,Fuel`;

      const result = parseCSV(csv);
      expect(result.expenses[0].amount).toBe(1000000000);
    });

    it('should handle decimal amounts', () => {
      const csv = `Date,Amount,Description,Category
2025-01-15,123.456789,Precise Amount,Meal`;

      const result = parseCSV(csv);
      expect(result.expenses[0].amount).toBe(123.456789);
    });

    it('should handle very long descriptions', () => {
      const longDesc = 'A'.repeat(1000);
      const csv = `Date,Amount,Description,Category
2025-01-15,100,"${longDesc}",Fuel`;

      const result = parseCSV(csv);
      expect(result.expenses[0].description).toBe(longDesc);
    });

    it('should handle special characters in descriptions', () => {
      const csv = `Date,Amount,Description,Category
2025-01-15,100,"Supplies & Equipment (2025)",Transportation`;

      const result = parseCSV(csv);
      expect(result.expenses[0].description).toBe('Supplies & Equipment (2025)');
    });
  });
});
