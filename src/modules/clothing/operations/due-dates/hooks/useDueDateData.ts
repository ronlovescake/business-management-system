/**
 * Due Dates Hook - Data Fetching
 *
 * This hook uses the existing abstraction layer (useTransactionData)
 * and processes the data for due dates display.
 */

import { useMemo } from 'react';
import { useTransactionData } from '@/hooks/useSheetData';
import { DueDateService } from '../services/DueDateService';
import type { DueDateItem } from '../types/dueDate.types';

export function useDueDateData() {
  // ✅ Use existing abstraction layer!
  const { data: transactions, isLoading, error } = useTransactionData();

  // Process transactions into due date items
  const dueDateItems = useMemo<DueDateItem[]>(() => {
    if (!transactions) return [];
    return DueDateService.processDueDateItems(transactions);
  }, [transactions]);

  // Calculate stats
  const stats = useMemo(() => {
    return DueDateService.calculateStats(dueDateItems);
  }, [dueDateItems]);

  return {
    dueDateItems,
    stats,
    isLoading,
    error,
    // Also expose raw transactions for modal
    transactions,
  };
}
