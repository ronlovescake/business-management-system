import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { AddProductModal } from '@/modules/clothing/operations/products/components/AddProductModal';
import { ProductService } from '@/modules/clothing/operations/products/services/ProductService';
import type { ProductFormData } from '@/modules/clothing/operations/products/types/product.types';

const scenario = new URLSearchParams(location.search).get('scenario') ?? 'edit';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const originalForm = {
  ...ProductService.createEmptyForm(),
  product: 'Dreamgrow Tiny Tots Pants',
  supplierReference: 'supplier a',
  shipmentCode: 'KPC 23930A-239',
  postingDate: '2026-10-26',
  orderDate: '2026-10-16',
  payment: 'Paid',
  paymentMethod: 'CASH',
  unitPrice: 195.1137,
  quantity: 100,
  exchangeRates: 1,
  applyTransactionFee: false,
};
const product = {
  ...ProductService.formToProductData(originalForm),
  id: 42,
  'Product Code': 'DTTP-101626',
  'Grand Total': 19511.37,
  'Supplier Fulfillment Status':
    scenario === 'issued' ? 'CREDIT_ISSUED' : 'ACTIVE',
};

function Fixture() {
  const [form, setForm] = useState<ProductFormData>(() =>
    scenario === 'new'
      ? {
          ...originalForm,
          product: 'Replacement Product',
          shipmentCode: 'KPC 23930A-240',
          unitPrice: 30,
        }
      : ProductService.productToForm(product)
  );
  return (
    <SessionProvider
      session={{
        user: {
          id: 'browser-fixture-admin',
          role: scenario === 'user' ? 'USER' : 'ADMIN',
        },
        expires: '2099-01-01T00:00:00.000Z',
      }}
      refetchOnWindowFocus={false}
    >
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <AddProductModal
            opened
            onClose={() => undefined}
            form={form}
            updateField={(field, value) =>
              setForm((current) => ({ ...current, [field]: value }))
            }
            calculations={ProductService.calculateFinancials(form)}
            onSubmit={() => {
              document.body.dataset.savedForm = JSON.stringify(form);
            }}
            isEditMode={scenario !== 'new'}
            product={scenario === 'new' ? undefined : product}
            supplierResolutionEnabled
            onSupplierResolved={async () => {
              document.body.dataset.supplierResolved = 'true';
            }}
          />
          <output hidden data-testid="supplier-form">
            {JSON.stringify(form)}
          </output>
        </QueryClientProvider>
      </MantineProvider>
    </SessionProvider>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Supplier browser fixture root is missing.');
}
createRoot(root).render(<Fixture />);
