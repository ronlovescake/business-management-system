import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionPaymentsModal } from '@/modules/clothing/operations/transactions/components/TransactionPaymentsModal';
import { useTransactionPaymentsState } from '@/modules/clothing/operations/transactions/components/useTransactionPaymentsState';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';
import { api } from '@/lib/api/client';

vi.mock('@/lib/alerts', () => ({
  getSwal: async () => ({ fire: async () => ({ isConfirmed: true }) }),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
  notifications: { show: vi.fn() },
}));

interface MockUniversalModalProps {
  opened: boolean;
  children: React.ReactNode;
}

vi.mock('@/components/modals/UniversalModal', () => ({
  UniversalModal: ({ opened, children }: MockUniversalModalProps) =>
    opened ? <div data-testid="mock-universal-modal">{children}</div> : null,
}));

function renderModal(
  props: React.ComponentProps<typeof TransactionPaymentsModal>
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <TransactionPaymentsModal {...props} />
      </MantineProvider>
    </QueryClientProvider>
  );
}

function createTransaction(
  overrides: Partial<TransactionData>
): TransactionData {
  return {
    id: 1,
    'Order Date': '2026-02-20',
    Customers: 'Lyn Domingo | SIERRAS THRIFTEES',
    'Product Code': 'Baby Talking/Musical Toy (BTMT-021926)',
    Quantity: 1,
    'Unit Price': 220,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 220,
    'Order Status': 'Prepared',
    Notes: '',
    'Invoice Date': '',
    'Packed Date': '',
    'Shipment Code': 'LALAMOVE 1',
    ...overrides,
  };
}

