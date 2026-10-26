/**
 * Transactions Page Component
 *
 * ==============================================================================
 * 🚨🚨🚨 CRITICAL WARNING - PROTECTED BUSINESS LOGIC 🚨🚨🚨
 * ==============================================================================
 *
 * This component displays transactions with FINALIZED business logic:
 * ✅ Invoice generation with customer consolidation
 * ✅ Packing list generation
 * ✅ Distribution slip generation
 * ✅ Customer validation (banned + high cancellation rate)
 * ✅ Order status auto-population
 * ✅ Unit Price calculation (Tier Price - Discount)
 * ✅ Line Total calculation ((Quantity × Unit Price) - Adjustment)
 *
 * UI is IDENTICAL to original - only organization changed!
 * ==============================================================================
 */

'use client';
import { useTransactionCustomerTabs } from '../hooks/useTransactionCustomerTabs';
import { useOrderCancellation } from '../hooks/useOrderCancellation';

import React, {
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconRefresh, IconTrash } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { RefundPending } from '@/components/refunds/RefundPending';
import type {
  CellClickEvent,
  CellEditEvent,
} from '@/components/ui/HandsontableGrid';
import { onRenderCallback } from '@/lib/performance/monitoring';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { useTransactionsData } from '../hooks/useTransactionsData';
import { useTransactionOperations } from '../hooks/useTransactionOperations';
import { useTransactionModals } from '../hooks/useTransactionModals';
import { useTransactionsDerivedData } from '../hooks/useTransactionsDerivedData';
import { useDueDateFilters } from '../hooks/useDueDateFilters';
import {
  DEFAULT_READ_ONLY_COLUMNS,
  type DueDateGridRow,
  type ReadOnlyColumnFlags,
} from '@/lib/transactions';
import {
  TransactionsTabs,
  type TransactionsTabValue,
} from './TransactionsTabs';
import {
  DistributionGenerationModal,
  CustomerWarningModal,
} from './TransactionModals';
import { TransactionPaymentsModal } from './TransactionPaymentsModal';
import { useChangeLogQuery } from '../../settings/change-log/hooks/useChangeLogQuery';
import { useInvoiceCustomerLookup } from '../../checkout-links/hooks/useInvoiceCustomerLookup';
import { CustomerDetailsModal } from '@/app/clothing/operations/customers/[id]/components/CustomerDetailsModal';
import type { TransactionData } from '../types/transaction.types';

const STRETCH_COLUMN_ID = 'notes';

interface TransactionsPageProps {
  apiBasePath?: string;
}

