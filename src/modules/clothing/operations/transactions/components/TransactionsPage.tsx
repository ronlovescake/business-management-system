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

import React, { Profiler, useEffect, useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import type { StatCard } from '@/components/ui';
import { TransactionsLayout } from '@/components/features/transactions';
import type {
  HandsontableColumn,
  CellData,
} from '@/components/ui/HandsontableGrid';
import {
  IconReceipt,
  IconCurrencyPeso,
  IconPackage,
  IconTruck,
  IconShoppingCart,
  IconAdjustments,
  IconPercentage,
  IconCheck,
  IconUsers,
} from '@tabler/icons-react';

// Import performance tracking
import { onRenderCallback } from '@/lib/performance/monitoring';
import { logger } from '@/lib/logger';

// Import hooks
import { useTransactionsData } from '../hooks/useTransactionsData';
import { useTransactionOperations } from '../hooks/useTransactionOperations';
import { useTransactionModals } from '../hooks/useTransactionModals';

// Import modals
import {
  // InvoiceGenerationModal, // No longer used - now using SweetAlert2
  // PackingListGenerationModal, // No longer used - now using SweetAlert2
  DistributionGenerationModal,
  CustomerWarningModal,
} from './TransactionModals';

// Import service
import { TransactionService } from '../services/TransactionService';

// Import types
import type {
  TransactionData,
  ColumnIdToKey,
} from '../types/transaction.types';
import { STATUS_FILTER_OPTIONS } from '../types/transaction.types';

const DEFAULT_READ_ONLY_COLUMNS = {
  unitPrice: true,
  lineTotal: true,
  invoiceDate: true,
  packedDate: true,
  shipmentCode: true,
};

type ReadOnlyColumnFlags = typeof DEFAULT_READ_ONLY_COLUMNS;

export function TransactionsPage() {
  // ============================================================================
  // SETTINGS STATE - Fetch read-only columns only
  // ============================================================================
  const [readOnlyColumns, setReadOnlyColumns] = useState<ReadOnlyColumnFlags>(
    DEFAULT_READ_ONLY_COLUMNS
  );

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
    // Invoice modal (now using SweetAlert2)
    // showInvoiceModal, // Not needed
    // invoiceData, // Not needed
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    // confirmInvoiceGeneration, // Not needed
    // cancelInvoiceGeneration, // Not needed
    // Packing list modal (now using SweetAlert2)
    // showPackingListModal, // Not needed
    // packingListData, // Not needed
    isGeneratingPackingList,
    preparePackingListGeneration,
    // confirmPackingListGeneration, // Not needed
    // cancelPackingListGeneration, // Not needed
    // Distribution modal
    showDistributionModal,
    distributionData,
    isGeneratingDistribution,
    prepareDistributionGeneration,
    confirmDistributionGeneration,
    cancelDistributionGeneration,
    // Customer warning modal
    showCustomerWarningModal,
    customerWarningData,
    setCustomerWarningData,
    setShowCustomerWarningModal,
  } = useTransactionModals({ transactions, bulkUpdate });

  // ============================================================================
  // OPERATIONS HOOKS - Cell edits
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
  // GRID CONFIGURATION
  // ============================================================================

  // Define columns
  const statusDropdownOptions = React.useMemo(
    // stable copy for dropdowns
    () => Array.from(STATUS_FILTER_OPTIONS),
    []
  );

  const columns: HandsontableColumn[] = React.useMemo(
    () => [
      {
        title: 'ORDER DATE',
        width: 140,
        id: 'orderDate',
        align: 'center',
      },
      {
        title: 'CUSTOMERS',
        width: 500,
        id: 'customers',
        type: 'dropdown',
        dropdownValues: customerNames,
      },
      {
        title: 'PRODUCT CODE',
        width: 550,
        id: 'productCode',
        type: 'dropdown',
        dropdownValues: productCodes,
      },
      {
        title: 'QUANTITY',
        width: 140,
        id: 'quantity',
        type: 'numeric',
        align: 'center',
      },
      {
        title: 'UNIT PRICE',
        width: 140,
        id: 'unitPrice',
        type: 'numeric',
        align: 'right',
        readOnly: readOnlyColumns.unitPrice,
        numericFormat: '0,0.00',
      },
      {
        title: 'DISCOUNT',
        width: 140,
        id: 'discount',
        type: 'numeric',
        align: 'right',
        numericFormat: '0,0.00',
      },
      {
        title: 'ADJUSTMENT',
        width: 140,
        id: 'adjustment',
        type: 'numeric',
        align: 'right',
        numericFormat: '0,0.00',
      },
      {
        title: 'LINE TOTAL',
        width: 140,
        id: 'lineTotal',
        type: 'numeric',
        align: 'right',
        readOnly: readOnlyColumns.lineTotal,
        numericFormat: '0,0.00',
      },
      {
        title: 'ORDER STATUS',
        width: 160,
        id: 'orderStatus',
        type: 'dropdown',
        dropdownValues: statusDropdownOptions,
        align: 'center',
      },
      {
        title: 'NOTES',
        width: 300,
        id: 'notes',
        className: 'ht-truncate',
      },
      {
        title: 'INVOICE DATE',
        width: 160,
        id: 'invoiceDate',
        align: 'center',
        readOnly: readOnlyColumns.invoiceDate,
      },
      {
        title: 'PACKED DATE',
        width: 160,
        id: 'packedDate',
        align: 'center',
        readOnly: readOnlyColumns.packedDate,
      },
      {
        title: 'SHIPMENT CODE',
        width: 160,
        id: 'shipmentCode',
        align: 'center',
        readOnly: readOnlyColumns.shipmentCode,
      },
    ],
    [
      customerNames,
      productCodes,
      statusDropdownOptions,
      readOnlyColumns.invoiceDate,
      readOnlyColumns.lineTotal,
      readOnlyColumns.packedDate,
      readOnlyColumns.shipmentCode,
      readOnlyColumns.unitPrice,
    ]
  );

  // Map column IDs to data keys
  const idToKey: ColumnIdToKey = React.useMemo(
    () => ({
      orderDate: 'Order Date',
      customers: 'Customers',
      productCode: 'Product Code',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      discount: 'Discount',
      adjustment: 'Adjustment',
      lineTotal: 'Line Total',
      orderStatus: 'Order Status',
      notes: 'Notes',
      invoiceDate: 'Invoice Date',
      packedDate: 'Packed Date',
      shipmentCode: 'Shipment Code',
    }),
    []
  );

  // Cell content getter tailored for HandsontableGrid
  const getCellData = React.useCallback(
    ({
      column,
      rowData,
    }: {
      column: HandsontableColumn;
      row: number;
      rowData: TransactionData;
    }): CellData => {
      const key = idToKey[column.id as keyof ColumnIdToKey];
      const value = key
        ? (rowData as unknown as Record<string, unknown>)[key]
        : undefined;

      const textValue = TransactionService.sanitizeValue(value);
      const numericValue = TransactionService.sanitizeNumericValue(value);

      if (column.id === 'orderDate') {
        return { value: textValue };
      }

      if (column.id === 'customers') {
        return { value: textValue };
      }

      if (column.id === 'productCode') {
        return { value: textValue };
      }

      if (column.id === 'quantity') {
        return { value: numericValue };
      }

      if (column.id === 'discount') {
        return { value: numericValue };
      }

      if (column.id === 'adjustment') {
        return { value: numericValue };
      }

      if (column.id === 'orderStatus') {
        return { value: textValue };
      }

      if (column.id === 'notes') {
        return { value: textValue };
      }

      if (column.id === 'invoiceDate') {
        if (readOnlyColumns.invoiceDate) {
          const formattedDate =
            textValue && textValue.trim() !== ''
              ? new Date(textValue).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'Asia/Manila',
                })
              : '';
          return { value: formattedDate, readOnly: true };
        }
        return { value: textValue };
      }

      if (column.id === 'packedDate') {
        return { value: textValue, readOnly: readOnlyColumns.packedDate };
      }

      if (column.id === 'shipmentCode') {
        const currentProductCode = rowData['Product Code'];
        let displayValue = textValue;

        if (
          readOnlyColumns.shipmentCode &&
          currentProductCode &&
          productToShipmentMap[currentProductCode]
        ) {
          displayValue = productToShipmentMap[currentProductCode];
        }

        return {
          value: displayValue,
          displayValue,
          readOnly: readOnlyColumns.shipmentCode,
        };
      }

      if (column.id === 'unitPrice') {
        if (numericValue === '') {
          return {
            value: '',
            displayValue: '',
            readOnly: readOnlyColumns.unitPrice,
          };
        }

        const rawNumber = Number(String(value).replace(/,/g, ''));
        if (Number.isFinite(rawNumber) && rawNumber !== 0) {
          return {
            value: String(rawNumber),
            displayValue: rawNumber.toLocaleString(),
            readOnly: readOnlyColumns.unitPrice,
          };
        }

        return {
          value: numericValue,
          displayValue: numericValue,
          readOnly: readOnlyColumns.unitPrice,
        };
      }

      if (column.id === 'lineTotal') {
        if (numericValue === '') {
          return {
            value: '',
            displayValue: '',
            readOnly: readOnlyColumns.lineTotal,
          };
        }

        const rawNumber = Number(String(value).replace(/,/g, ''));
        if (Number.isFinite(rawNumber) && rawNumber !== 0) {
          return {
            value: String(rawNumber),
            displayValue: rawNumber.toLocaleString(),
            readOnly: readOnlyColumns.lineTotal,
          };
        }

        return {
          value: numericValue,
          displayValue: numericValue,
          readOnly: readOnlyColumns.lineTotal,
        };
      }

      return { value: textValue };
    },
    [idToKey, productToShipmentMap, readOnlyColumns]
  );

  // ============================================================================
  // STATISTICS CARDS
  // ============================================================================
  const statsCards: StatCard[] = React.useMemo(
    () => [
      {
        title: 'CUSTOMERS',
        value: statistics.uniqueCustomers,
        icon: <IconUsers size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Total Transactions',
        value: statistics.totalTransactions.toString(),
        icon: <IconReceipt size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Total Revenue',
        value: `₱${statistics.totalRevenue.toLocaleString()}`,
        icon: <IconCurrencyPeso size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'In Transit',
        value: `₱${statistics.inTransitTotal.toLocaleString()}`,
        icon: <IconPackage size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Warehouse',
        value: `₱${statistics.warehouseTotal.toLocaleString()}`,
        icon: <IconShoppingCart size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Prepared',
        value: `₱${statistics.preparedTotal.toLocaleString()}`,
        icon: <IconPercentage size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Pending Payment',
        value: `₱${statistics.pendingPaymentTotal.toLocaleString()}`,
        icon: <IconAdjustments size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Shipped',
        value: statistics.shippedOrders,
        icon: <IconTruck size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
      {
        title: 'Delivered',
        value: statistics.deliveredOrders,
        icon: <IconCheck size={18} />,
        color: 'white',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
      },
    ],
    [statistics]
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
        {/* Invoice Generation Modal - Now handled by SweetAlert2 in hook */}
        {/* 
        <InvoiceGenerationModal
          opened={showInvoiceModal}
          onClose={cancelInvoiceGeneration}
          onConfirm={confirmInvoiceGeneration}
          data={invoiceData}
          isGenerating={isGeneratingInvoice}
        />
        */}

        {/* Packing List Generation Modal - Now handled by SweetAlert2 in hook */}
        {/* 
        <PackingListGenerationModal
          opened={showPackingListModal}
          onClose={cancelPackingListGeneration}
          onConfirm={confirmPackingListGeneration}
          data={packingListData}
          isGenerating={isGeneratingPackingList}
        />
        */}

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

        {/* Main Transactions Layout */}
        <TransactionsLayout<TransactionData>
          data={transactions}
          filteredData={filteredData}
          columns={columns}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          searchPlaceholder="Search transactions by customer, product code, status, notes, or shipment code..."
          getCellData={getCellData}
          onCellEdited={handleCellEdited}
          statsCards={statsCards}
          enableCSVImport={false}
          enableCtrlF={true}
          statusOptions={statusDropdownOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={handleStatusFilter}
          onGenerateInvoice={prepareInvoiceGeneration}
          onGeneratePackingList={preparePackingListGeneration}
          onGenerateDistribution={prepareDistributionGeneration}
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          // scrollToLastNonEmptyRows removed
          stretchColumnId="notes"
        />
      </PageLayout>
    </Profiler>
  );
}
