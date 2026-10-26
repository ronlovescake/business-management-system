import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RESTORE_TABLE_ORDER,
  sortTablesForRestore,
} from '../restore-order';
import { RESTORE_MODEL_MAP } from '../restoreModelMap';

describe('sortTablesForRestore', () => {
  it('restores immutable customer money requests and event parents before payouts', () => {
    const tables = [
      'clothing_refund_payouts',
      'clothing_order_cancellations',
      'transaction_refunds',
      'transaction_payments',
      'clothing_financial_requests',
      'transactions',
    ];
    expect(sortTablesForRestore(tables)).toEqual([
      'transactions',
      'clothing_financial_requests',
      'transaction_payments',
      'transaction_refunds',
      'clothing_order_cancellations',
      'clothing_refund_payouts',
    ]);
    expect(RESTORE_MODEL_MAP.clothing_financial_requests).toBe(
      'clothingFinancialRequest'
    );
    expect(RESTORE_MODEL_MAP.clothing_order_cancellations).toBe(
      'clothingOrderCancellation'
    );
    expect(RESTORE_MODEL_MAP.clothing_refund_payouts).toBe(
      'clothingRefundPayout'
    );
  });
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

  it('restores GM products before aliases and product-linked records', () => {
    const productIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_products'
    );
    const aliasIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_product_code_aliases'
    );
    const pricesIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_prices'
    );
    const transactionsIndex = DEFAULT_RESTORE_TABLE_ORDER.indexOf(
      'general_merchandise_transactions'
    );

    expect(RESTORE_MODEL_MAP.general_merchandise_product_code_aliases).toBe(
      'generalMerchandiseProductCodeAlias'
    );
    expect(productIndex).toBeGreaterThanOrEqual(0);
    expect(productIndex).toBeLessThan(aliasIndex);
    expect(aliasIndex).toBeLessThan(pricesIndex);
    expect(pricesIndex).toBeLessThan(transactionsIndex);

    expect(
      sortTablesForRestore([
        'general_merchandise_transactions',
        'general_merchandise_product_code_aliases',
        'general_merchandise_prices',
        'general_merchandise_products',
      ])
    ).toEqual([
      'general_merchandise_products',
      'general_merchandise_product_code_aliases',
      'general_merchandise_prices',
      'general_merchandise_transactions',
    ]);
  });
});
