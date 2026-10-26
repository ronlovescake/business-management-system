import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { RefundPending } from '@/components/refunds/RefundPending';
import { CustomerRefundPayouts } from '@/components/refunds/CustomerRefundPayouts';
import { InventoryValuationNotice } from '@/components/accounting/InventoryValuationNotice';
import { InventoryCostCorrections } from '@/components/accounting/InventoryCostCorrections';
import { OrdersAndTransactions } from '@/app/clothing/operations/customers/[id]/components/OrdersAndTransactions';
import type {
  CustomerStats,
  Transaction,
} from '@/app/clothing/operations/customers/[id]/types';

const summary = {
  scope: 'clothing',
  asOf: '2026-10-26',
  from: null,
  pendingAmount: 200,
  transactionCount: 1,
  oldestAgeDays: 5,
  paidApprovedRefundAmount: 100,
  retainedDepositAmount: 100,
  paidRefundTrends: [],
  items: [
    {
      id: 'approval',
      transactionId: 10,
      customerId: 1,
      customerName: 'Customer',
      productCode: 'SKU',
      kind: 'CANCELLED',
      decisionDate: '2026-10-21',
      reason: 'Customer cancellation',
      createdBy: 'admin',
      approvedAmount: 300,
      paidAmount: 100,
      pendingAmount: 200,
      ageDays: 5,
      payouts: [],
    },
  ],
};

