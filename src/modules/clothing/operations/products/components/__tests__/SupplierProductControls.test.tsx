import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupplierProductControls } from '../SupplierProductControls';
import type { ProductData, ProductFormData } from '../../types/product.types';
import { ProductService } from '../../services/ProductService';

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
  function Controls() {
    const [values, setValues] = React.useState(overrides.form ?? form);
    return (
      <SupplierProductControls
        grandTotal={3000}
        {...overrides}
        form={values}
        updateField={(field, value) => {
          updateField(field, value);
          setValues((previous) => ({ ...previous, [field]: value }));
        }}
      />
    );
  }
  render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Controls />
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
    vi.spyOn(ProductService, 'loadProducts').mockResolvedValue([
      { 'Supplier Reference': 'Supplier A' },
      { 'Supplier Reference': ' SUPPLIER  A ' },
      { 'Supplier Reference': 'Products Only Supplier' },
    ] as ProductData[]);
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
    vi.mocked(ProductService.loadProducts).mockRestore();
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

  it('deduplicates recorded suppliers and keeps a keyboard selection after blur', async () => {
    mount();
    const input = screen.getByRole('textbox', {
      name: 'Supplier',
    });
    fireEvent.click(input);
    await screen.findByRole('option', { name: 'Products Only Supplier' });
    expect(screen.getAllByRole('option', { name: 'Supplier A' })).toHaveLength(
      1
    );
    fireEvent.change(input, { target: { value: 'Products Only Supplier' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('Products Only Supplier');
  });

  it('adds a new supplier only when explicitly selected and clears incompatible credit', async () => {
    const { updateField } = mount({
      form: {
        ...form,
        supplierCreditId: 'credit-42',
        supplierCreditAmount: 1000,
      },
    });
    const input = screen.getByRole('textbox', {
      name: 'Supplier',
    });
    fireEvent.change(input, { target: { value: 'New Supplier' } });
    expect(updateField).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole('option', { name: 'Add supplier "New Supplier"' })
    );
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('New Supplier');
    expect(updateField).toHaveBeenCalledWith('supplierCreditId', '');
    expect(updateField).toHaveBeenCalledWith('supplierCreditAmount', 0);
    expect(screen.queryByLabelText('Credit to apply (PHP)')).toBeNull();
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

  it('lists credit-only suppliers but excludes exhausted, foreign-currency and other-supplier credits', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            ...credits,
            {
              ...credits[0],
              id: 'zero',
              reference: 'EXHAUSTED',
              availableAmount: 0,
            },
            { ...credits[0], id: 'usd', reference: 'FOREIGN', currency: 'USD' },
            {
              ...credits[0],
              id: 'other',
              reference: 'OTHER',
              supplierReference: 'Credit Only Supplier',
            },
          ],
        })
      )
    );
    mount();
    const supplier = screen.getByRole('textbox', {
      name: 'Supplier',
    });
    fireEvent.click(supplier);
    await screen.findByRole('option', { name: 'Credit Only Supplier' });
    fireEvent.keyDown(supplier, { key: 'Escape' });
    fireEvent.click(
      screen.getByRole('textbox', { name: 'Available supplier credit' })
    );
    expect(
      await screen.findByRole('option', { name: /CREDIT-42/ })
    ).toBeTruthy();
    expect(
      screen.queryByRole('option', { name: /EXHAUSTED|FOREIGN|OTHER/ })
    ).toBeNull();
  });

  it('disables credit choice while loading and recovers after a failed fetch', async () => {
    let resolveCredits!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCredits = resolve;
        })
    );
    mount();
    const creditInput = screen.getByRole('textbox', {
      name: 'Available supplier credit',
    }) as HTMLInputElement;
    expect(creditInput.disabled).toBe(true);
    expect(creditInput.placeholder).toBe('Loading credits...');
    resolveCredits(
      new Response(JSON.stringify({ error: 'Unavailable' }), { status: 500 })
    );
    await screen.findByText('Supplier credits unavailable');
    expect(creditInput.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(creditInput.disabled).toBe(false));
    fireEvent.click(creditInput);
    expect(
      await screen.findByRole('option', { name: /CREDIT-42/ })
    ).toBeTruthy();
  });

  it('recovers the recorded supplier list independently of credit data', async () => {
    vi.mocked(ProductService.loadProducts).mockRejectedValueOnce(
      new Error('Supplier list unavailable')
    );
    mount();
    await screen.findByText('Recorded suppliers unavailable');
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry supplier list' })
    );
    await waitFor(() =>
      expect(screen.queryByText('Recorded suppliers unavailable')).toBeNull()
    );
    fireEvent.click(screen.getByRole('textbox', { name: 'Supplier' }));
    expect(
      await screen.findByRole('option', { name: 'Products Only Supplier' })
    ).toBeTruthy();
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
