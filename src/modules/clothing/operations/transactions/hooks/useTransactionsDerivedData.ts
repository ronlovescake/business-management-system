'use client';

import { useCallback, useMemo } from 'react';
import type {
  HandsontableColumn,
  CellData,
} from '@/components/ui/HandsontableGrid';
import { TransactionService } from '../services/TransactionService';
import { DueDateService } from '../../due-dates/services/DueDateService';
import { STATUS_FILTER_OPTIONS } from '../types/transaction.types';
import type {
  TransactionData,
  ColumnIdToKey,
} from '../types/transaction.types';
import type { ReadOnlyColumnFlags } from '@/lib/transactions';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import {
  buildTransactionColumns,
  buildColumnIdToKey,
  buildPackingListColumns,
  buildDueDateColumns,
  buildRecentlyUpdatedColumns,
  formatDueInLabel,
  getDueStatusClassName,
  getDueStatusFromHours,
  parseDateToTimestamp,
  formatUpdatedLabel,
  isMeaningfulTransaction,
  capPlaceholderRows,
  type DueDateGridRow,
} from '@/lib/transactions';

interface UseTransactionsDerivedDataParams {
  filteredData: TransactionData[];
  readOnlyColumns: ReadOnlyColumnFlags;
  customerNames: string[];
  productCodes: string[];
  productToShipmentMap: Record<string, string>;
  transactionUpdateMap: Map<number, number>;
}

interface UseTransactionsDerivedDataResult {
  statusDropdownOptions: string[];
  columns: HandsontableColumn[];
  idToKey: ColumnIdToKey;
  getCellData: ({
    column,
    rowData,
    row,
  }: {
    column: HandsontableColumn;
    rowData: TransactionData;
    row: number;
  }) => CellData;
  packingListEligibleData: TransactionData[];
  packingListColumns: HandsontableColumn[];
  packedTransactionsData: TransactionData[];
  dueDateColumns: HandsontableColumn[];
  dueDatesData: DueDateGridRow[];
  getDueDateCellData: ({
    column,
    rowData,
  }: {
    column: HandsontableColumn;
    rowData: DueDateGridRow;
  }) => CellData;
  meaningfulTransactions: TransactionData[];
  cappedFilteredTransactions: TransactionData[];
  recentlyUpdatedColumns: HandsontableColumn[];
  recentlyUpdatedData: TransactionData[];
  getRecentlyUpdatedCellData: ({
    column,
    rowData,
    row,
  }: {
    column: HandsontableColumn;
    rowData: TransactionData;
    row: number;
  }) => CellData;
}