describe('shared refund pending reminders', () => {
  const open = (children: React.ReactNode) =>
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MantineProvider>{children}</MantineProvider>
      </QueryClientProvider>
    );

  it('shows incomplete profit and retries a genuine-zero confirmation with the same key', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({});
    const refresh = vi.fn();
    try {
      open(
        <InventoryValuationNotice
          valuation={{
            complete: false,
            affectedQuantity: 3,
            issues: [
              {
                movementId: 42,
                productCode: 'GIFT',
                date: '2026-10-20',
                quantity: 3,
                direction: 'SALE',
                reason: 'MISSING_COST',
              },
            ],
          }}
          canConfirm
          onConfirmed={refresh}
        />
      );
      expect(screen.getByText('Profit Incomplete')).toBeInTheDocument();
      expect(
        screen.getByText('Unconfirmed valuation: 3 units in 1 movement.')
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm zero cost', exact: true })
      );
      fireEvent.change(await screen.findByLabelText(/Confirmation reason/), {
        target: { value: 'Supplier provided these goods free' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm zero-cost goods' })
      );
      await screen.findByText('Response lost');
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm zero-cost goods' })
      );
      await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
    } finally {
      post.mockRestore();
    }
  });

  it('requires a posted cost reference and retries the same explicit dated allocation', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      products: [
        {
          id: 5,
          productCode: 'SKU',
          shipmentCode: 'SHIP',
          quantity: 10,
          unitCost: 100,
        },
      ],
      capitalizations: [
        { id: 'posted-cost', ref: 'SKU', date: '2026-10-25', amount: 200 },
      ],
      history: [],
    });
    const patch = vi
      .spyOn(api, 'patch')
      .mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({});
    const refresh = vi.fn();
    try {
      open(<InventoryCostCorrections onSaved={refresh} />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Dated cost corrections' })
      );
      fireEvent.change(
        await screen.findByLabelText('Confirmed new unit cost'),
        { target: { value: '120' } }
      );
      fireEvent.change(screen.getByLabelText('Correction reason'), {
        target: { value: 'Confirmed freight has already been capitalized' },
      });
      expect(
        screen.getByRole('button', { name: 'Record dated allocation' })
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole('textbox', { name: 'Posted capitalization' })
      );
      fireEvent.click(
        await screen.findByRole('option', { name: /SKU \| 2026-10-25/ })
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Record dated allocation' })
      );
      await screen.findByText('Response lost');
      fireEvent.click(
        screen.getByRole('button', { name: 'Record dated allocation' })
      );
      await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(patch.mock.calls[0]).toEqual(patch.mock.calls[1]);
      expect(patch.mock.calls[0]?.[1]).toMatchObject({
        productId: 5,
        expectedUnitCost: 100,
        newUnitCost: 120,
        capitalizationLineId: 'posted-cost',
      });
    } finally {
      get.mockRestore();
      patch.mockRestore();
    }
  });

  it.each(['card', 'icon'] as const)(
    '%s opens the same pending list and customer execution link',
    async (variant) => {
      const get = vi.spyOn(api, 'get').mockResolvedValue(summary);
      try {
        open(<RefundPending variant={variant} />);
        await waitFor(() =>
          expect(get).toHaveBeenCalledWith('/api/customers/refund-pending')
        );
        fireEvent.click(
          screen.getByRole('button', { name: /^Refund Pending/ })
        );
        expect(
          await screen.findByRole('link', { name: 'Customer' })
        ).toHaveAttribute(
          'href',
          '/clothing/operations/customers/1?refund=approval'
        );
        expect(screen.getByText('TX-10 | SKU')).toBeInTheDocument();
        expect(screen.getByText('5d')).toBeInTheDocument();
      } finally {
        get.mockRestore();
      }
    }
  );

  it('shares one cached summary between the card and header badge', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(summary);
    try {
      open(
        <>
          <RefundPending />
          <RefundPending variant="icon" />
        </>
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Refund Pending:.*1 orders/ })
        ).toBeInTheDocument()
      );
      expect(get).toHaveBeenCalledTimes(1);
    } finally {
      get.mockRestore();
    }
  });

  it('shows dated paid-refund trends separately from pending obligations and retained deposits', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({
      ...summary,
      paidRefundTrends: [
        { month: '2026-09', amount: 75 },
        { month: '2026-10', amount: 25 },
      ],
    });
    try {
      open(
        <RefundPending
          showPaid
          showTrends
          from="2026-01-01"
          asOf="2026-10-26"
        />
      );
      await screen.findByRole('table', {
        name: 'Approved refunds paid by month',
      });
      expect(get).toHaveBeenCalledWith(
        '/api/customers/refund-pending?asOf=2026-10-26&from=2026-01-01'
      );
      expect(screen.getByText('2026-09')).toBeInTheDocument();
      expect(screen.getByText('2026-10')).toBeInTheDocument();
      expect(
        screen.getByText('Approved Retained Deposits')
      ).toBeInTheDocument();
      expect(screen.getByText('1 orders | Oldest 5d')).toBeInTheDocument();
    } finally {
      get.mockRestore();
    }
  });

  it('executes a partial payout only from the customer surface with a stable request key', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ ...summary, history: summary.items });
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({});
    try {
      open(<CustomerRefundPayouts customerId="1" />);
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Record payout' })
        ).toBeEnabled()
      );
      fireEvent.click(screen.getByRole('button', { name: 'Record payout' }));
      fireEvent.change(await screen.findByLabelText(/Payout amount/), {
        target: { value: '100' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Save actual payout' })
      );
      await screen.findByText('Response lost');
      fireEvent.click(
        screen.getByRole('button', { name: 'Save actual payout' })
      );
      await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
      expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
      expect(post.mock.calls[0]?.[0]).toBe('/api/customers/1/refunds/payout');
      expect(post.mock.calls[0]?.[1]).toMatchObject({
        cancellationId: 'approval',
        amount: 100,
        method: 'Cash',
      });
    } finally {
      get.mockRestore();
      post.mockRestore();
    }
  });

  it.each([undefined, '/api/general-merchandise'])(
    'keeps goods refunds separate from cancellation payouts for %s',
    async (apiBasePath) => {
      const transaction: Transaction = {
        id: 10,
        orderDate: '2026-10-01',
        customers: 'Customer',
        productCode: 'SKU',
        quantity: 1,
        unitPrice: 1000,
        discount: 0,
        adjustment: 400,
        lineTotal: 0,
        orderStatus: 'Cancelled',
        notes: null,
        invoiceDate: null,
        packedDate: null,
        shipmentCode: null,
        createdAt: '',
        updatedAt: '',
      };
      const stats: CustomerStats = {
        totalTransactions: 2,
        totalSpent: 0,
        recentTransactions: 0,
        cancelledTransactions: 1,
        completedTransactions: 1,
        completionRate: 50,
        cancellationRate: 50,
        averageTransactionValue: 0,
        totalOrders: 2,
        cancelledOrders: 1,
        completedOrders: 1,
        processingOrders: 0,
        shippedOrders: 1,
      };
      const get = vi.spyOn(api, 'get').mockImplementation(async (path) =>
        path === '/api/customers/refund-pending'
          ? {
              ...summary,
              history: [{ ...summary.items[0], pendingAmount: 0 }],
            }
          : [
              {
                id: 1,
                transactionId: 10,
                refundDate: '2026-10-22',
                amount: 300,
              },
            ]
      );
      try {
        open(
          <OrdersAndTransactions
            customerId="1"
            orders={[]}
            transactions={[
              transaction,
              { ...transaction, id: 20, orderStatus: 'Delivered' },
            ]}
            stats={stats}
            apiBasePath={apiBasePath}
          />
        );
        fireEvent.click(screen.getByRole('tab', { name: /Return\/Refund/ }));
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Record Refund' })
          ).toBeEnabled()
        );
        if (apiBasePath) {
          expect(
            await screen.findByRole('button', { name: 'Delete refund' })
          ).toBeInTheDocument();
          expect(get).not.toHaveBeenCalledWith('/api/customers/refund-pending');
        } else {
          expect(
            screen.queryByRole('button', { name: 'Delete refund' })
          ).not.toBeInTheDocument();
        }
        fireEvent.click(screen.getByRole('button', { name: 'Record Refund' }));
        const selector = await screen.findByRole('textbox', {
          name: /^Transaction/,
        });
        fireEvent.click(selector);
        expect(
          await screen.findByRole('option', { name: /#20/ })
        ).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /#10/ }) !== null).toBe(
          Boolean(apiBasePath)
        );
      } finally {
        get.mockRestore();
      }
    }
  );
});