export function TransactionsPage({ apiBasePath }: TransactionsPageProps) {
  const { requestCancellation, cancellationModal } = useOrderCancellation();
  const actionInProgress = useRef(false);
  const pendingVoidedCustomer = useRef<string | null>(null);
  // ============================================================================
  // SETTINGS STATE - Fetch read-only config
  // ============================================================================
  const [readOnlyColumns, setReadOnlyColumns] = useState<ReadOnlyColumnFlags>(
    DEFAULT_READ_ONLY_COLUMNS
  );
  const [activeTab, setActiveTab] = useState<TransactionsTabValue>('main');
  const [tabSearchQueries, setTabSearchQueries] = useState<
    Record<TransactionsTabValue, string>
  >({
    main: '',
    invoicing: '',
    'warehouse-prepared': '',
    'packing-list': '',
    packed: '',
    'due-dates': '',
    'recently-updated': '',
  });
  const [tabProductCodeSearchQueries, setTabProductCodeSearchQueries] =
    useState<Record<TransactionsTabValue, string>>({
      main: '',
      invoicing: '',
      'warehouse-prepared': '',
      'packing-list': '',
      packed: '',
      'due-dates': '',
      'recently-updated': '',
    });

  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const paymentsFiltersRef = useRef<{
    customer: string | null;
    productCode: string | null;
  }>({
    customer: null,
    productCode: null,
  });
  const [customerDetailsId, setCustomerDetailsId] = useState<string | null>(
    null
  );
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState(false);
  const lastCustomerClickRef = useRef<{
    row: number;
    columnId: string;
    time: number;
  } | null>(null);

  const lastCustomerPasteRef = useRef<{
    row: number;
    time: number;
  } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          buildApiPath(undefined, '/settings/transactions')
        );
        if (response.ok) {
          const data = await response.json();
          setReadOnlyColumns({
            unitPrice:
              data.unitPriceReadOnly ?? DEFAULT_READ_ONLY_COLUMNS.unitPrice,
            lineTotal:
              data.lineTotalReadOnly ?? DEFAULT_READ_ONLY_COLUMNS.lineTotal,
            invoiceDate:
              data.invoiceDateReadOnly ?? DEFAULT_READ_ONLY_COLUMNS.invoiceDate,
            packedDate:
              data.packedDateReadOnly ?? DEFAULT_READ_ONLY_COLUMNS.packedDate,
            shipmentCode:
              data.shipmentCodeReadOnly ??
              DEFAULT_READ_ONLY_COLUMNS.shipmentCode,
          });
        }
      } catch (error) {
        logger.error('Error fetching transactions settings:', error);
      }
    };
    fetchSettings();
  }, [apiBasePath]);

  // ============================================================================
  // DATA HOOKS - All data fetching and filtering
  // ============================================================================
  const {
    saveQueue,
    replacePlaceholder,
    saveBulkChanges,
    transactions,
    isLoading,
    filteredData,
    statistics,
    customerNames,
    productCodes,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,
    handleSearch,
    selectedStatuses,
    handleStatusFilter,
    bulkUpdate,
    update,
    saveOrderStatus,
    saveBulkUpdate,
  } = useTransactionsData({
    apiBasePath,
    productCodeSearchQuery: tabProductCodeSearchQueries[activeTab] ?? '',
  });

  const blockPendingAction = useCallback(() => {
    if (!saveQueue.isBusy()) {
      return false;
    }
    showNotification({
      title: 'Unsaved transaction changes',
      message:
        'Wait for inline edits to save, or resolve the save error first.',
      color: 'orange',
    });
    return true;
  }, [saveQueue]);

  const runSavedAction = useCallback(
    async (action: () => Promise<void>) => {
      if (blockPendingAction() || actionInProgress.current) {
        return;
      }
      actionInProgress.current = true;
      try {
        await action();
      } finally {
        actionInProgress.current = false;
      }
    },
    [blockPendingAction]
  );

  const handleTabChange = useCallback(
    (value: TransactionsTabValue) => {
      if (blockPendingAction() || actionInProgress.current) {
        return;
      }
      setActiveTab(value);
      const nextQuery = tabSearchQueries[value] ?? '';
      handleSearch(nextQuery);
    },
    [handleSearch, tabSearchQueries, blockPendingAction]
  );

  const handleTabSearchChange = useCallback(
    (tab: TransactionsTabValue, query: string) => {
      setTabSearchQueries((prev) => {
        if (prev[tab] === query) {
          return prev;
        }
        return { ...prev, [tab]: query };
      });

      if (activeTab === tab) {
        handleSearch(query);
      }
    },
    [activeTab, handleSearch]
  );

  const handleTabProductCodeSearchChange = useCallback(
    (tab: TransactionsTabValue, query: string) => {
      setTabProductCodeSearchQueries((prev) => {
        if (prev[tab] === query) {
          return prev;
        }
        return { ...prev, [tab]: query };
      });
    },
    []
  );

  const syncCustomerFilter = useCallback(
    (customerName: string | null) => {
      const normalizedCustomer = customerName?.trim() ?? '';
      const nextCustomer =
        normalizedCustomer.length > 0 ? normalizedCustomer : null;
      const nextProductCode = paymentsFiltersRef.current.productCode;

      paymentsFiltersRef.current = {
        customer: nextCustomer,
        productCode: nextProductCode,
      };

      const query = nextCustomer ?? '';
      setTabSearchQueries((prev) => {
        const next = { ...prev, main: query, [activeTab]: query };
        return next;
      });
      handleSearch(query);
    },
    [activeTab, handleSearch]
  );

  const syncProductCodeFilter = useCallback(
    (productCode: string | null) => {
      const normalizedProductCode = productCode?.trim() ?? '';
      const nextProductCode =
        normalizedProductCode.length > 0 ? normalizedProductCode : null;
      const nextCustomer = paymentsFiltersRef.current.customer;

      paymentsFiltersRef.current = {
        customer: nextCustomer,
        productCode: nextProductCode,
      };
      setTabProductCodeSearchQueries((prev) => {
        const next = {
          ...prev,
          main: normalizedProductCode,
          [activeTab]: normalizedProductCode,
        };
        return next;
      });
    },
    [activeTab]
  );

  const handlePaymentsModalClose = useCallback(() => {
    setShowPaymentsModal(false);
    paymentsFiltersRef.current = {
      customer: null,
      productCode: null,
    };
  }, []);

  const customerLookupBasePath =
    apiBasePath === '/api/general-merchandise' ? undefined : apiBasePath;

  const resolveCustomerIdByName = useCallback(
    async (customerName: string): Promise<string | null> => {
      const normalizedTarget = customerName.trim().toLowerCase();
      if (!normalizedTarget) {
        return null;
      }

      const response = await api.get<Record<string, unknown>[]>(
        buildApiPath(
          customerLookupBasePath,
          `/customers?search=${encodeURIComponent(customerName)}`
        )
      );

      if (!Array.isArray(response) || response.length === 0) {
        return null;
      }

      const normalize = (value: unknown) =>
        typeof value === 'string' ? value.trim().toLowerCase() : '';

      for (const customer of response) {
        const customerNameValue =
          customer['Customer Name'] ||
          customer.customerName ||
          customer.Name ||
          customer.name ||
          '';
        const businessNameValue =
          customer['Business Name'] || customer.businessName || '';

        const normalizedName = normalize(customerNameValue);
        const normalizedBusiness = normalize(businessNameValue);
        const normalizedCombined = normalizedBusiness
          ? `${normalizedName} | ${normalizedBusiness}`
          : '';

        if (
          normalizedTarget === normalizedName ||
          normalizedTarget === normalizedBusiness ||
          (normalizedCombined && normalizedTarget === normalizedCombined)
        ) {
          const idValue = customer.id ?? customer.ID;
          if (idValue !== null && idValue !== undefined) {
            return String(idValue);
          }
        }
      }

      return null;
    },
    [customerLookupBasePath]
  );

  const openCustomerDetailsByName = useCallback(
    async (customerName: string) => {
      if (blockPendingAction()) {
        return;
      }
      try {
        const customerId = await resolveCustomerIdByName(customerName);
        if (blockPendingAction()) {
          return;
        }
        if (!customerId) {
          showNotification({
            title: 'Customer not found',
            message: `No customer record found for ${customerName}.`,
            color: 'yellow',
          });
          return;
        }

        setCustomerDetailsId(customerId);
        setIsCustomerDetailsOpen(true);
      } catch (error) {
        logger.error('Failed to open customer details modal', error);
        showNotification({
          title: 'Unable to open customer',
          message: 'Please try again in a moment.',
          color: 'red',
        });
      }
    },
    [resolveCustomerIdByName, blockPendingAction]
  );

  useEffect(() => {
    if (!saveQueue.hasPendingChanges && pendingVoidedCustomer.current) {
      const customer = pendingVoidedCustomer.current;
      pendingVoidedCustomer.current = null;
      void openCustomerDetailsByName(customer);
    }
  }, [saveQueue.hasPendingChanges, openCustomerDetailsByName]);

  useEffect(() => {
    const activeQuery = tabSearchQueries[activeTab] ?? '';
    handleSearch(activeQuery);
  }, [activeTab, handleSearch, tabSearchQueries]);

  // ============================================================================
  // MODAL HOOKS - All modal state and handlers
  // ============================================================================
  const {
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    isGeneratingPackingList,
    preparePackingListGeneration,
    showDistributionModal,
    distributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,
    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  } = useTransactionModals({ transactions, bulkUpdate, apiBasePath });

  // ============================================================================
  // OPERATIONS HOOK - Cell edits and validation
  // ============================================================================
  const {
    handleCellEdited,
    draftError,
    hasDrafts,
    creatingDraft,
    retryDrafts,
    discardDrafts,
  } = useTransactionOperations({
    transactions,
    filteredData,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,
    bulkUpdate,
    update,
    saveOrderStatus,
    saveBulkUpdate,
    saveBulkChanges,
    getTransaction: saveQueue.getTransaction,
    beginDraft: saveQueue.beginValidation,
    adoptCreatedRow: saveQueue.adoptCreatedRow,
    replacePlaceholder,
    apiBasePath,
    onVoidedStatusSaved: (customer) => {
      pendingVoidedCustomer.current = customer;
    },
    onCancellationRequested:
      apiBasePath === '/api/general-merchandise'
        ? undefined
        : requestCancellation,
    onCustomerWarning: (data) => {
      setCustomerWarningData({
        ...data,
        onProceed: () => {
          data.onProceed();
          setShowCustomerWarningModal(false);
          setCustomerWarningData(null);
        },
        onCancel: () => {
          data.onCancel();
          setShowCustomerWarningModal(false);
          setCustomerWarningData(null);
        },
      });
      setShowCustomerWarningModal(true);
    },
  });

  const handleCellEditedWithPasteTracking = useCallback(
    (edit: CellEditEvent<TransactionData>) => {
      if (
        actionInProgress.current ||
        showPaymentsModal ||
        isCustomerDetailsOpen ||
        cancellationModal ||
        showDistributionModal
      ) {
        return false;
      }
      if (
        edit.columnId === 'customers' &&
        typeof edit.source === 'string' &&
        edit.source.toLowerCase().includes('paste')
      ) {
        lastCustomerPasteRef.current = {
          row: edit.row,
          time: Date.now(),
        };
      }

      const finish = saveQueue.beginValidation();
      return Promise.resolve(handleCellEdited(edit)).finally(finish);
    },
    [
      handleCellEdited,
      saveQueue,
      showPaymentsModal,
      isCustomerDetailsOpen,
      cancellationModal,
      showDistributionModal,
    ]
  );

  // ============================================================================
  // CHANGE LOG DATA
  // ============================================================================
  const { data: changeLogResponse } = useChangeLogQuery(
    {
      page: 1,
      limit: 200,
      entityType: 'transaction',
      includeFilters: false,
    },
    {
      enabled: true,
    },
    apiBasePath
  );

  const transactionUpdateMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!changeLogResponse?.logs?.length) {
      return map;
    }

    changeLogResponse.logs.forEach((log) => {
      const entityIdNumber = Number(log.entityId);
      if (!Number.isFinite(entityIdNumber)) {
        return;
      }

      const timestamp = Date.parse(log.createdAt);
      if (Number.isNaN(timestamp)) {
        return;
      }

      const existingTimestamp = map.get(entityIdNumber);
      if (!existingTimestamp || timestamp > existingTimestamp) {
        map.set(entityIdNumber, timestamp);
      }
    });

    return map;
  }, [changeLogResponse]);

  // ============================================================================
  // DERIVED DATA + GRID HELPERS
  // ============================================================================
  const {
    statusFilterOptions,
    columns,
    getCellData,
    packingListEligibleData,
    packingListColumns,
    packedTransactionsData,
    dueDateColumns,
    dueDatesData,
    getDueDateCellData,
    meaningfulTransactions,
    cappedFilteredTransactions,
    recentlyUpdatedColumns,
    recentlyUpdatedData,
    getRecentlyUpdatedCellData,
  } = useTransactionsDerivedData({
    filteredData,
    readOnlyColumns,
    customerNames,
    productCodes,
    productToShipmentMap,
    transactionUpdateMap,
    preserveLegacyStatusChoices: apiBasePath === '/api/general-merchandise',
  });

  const { dueDateFilters, filteredDueDatesData, handleDueDateFilter } =
    useDueDateFilters(dueDatesData);

  const { lookupFacebookLink } = useInvoiceCustomerLookup();

  const {
    onhandEligibleTransactions,
    onhandEligibleFilteredTransactions,
    warehousePreparedTransactions,
    warehousePreparedFilteredTransactions,
  } = useTransactionCustomerTabs(transactions, cappedFilteredTransactions);

  const handleWarehousePreparedCustomerClick = useCallback(
    async (event: CellClickEvent<TransactionData>) => {
      if (event.column.id !== 'customers') {
        return;
      }

      const customerName = event.rowData.Customers;
      if (!customerName) {
        return;
      }

      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(customerName);
        }
      } catch (error) {
        logger.warn('Failed to copy customer name to clipboard', error);
      }

      const facebookLink = lookupFacebookLink(customerName);
      if (!facebookLink) {
        showNotification({
          title: 'No Facebook Link',
          message: `No Facebook profile found for ${customerName}.`,
          color: 'yellow',
        });
        return;
      }

      const normalizedLink = facebookLink.startsWith('http')
        ? facebookLink
        : `https://${facebookLink}`;

      showNotification({
        title: 'Opening Messenger',
        message: `Copied ${customerName}. Launching Messenger...`,
        color: 'blue',
      });

      if (typeof window !== 'undefined') {
        window.open(normalizedLink, '_blank', 'noopener,noreferrer');
      }
    },
    [lookupFacebookLink]
  );

  const handleDueDatesCustomerClick = useCallback(
    async (event: CellClickEvent<DueDateGridRow>) => {
      if (event.column.id !== 'customer') {
        return;
      }

      const customerName = event.rowData.customer;
      if (!customerName) {
        return;
      }

      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(customerName);
        }
      } catch (error) {
        logger.warn('Failed to copy customer name to clipboard', error);
      }

      const facebookLink = lookupFacebookLink(customerName);
      if (!facebookLink) {
        showNotification({
          title: 'No Facebook Link',
          message: `No Facebook profile found for ${customerName}.`,
          color: 'yellow',
        });
        return;
      }

      const normalizedLink = facebookLink.startsWith('http')
        ? facebookLink
        : `https://${facebookLink}`;

      showNotification({
        title: 'Opening Messenger',
        message: `Copied ${customerName}. Launching Messenger...`,
        color: 'blue',
      });

      if (typeof window !== 'undefined') {
        window.open(normalizedLink, '_blank', 'noopener,noreferrer');
      }
    },
    [lookupFacebookLink]
  );

  const paymentsActionButton = useMemo(
    () => (
      <Button
        variant="outline"
        disabled={saveQueue.hasPendingChanges}
        onClick={() => {
          if (!blockPendingAction() && !actionInProgress.current) {
            setShowPaymentsModal(true);
          }
        }}
        radius="sm"
        style={{
          backgroundColor: '#c8e6fd',
          borderColor: '#7dd3fc',
          borderWidth: '1.5px',
          color: '#374151',
          width: '175px',
        }}
      >
        Record Payment
      </Button>
    ),
    [saveQueue.hasPendingChanges, blockPendingAction]
  );

  const defaultPaymentsCustomer = useMemo(() => {
    const candidates = cappedFilteredTransactions
      .filter((transaction) => transaction.id && transaction.Customers)
      .map((transaction) => transaction.Customers.trim())
      .filter((name) => name.length > 0);

    const unique = Array.from(new Set(candidates));
    return unique.length === 1 ? unique[0] : null;
  }, [cappedFilteredTransactions]);

  const defaultPaymentsProductCode = useMemo(() => {
    const candidates = cappedFilteredTransactions
      .filter((transaction) => transaction.id && transaction['Product Code'])
      .map((transaction) => String(transaction['Product Code']).trim())
      .filter((code) => code.length > 0);

    const unique = Array.from(new Set(candidates));
    return unique.length === 1 ? unique[0] : null;
  }, [cappedFilteredTransactions]);

  const handleCustomerCellClick = useCallback(
    async (event: CellClickEvent<TransactionData>) => {
      if (event.column.id !== 'customers') {
        return;
      }

      const now = Date.now();
      const lastPaste = lastCustomerPasteRef.current;
      if (
        lastPaste &&
        lastPaste.row === event.row &&
        now - lastPaste.time < 1000
      ) {
        lastCustomerClickRef.current = null;
        return;
      }

      const customerName = event.rowData.Customers?.trim();
      if (!customerName) {
        return;
      }

      const lastClick = lastCustomerClickRef.current;
      if (
        !lastClick ||
        lastClick.row !== event.row ||
        lastClick.columnId !== event.column.id ||
        now - lastClick.time >= 500
      ) {
        lastCustomerClickRef.current = {
          row: event.row,
          columnId: event.column.id,
          time: now,
        };
        return;
      }

      lastCustomerClickRef.current = null;

      await openCustomerDetailsByName(customerName);
    },
    [openCustomerDetailsByName]
  );

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <PageLayout fluid withPadding>
        <TableSkeleton rows={15} columns={14} />
      </PageLayout>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <Profiler id="TransactionsPage" onRender={onRenderCallback}>
      <PageLayout fluid withPadding>
        {saveQueue.error || hasDrafts ? (
          <Alert
            color="red"
            title="Unsaved transaction changes"
            role="alert"
            mb="md"
          >
            <Stack gap="xs">
              <Text size="sm">
                {saveQueue.error ??
                  draftError ??
                  (creatingDraft
                    ? 'Saving new transaction...'
                    : 'New transaction is incomplete. Complete its required fields or discard the draft.')}
              </Text>
              <Text size="sm">
                Some changes may already be saved. Review before retrying.
              </Text>
              <Group gap="sm">
                <Button
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  disabled={saveQueue.isSaving || creatingDraft}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Refresh and retry unacknowledged transaction edits? Some changes may already be saved.'
                      )
                    ) {
                      void saveQueue.retry().then(retryDrafts);
                    }
                  }}
                >
                  Refresh and Retry
                </Button>
                <Button
                  size="xs"
                  color="red"
                  variant="outline"
                  leftSection={<IconTrash size={14} />}
                  disabled={saveQueue.isSaving || creatingDraft}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Discard local transaction drafts and reload saved values? This does not undo changes already saved.'
                      )
                    ) {
                      void saveQueue.discard().then(discardDrafts);
                    }
                  }}
                >
                  Discard Drafts
                </Button>
              </Group>
            </Stack>
          </Alert>
        ) : (
          <Text size="xs" c="dimmed" role="status" aria-live="polite" mb="sm">
            {saveQueue.hasPendingChanges
              ? 'Saving changes...'
              : 'All changes saved'}
          </Text>
        )}
        {apiBasePath !== '/api/general-merchandise' && <RefundPending />}
        {cancellationModal}
        <TransactionPaymentsModal
          opened={showPaymentsModal}
          onClose={handlePaymentsModalClose}
          transactions={transactions}
          customerNames={customerNames}
          lookupFacebookLink={lookupFacebookLink}
          defaultCustomerName={defaultPaymentsCustomer}
          onCustomerChange={syncCustomerFilter}
          defaultProductCode={defaultPaymentsProductCode}
          onProductCodeChange={syncProductCodeFilter}
          apiBasePath={apiBasePath}
          selectedStatuses={selectedStatuses}
          onStatusFilter={handleStatusFilter}
        />

        <CustomerDetailsModal
          opened={isCustomerDetailsOpen}
          onClose={() => {
            setIsCustomerDetailsOpen(false);
            setCustomerDetailsId(null);
          }}
          customerId={customerDetailsId ?? ''}
          apiBasePath={apiBasePath}
          customerApiBasePath={
            apiBasePath === '/api/general-merchandise' ? '/api' : apiBasePath
          }
        />

        {/* Distribution Generation Modal */}
        <DistributionGenerationModal
          opened={showDistributionModal}
          onClose={cancelDistributionGeneration}
          onConfirm={() => runSavedAction(confirmDistributionGeneration)}
          data={distributionData}
          isGenerating={isGeneratingDistribution}
        />

        {/* Customer Warning Modal */}
        <CustomerWarningModal
          opened={showCustomerWarningModal}
          onClose={() => {
            if (customerWarningData?.onCancel) {
              customerWarningData.onCancel();
            } else {
              setShowCustomerWarningModal(false);
              setCustomerWarningData(null);
            }
          }}
          data={customerWarningData}
        />

        <TransactionsTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          statistics={statistics}
          transactions={transactions}
          cappedFilteredTransactions={cappedFilteredTransactions}
          onhandEligibleTransactions={onhandEligibleTransactions}
          onhandEligibleFilteredTransactions={
            onhandEligibleFilteredTransactions
          }
          warehousePreparedTransactions={warehousePreparedTransactions}
          warehousePreparedFilteredTransactions={
            warehousePreparedFilteredTransactions
          }
          onWarehousePreparedCustomerClick={
            handleWarehousePreparedCustomerClick
          }
          onMainCustomerClick={handleCustomerCellClick}
          columns={columns}
          getCellData={getCellData}
          onCellEdited={handleCellEditedWithPasteTracking}
          packingListEligibleData={packingListEligibleData}
          packingListColumns={packingListColumns}
          packedTransactionsData={packedTransactionsData}
          dueDateColumns={dueDateColumns}
          dueDatesData={dueDatesData}
          filteredDueDatesData={filteredDueDatesData}
          getDueDateCellData={getDueDateCellData}
          onDueDatesCustomerClick={handleDueDatesCustomerClick}
          dueDateFilters={dueDateFilters}
          onDueDateFilter={handleDueDateFilter}
          meaningfulTransactions={meaningfulTransactions}
          recentlyUpdatedColumns={recentlyUpdatedColumns}
          recentlyUpdatedData={recentlyUpdatedData}
          getRecentlyUpdatedCellData={getRecentlyUpdatedCellData}
          statusOptions={statusFilterOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={handleStatusFilter}
          onGenerateInvoice={(rows) =>
            runSavedAction(() => prepareInvoiceGeneration(rows))
          }
          onGeneratePackingList={(rows) =>
            runSavedAction(() => preparePackingListGeneration(rows))
          }
          onGenerateDistribution={(rows) =>
            runSavedAction(() => prepareDistributionGeneration(rows))
          }
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          extraActionButtons={paymentsActionButton}
          searchQueries={tabSearchQueries}
          onTabSearch={handleTabSearchChange}
          productSearchQueries={tabProductCodeSearchQueries}
          onTabProductSearch={handleTabProductCodeSearchChange}
          stretchColumnId={STRETCH_COLUMN_ID}
        />
      </PageLayout>
    </Profiler>
  );
}