describe('TransactionPaymentsModal default prefill sync', () => {
  it('sends an agreed 20 percent original deposit but no deposit terms on a later installment', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useTransactionPaymentsState({
          opened: true,
          onClose: vi.fn(),
          transactions: [
            createTransaction({
              Customers: 'Customer',
              'Unit Price': 1000,
              'Line Total': 1000,
            }),
          ],
          customerNames: ['Customer'],
          defaultCustomerName: 'Customer',
          selectedStatuses: new Set(['Prepared']),
          onStatusFilter: vi.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );
    try {
      await waitFor(() =>
        expect(result.current.selectedCustomer).toBe('Customer')
      );
      act(() => {
        result.current.setOriginalDepositRate(20);
        result.current.handleReservationChange(true);
        result.current.handleAmountChange(1, 200);
      });
      await act(async () => {
        await result.current.handleConfirmAndSubmit('continue');
      });
      expect(post.mock.calls[0]?.[1]).toMatchObject({
        payments: [
          expect.objectContaining({
            amount: 200,
            isReservation: true,
            originalDepositRate: 20,
          }),
        ],
      });
      act(() => {
        result.current.handleReservationChange(false);
        result.current.handleAmountChange(1, 300);
      });
      await act(async () => {
        await result.current.handleConfirmAndSubmit('continue');
      });
      const installments = post.mock.calls[1]?.[1] as {
        payments: Array<Record<string, unknown>>;
      };
      expect(installments.payments[0]).toMatchObject({
        amount: 300,
        isReservation: false,
      });
      expect(installments.payments[0]).not.toHaveProperty(
        'originalDepositRate'
      );
    } finally {
      post.mockRestore();
    }
  });

  it('reuses the same save key after an uncertain payment response', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({});
    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useTransactionPaymentsState({
          opened: true,
          onClose: vi.fn(),
          transactions: [createTransaction({ Customers: 'Customer' })],
          customerNames: ['Customer'],
          defaultCustomerName: 'Customer',
          selectedStatuses: new Set(['Prepared']),
          onStatusFilter: vi.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    try {
      await waitFor(() =>
        expect(result.current.selectedCustomer).toBe('Customer')
      );
      act(() => {
        result.current.handleAmountChange(1, 20);
        result.current.setPaymentDate(new Date('2026-10-25T16:00:00Z'));
      });
      await act(async () => {
        await result.current.handleConfirmAndSubmit('continue');
      });
      await act(async () => {
        await result.current.handleConfirmAndSubmit('continue');
      });

      expect(post).toHaveBeenCalledTimes(2);
      expect(post.mock.calls[0]?.[2]).toEqual(post.mock.calls[1]?.[2]);
      expect(post.mock.calls[0]?.[2]).toMatchObject({
        headers: { 'Idempotency-Key': expect.any(String) },
      });
      expect(post.mock.calls[0]?.[1]).toMatchObject({
        payments: [expect.objectContaining({ paymentDate: '2026-10-26' })],
      });
    } finally {
      post.mockRestore();
    }
  });

  it('lists only unique customers with open orders, regardless of the selected status pills', () => {
    const transactions = [
      ...[
        'In Transit',
        'Warehouse',
        'Prepared',
        'Ready For Dispatch',
        'Checked Out',
        'On-Hold',
        'Accounts Receivable',
        'Pending Payment',
      ].map((status, index) =>
        createTransaction({
          id: index + 1,
          Customers: status,
          'Order Status': status,
        })
      ),
      ...[
        'Shipped',
        'Cancelled',
        'Voided',
        'Forfeited',
        ' SHIPPED ',
        ' cancelled ',
        ' VOIDED ',
        ' forfeited ',
      ].map((status, index) =>
        createTransaction({
          id: index + 20,
          Customers: `Closed ${index}`,
          'Order Status': status,
        })
      ),
      createTransaction({
        id: 40,
        Customers: 'Prepared',
        'Order Status': 'Cancelled',
      }),
      createTransaction({ id: 41, Customers: 'Prepared' }),
      createTransaction({ id: 42, Customers: '   ' }),
      createTransaction({ id: undefined, Customers: 'Unsaved Customer' }),
    ];
    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useTransactionPaymentsState({
          opened: true,
          onClose: vi.fn(),
          transactions,
          customerNames: ['Directory Only Customer', 'Closed 0', 'Prepared'],
          selectedStatuses: new Set(['Prepared']),
          onStatusFilter: vi.fn(),
        }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    expect(
      result.current.customerOptions.map((option) => option.value)
    ).toEqual(
      [
        'In Transit',
        'Warehouse',
        'Prepared',
        'Ready For Dispatch',
        'Checked Out',
        'On-Hold',
        'Accounts Receivable',
        'Pending Payment',
      ].sort((left, right) => left.localeCompare(right))
    );
  });

  it('does not prefill a closed-order customer and clears selections when their last open order closes', async () => {
    const queryClient = new QueryClient();
    const onCustomerChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ status }) =>
        useTransactionPaymentsState({
          opened: true,
          onClose: vi.fn(),
          transactions: [
            createTransaction({
              Customers: 'Customer',
              'Order Status': status,
            }),
          ],
          customerNames: ['Customer'],
          defaultCustomerName: 'Customer',
          onCustomerChange,
          selectedStatuses: new Set(['Prepared']),
          onStatusFilter: vi.fn(),
        }),
      {
        initialProps: { status: 'Shipped' },
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      }
    );

    expect(result.current.selectedCustomer).toBeNull();
    expect(result.current.customerOptions).toEqual([]);
    rerender({ status: 'Prepared' });
    await waitFor(() =>
      expect(result.current.selectedCustomer).toBe('Customer')
    );
    rerender({ status: 'Forfeited' });
    await waitFor(() => expect(result.current.selectedCustomer).toBeNull());
    expect(result.current.customerOptions).toEqual([]);
    expect(onCustomerChange).not.toHaveBeenCalled();
  });

  it.each([
    ['https://m.me/lyn.domingo', 'https://m.me/lyn.domingo'],
    ['m.me/lyn.domingo', 'https://m.me/lyn.domingo'],
    [
      'https://www.facebook.com/profile.php?id=12345',
      'https://www.facebook.com/profile.php?id=12345',
    ],
  ])(
    'links customer names using the saved contact URL %s',
    async (savedLink, expectedLink) => {
      const transaction = createTransaction({});
      const lookupFacebookLink = vi.fn(() => savedLink);
      const { container } = renderModal({
        opened: true,
        onClose: vi.fn(),
        transactions: [transaction],
        customerNames: [transaction.Customers],
        defaultCustomerName: transaction.Customers,
        lookupFacebookLink,
        selectedStatuses: new Set(['Prepared']),
        onStatusFilter: vi.fn(),
      });

      await waitFor(() => {
        const link = container.querySelector('a');
        expect(link?.textContent).toBe(transaction.Customers);
        expect(link?.getAttribute('href')).toBe(expectedLink);
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
      });
      expect(lookupFacebookLink).toHaveBeenCalledWith(transaction.Customers);
    }
  );

  it('keeps customer names as plain text when no contact link is saved', async () => {
    const transaction = createTransaction({});
    const { container } = renderModal({
      opened: true,
      onClose: vi.fn(),
      transactions: [transaction],
      customerNames: [transaction.Customers],
      defaultCustomerName: transaction.Customers,
      lookupFacebookLink: () => '',
      selectedStatuses: new Set(['Prepared']),
      onStatusFilter: vi.fn(),
    });

    await waitFor(() => {
      expect(container.querySelector('tbody')?.textContent).toContain(
        transaction.Customers
      );
    });
    expect(container.querySelector('a')).toBeNull();
  });

  it('does not emit parent sync callbacks while applying default customer/product values', async () => {
    const onCustomerChange = vi.fn();
    const onProductCodeChange = vi.fn();

    const baseTransactions: TransactionData[] = [
      createTransaction({ id: 1 }),
      createTransaction({
        id: 2,
        Customers: 'Other Customer',
      }),
    ];

    const baseProps: React.ComponentProps<typeof TransactionPaymentsModal> = {
      opened: true,
      onClose: vi.fn(),
      transactions: baseTransactions,
      customerNames: ['Lyn Domingo | SIERRAS THRIFTEES', 'Other Customer'],
      defaultCustomerName: 'Lyn Domingo | SIERRAS THRIFTEES',
      onCustomerChange,
      defaultProductCode: 'Baby Talking/Musical Toy (BTMT-021926)',
      onProductCodeChange,
      selectedStatuses: new Set(['All Status']),
      onStatusFilter: vi.fn(),
      apiBasePath: '/api',
    };

    const { rerender } = renderModal(baseProps);

    await waitFor(() => {
      expect(onCustomerChange).not.toHaveBeenCalled();
      expect(onProductCodeChange).not.toHaveBeenCalled();
    });

    const broadenedTransactions: TransactionData[] = [
      ...baseTransactions,
      createTransaction({
        id: 3,
        Customers: 'Another Customer Same Product',
        'Product Code': 'Baby Talking/Musical Toy (BTMT-021926)',
      }),
    ];

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <TransactionPaymentsModal
            {...baseProps}
            transactions={broadenedTransactions}
          />
        </MantineProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(onCustomerChange).not.toHaveBeenCalled();
      expect(onProductCodeChange).not.toHaveBeenCalled();
    });
  });
});
