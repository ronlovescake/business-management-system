import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Button,
  Group,
  MantineProvider,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { SessionProvider } from 'next-auth/react';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { RefundPending } from '@/components/refunds/RefundPending';
import { CustomerRefundPayouts } from '@/components/refunds/CustomerRefundPayouts';
import { InventoryValuationNotice } from '@/components/accounting/InventoryValuationNotice';
import { InventoryCostCorrections } from '@/components/accounting/InventoryCostCorrections';
import { OrdersAndTransactions } from '@/app/clothing/operations/customers/[id]/components/OrdersAndTransactions';
import type {
  CustomerStats,
  Transaction,
} from '@/app/clothing/operations/customers/[id]/types';
import { useOrderCancellation } from '@/modules/clothing/operations/transactions/hooks/useOrderCancellation';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';
import { useLedger } from '@/app/clothing/accounting/ledger/hooks/useLedger';
import { LedgerListTable } from '@/app/clothing/accounting/ledger/components/LedgerListTable';
import { InventoryTable } from '@/modules/clothing/operations/inventory/components/InventoryTable';
import { buildInventoryItems } from '@/modules/clothing/operations/inventory/lib/inventoryTransforms';

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
const isGeneralMerchandise =
  new URLSearchParams(location.search).get('domain') === 'gm';
const isValuation =
  new URLSearchParams(location.search).get('view') === 'valuation';
const isCancellation =
  new URLSearchParams(location.search).get('view') === 'cancellation';
const isLedger = new URLSearchParams(location.search).get('view') === 'ledger';
const isInventory =
  new URLSearchParams(location.search).get('view') === 'inventory';

function LedgerFixture() {
  const ledger = useLedger();
  return (
    <Stack>
      <Select
        label="Ledger account"
        data={ledger.accounts}
        value={ledger.filterAccount}
        onChange={ledger.setFilterAccount}
      />
      <TextInput
        label="Ledger search"
        value={ledger.searchQuery}
        onChange={(event) => ledger.setSearchQuery(event.currentTarget.value)}
      />
      {ledger.accountBalance && (
        <>
          <Text>
            Opening: {ledger.formatCurrency(ledger.accountBalance.opening)}
          </Text>
          <Text>
            Closing: {ledger.formatCurrency(ledger.accountBalance.closing)}
          </Text>
          <Text>
            Period movement:{' '}
            {ledger.formatCurrency(ledger.accountBalance.movement)}
          </Text>
        </>
      )}
      <Button onClick={ledger.handleExportCSV}>Export ledger CSV</Button>
      <LedgerListTable
        entries={ledger.entries}
        filteredEntries={ledger.filteredEntries}
        formatDate={ledger.formatDate}
        formatCurrency={ledger.formatCurrency}
      />
    </Stack>
  );
}

function InventoryFixture() {
  const products = ['ONHAND', 'TRANSIT'].map((code, index) => ({
    id: String(index + 1),
    'Product Code': code,
    Quantity: 10,
    COGS: 100,
    'Actual Price': 10,
    'Shipment Code': `SHIP-${code}`,
    'Shipment Status': index ? 'In Transit' : 'Delivered',
  }));
  const data = buildInventoryItems(
    products,
    products.map((product) => ({
      id: product.id,
      'Product Code': product['Product Code'],
      Quantity: 4,
      'Unit Price': 100,
      'Order Status': 'Prepared',
    }))
  );
  return (
    <InventoryTable
      headers={[
        'PRODUCT CODE',
        'P.O. QUANTITY',
        'DAMAGED QTY',
        'SUPPLIER SHORT',
        'ADDITIONALS',
        'TRANSFER OUT',
        'TRANSFER IN',
        'ACTUAL QUANTITY',
        'ON-HAND RESERVED',
        'SOLD',
        'ON-HAND SELLABLE',
        'IN-TRANSIT RESERVED',
        'IN-TRANSIT UNRESERVED',
        'TOTAL SALES',
        'COGS',
        'NET PROFIT',
        'PERCENTAGE',
        'SELLABLE VALUE',
        'SHIPMENT STATUS',
        'SHIPMENT CODE',
      ]}
      data={data}
      emptyState="No inventory"
      transferOutByProduct={new Map()}
      transferInByProduct={new Map()}
    />
  );
}

function CancellationFixture() {
  const { requestCancellation, cancellationModal } = useOrderCancellation();
  const [error, setError] = useState('');
  const close = async (status: 'Cancelled' | 'Voided') => {
    try {
      await requestCancellation({ id: 30 } as TransactionData, status);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  return (
    <>
      <Group>
        <Button onClick={() => void close('Cancelled')}>Cancel order</Button>
        <Button onClick={() => void close('Voided')}>Void order</Button>
      </Group>
      {error && <Alert role="alert">{error}</Alert>}
      {cancellationModal}
    </>
  );
}

function ValuationFixture() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <>
      <InventoryCostCorrections />
      <InventoryValuationNotice
        valuation={{
          complete: confirmed,
          affectedQuantity: confirmed ? 0 : 3,
          issues: confirmed
            ? []
            : [
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
        onConfirmed={() => setConfirmed(true)}
      />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <SessionProvider
    session={{
      user: { id: 'fixture-admin', role: 'ADMIN', name: 'Fixture Admin' },
      expires: '2099-01-01T00:00:00Z',
    }}
    refetchOnWindowFocus={false}
  >
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MantineProvider>
        <Notifications />
        <Stack maw={1200} mx="auto" p="md">
          {isLedger ? (
            <LedgerFixture />
          ) : isInventory ? (
            <InventoryFixture />
          ) : isCancellation ? (
            <CancellationFixture />
          ) : isValuation ? (
            <ValuationFixture />
          ) : (
            <>
              {!isGeneralMerchandise && (
                <>
                  <RefundPending />
                  <RefundPending variant="icon" />
                  <CustomerRefundPayouts customerId="1" />
                </>
              )}
              <OrdersAndTransactions
                customerId="1"
                orders={[]}
                transactions={[
                  transaction,
                  { ...transaction, id: 20, orderStatus: 'Delivered' },
                ]}
                stats={stats}
                apiBasePath={
                  isGeneralMerchandise ? '/api/general-merchandise' : undefined
                }
              />
            </>
          )}
        </Stack>
      </MantineProvider>
    </QueryClientProvider>
  </SessionProvider>
);
