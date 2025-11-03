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

import React, { Profiler } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import type { StatCard } from '@/components/ui';
import { TransactionsLayout } from '@/components/features/transactions';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { GridCellKind } from '@glideapps/glide-data-grid';
import { allCells } from '@glideapps/glide-data-grid-cells';
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

// Import hooks
import { useTransactionsData } from '../hooks/useTransactionsData';
import { useTransactionOperations } from '../hooks/useTransactionOperations';
import { useTransactionModals } from '../hooks/useTransactionModals';

// Import modals
import {
  InvoiceGenerationModal,
  PackingListGenerationModal,
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

export function TransactionsPage() {
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
    // Invoice modal
    showInvoiceModal,
    invoiceData,
    isGeneratingInvoice,
    prepareInvoiceGeneration,
    confirmInvoiceGeneration,
    cancelInvoiceGeneration,
    // Packing list modal
    showPackingListModal,
    packingListData,
    isGeneratingPackingList,
    preparePackingListGeneration,
    confirmPackingListGeneration,
    cancelPackingListGeneration,
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
  // OPERATIONS HOOKS - Cell edits, CSV import, add rows
  // ============================================================================
  const { handleCellEdited, handleAdd10Rows, handleCSVImport } =
    useTransactionOperations({
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

  // CSV file state (for UI)
  const [csvFile, setCsvFile] = React.useState<File | null>(null);

  // ============================================================================
  // GRID CONFIGURATION
  // ============================================================================

  // Define columns
  const columns: GridColumn[] = React.useMemo(
    () => [
      { title: 'ORDER DATE', width: 180, id: 'orderDate' },
      { title: 'CUSTOMERS', width: 500, id: 'customers' },
      { title: 'PRODUCT CODE', width: 550, id: 'productCode' },
      { title: 'QUANTITY', width: 180, id: 'quantity' },
      { title: 'UNIT PRICE', width: 180, id: 'unitPrice' },
      { title: 'DISCOUNT', width: 180, id: 'discount' },
      { title: 'ADJUSTMENT', width: 180, id: 'adjustment' },
      { title: 'LINE TOTAL', width: 200, id: 'lineTotal' },
      { title: 'ORDER STATUS', width: 200, id: 'orderStatus' },
      { title: 'NOTES', width: 300, grow: 1, id: 'notes' },
      { title: 'INVOICE DATE', width: 200, id: 'invoiceDate' },
      { title: 'PACKED DATE', width: 200, id: 'packedDate' },
      { title: 'SHIPMENT CODE', width: 200, id: 'shipmentCode' },
    ],
    []
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

  // Cell content getter
  const getCellContent = React.useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = filteredData[row] as TransactionData | undefined;
      const column = columns[col];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        } as GridCell;
      }

      const key = idToKey[column.id as string];
      const value = item[key];

      // Helper to sanitize values - ensures all values are strings, never undefined
      const sanitize = (val: unknown): string => {
        const result = TransactionService.sanitizeValue(val);
        return result ?? ''; // Extra safety: ensure never undefined
      };
      const sanitizeNumeric = (val: unknown): string => {
        const result = TransactionService.sanitizeNumericValue(val);
        return result ?? ''; // Extra safety: ensure never undefined
      };

      // Order Date - editable
      if (column.id === 'orderDate') {
        return {
          kind: GridCellKind.Text,
          data: sanitize(value),
          displayData: sanitize(value),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Customers - dropdown
      if (column.id === 'customers') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitize(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitize(value),
            allowedValues: customerNames,
          },
        } as GridCell;
      }

      // Product Code - dropdown
      if (column.id === 'productCode') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitize(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitize(value),
            allowedValues: productCodes,
          },
        } as GridCell;
      }

      // Quantity - editable
      if (column.id === 'quantity') {
        return {
          kind: GridCellKind.Text,
          data: sanitizeNumeric(value),
          displayData: sanitizeNumeric(value),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Discount - editable
      if (column.id === 'discount') {
        return {
          kind: GridCellKind.Text,
          data: sanitizeNumeric(value),
          displayData: sanitizeNumeric(value),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Adjustment - editable
      if (column.id === 'adjustment') {
        return {
          kind: GridCellKind.Text,
          data: sanitizeNumeric(value),
          displayData: sanitizeNumeric(value),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Order Status - dropdown
      if (column.id === 'orderStatus') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitize(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitize(value),
            allowedValues: [
              'In Transit',
              'Warehouse',
              'Prepared',
              'Ready For Dispatch',
              'Checked Out',
              'Lalamove',
              'On-Hold',
              'Pending Payment',
              'Shipped',
              'Cancelled',
            ],
          },
        } as GridCell;
      }

      // Notes - editable
      if (column.id === 'notes') {
        return {
          kind: GridCellKind.Text,
          data: sanitize(value),
          displayData: sanitize(value),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Shipment Code - auto-populated, read-only
      if (column.id === 'shipmentCode') {
        const currentProductCode = item['Product Code'];
        let displayValue = sanitize(value);

        if (currentProductCode && productToShipmentMap[currentProductCode]) {
          displayValue = productToShipmentMap[currentProductCode];
        }

        return {
          kind: GridCellKind.Text,
          data: displayValue,
          displayData: displayValue,
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      // Unit Price - calculated, read-only
      if (column.id === 'unitPrice') {
        const displayValue =
          typeof value === 'number' && value !== 0
            ? value.toLocaleString()
            : '';
        const dataValue =
          typeof value === 'number' && value !== 0 ? String(value) : '';

        return {
          kind: GridCellKind.Text,
          data: dataValue || '',
          displayData: displayValue || '',
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      // Line Total - calculated, read-only
      if (column.id === 'lineTotal') {
        const displayValue =
          typeof value === 'number' && value !== 0
            ? value.toLocaleString()
            : '';
        const dataValue =
          typeof value === 'number' && value !== 0 ? String(value) : '';

        return {
          kind: GridCellKind.Text,
          data: dataValue || '',
          displayData: displayValue || '',
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      // Invoice Date - system-managed, read-only
      if (column.id === 'invoiceDate') {
        return {
          kind: GridCellKind.Text,
          data: sanitize(value),
          displayData: sanitize(value),
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      // Numeric columns - show blank if 0
      if (typeof value === 'number') {
        const displayValue = value === 0 ? '' : (value.toLocaleString() ?? '');
        const dataValue = value === 0 ? '' : (String(value) ?? '');

        return {
          kind: GridCellKind.Text,
          data: dataValue || '', // Ensure never undefined
          displayData: displayValue || '', // Ensure never undefined
          allowOverlay: false,
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: sanitize(value) || '', // Ensure never undefined
        displayData: sanitize(value) || '', // Ensure never undefined
        allowOverlay: false,
      } as GridCell;
    },
    [
      filteredData,
      columns,
      idToKey,
      customerNames,
      productCodes,
      productToShipmentMap,
    ]
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
        title: 'LALAMOVE',
        value: statistics.lalamoveOrders,
        icon: <IconTruck size={18} />,
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
        {/* Invoice Generation Modal */}
        <InvoiceGenerationModal
          opened={showInvoiceModal}
          onClose={cancelInvoiceGeneration}
          onConfirm={confirmInvoiceGeneration}
          data={invoiceData}
          isGenerating={isGeneratingInvoice}
        />

        {/* Packing List Generation Modal */}
        <PackingListGenerationModal
          opened={showPackingListModal}
          onClose={cancelPackingListGeneration}
          onConfirm={confirmPackingListGeneration}
          data={packingListData}
          isGenerating={isGeneratingPackingList}
        />

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
        <TransactionsLayout
          data={transactions as unknown as Item[]}
          filteredData={filteredData as unknown as Item[]}
          columns={columns}
          searchQuery={searchQuery}
          onSearch={handleSearch}
          searchPlaceholder="Search transactions by customer, product code, status, notes, or shipment code..."
          getCellContent={getCellContent}
          onCellEdited={handleCellEdited}
          statsCards={statsCards}
          enableCSVImport={true}
          enableCtrlF={true}
          csvFile={csvFile}
          onFileChange={setCsvFile}
          onCSVImport={handleCSVImport}
          customRenderers={
            allCells as unknown as readonly Record<string, unknown>[]
          }
          onAddRows={handleAdd10Rows}
          statusOptions={Array.from(STATUS_FILTER_OPTIONS)}
          selectedStatuses={selectedStatuses}
          onStatusFilter={handleStatusFilter}
          onGenerateInvoice={
            prepareInvoiceGeneration as unknown as (
              data: Item[]
            ) => Promise<void>
          }
          onGeneratePackingList={
            preparePackingListGeneration as unknown as (
              data: Item[]
            ) => Promise<void>
          }
          onGenerateDistribution={
            prepareDistributionGeneration as unknown as (
              data: Item[]
            ) => Promise<void>
          }
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
        />
      </PageLayout>
    </Profiler>
  );
}
