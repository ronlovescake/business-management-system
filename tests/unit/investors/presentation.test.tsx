import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { MantineProvider, Table } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InvestorAccounting } from '@/modules/clothing/accounting/investors/InvestorAccounting';
import InvestorsPage from '@/modules/clothing/accounting/investors/InvestorsPage';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import { buildInvestorDashboard } from '@/modules/clothing/accounting/investors/dashboard';
import { InvestorDashboard } from '@/modules/clothing/accounting/investors/InvestorDashboard';
import {
  InvestorControls,
  InvestorPayoutStatus,
  InvestorTable,
} from '@/modules/clothing/accounting/investors/InvestorPresentation';

const controls = () => ({
  tab: 'investors',
  onTabChange: vi.fn(),
  search: '',
  onSearchChange: vi.fn(),
  payoutMonth: '2026-10',
  onPayoutMonthChange: vi.fn(),
  paidStatementCount: 2,
  generatingStatements: false,
  onGenerateStatements: vi.fn(),
  calendarYear: '2026',
  onCalendarYearChange: vi.fn(),
  refreshing: false,
  onRefresh: vi.fn(),
  onAddInvestor: vi.fn(),
  onAddClosure: vi.fn(),
});

vi.mock('@/utils/date', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/date')>()),
  getCurrentDateISO: () => '2026-10-17',
}));

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal('React', React);
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains('recharts-responsive-container')
        ? new DOMRect(0, 0, 640, 300)
        : original.call(this);
    }
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockRestore();
});

