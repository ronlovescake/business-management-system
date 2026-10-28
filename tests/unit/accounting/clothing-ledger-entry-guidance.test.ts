import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLedger } from '@/app/clothing/accounting/ledger/hooks/useLedger';
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

describe('shared ledger period response ordering', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { apiBasePath: undefined, staleFailure: false },
    { apiBasePath: undefined, staleFailure: true },
    { apiBasePath: '/api/general-merchandise', staleFailure: false },
    { apiBasePath: '/api/general-merchandise', staleFailure: true },
  ])(
    'preserves the latest period for $apiBasePath with staleFailure=$staleFailure',
    async ({ apiBasePath, staleFailure }) => {
      const pending: Array<{
        resolve: (response: Response) => void;
        reject: (error: Error) => void;
      }> = [];
      const response = (closing: number) =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              entries: [
                {
                  id: String(closing),
                  date: '2026-09-30',
                  ref: 'PERIOD',
                  account: 'Cash',
                  debit: closing,
                  credit: 0,
                  balance: closing,
                  description: 'Period response',
                },
              ],
              stats: {
                totalDebits: closing,
                totalCredits: 0,
                netChange: closing,
                accounts: 1,
                period: 'Last Month',
              },
              openingBalances: { Cash: 0 },
              closingBalances: { Cash: closing },
            },
          }),
          { status: 200 }
        );
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          if (
            new URL(String(input), 'http://localhost').pathname.endsWith(
              '/accounting/ledger'
            )
          ) {
            return new Promise<Response>((resolve, reject) =>
              pending.push({ resolve, reject })
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({ success: true, data: { entries: [] } }),
              { status: 200 }
            )
          );
        })
      );
      const { result } = renderHook(() => useLedger({ apiBasePath }));
      await waitFor(() => expect(pending).toHaveLength(1));
      act(() => {
        result.current.setFilterAccount('Cash');
        result.current.setPeriod('Last Month');
      });
      await waitFor(() => expect(pending).toHaveLength(2));
      await act(async () => pending[1].resolve(response(50)));
      expect(result.current.accountBalance?.closing).toBe(50);
      await act(async () => {
        if (staleFailure) {
          pending[0].reject(new Error('Late obsolete request failed'));
        } else {
          pending[0].resolve(response(550));
        }
      });
      expect(result.current.period).toBe('Last Month');
      expect(result.current.entries.map((entry) => entry.id)).toEqual(['50']);
      expect(result.current.accountBalance?.closing).toBe(50);
      expect(result.current.loadError).toBeNull();
    }
  );
});
