/**
 * Dispatch Component - Refactored
 * Manage dispatch operations and order tracking
 */

'use client';

import { useState } from 'react';
import { Stack, Tabs } from '@mantine/core';
import {
  useDispatchCustomerLookup,
  usePossibleMatches,
  useDispatchData,
  useDispatchImport,
  useClipboard,
  useDispatchActions,
} from '../hooks';
import {
  MatchingTab,
  PossibleMatchTab,
  CheckoutUpdateTab,
  RecentlyUpdatedTab,
  RawDataTab,
  DispatchKPICards,
} from './';
import type { ServerCustomerData } from '../types';

interface DispatchComponentProps {
  serverCustomersData?: ServerCustomerData[];
}

export function DispatchComponent({
  serverCustomersData,
}: DispatchComponentProps = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rawDataSearch, setRawDataSearch] = useState('');

  // Customer lookup hook
  const {
    lookupCustomerName,
    lookupFacebookLink,
    lookupFacebookLinkById,
    isLoading: loadingCustomers,
  } = useDispatchCustomerLookup(true, serverCustomersData);

  // Main data management hook
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    rawData,
    setRawData,
    statusFilter,
    setStatusFilter,
    dateRangeFilter,
    setDateRangeFilter,
    completedOrders,
    autoCompletedOrders,
    updateOrderCompletion,
    actionLinksEnabled,
    toggleActionLinks,
    hoveredCustomerId,
    setHoveredCustomerId,
    savedOrders,
    loadingSavedOrders,
    fetchError,
    effectiveRawData,
    saveOrdersMutation,
    linkCustomerMutation,
    filteredData,
    unmatchedOrders,
    preparedLineTotalsByCustomer,
  } = useDispatchData({
    _serverCustomersData: serverCustomersData,
    lookupCustomerName,
  });

  // Possible matches hook with address matching
  const possibleMatchesSource = serverCustomersData?.map((customer) => ({
    id: customer.id,
    customerName: customer.customerName,
    businessName: customer.businessName,
    phoneNumber: customer.phoneNumber,
    address: customer.address,
    additionalAddresses: customer.additionalAddresses,
  }));

  const {
    getMatchesForOrder,
    stats,
    isLoading: loadingMatches,
  } = usePossibleMatches(
    unmatchedOrders,
    activeTab === 'possible-match' || activeTab === 'match',
    possibleMatchesSource
  );

  // Import/Export hook
  const { isImportingRawData, handleXlsxImport, handleExportCSV } =
    useDispatchImport({
      setRawData,
      saveOrdersMutation,
    });

  // Clipboard utilities
  const { copyToClipboard } = useClipboard();

  // Action handlers
  const {
    handleCustomerNameClick,
    navigateToPossibleMatchTab,
    handleUpdateShippedOrders,
    handleLinkCustomer,
  } = useDispatchActions({
    effectiveRawData,
    lookupCustomerName,
    updateOrderCompletion,
  });

  // Handle add new - triggers update shipped orders for checkout-update tab
  const handleAddNew = () => {
    if (activeTab === 'checkout-update') {
      void handleUpdateShippedOrders();
    }
  };

  // Mock data for empty states
  const mockData: unknown[] = [];

  // Completed orders count
  const completedCount = Object.keys(completedOrders).length;

  return (
    <Stack gap="md">
      {/* KPI Cards */}
      <DispatchKPICards
        totalOrders={effectiveRawData.length}
        filteredCount={filteredData.length}
        completedCount={completedCount}
        stats={stats}
      />

      {/* Main Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="match">To Ship</Tabs.Tab>
          <Tabs.Tab value="possible-match" id="dispatch-possible-match-tab">
            Possible Match
          </Tabs.Tab>
          <Tabs.Tab value="checkout-update">Shipped</Tabs.Tab>
          <Tabs.Tab value="recently-updated">Recently Updated Orders</Tabs.Tab>
          <Tabs.Tab value="raw-data">Raw Data</Tabs.Tab>
        </Tabs.List>

        {/* Matching Tab - Orders to ship */}
        <Tabs.Panel value="match" pt="md">
          <MatchingTab
            filteredData={filteredData}
            effectiveRawData={effectiveRawData}
            mockData={mockData}
            savedOrders={savedOrders}
            rawData={rawData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleXlsxImport={handleXlsxImport}
            handleExportCSV={handleExportCSV}
            handleAddNew={handleAddNew}
            isImportingRawData={isImportingRawData}
            lookupCustomerName={lookupCustomerName}
            lookupFacebookLink={lookupFacebookLink}
            loadingCustomers={loadingCustomers}
            loadingSavedOrders={loadingSavedOrders}
            completedOrders={completedOrders}
            autoCompletedOrders={autoCompletedOrders}
            updateOrderCompletion={updateOrderCompletion}
            actionLinksEnabled={actionLinksEnabled}
            toggleActionLinks={toggleActionLinks}
            hoveredCustomerId={hoveredCustomerId}
            setHoveredCustomerId={setHoveredCustomerId}
            navigateToPossibleMatchTab={() =>
              navigateToPossibleMatchTab(setActiveTab)
            }
            handleCustomerNameClick={handleCustomerNameClick}
            copyToClipboard={copyToClipboard}
            getMatchesForOrder={getMatchesForOrder}
            preparedLineTotalsByCustomer={preparedLineTotalsByCustomer}
          />
        </Tabs.Panel>

        {/* Possible Match Tab - Unmatched orders with suggestions */}
        <Tabs.Panel value="possible-match" pt="md">
          <PossibleMatchTab
            unmatchedOrders={unmatchedOrders}
            effectiveRawData={effectiveRawData}
            getMatchesForOrder={getMatchesForOrder}
            handleLinkCustomer={(
              orderId,
              customerId,
              customerName,
              username,
              deliveryAddress,
              addressScore
            ) =>
              handleLinkCustomer(
                orderId,
                customerId,
                customerName,
                username,
                deliveryAddress,
                addressScore,
                linkCustomerMutation
              )
            }
            lookupFacebookLinkById={lookupFacebookLinkById}
            copyToClipboard={copyToClipboard}
            stats={stats}
            loadingMatches={loadingMatches}
          />
        </Tabs.Panel>

        {/* Checkout Update Tab - Shipped orders */}
        <Tabs.Panel value="checkout-update" pt="md">
          <CheckoutUpdateTab
            filteredData={filteredData}
            effectiveRawData={effectiveRawData}
            mockData={mockData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateRangeFilter={dateRangeFilter}
            setDateRangeFilter={setDateRangeFilter}
            handleXlsxImport={handleXlsxImport}
            handleExportCSV={handleExportCSV}
            handleAddNew={handleAddNew}
            isImportingRawData={isImportingRawData}
            lookupCustomerName={lookupCustomerName}
            lookupFacebookLink={lookupFacebookLink}
            copyToClipboard={copyToClipboard}
          />
        </Tabs.Panel>

        {/* Recently Updated Tab - Time-sorted view */}
        <Tabs.Panel value="recently-updated" pt="md">
          <RecentlyUpdatedTab
            filteredData={filteredData}
            effectiveRawData={effectiveRawData}
            mockData={mockData}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleXlsxImport={handleXlsxImport}
            handleExportCSV={handleExportCSV}
            handleAddNew={handleAddNew}
            isImportingRawData={isImportingRawData}
            lookupCustomerName={lookupCustomerName}
            copyToClipboard={copyToClipboard}
          />
        </Tabs.Panel>

        {/* Raw Data Tab - Import and view raw XLSX data */}
        <Tabs.Panel value="raw-data" pt="md">
          <RawDataTab
            effectiveRawData={effectiveRawData}
            savedOrders={savedOrders}
            loadingSavedOrders={loadingSavedOrders}
            fetchError={fetchError}
            _rawDataSearch={rawDataSearch}
            setRawDataSearch={setRawDataSearch}
            handleXlsxImport={handleXlsxImport}
            isImportingRawData={isImportingRawData}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
