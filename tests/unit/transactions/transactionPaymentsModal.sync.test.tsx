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
