import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  toCSV,
  cleanAmount,
  normalizeDate,
  parseCSVLine,
} from '../ExpensesCSV';
import type { Expense } from '../../types';

describe('ExpensesCSV helpers', () => {
  it('parseCSV parses valid rows and reports errors for invalid ones', () => {
    const csv = [
      'Date,Amount,Description,Category,Notes,Receipt,Status,Employee Name',
      '2025-10-01,1000.50,Lunch,Meal,Client meeting,,approved,Jane',
      '2025/10/02,₱2,000.00,Office Chair,Supplies,,receipt.pdf,pending,John',
      'invalid-date,100,Snacks,Meal,,,approved,Jim',
      '2025-10-03,abc,Pen,Supplies,,,pending,Jill',
      '2025-10-04,100,Item,InvalidCategory,,,pending,June',
    ].join('\n');

    const { expenses, summary } = parseCSV(csv);

    // Expect 2 valid rows (first two)
    expect(expenses.length).toBe(2);
    expect(summary.successCount).toBe(2);
    expect(summary.errorCount).toBe(3);
    expect(summary.errors.length).toBe(3);

    // Validate normalized values
    const [e1, e2] = expenses as Expense[];
    expect(e1.date).toBe('2025-10-01');
    expect(e1.amount).toBe(1000.5);
    expect(e1.description).toBe('Lunch');
    expect(e1.category).toBe('Meal');
    expect(e1.status).toBe('approved');

    expect(e2.date).toBe('2025-10-02');
    expect(e2.amount).toBe(2000);
    expect(e2.description).toBe('Office Chair');
    expect(e2.category).toBe('Supplies');
    expect(e2.status).toBe('pending');
  });

  it('toCSV outputs the correct header and rows with escaping', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2025-10-01',
        amount: 1234.56,
        description: 'Desc with, comma and "quote"',
        category: 'Meal',
        notes: 'Note", with comma',
        receipt: null,
        status: 'approved',
        employeeName: 'Jane',
      },
    ];

    const csv = toCSV(expenses);
    const lines = csv.split('\n');

    // Header must match implementation
    expect(lines[0]).toBe(
      'Date,Amount,Description,Category,Notes,Receipt,Status,Employee Name'
    );

    // Amount must be formatted with 2 decimals and fields escaped
    const row = lines[1];
    // Date, Amount, Description, Category, Notes, Receipt, Status, Employee Name
    const parts = parseCSVLine(row);
    expect(parts[0]).toBe('2025-10-01');
    expect(parts[1]).toBe('1234.56');
    expect(parts[2]).toBe('Desc with, comma and "quote"');
    expect(parts[3]).toBe('Meal');
    expect(parts[4]).toBe('Note", with comma');
    expect(parts[5]).toBe('');
    expect(parts[6]).toBe('approved');
    expect(parts[7]).toBe('Jane');
  });

  it('cleanAmount strips currency symbols and commas', () => {
    expect(cleanAmount('₱1,234.56')).toBe(1234.56);
    expect(cleanAmount('$2,000')).toBe(2000);
    expect(cleanAmount(' 3 000 ')).toBe(3000);
    expect(cleanAmount('invalid')).toBeNull();
  });

  it('normalizeDate returns yyyy-mm-dd or null', () => {
    expect(normalizeDate('2025-10-01')).toBe('2025-10-01');
    expect(normalizeDate('10/02/2025')).toBe('2025-10-02');
    expect(normalizeDate('invalid')).toBeNull();
  });
});