describe('investor accounting presentation', () => {
  it('renders dashboard empty states without creating any payment actions', () => {
    render(
      <MantineProvider>
        <InvestorDashboard
          data={buildInvestorDashboard([], '2026-10-17')}
          today="2026-10-17"
          search=""
          closureYears={[]}
          onMarkPaid={vi.fn()}
          onOpenInvestor={vi.fn()}
        />
      </MantineProvider>
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Upcoming payouts (90 days)' })
      ).getByText('No payouts scheduled in the next 90 days.')
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('region', { name: 'Unpaid due returns' })
      ).getByRole('status')
    ).toHaveTextContent('No unpaid returns due');
    expect(
      within(
        screen.getByRole('region', { name: 'Agreement review' })
      ).getByText('Missing bank-calendar coverage')
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Needs attention' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('figure', {
        name: 'Monthly cash requirements (12 months)',
      })
    ).toBeVisible();
    expect(
      screen.queryByRole('figure', {
        name: 'Outstanding principal by maturity month',
      })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Principal maturities'));
    const maturityChart = screen.getByRole('figure', {
      name: 'Outstanding principal by maturity month',
    });
    expect(maturityChart).toBeVisible();
    expect(
      within(maturityChart).getByText('No outstanding funded principal.')
    ).toBeVisible();
    for (const [region, empty] of [
      ['Investment maturities', 'No outstanding funded principal.'],
      ['Recent activity', 'No recorded movements yet.'],
      ['Investors', 'No investors match this search.'],
    ]) {
      expect(
        within(screen.getByRole('region', { name: region })).getByText(empty)
      ).toBeVisible();
    }
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(
      screen.getByRole('table', {
        name: 'Outstanding principal by maturity month data',
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark paid' })
    ).not.toBeInTheDocument();
  });
  it('lists maturities with clear status and opens the related portfolio', () => {
    const onOpenInvestor = vi.fn();
    const data = buildInvestorDashboard(
      [
        {
          id: 'investor',
          investorCode: 'INV-001',
          name: 'Test investor',
          agreements: [
            ['overdue', '2023-10-01'],
            ['day-90', '2024-01-15'],
            ['day-91', '2024-01-16'],
          ].map(([id, effectiveDate]) => ({
            id,
            reference: id,
            principal: '1000.00',
            accounting: {
              fundedDate: effectiveDate,
              repaidDate: null,
              unpostedPayments: 0,
            },
            schedule: {
              ...buildInvestmentSchedule({
                effectiveDate,
                principalCents: 100000,
                monthlyRateBps: 500,
              }),
              payouts: [],
            },
          })),
        },
      ],
      '2026-10-17'
    );
    render(
      <MantineProvider>
        <InvestorDashboard
          data={data}
          today="2026-10-17"
          search=""
          closureYears={['2026', '2027']}
          onMarkPaid={vi.fn()}
          onOpenInvestor={onOpenInvestor}
        />
      </MantineProvider>
    );
    const maturities = screen.getByRole('region', {
      name: 'Investment maturities',
    });
    expect(
      within(maturities).getByText('3 outstanding · ₱3,000.00')
    ).toBeVisible();
    for (const [reference, status] of [
      ['overdue', 'Matured'],
      ['day-90', 'Within 90 days'],
      ['day-91', 'Active'],
    ]) {
      expect(
        within(maturities).getByText(`${reference} · ₱1,000.00`)
      ).toBeVisible();
      expect(within(maturities).getByText(status)).toBeVisible();
    }
    expect(
      within(
        screen.getByRole('region', { name: 'Agreement review' })
      ).getByText('Matured principal awaiting repayment')
    ).toBeVisible();
    fireEvent.click(
      within(maturities).getByRole('button', {
        name: 'View portfolio for overdue',
      })
    );
    expect(onOpenInvestor).toHaveBeenCalledWith('investor', 'overdue');
    expect(
      within(
        screen.getByRole('region', { name: 'Recent activity' })
      ).getAllByText('Funding received')
    ).toHaveLength(3);
  });
  it('shows all due unpaid candidates across months and requires payment confirmation', async () => {
    const schedule = buildInvestmentSchedule({
      effectiveDate: '2026-04-10',
      principalCents: 200000000,
      monthlyRateBps: 500,
    });
    const portfolio = {
      investors: [
        {
          id: 'investor',
          investorCode: 'INV-001',
          name: 'Test investor',
          agreements: [
            {
              id: 'agreement',
              reference: 'CR-001',
              effectiveDate: '2026-04-10',
              principal: '2000000.00',
              monthlyRateBps: 500,
              accounting: {
                fundedDate: '2026-04-10',
                repaidDate: null,
                unpostedPayments: 1,
              },
              schedule: {
                ...schedule,
                payouts: schedule.payouts.map((payout) => ({
                  ...payout,
                  payment:
                    payout.month === 3
                      ? { amount: '100000.00', paidDate: '2026-07-10' }
                      : null,
                })),
              },
            },
          ],
        },
      ],
      closures: [
        { id: 'closure-1', name: 'Christmas Day', date: '2026-12-25' },
        { id: 'closure-2', name: 'New Year', date: '2026-01-01' },
      ],
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(['clothing-investors'], portfolio);
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => portfolio });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider client={client}>
        <MantineProvider>
          <InvestorsPage />
        </MantineProvider>
      </QueryClientProvider>
    );
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getAllByText('Outstanding funded principal')[0]
    ).toBeVisible();
    await waitFor(() => {
      const chart = screen.getByRole('figure', {
        name: 'Monthly cash requirements (12 months)',
      });
      expect(
        chart.querySelectorAll('.recharts-bar-rectangle path').length
      ).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByLabelText('Principal maturities'));
    await waitFor(() => {
      const chart = screen.getByRole('figure', {
        name: 'Outstanding principal by maturity month',
      });
      expect(
        chart.querySelectorAll('.recharts-bar-rectangle path').length
      ).toBeGreaterThan(0);
    });
    expect(
      screen.getByRole('group', { name: 'Cash requirements (cumulative)' })
    ).toBeVisible();
    const dueReturns = screen.getByRole('region', {
      name: 'Unpaid due returns',
    });
    expect(
      within(dueReturns).getAllByRole('button', { name: 'Mark paid' })
    ).toHaveLength(3);
    expect(
      screen.getByText(/1 paid return\(s\) without linked journal postings/)
    ).toBeVisible();
    fireEvent.click(
      within(dueReturns).getAllByRole('button', { name: 'Mark paid' })[0]
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirm payment' })
      ).toBeVisible()
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Confirm payment' })
      ).not.toBeInTheDocument()
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search dashboard' }),
      { target: { value: 'missing' } }
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Unpaid due returns' })
      ).queryByRole('button', { name: 'Mark paid' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No unpaid returns due')).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search dashboard' }),
      { target: { value: 'cr-001' } }
    );
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Investors' })).getByRole(
        'button',
        { name: 'View portfolio for Test investor' }
      )
    );
    expect(screen.getByRole('tab', { name: 'Investors' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByRole('heading', { name: 'Projected returns' })
    ).toBeVisible();
    expect(screen.getByText('INV-001')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to investors' }));
    const investorRow = screen.getByRole('row', { name: /Test investor/ });
    expect(within(investorRow).getByText('INV-001')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Payout schedule' }));
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      3
    );
    fireEvent.click(screen.getByLabelText('Payment month'));
    fireEvent.click(await screen.findByRole('button', { name: 'Jul' }));
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      3
    );
    expect(screen.getByText('Paid')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download statements (1)' })
    ).toBeEnabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search payouts' }), {
      target: { value: 'missing' },
    });
    expect(screen.getByText('No matching payouts.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download statements (1)' })
    ).toBeEnabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search payouts' }), {
      target: { value: 'cr-001' },
    });
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      3
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Bank calendar' }));
    const closureSearch = screen.getByRole('textbox', {
      name: 'Search bank closures',
    });
    expect(closureSearch).toHaveValue('');
    fireEvent.change(closureSearch, { target: { value: 'CHRISTMAS' } });
    expect(screen.getByRole('cell', { name: 'Christmas Day' })).toBeVisible();
    expect(
      screen.queryByRole('cell', { name: 'New Year' })
    ).not.toBeInTheDocument();
    fireEvent.change(closureSearch, { target: { value: '2026-01-01' } });
    expect(screen.getByRole('cell', { name: 'New Year' })).toBeVisible();
    fireEvent.change(closureSearch, { target: { value: 'missing' } });
    expect(screen.getByText('No matching bank closures.')).toBeVisible();
    expect(
      screen.queryByText('No bank closures recorded for this year')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Payout schedule' }));
    expect(screen.getByRole('textbox', { name: 'Search payouts' })).toHaveValue(
      'cr-001'
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Search payouts' }), {
      target: { value: 'TEST INVESTOR' },
    });
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      3
    );
    fireEvent.click(screen.getByLabelText('Payment month'));
    fireEvent.click(await screen.findByRole('button', { name: 'Nov' }));
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      3
    );
    expect(screen.getByText('Projected')).toBeVisible();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download statements (0)' })
    ).toBeDisabled();
    const action = screen.getAllByRole('button', { name: 'Mark paid' })[0];
    expect(action.getAttribute('style')).toContain('--mantine-color-orange');
    fireEvent.click(action);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirm payment' })
      ).toBeVisible()
    );
    expect(screen.getByText(/for month 4 was transferred/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Confirm payment' })
      ).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark paid' })[0]);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm payment' })
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/clothing/investors',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            kind: 'payment',
            data: {
              agreementId: 'agreement',
              month: 4,
              amount: '100000.00',
              paidDate: '2026-10-17',
            },
          }),
        })
      )
    );
  });
  it('requires funding confirmation and flags unposted historical returns', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <InvestorAccounting
            agreement={{
              id: 'agreement',
              reference: 'CR-001',
              principal: '1000000.00',
              monthlyRateBps: 500,
              effectiveDate: '2026-01-25',
              accounting: {
                fundedDate: null,
                repaidDate: null,
                unpostedPayments: 2,
              },
              schedule: {
                maturityDate: '2029-01-25',
                eligibleDate: '2026-04-16',
                principalRepaymentDeadline: '2029-02-24',
              },
            }}
          />
        </MantineProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText(/2 historical paid return/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Record principal repayment' })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Record funding received' })
    );
    expect(
      await screen.findByRole('button', { name: 'Confirm and post' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(
      screen.getByRole('button', { name: 'Confirm and post' })
    ).toBeEnabled();
  });
  it('replaces the due payment action with Paid when a saved payment is loaded', () => {
    const onMarkPaid = vi.fn();
    const payout = {
      status: 'scheduled',
      dueDate: '2026-04-28',
      payment: null,
    };
    const { rerender } = render(
      <MantineProvider>
        <InvestorPayoutStatus
          payout={payout}
          today="2026-10-17"
          onMarkPaid={onMarkPaid}
        />
      </MantineProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(onMarkPaid).toHaveBeenCalledOnce();
    rerender(
      <MantineProvider>
        <InvestorPayoutStatus
          payout={{
            ...payout,
            payment: { amount: '50.00', paidDate: '2026-10-17' },
          }}
          today="2026-10-17"
          onMarkPaid={onMarkPaid}
        />
      </MantineProvider>
    );
    expect(screen.getByText('Paid')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mark paid' })
    ).not.toBeInTheDocument();
  });

  it('keeps search, add, refresh, and tab navigation in the accounting control panel', () => {
    const props = controls();
    render(
      <MantineProvider>
        <InvestorControls {...props} />
      </MantineProvider>
    );
    expect(screen.getByRole('heading', { name: 'Investors' })).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search investors' }),
      { target: { value: 'Test investor' } }
    );
    expect(props.onSearchChange).toHaveBeenCalledWith('Test investor');
    fireEvent.click(screen.getByRole('button', { name: 'Add investor' }));
    expect(props.onAddInvestor).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh investors' }));
    expect(props.onRefresh).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('tab', { name: 'Payout schedule' }));
    expect(props.onTabChange).toHaveBeenCalledWith('payouts');
  });

  it('enables statement downloads only when the payout month has paid records', () => {
    const props = controls();
    render(
      <MantineProvider>
        <InvestorControls {...props} tab="payouts" />
      </MantineProvider>
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Download statements (2)' })
    );
    expect(props.onGenerateStatements).toHaveBeenCalledOnce();
  });

  it('preserves the payment-month and bank-calendar controls across tabs', async () => {
    const props = controls();
    const { rerender } = render(
      <MantineProvider>
        <InvestorControls {...props} tab="payouts" />
      </MantineProvider>
    );
    expect(screen.getByLabelText('Payment month')).toHaveTextContent(
      'October 2026'
    );
    fireEvent.click(screen.getByLabelText('Payment month'));
    fireEvent.click(await screen.findByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apr' }));
    expect(props.onPayoutMonthChange).toHaveBeenCalledWith('2027-04');
    expect(
      screen.queryByRole('button', { name: 'Add bank closure' })
    ).not.toBeInTheDocument();
    rerender(
      <MantineProvider>
        <InvestorControls {...props} tab="calendar" />
      </MantineProvider>
    );
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Calendar year' }),
      { target: { value: '2027' } }
    );
    expect(props.onCalendarYearChange).toHaveBeenCalledWith('2027');
    fireEvent.click(screen.getByRole('button', { name: 'Add bank closure' }));
    expect(props.onAddClosure).toHaveBeenCalledOnce();
  });

  it('shows the selected portfolio instead of an inactive directory search', () => {
    render(
      <MantineProvider>
        <InvestorControls {...controls()} selectedName="Test investor" />
      </MantineProvider>
    );
    expect(screen.getByText('Test investor')).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: 'Search investors' })
    ).not.toBeInTheDocument();
  });

  it('uses accounting table framing, sticky headers, and a horizontal scroll area', () => {
    render(
      <MantineProvider>
        <InvestorTable minWidth={620}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Investor</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>No investors recorded.</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </InvestorTable>
      </MantineProvider>
    );
    const table = screen.getByRole('table');
    expect(table).toHaveStyle({ minWidth: '620px' });
    expect(table.parentElement).toHaveStyle({
      overflowX: 'auto',
      overflowY: 'auto',
    });
    expect(table.parentElement?.parentElement).toHaveStyle({ height: '73vh' });
    expect(table.querySelector('thead')).toHaveStyle({
      position: 'sticky',
      top: '0px',
    });
    expect(within(table).getByRole('columnheader')).toHaveStyle({
      backgroundColor: '#f1f3f5',
      textTransform: 'uppercase',
      padding: '16px 12px',
    });
    expect(within(table).getByText('No investors recorded.')).toBeVisible();
  });
});
