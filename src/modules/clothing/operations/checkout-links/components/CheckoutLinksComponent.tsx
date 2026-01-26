'use client';

import { Stack, Tabs } from '@mantine/core';
import { CheckoutLinkEditorModal } from './modals/CheckoutLinkEditorModal';
import { CheckoutLinksTab } from './tabs/CheckoutLinksTab';
import { InvoicingTab } from './tabs/InvoicingTab';
import { ItemWeightTab } from './tabs/ItemWeightTab';
import { LocalInvoicingTab } from './tabs/LocalInvoicingTab';
import { CustomerOrdersTab } from './tabs/CustomerOrdersTab';
import { useCheckoutLinksPage } from '../hooks/useCheckoutLinksPage';

export function CheckoutLinksComponent({
  apiBasePath,
  checkoutLinksApiBasePath,
}: {
  apiBasePath?: string;
  checkoutLinksApiBasePath?: string;
} = {}) {
  const {
    activeTab,
    setActiveTab,
    checkoutLinksState,
    invoicesState,
    localInvoicesState,
    customerOrdersState,
    itemWeightsState,
    modalState,
    utilities,
  } = useCheckoutLinksPage({ apiBasePath, checkoutLinksApiBasePath });

  const noop = () => {};

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="invoicing">Invoicing</Tabs.Tab>
          <Tabs.Tab value="local-invoicing">Local Invoicing</Tabs.Tab>
          <Tabs.Tab value="customer-orders">Customer Orders</Tabs.Tab>
          <Tabs.Tab value="item-weight">Item Weight</Tabs.Tab>
          <Tabs.Tab value="checkout-links">Checkout Link</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoicing" pt="md">
          <InvoicingTab
            invoiceData={invoicesState.data}
            filteredInvoiceData={invoicesState.filteredData}
            checkoutLinks={checkoutLinksState.data}
            onSearch={invoicesState.handleSearch}
            searchValue={invoicesState.searchQuery}
            onSyncGoogleDrive={invoicesState.handleSyncGoogleDrive}
            isSyncing={invoicesState.isSyncing}
            onCustomerNameClick={invoicesState.handleCustomerNameClick}
            hasFacebookLink={invoicesState.hasFacebookLink}
            onTickboxChange={invoicesState.handleInvoiceTickboxChange}
            calculateFinalWeight={utilities.calculateFinalWeight}
            findCheckoutLinkByWeight={utilities.findCheckoutLinkByWeight}
          />
        </Tabs.Panel>

        <Tabs.Panel value="local-invoicing" pt="md">
          <LocalInvoicingTab
            invoiceData={localInvoicesState.data}
            filteredInvoiceData={localInvoicesState.filteredData}
            checkoutLinks={checkoutLinksState.data}
            onSearch={localInvoicesState.handleSearch}
            searchValue={localInvoicesState.searchQuery}
            calculateFinalWeight={utilities.calculateFinalWeight}
            findCheckoutLinkByWeight={utilities.findCheckoutLinkByWeight}
            onCustomerNameClick={localInvoicesState.handleCustomerNameClick}
            hasFacebookLink={localInvoicesState.hasFacebookLink}
            onTickboxChange={localInvoicesState.handleInvoiceTickboxChange}
            searchPlaceholder="Search local invoicing customers..."
            summaryLabel="local transactions with invoice dates"
            emptyStateMessage="No transactions with invoice dates were found."
            invoiceDateOptions={localInvoicesState.invoiceDateOptions}
            invoiceDateFilter={localInvoicesState.invoiceDateFilter}
            onInvoiceDateFilterChange={localInvoicesState.setInvoiceDateFilter}
          />
        </Tabs.Panel>

        <Tabs.Panel value="customer-orders" pt="md">
          <CustomerOrdersTab
            orders={customerOrdersState.data}
            filteredOrders={customerOrdersState.filteredData}
            onSearch={customerOrdersState.handleSearch}
            searchValue={customerOrdersState.searchQuery}
            isLoading={customerOrdersState.isLoading}
          />
        </Tabs.Panel>

        <Tabs.Panel value="item-weight" pt="md">
          <ItemWeightTab
            itemWeightData={itemWeightsState.data}
            filteredItemWeightData={itemWeightsState.filteredData}
            isItemWeightLoading={itemWeightsState.isItemWeightLoading}
            itemWeightError={itemWeightsState.itemWeightError}
            onSearch={itemWeightsState.handleSearch}
            searchValue={itemWeightsState.searchQuery}
            onOpenProducts={itemWeightsState.handleOpenProductsModule}
          />
        </Tabs.Panel>

        <Tabs.Panel value="checkout-links" pt="md">
          <CheckoutLinksTab
            checkoutLinks={checkoutLinksState.data}
            filteredCheckoutLinks={checkoutLinksState.filteredData}
            isLoading={checkoutLinksState.isLoading}
            isImporting={checkoutLinksState.isImporting}
            pendingDeleteId={checkoutLinksState.pendingDeleteId}
            onSearch={checkoutLinksState.handleSearch}
            searchValue={checkoutLinksState.searchQuery}
            onImport={checkoutLinksState.handleImportCSV}
            onExport={checkoutLinksState.handleExportCSV}
            onAddNew={noop}
            onEdit={checkoutLinksState.handleEdit}
            onDelete={checkoutLinksState.handleDelete}
          />
        </Tabs.Panel>
      </Tabs>

      <CheckoutLinkEditorModal
        opened={modalState.isEditModalOpen}
        onClose={modalState.closeEditModal}
        form={modalState.checkoutLinkForm}
        onSubmit={modalState.handleUpdateCheckoutLink}
        isSaving={modalState.isSavingCheckoutLink}
      />
    </Stack>
  );
}
