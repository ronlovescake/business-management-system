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

import React, { Profiler, useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { onRenderCallback } from '@/lib/performance/monitoring';
import { logger } from '@/lib/logger';
import { useTransactionsData } from '../hooks/useTransactionsData';
import { useTransactionOperations } from '../hooks/useTransactionOperations';
import { useTransactionModals } from '../hooks/useTransactionModals';
import { useTransactionsDerivedData } from '../hooks/useTransactionsDerivedData';
import { useDueDateFilters } from '../hooks/useDueDateFilters';
import {
  DEFAULT_READ_ONLY_COLUMNS,
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
import { useChangeLogQuery } from '../../settings/change-log/hooks/useChangeLogQuery';

const STRETCH_COLUMN_ID = 'notes';

export function TransactionsPage() {
  // ============================================================================
  // SETTINGS STATE - Fetch read-only config
  // ============================================================================
  const [readOnlyColumns, setReadOnlyColumns] = useState<ReadOnlyColumnFlags>(
    DEFAULT_READ_ONLY_COLUMNS
  );
  const [activeTab, setActiveTab] = useState<TransactionsTabValue>('main');

  const handleTabChange = (value: TransactionsTabValue) => {
    setActiveTab(value);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/transactions');
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
  }, []);

  // ============================================================================
  // DATA HOOKS - All data fetching and filtering
  // ============================================================================
  const {
    transactions,
    isLoading,
    filteredData,
    statistics,
    customerNames,
    productCodes,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,
    searchQuery,
    handleSearch,
    selectedStatuses,
    handleStatusFilter,
    bulkUpdate,
    update,
  } = useTransactionsData();

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
  } = useTransactionModals({ transactions, bulkUpdate });

  // ============================================================================
  // OPERATIONS HOOK - Cell edits and validation
  // ============================================================================
  const { handleCellEdited } = useTransactionOperations({
    transactions,
    filteredData,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,
    bulkUpdate,
    update,
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
    }
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
    statusDropdownOptions,
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
  });

  const { dueDateFilters, filteredDueDatesData, handleDueDateFilter } =
    useDueDateFilters(dueDatesData);

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
        {/* Distribution Generation Modal */}
        <DistributionGenerationModal
          opened={showDistributionModal}
          onClose={cancelDistributionGeneration}
          onConfirm={confirmDistributionGeneration}
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
          columns={columns}
          getCellData={getCellData}
          onCellEdited={handleCellEdited}
          packingListEligibleData={packingListEligibleData}
          packingListColumns={packingListColumns}
          packedTransactionsData={packedTransactionsData}
          dueDateColumns={dueDateColumns}
          dueDatesData={dueDatesData}
          filteredDueDatesData={filteredDueDatesData}
          getDueDateCellData={getDueDateCellData}
          dueDateFilters={dueDateFilters}
          onDueDateFilter={handleDueDateFilter}
          meaningfulTransactions={meaningfulTransactions}
          recentlyUpdatedColumns={recentlyUpdatedColumns}
          recentlyUpdatedData={recentlyUpdatedData}
          getRecentlyUpdatedCellData={getRecentlyUpdatedCellData}
          statusOptions={statusDropdownOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={handleStatusFilter}
          onGenerateInvoice={prepareInvoiceGeneration}
          onGeneratePackingList={preparePackingListGeneration}
          onGenerateDistribution={prepareDistributionGeneration}
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          stretchColumnId={STRETCH_COLUMN_ID}
        />
      </PageLayout>
    </Profiler>
  );
}
