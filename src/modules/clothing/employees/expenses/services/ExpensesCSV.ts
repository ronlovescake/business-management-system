import type { Expense, ExpenseStatus, ImportCSVSummary } from '../types/index';
import { isValidCategory } from '../utils/index';

export interface ParseResult {
  expenses: Expense[];
  summary: ImportCSVSummary;
}

// Robust CSV line parser (supports quoted values containing commas)
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Toggle quotes or handle escaped quotes
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
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

export function normalizeDate(input: string): string | null {
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function cleanAmount(input: string): number | null {
  const cleaned = input.replace(/[₱$\s,]/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

// Parse CSV text to expenses with validation and summary
export function parseCSV(text: string): ParseResult {
  // Parsing
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lines.length < 2) {
    return {
      expenses: [],
      summary: {
        successCount: 0,
        errorCount: 0,
        errors: ['CSV file is empty or invalid'],
      },
    };
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '')
  );
  const required = ['date', 'amount', 'description', 'category'];
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      expenses: [],
      summary: {
        successCount: 0,
        errorCount: 1,
        errors: [`Missing required columns: ${missing.join(', ')}`],
      },
    };
  }

  const expenses: Expense[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });

      if (!row.date && !row.amount && !row.description) {
        continue; // skip empty row
      }

      if (!row.date || !row.amount || !row.description || !row.category) {
        errorCount++;
        errors.push(`Row ${i + 1}: Missing required field(s)`);
        continue;
      }

      const date = normalizeDate(row.date);
      if (!date) {
        errorCount++;
        errors.push(`Row ${i + 1}: Invalid date "${row.date}"`);
        continue;
      }

      const amount = cleanAmount(row.amount);
      if (amount === null) {
        errorCount++;
        errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`);
        continue;
      }

      if (!isValidCategory(row.category)) {
        errorCount++;
        errors.push(`Row ${i + 1}: Invalid category "${row.category}"`);
        continue;
      }

      const status = (row.status?.toLowerCase() as ExpenseStatus) ?? 'pending';
      const validStatus: ExpenseStatus = [
        'pending',
        'approved',
        'rejected',
      ].includes(status)
        ? status
        : 'pending';

      const expense: Expense = {
        id: `import_${Date.now()}_${i}`,
        date,
        amount,
        description: row.description,
        category: row.category,
        notes: row.notes || '',
        receipt: row.receipt || null,
        status: validStatus,
        employeeName: row.employeename || 'Imported',
      };

      expenses.push(expense);
      successCount++;
    } catch (e) {
      errorCount++;
      errors.push(`Row ${i + 1}: ${(e as Error).message}`);
    }
  }

  return {
    expenses,
    summary: { successCount, errorCount, errors },
  };
}

export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCSV(expenses: Expense[]): string {
  const headers = [
    'Date',
    'Amount',
    'Description',
    'Category',
    'Notes',
    'Receipt',
    'Status',
    'Employee Name',
  ];

  const rows = expenses.map((e) =>
    [
      escapeCSV(e.date),
      escapeCSV(e.amount.toFixed(2)),
      escapeCSV(e.description),
      escapeCSV(e.category),
      escapeCSV(e.notes),
      escapeCSV(e.receipt || ''),
      escapeCSV(e.status),
      escapeCSV(e.employeeName || ''),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
