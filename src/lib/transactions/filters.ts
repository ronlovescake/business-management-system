import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';
import type { DueDateGridRow } from './types';
import { MAX_PLACEHOLDER_ROWS } from './constants';

export const isMeaningfulTransaction = (
  transaction: TransactionData
): boolean => {
  const hasCustomer = Boolean(transaction.Customers?.trim());
  const hasProduct = Boolean(transaction['Product Code']?.trim());
  const hasOrderDate = Boolean(transaction['Order Date']?.trim());
  const hasShipmentCode = Boolean(
    transaction['Shipment Code'] &&
      transaction['Shipment Code']?.trim() !== '' &&
      transaction['Shipment Code'] !== '-'
  );
  const hasQuantity = Boolean(transaction.Quantity && transaction.Quantity > 0);
  const hasNotes = Boolean(transaction.Notes?.trim());

  return (
    hasCustomer ||
    hasProduct ||
    hasOrderDate ||
    hasShipmentCode ||
    hasQuantity ||
    hasNotes
  );
};

export const capPlaceholderRows = (
  transactions: TransactionData[],
  maxPlaceholderRows: number = MAX_PLACEHOLDER_ROWS
): TransactionData[] => {
  let placeholdersShown = 0;
  return transactions.filter((transaction) => {
    if (isMeaningfulTransaction(transaction)) {
      return true;
    }
    if (placeholdersShown < maxPlaceholderRows) {
      placeholdersShown += 1;
      return true;
    }
    return false;
  });
};

export const filterDueDatesBySelection = (
  dueDatesData: DueDateGridRow[],
  dueDateFilters: Set<string>
): DueDateGridRow[] => {
  if (dueDateFilters.has('Show All')) {
    return dueDatesData;
  }

  if (dueDateFilters.size === 0) {
    return [];
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
};
