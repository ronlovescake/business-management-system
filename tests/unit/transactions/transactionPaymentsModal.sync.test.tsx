import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionPaymentsModal } from '@/modules/clothing/operations/transactions/components/TransactionPaymentsModal';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';

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
