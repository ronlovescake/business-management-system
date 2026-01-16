import { describe, expect, it } from 'vitest';
import { parseManualEntryCsv } from '@/lib/accounting/manual-entry-import';

describe('manual entry CSV import', () => {
  it('parses rows with required columns', () => {
    const text =
      'date,amount,ref,debit account,credit account,description\n' +
      '2026-01-16,1000,JV-001,Cash,Sales Revenue,Sample entry';

    const result = parseManualEntryCsv(text);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      date: '2026-01-16',
      amount: 1000,
      ref: 'JV-001',
      debitAccount: 'Cash',
      creditAccount: 'Sales Revenue',
      description: 'Sample entry',
    });
  });

  it('reports missing required columns', () => {
    const text = 'date,amount,ref\n2026-01-16,100,JV-1';
    const result = parseManualEntryCsv(text);
    expect(result.errors[0]).toContain('Missing required columns');
  });
});
