import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderCancellationModal } from '@/modules/clothing/operations/transactions/components/OrderCancellationModal';
import { api } from '@/lib/api/client';

const auth = vi.hoisted(() => ({ role: 'ADMIN' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: auth.role } } }),
}));

describe('clothing cancellation decision modal', () => {
  const preview = {
    transactionId: 1,
    orderStatus: 'Prepared',
    grossAmount: 1000,
    collectedAmount: 400,
    priorRefundAmount: 0,
    initialDepositAmount: 200,
    initialDepositRate: 20,
    hasReceivableSale: false,
    reviewRequired: false,
    closed: false,
  };

  beforeEach(() => {
    auth.role = 'ADMIN';
  });

  const open = (overrides = {}) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <OrderCancellationModal
            preview={{ ...preview, ...overrides }}
            kind="CANCELLED"
            onClose={vi.fn()}
            onSaved={vi.fn()}
          />
        </MantineProvider>
      </QueryClientProvider>
    );

  it('submits the original twenty-percent retention without a ten-percent cap', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({});
    try {
      open();
      fireEvent.click(
        screen.getByLabelText('Keep the agreed original deposit')
      );
      fireEvent.change(screen.getByLabelText(/Decision reason/), {
        target: { value: 'Customer cancellation reviewed' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Approve cancellation' })
      );
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(
          '/api/transactions/1/cancellation',
          {
            kind: 'CANCELLED',
            mode: 'RETAIN_DEPOSIT',
            reason: 'Customer cancellation reviewed',
          },
          { headers: { 'Idempotency-Key': expect.any(String) } }
        )
      );
    } finally {
      post.mockRestore();
    }
  });

  it('does not guess an unknown original deposit from the four hundred collected', () => {
    open({ initialDepositAmount: null, initialDepositRate: null });
    fireEvent.click(screen.getByLabelText('Keep the agreed original deposit'));
    expect(
      screen.getByLabelText(/Confirmed original deposit amount/)
    ).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Approve cancellation' })
    ).toBeDisabled();
  });

  it('prevents an ordinary user from approving money', () => {
    auth.role = 'USER';
    open();
    expect(
      screen.getByText('Administrator approval required.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve cancellation' })
    ).toBeDisabled();
  });

  it('requires an explicit money decision rather than preselecting an emergency refund', () => {
    open();
    fireEvent.change(screen.getByLabelText(/Decision reason/), {
      target: { value: 'Customer cancellation reviewed' },
    });
    expect(
      screen.getByRole('button', { name: 'Approve cancellation' })
    ).toBeDisabled();
  });
});
