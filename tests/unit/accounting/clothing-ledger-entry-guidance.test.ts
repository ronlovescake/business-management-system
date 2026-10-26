import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLedgerManualEntries } from '@/app/clothing/accounting/ledger/hooks/useLedgerManualEntries';
import {
  CLOTHING_ENTRY_SCENARIOS,
  CLOTHING_NON_ROUTINE_ENTRY_ACCOUNTS,
  getClothingEntryScenario,
  getClothingManualEntryAccounts,
} from '@/app/clothing/accounting/ledger/ledgerEntryGuidance';
import { buildLedgerAccounts } from '@/app/clothing/accounting/ledger/hooks/ledgerDerivedData';

describe('clothing ledger entry guidance', () => {
  it('opens the real manual-entry form with the canonical card-settlement accounts', () => {
    const { result } = renderHook(() =>
      useLedgerManualEntries({
        apiPath: (path) => path,
        refreshLedger: async () => {},
        entries: [],
      })
    );
    act(() => result.current.openManualEntryModal('card-settlement'));
    expect(result.current.manualEntryForm).toMatchObject({
      debitAccount: 'Cash',
      creditAccount: 'Card Collections Clearing',
    });
    act(() => result.current.openManualEntryModal('card-processing-fee'));
    expect(result.current.manualEntryForm).toMatchObject({
      debitAccount: 'Card Processing Fees',
      creditAccount: 'Card Collections Clearing',
    });
  });

  it('omits automatic accounts from new manual-entry options, including historical accounts', () => {
    const options = getClothingManualEntryAccounts([
      'Cash',
      'Sales Revenue',
      'Sales Returns',
      'Customer Deposits',
      'Forfeited Deposits',
      'COGS',
      'Inventory Shrinkage',
      'Stock on Hand',
      'Inventory in Transit',
      'Landed Cost Clearing',
      'Forwarder Payable',
      'Courier Payable',
      'Opening Equity',
      'Supplier Payable',
      'Payroll',
      'Loan Payable – Esquire Loan',
      'Custom Payable',
    ]);

    expect(options).toContain('Cash');
    expect(options).toContain('Card Collections Clearing');
    expect(options).toContain('Card Processing Fees');
    expect(options).toContain('Loan Payable');
    expect(options).toContain('Accounts Payable');
    expect(options).toContain('Credit Card Payable');
    expect(options).toContain('Accounts Receivable');
    expect(options).toContain('Custom Payable');
    expect(options).not.toContain('Sales Revenue');
    expect(options).not.toContain('Sales Returns');
    expect(options).not.toContain('Customer Deposits');
    expect(options).not.toContain('Forfeited Deposits');
    expect(options).not.toContain('COGS');
    expect(options).not.toContain('Inventory Shrinkage');
    expect(options).not.toContain('Stock on Hand');
    expect(options).not.toContain('Inventory in Transit');
    expect(options).not.toContain('Landed Cost Clearing');
    expect(options).not.toContain('Forwarder Payable');
    expect(options).not.toContain('Courier Payable');
    expect(options).not.toContain('Opening Equity');
    expect(options).not.toContain('Supplier Payable');
    expect(options).not.toContain('Payroll');
  });

  it('preserves hidden accounts when editing an existing manual entry', () => {
    const options = getClothingManualEntryAccounts(
      ['Cash', 'Sales Revenue'],
      ['Sales Revenue']
    );

    expect(options).toContain('Sales Revenue');
  });

  it('keeps hidden accounts in the full ledger account list', () => {
    const ledgerAccounts = buildLedgerAccounts([
      { account: 'Sales Revenue' },
      { account: 'Customer Deposits' },
    ]);

    expect(ledgerAccounts).toContain('Sales Revenue');
    expect(ledgerAccounts).toContain('Customer Deposits');
    expect(CLOTHING_NON_ROUTINE_ENTRY_ACCOUNTS.has('Sales Revenue')).toBe(true);
  });

  it('provides manual presets and routes operational workflows to their modules', () => {
    const loanPrincipal = getClothingEntryScenario('loan-principal');
    const logistics = getClothingEntryScenario('shipment-logistics');
    const manualScenarios = CLOTHING_ENTRY_SCENARIOS.filter(
      (scenario) => scenario.debitAccount && scenario.creditAccount
    );

    expect(loanPrincipal).toMatchObject({
      debitAccount: 'Loan Payable',
      creditAccount: 'Cash',
    });
    expect(logistics?.destination?.href).toBe('/clothing/operations/shipments');
    expect(manualScenarios).toHaveLength(7);
  });

  it('settles incoming cards through actual Cash and a separate actual fee, never outgoing card debt', () => {
    expect(getClothingEntryScenario('card-settlement')).toMatchObject({
      debitAccount: 'Cash',
      creditAccount: 'Card Collections Clearing',
    });
    expect(getClothingEntryScenario('card-processing-fee')).toMatchObject({
      debitAccount: 'Card Processing Fees',
      creditAccount: 'Card Collections Clearing',
    });
  });
});
