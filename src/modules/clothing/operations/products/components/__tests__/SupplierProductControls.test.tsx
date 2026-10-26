import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierProductControls } from '../SupplierProductControls';
import type { ProductData, ProductFormData } from '../../types/product.types';

const fixture = vi.hoisted(() => ({ role: 'ADMIN', confirm: vi.fn() }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: fixture.role } } }),
}));
vi.mock('@/lib/alerts', () => ({ showConfirm: fixture.confirm }));

const credits = [
  {
    id: 'credit-42',
    supplierReference: 'supplier a',
    reference: 'CREDIT-42',
    currency: 'PHP',
    amount: 19511.37,
    availableAmount: 19511.37,
    sourceProduct: { id: 42, productCode: 'DTTP-101626', product: 'Dreamgrow' },
    applications: [],
  },
];
const form = {
  supplierReference: 'Supplier A',
  supplierCreditId: '',
  supplierCreditAmount: 0,
  supplierCreditRequestId: '',
  shipmentCode: 'KPC 23930A-239',
} as ProductFormData;
const product = {
  id: 42,
  Product: 'Dreamgrow',
  'Product Code': 'DTTP-101626',
  Quantity: 100,
  'Grand Total': 19511.37,
  'Shipment Code': 'KPC 23930A-239',
  'Supplier Fulfillment Status': 'ACTIVE',
} as ProductData;

function mount(
  overrides: Partial<React.ComponentProps<typeof SupplierProductControls>> = {}
) {
  const updateField = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <SupplierProductControls
          form={form}
          grandTotal={3000}
          updateField={updateField}
          {...overrides}
        />
      </QueryClientProvider>
    </MantineProvider>
  );
  return { updateField };
}

describe('supplier product controls', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    fixture.role = 'ADMIN';
    fixture.confirm.mockResolvedValue(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: credits }),
      }))
    );
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('hides financial supplier controls from ordinary users', () => {
    fixture.role = 'USER';
    mount();
    expect(
      screen.queryByLabelText('Supplier funding and fulfillment')
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('offers available credit without reducing the gross purchase amount', async () => {
    const { updateField } = mount();
    await waitFor(() =>
      expect(
        (
          screen.getByRole('textbox', {
            name: 'Available supplier credit',
          }) as HTMLInputElement
        ).disabled
      ).toBe(false)
    );
    fireEvent.click(
      screen.getByRole('textbox', { name: 'Available supplier credit' })
    );
    fireEvent.click(await screen.findByText(/CREDIT-42 \| DTTP-101626/));
    expect(updateField).toHaveBeenCalledWith('supplierCreditId', 'credit-42');
    expect(updateField).toHaveBeenCalledWith('supplierCreditAmount', 3000);
    expect(updateField).not.toHaveBeenCalledWith(
      'unitPrice',
      expect.anything()
    );
  });

  it('issues credit for the saved missing product rather than a user-entered amount', async () => {
    const onResolved = vi.fn();
    mount({ product, onResolved });
    fireEvent.click(
      screen.getByRole('textbox', { name: 'Supplier resolution' })
    );
    fireEvent.click(screen.getByText('Record supplier credit'));
    fireEvent.change(screen.getByLabelText('Supplier credit reference'), {
      target: { value: 'CREDIT-42' },
    });
    expect(screen.getByText(/Credit amount:.*19,511.37/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Record Supplier Credit' })
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === 'POST');
    expect(call?.[0]).toBe('/api/products/42/supplier-resolution');
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body).toMatchObject({
      action: 'ISSUE_CREDIT',
      supplierReference: 'supplier a',
      reference: 'CREDIT-42',
    });
    expect(body.amount).toBeUndefined();
  });

  it('shows issued-credit remaining balance and purchase applications', async () => {
    mount({
      product: { ...product, 'Supplier Fulfillment Status': 'CREDIT_ISSUED' },
    });
    expect(
      await screen.findByText(/Credit CREDIT-42:.*19,511.37.*Available/)
    ).toBeTruthy();
    expect(screen.queryByLabelText('Supplier resolution')).toBeNull();
  });

  it('blocks a supplier action while other purchase edits are unsaved', async () => {
    mount({ product, form: { ...form, quantity: 99 } });
    fireEvent.click(
      screen.getByRole('textbox', { name: 'Supplier resolution' })
    );
    fireEvent.click(screen.getByText('Record supplier credit'));
    fireEvent.change(screen.getByLabelText('Supplier credit reference'), {
      target: { value: 'CREDIT-42' },
    });
    expect(
      (
        screen.getByRole('button', {
          name: 'Record Supplier Credit',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      screen.getByText(
        'Save or discard other product edits before recording a supplier action.'
      )
    ).toBeTruthy();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([, options]) => options?.method === 'POST')
    ).toBe(false);
  });

  it('does not report a committed operation as failed when refreshing fails', async () => {
    mount({
      product,
      onResolved: vi.fn().mockRejectedValue(new Error('Refresh failed')),
    });
    fireEvent.click(
      screen.getByRole('textbox', { name: 'Supplier resolution' })
    );
    fireEvent.click(screen.getByText('Record supplier credit'));
    fireEvent.change(screen.getByLabelText('Supplier credit reference'), {
      target: { value: 'CREDIT-42' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Record Supplier Credit' })
    );
    expect(await screen.findByText('Supplier action recorded')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Record Supplier Credit',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([, options]) => options?.method === 'POST')
    ).toHaveLength(1);
  });
});
