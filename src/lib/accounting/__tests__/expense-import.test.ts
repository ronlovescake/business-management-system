import { describe, expect, it } from 'vitest';
import {
  buildExpenseImportMissingColumnsMessage,
  getMissingRequiredColumns,
} from '@/lib/accounting/expense-import';

describe('expense import helpers', () => {
  it('detects missing required columns', () => {
    const missing = getMissingRequiredColumns(['date', 'amount']);
    expect(missing).toEqual(['description', 'category']);
  });

  it('builds missing columns message', () => {
    const message = buildExpenseImportMissingColumnsMessage(
      ['description'],
      ['notes', 'receipt']
    );
    expect(message).toContain('Missing required columns: description');
    expect(message).toContain(
      'Required columns: date, amount, description, category'
    );
    expect(message).toContain('Optional columns: notes, receipt');
  });
});
