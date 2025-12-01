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
import { Tabs } from '@mantine/core';
import { StatsCardGrid } from '@/components/ui/StatsCardGrid';
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
import { DueDateService } from '../../due-dates/services/DueDateService';
import { useChangeLogQuery } from '../../settings/change-log/hooks/useChangeLogQuery';

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

interface DueDateGridRow {
  id: string;
  customer: string;
  productCode: string;
  quantity: number | string | null;
  unitPrice: number | string | null;
  lineTotal: number | string | null;
  invoiceDate: string;
  dueDate: string;
  dueIn: string;
  dueInHours: number;
  notes: string;
  done: string;
}

const DUE_DATE_FILTER_OPTIONS = [
  'Show All',
  'Due in 2 days',
  'Due in 1 day',
  'Due today',
  'Past due',
] as const;

const formatDueInLabel = (hours: number): string => {
  if (!Number.isFinite(hours)) {
    return '';
  }
  if (hours === 0) {
    return 'Due now';
  }

  const absHours = Math.abs(hours);
  const hourLabel = absHours === 1 ? 'hour' : 'hours';

  if (hours < 0) {
    return `${absHours} ${hourLabel} overdue`;
  }

  return `in ${absHours} ${hourLabel}`;
};

export function TransactionsPage() {
  // ============================================================================
  // SETTINGS STATE - Fetch read-only columns only
  // ============================================================================
  const [readOnlyColumns, setReadOnlyColumns] = useState<ReadOnlyColumnFlags>(
    DEFAULT_READ_ONLY_COLUMNS
  );
  const [activeTab, setActiveTab] = useState<
    'main' | 'packing-list' | 'packed' | 'due-dates' | 'recently-updated'
  >('main');
  const [dueDateFilters, setDueDateFilters] = useState<Set<string>>(
    () => new Set(DUE_DATE_FILTER_OPTIONS)
  );

  const handleTabChange = (value: string | null) => {
    if (value === 'packing-list') {
      setActiveTab('packing-list');
    } else if (value === 'packed') {
      setActiveTab('packed');
    } else if (value === 'due-dates') {
      setActiveTab('due-dates');
    } else if (value === 'recently-updated') {
      setActiveTab('recently-updated');
    } else {
      setActiveTab('main');
    }
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
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Total Transactions',
        value: statistics.totalTransactions,
        icon: <IconReceipt size={18} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Total Revenue',
        value: `₱${statistics.totalRevenue.toLocaleString()}`,
        icon: <IconCurrencyPeso size={18} />,
        color: 'orange',
        backgroundColor: '#fd7e14',
      },
      {
        title: 'In Transit',
        value: `₱${statistics.inTransitTotal.toLocaleString()}`,
        icon: <IconPackage size={18} />,
        color: 'purple',
        backgroundColor: '#9775fa',
      },
      {
        title: 'Warehouse',
        value: `₱${statistics.warehouseTotal.toLocaleString()}`,
        icon: <IconShoppingCart size={18} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Prepared',
        value: `₱${statistics.preparedTotal.toLocaleString()}`,
        icon: <IconPercentage size={18} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Pending Payment',
        value: `₱${statistics.pendingPaymentTotal.toLocaleString()}`,
        icon: <IconAdjustments size={18} />,
        color: 'orange',
        backgroundColor: '#fd7e14',
      },
      {
        title: 'Adjustment',
        value: `₱${statistics.adjustmentTotal.toLocaleString()}`,
        icon: <IconAdjustments size={18} />,
        color: 'purple',
        backgroundColor: '#9775fa',
      },
      {
        title: 'Line Total',
        value: `₱${statistics.lineTotalExcludingCancelled.toLocaleString()}`,
        icon: <IconCheck size={18} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
    ],
    [statistics]
  );

  const packingListEligibleData = React.useMemo(() => {
    const customersWithEligiblePrepared = new Set(
      filteredData
        .filter((transaction) => {
          const status = transaction['Order Status'];
          const lineTotal = Number(transaction['Line Total']) || 0;
          return status === 'Prepared' && lineTotal <= 50;
        })
        .map((transaction) => transaction.Customers)
        .filter(Boolean)
    );

    return filteredData
      .filter((transaction) => {
        const status = transaction['Order Status'];
        const lineTotal = Number(transaction['Line Total']) || 0;
        const customerName = transaction.Customers;

        if (status === 'Prepared' && lineTotal <= 50) {
          return true;
        }

        if (
          status === 'On-Hold' &&
          customerName &&
          customersWithEligiblePrepared.has(customerName)
        ) {
          return true;
        }

        return false;
      })
      .slice()
      .sort((a, b) => {
        const nameA = (a.Customers || '').toLowerCase();
        const nameB = (b.Customers || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [filteredData]);

  const packingListColumns = React.useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        readOnly: true,
      })),
    [columns]
  );

  const packedTransactionsData = React.useMemo(() => {
    return filteredData
      .filter((transaction) => {
        const packedDate = transaction['Packed Date'];
        return packedDate && packedDate.trim() !== '';
      })
      .slice()
      .sort((a, b) => {
        const dateA = a['Packed Date'] || '';
        const dateB = b['Packed Date'] || '';
        return dateB.localeCompare(dateA); // Most recent first
      });
  }, [filteredData]);

  const dueDateColumns: HandsontableColumn[] = React.useMemo(
    () => [
      {
        title: 'CUSTOMER',
        width: 380,
        id: 'customer',
        readOnly: true,
      },
      {
        title: 'PRODUCT CODE',
        width: 420,
        id: 'productCode',
        readOnly: true,
      },
      {
        title: 'QUANTITY',
        width: 120,
        id: 'quantity',
        type: 'numeric',
        align: 'center',
        readOnly: true,
      },
      {
        title: 'UNIT PRICE',
        width: 140,
        id: 'unitPrice',
        type: 'numeric',
        align: 'right',
        readOnly: true,
      },
      {
        title: 'LINE TOTAL',
        width: 160,
        id: 'lineTotal',
        type: 'numeric',
        align: 'right',
        readOnly: true,
      },
      {
        title: 'INVOICE DATE',
        width: 160,
        id: 'invoiceDate',
        align: 'center',
        readOnly: true,
      },
      {
        title: 'DUE DATE',
        width: 160,
        id: 'dueDate',
        align: 'center',
        readOnly: true,
      },
      {
        title: 'DUE IN',
        width: 140,
        id: 'dueIn',
        align: 'center',
        readOnly: true,
      },
      {
        title: 'NOTES',
        width: 360,
        id: 'notes',
        className: 'ht-truncate',
        readOnly: true,
      },
      {
        title: 'DONE',
        width: 120,
        id: 'done',
        align: 'center',
        readOnly: true,
      },
    ],
    []
  );

  const recentlyUpdatedColumns: HandsontableColumn[] = React.useMemo(() => {
    const clonedColumns = columns.map((column) => ({
      ...column,
      readOnly: true,
    }));
    const shipmentIndex = clonedColumns.findIndex(
      (column) => column.id === 'shipmentCode'
    );
    const updatedColumn: HandsontableColumn = {
      title: 'DATE/TIME UPDATED',
      width: 220,
      id: 'updatedAt',
      align: 'center',
      readOnly: true,
    };

    if (shipmentIndex === -1) {
      return [...clonedColumns, updatedColumn];
    }

    return [
      ...clonedColumns.slice(0, shipmentIndex + 1),
      updatedColumn,
      ...clonedColumns.slice(shipmentIndex + 1),
    ];
  }, [columns]);

  const dueDatesData = React.useMemo<DueDateGridRow[]>(() => {
    return filteredData
      .filter((transaction) => {
        const invoiceDate = transaction['Invoice Date'];
        const lineTotal = Number(transaction['Line Total']) || 0;
        const status = transaction['Order Status'];

        return (
          Boolean(invoiceDate && invoiceDate.trim()) &&
          lineTotal > 0 &&
          status === 'Prepared'
        );
      })
      .map((transaction, index) => {
        const invoiceDate = transaction['Invoice Date'] || '';
        const dueDateRaw = DueDateService.calculateDueDate(invoiceDate);
        const dueInHours = dueDateRaw
          ? DueDateService.calculateHoursUntilDue(dueDateRaw)
          : 0;

        return {
          id: transaction.id ? `due-${transaction.id}` : `due-${index}`,
          customer: transaction.Customers || '',
          productCode: transaction['Product Code'] || '',
          quantity: transaction.Quantity ?? null,
          unitPrice: transaction['Unit Price'] ?? null,
          lineTotal: transaction['Line Total'] ?? null,
          invoiceDate: invoiceDate
            ? DueDateService.formatDate(invoiceDate)
            : '',
          dueDate: dueDateRaw ? DueDateService.formatDate(dueDateRaw) : '',
          dueIn: formatDueInLabel(dueInHours),
          dueInHours,
          notes: transaction.Notes || '',
          done: 'No',
        };
      })
      .sort((a, b) => a.customer.localeCompare(b.customer));
  }, [filteredData]);

  const filteredDueDatesData = React.useMemo(() => {
    if (dueDateFilters.size === 0 || dueDateFilters.has('Show All')) {
      return dueDatesData;
    }

    return dueDatesData.filter((row) => {
      const hours = row.dueInHours;

      const matchesTwoDays =
        dueDateFilters.has('Due in 2 days') && hours > 24 && hours <= 48;
      const matchesOneDay =
        dueDateFilters.has('Due in 1 day') && hours > 0 && hours <= 24;
      const matchesToday =
        dueDateFilters.has('Due today') && hours <= 0 && hours >= -24;
      const matchesPastDue = dueDateFilters.has('Past due') && hours < -24;

      return matchesTwoDays || matchesOneDay || matchesToday || matchesPastDue;
    });
  }, [dueDateFilters, dueDatesData]);

  const handleDueDateFilter = React.useCallback((filter: string) => {
    setDueDateFilters((prev) => {
      const next = new Set(prev);

      if (filter === 'Show All') {
        if (next.has('Show All')) {
          return new Set();
        }
        return new Set(DUE_DATE_FILTER_OPTIONS);
      }

      next.delete('Show All');
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      const areAllIndividualSelected = DUE_DATE_FILTER_OPTIONS.slice(1).every(
        (option) => next.has(option)
      );

      if (areAllIndividualSelected) {
        return new Set(DUE_DATE_FILTER_OPTIONS);
      }

      return next;
    });
  }, []);

  const getDueDateCellData = React.useCallback(
    ({
      column,
      rowData,
    }: {
      column: HandsontableColumn;
      rowData: DueDateGridRow;
    }): CellData => {
      if (column.id === 'quantity') {
        return { value: rowData.quantity ?? '', readOnly: true };
      }

      if (column.id === 'unitPrice' || column.id === 'lineTotal') {
        const rawValue = rowData[column.id as 'unitPrice' | 'lineTotal'];

        if (rawValue === null || rawValue === undefined) {
          return { value: '', displayValue: '', readOnly: true };
        }

        const sanitizedValue = String(rawValue).trim();
        if (sanitizedValue === '') {
          return { value: '', displayValue: '', readOnly: true };
        }

        const numeric = Number(sanitizedValue.replace(/,/g, ''));
        if (Number.isFinite(numeric) && numeric !== 0) {
          return {
            value: String(numeric),
            displayValue: numeric.toLocaleString(),
            readOnly: true,
          };
        }

        return {
          value: sanitizedValue,
          displayValue: sanitizedValue,
          readOnly: true,
        };
      }

      const fallbackValue = rowData[column.id as keyof DueDateGridRow] ?? '';

      return {
        value: fallbackValue,
        readOnly: true,
      };
    },
    []
  );

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

  const parseDateToTimestamp = React.useCallback((value: string) => {
    if (!value || value.trim() === '') {
      return 0;
    }

    const trimmedValue = value.trim();

    const attempts = [trimmedValue];

    if (!/[zZ]|GMT|UTC|[+-]\d{2}:?\d{2}/.test(trimmedValue)) {
      attempts.push(`${trimmedValue} GMT+0800`);

      if (!/[0-9]{1,2}:[0-9]{2}/.test(trimmedValue)) {
        attempts.push(`${trimmedValue}T00:00:00+08:00`);
      }
    }

    for (const candidate of attempts) {
      const timestamp = Date.parse(candidate);
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
    }

    return 0;
  }, []);

  const getLatestTransactionTimestamp = React.useCallback(
    (transaction: TransactionData) => {
      const transactionId =
        typeof transaction.id === 'number' ? transaction.id : 0;
      const changeLogTimestamp =
        (transactionId && transactionUpdateMap.get(transactionId)) || 0;

      if (changeLogTimestamp) {
        return changeLogTimestamp;
      }

      const timestamps = [
        parseDateToTimestamp(transaction['Invoice Date']),
        parseDateToTimestamp(transaction['Packed Date']),
        parseDateToTimestamp(transaction['Order Date']),
      ].filter((value): value is number => Boolean(value));

      if (timestamps.length === 0) {
        return transactionId;
      }

      return Math.max(...timestamps);
    },
    [parseDateToTimestamp, transactionUpdateMap]
  );

  const getTransactionUpdatedLabel = React.useCallback(
    (transaction: TransactionData) => {
      const timestamp = getLatestTransactionTimestamp(transaction);
      if (!timestamp) {
        return '';
      }

      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(timestamp));
    },
    [getLatestTransactionTimestamp]
  );

  const isMeaningfulTransaction = React.useCallback(
    (transaction: TransactionData) => {
      const hasCustomer = Boolean(transaction.Customers?.trim());
      const hasProduct = Boolean(transaction['Product Code']?.trim());
      const hasOrderDate = Boolean(transaction['Order Date']?.trim());
      const hasShipmentCode = Boolean(
        transaction['Shipment Code'] &&
          transaction['Shipment Code']?.trim() !== '' &&
          transaction['Shipment Code'] !== '-'
      );
      const hasQuantity = Boolean(
        transaction.Quantity && transaction.Quantity > 0
      );
      const hasNotes = Boolean(transaction.Notes?.trim());

      return (
        hasCustomer ||
        hasProduct ||
        hasOrderDate ||
        hasShipmentCode ||
        hasQuantity ||
        hasNotes
      );
    },
    []
  );

  const meaningfulTransactions = React.useMemo(
    () => filteredData.filter(isMeaningfulTransaction),
    [filteredData, isMeaningfulTransaction]
  );

  const MAX_PLACEHOLDER_ROWS = 20;
  const cappedFilteredTransactions = React.useMemo(() => {
    let placeholdersShown = 0;
    return filteredData.filter((transaction) => {
      if (isMeaningfulTransaction(transaction)) {
        return true;
      }
      if (placeholdersShown < MAX_PLACEHOLDER_ROWS) {
        placeholdersShown += 1;
        return true;
      }
      return false;
    });
  }, [filteredData, isMeaningfulTransaction]);

  const recentlyUpdatedData = React.useMemo(() => {
    return meaningfulTransactions
      .slice()
      .sort(
        (a, b) =>
          getLatestTransactionTimestamp(b) - getLatestTransactionTimestamp(a)
      );
  }, [meaningfulTransactions, getLatestTransactionTimestamp]);

  const getRecentlyUpdatedCellData = React.useCallback(
    ({
      column,
      rowData,
      row,
    }: {
      column: HandsontableColumn;
      rowData: TransactionData;
      row: number;
    }): CellData => {
      if (column.id === 'updatedAt') {
        return {
          value: getTransactionUpdatedLabel(rowData),
          readOnly: true,
        };
      }

      const cellData = getCellData({ column, row, rowData });
      return {
        ...cellData,
        readOnly: true,
      };
    },
    [getCellData, getTransactionUpdatedLabel]
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

        <Tabs value={activeTab} onChange={handleTabChange} defaultValue="main">
          {statsCards.length > 0 && (
            <StatsCardGrid
              cards={statsCards}
              variant="vibrant"
              minCardWidth={220}
              spacing="md"
            />
          )}

          <Tabs.List mt="sm">
            <Tabs.Tab value="main">Main Transactions</Tabs.Tab>
            <Tabs.Tab value="packing-list">Packing List</Tabs.Tab>
            <Tabs.Tab value="packed">Packed</Tabs.Tab>
            <Tabs.Tab value="due-dates">Due Dates</Tabs.Tab>
            <Tabs.Tab value="recently-updated">Recently Updated</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="main" pt="md">
            {/* Main Transactions Layout */}
            <TransactionsLayout<TransactionData>
              data={transactions}
              filteredData={cappedFilteredTransactions}
              columns={columns}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              searchPlaceholder="Search transactions by customer, product code, status, notes, or shipment code..."
              getCellData={getCellData}
              onCellEdited={handleCellEdited}
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
          </Tabs.Panel>

          <Tabs.Panel value="packing-list" pt="md">
            <TransactionsLayout<TransactionData>
              data={packingListEligibleData}
              filteredData={packingListEligibleData}
              columns={packingListColumns}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              searchPlaceholder="Search packing list eligible transactions..."
              getCellData={getCellData}
              enableCSVImport={false}
              enableCtrlF={true}
              statusOptions={[]}
              showActionButtons={false}
              stretchColumnId="notes"
            />
          </Tabs.Panel>

          <Tabs.Panel value="packed" pt="md">
            <TransactionsLayout<TransactionData>
              data={packedTransactionsData}
              filteredData={packedTransactionsData}
              columns={packingListColumns}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              searchPlaceholder="Search packed transactions..."
              getCellData={getCellData}
              enableCSVImport={false}
              enableCtrlF={true}
              statusOptions={[]}
              showActionButtons={false}
              stretchColumnId="notes"
            />
          </Tabs.Panel>

          <Tabs.Panel value="due-dates" pt="md">
            <TransactionsLayout<DueDateGridRow>
              data={dueDatesData}
              filteredData={filteredDueDatesData}
              columns={dueDateColumns}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              searchPlaceholder="Search due dates by customer or product code..."
              getCellData={getDueDateCellData}
              enableCSVImport={false}
              enableCtrlF={true}
              statusOptions={Array.from(DUE_DATE_FILTER_OPTIONS)}
              selectedStatuses={dueDateFilters}
              onStatusFilter={handleDueDateFilter}
              showActionButtons={false}
              stretchColumnId="notes"
            />
          </Tabs.Panel>

          <Tabs.Panel value="recently-updated" pt="md">
            <TransactionsLayout<TransactionData>
              data={meaningfulTransactions}
              filteredData={recentlyUpdatedData}
              columns={recentlyUpdatedColumns}
              searchQuery={searchQuery}
              onSearch={handleSearch}
              searchPlaceholder="Search recently updated transactions..."
              getCellData={getRecentlyUpdatedCellData}
              onCellEdited={handleCellEdited}
              enableCSVImport={false}
              enableCtrlF={true}
              showActionButtons={false}
              statusOptions={statusDropdownOptions}
              selectedStatuses={selectedStatuses}
              onStatusFilter={handleStatusFilter}
              onGenerateInvoice={prepareInvoiceGeneration}
              onGeneratePackingList={preparePackingListGeneration}
              onGenerateDistribution={prepareDistributionGeneration}
              isGeneratingInvoice={isGeneratingInvoice}
              isGeneratingPackingList={isGeneratingPackingList}
              isGeneratingDistribution={isGeneratingDistribution}
              stretchColumnId="notes"
            />
          </Tabs.Panel>
        </Tabs>
      </PageLayout>
    </Profiler>
  );
}