export function useTransactionsDerivedData({
  filteredData,
  readOnlyColumns,
  customerNames,
  productCodes,
  productToShipmentMap,
  transactionUpdateMap,
}: UseTransactionsDerivedDataParams): UseTransactionsDerivedDataResult {
  const statusDropdownOptions = useMemo(
    () => Array.from(STATUS_FILTER_OPTIONS),
    []
  );

  const columns = useMemo(
    () =>
      buildTransactionColumns({
        customerNames,
        productCodes,
        readOnlyColumns,
        statusDropdownOptions,
      }),
    [customerNames, productCodes, readOnlyColumns, statusDropdownOptions]
  );

  const idToKey = useMemo(() => buildColumnIdToKey(), []);

  const getCellData = useCallback(
    ({
      column,
      rowData,
      row: _row,
    }: {
      column: HandsontableColumn;
      rowData: TransactionData;
      row: number;
    }): CellData => {
      const key = idToKey[column.id as keyof ColumnIdToKey];
      const value = key ? rowData[key] : undefined;

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
        return { value: numericValue, readOnly: true };
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

  const packingListEligibleData = useMemo(() => {
    // ========================================================================
    // ⚠️ STATUS NORMALIZATION
    // ========================================================================
    // Normalize order status comparisons to avoid casing/whitespace drift in
    // filtered transaction views (e.g. "Prepared" vs "prepared").
    // ========================================================================
    const customersWithEligiblePrepared = new Set(
      filteredData
        .filter((transaction) => {
          const status = normalizeOrderStatus(transaction['Order Status']);
          const lineTotal = Number(transaction['Line Total']) || 0;
          return status === 'prepared' && lineTotal <= 50;
        })
        .map((transaction) => transaction.Customers)
        .filter(Boolean)
    );

    return filteredData
      .filter((transaction) => {
        const status = normalizeOrderStatus(transaction['Order Status']);
        const lineTotal = Number(transaction['Line Total']) || 0;
        const customerName = transaction.Customers;

        if (status === 'prepared' && lineTotal <= 50) {
          return true;
        }

        if (
          status === 'on-hold' &&
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

  const packingListColumns = useMemo(
    () => buildPackingListColumns(columns),
    [columns]
  );

  const packedTransactionsData = useMemo(() => {
    return filteredData
      .filter((transaction) => {
        const packedDate = transaction['Packed Date'];
        return packedDate && packedDate.trim() !== '';
      })
      .slice()
      .sort((a, b) => {
        const dateA = a['Packed Date'] || '';
        const dateB = b['Packed Date'] || '';
        return dateB.localeCompare(dateA);
      });
  }, [filteredData]);

  const dueDateColumns = useMemo(() => buildDueDateColumns(), []);

  const dueDatesData = useMemo<DueDateGridRow[]>(() => {
    // ========================================================================
    // ⚠️ STATUS NORMALIZATION
    // ========================================================================
    // Due-date eligibility depends on the prepared status; normalize before
    // comparing to avoid silent mismatches.
    // ========================================================================
    return filteredData
      .filter((transaction) => {
        const invoiceDate = transaction['Invoice Date'];
        const lineTotal = Number(transaction['Line Total']) || 0;
        const status = normalizeOrderStatus(transaction['Order Status']);

        return (
          Boolean(invoiceDate && invoiceDate.trim()) &&
          lineTotal > 0 &&
          status === 'prepared'
        );
      })
      .map((transaction, index) => {
        const invoiceDate = transaction['Invoice Date'] || '';
        const dueDateRaw = DueDateService.calculateDueDate(invoiceDate);
        const dueInHours = dueDateRaw
          ? DueDateService.calculateHoursUntilDue(dueDateRaw)
          : 0;
        const dueStatus = getDueStatusFromHours(dueInHours);

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
          dueStatus,
          notes: transaction.Notes || '',
          done: 'No',
        };
      })
      .sort((a, b) => a.customer.localeCompare(b.customer));
  }, [filteredData]);

  const getDueDateCellData = useCallback(
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

      if (column.id === 'dueIn') {
        const className = getDueStatusClassName(rowData.dueStatus);

        return {
          value: rowData.dueIn,
          readOnly: true,
          className,
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

  const meaningfulTransactions = useMemo(
    () => filteredData.filter(isMeaningfulTransaction),
    [filteredData]
  );

  const cappedFilteredTransactions = useMemo(
    () => capPlaceholderRows(filteredData),
    [filteredData]
  );

  const parseLatestTimestamp = useCallback(
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
    [transactionUpdateMap]
  );

  const recentlyUpdatedData = useMemo(() => {
    return meaningfulTransactions
      .slice()
      .sort((a, b) => parseLatestTimestamp(b) - parseLatestTimestamp(a));
  }, [meaningfulTransactions, parseLatestTimestamp]);

  const recentlyUpdatedColumns = useMemo(
    () => buildRecentlyUpdatedColumns(columns),
    [columns]
  );

  const getRecentlyUpdatedCellData = useCallback(
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
          value: formatUpdatedLabel(parseLatestTimestamp(rowData)),
          readOnly: true,
        };
      }

      const cellData = getCellData({ column, rowData, row });
      return {
        ...cellData,
        readOnly: true,
      };
    },
    [getCellData, parseLatestTimestamp]
  );

  return {
    statusDropdownOptions,
    columns,
    idToKey,
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
  };
}
