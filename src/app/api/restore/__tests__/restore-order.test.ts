import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RESTORE_TABLE_ORDER,
  sortTablesForRestore,
} from '../restore-order';

describe('sortTablesForRestore', () => {
  it('orders known dependencies before dependents', () => {
    const sorted = sortTablesForRestore([
      'transaction_payments',
      'transactions',
      'transaction_refunds',
    ]);

    expect(sorted).toEqual([
      'transactions',
      'transaction_payments',
      'transaction_refunds',
    ]);
  });

  it('keeps templates before drafts', () => {
    const sorted = sortTablesForRestore([
      'clothing_recurring_payment_drafts',
      'clothing_recurring_payment_templates',
    ]);

    expect(sorted).toEqual([
      'clothing_recurring_payment_templates',
      'clothing_recurring_payment_drafts',
    ]);
  });

  it('is stable for unknown tables and preserves relative order', () => {
    const sorted = sortTablesForRestore([
      'unknown_a',
      'transactions',
      'unknown_b',
      'customers',
    ]);

    expect(sorted).toEqual([
      'customers',
      'transactions',
      'unknown_a',
      'unknown_b',
    ]);
  });

  it('allows custom order lists', () => {
    const sorted = sortTablesForRestore(['b', 'a', 'c'], ['a', 'b']);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });

  it('default restore order includes GM recurring payment templates before drafts', () => {
    const templatesIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_recurring_payment_templates'
    );
    const draftsIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_recurring_payment_drafts'
    );

    expect(templatesIndex).toBeGreaterThanOrEqual(0);
    expect(draftsIndex).toBeGreaterThanOrEqual(0);
    expect(templatesIndex).toBeLessThan(draftsIndex);
  });
});
