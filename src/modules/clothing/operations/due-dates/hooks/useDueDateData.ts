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
import type { QueryKey } from '@tanstack/react-query';
import type { TransactionDTO } from '@/types';
import { queryKeys } from '@/lib/queryKeys';

type TransactionServiceLike = {
  getAll: () => Promise<TransactionDTO[]>;
  update: (
    id: string | number,
    data: Partial<TransactionDTO>
  ) => Promise<TransactionDTO>;
  bulkUpdate: (data: TransactionDTO[]) => Promise<{ count: number }>;
};

export function useDueDateData({
  service,
  queryKey,
}: {
  service?: TransactionServiceLike;
  queryKey?: QueryKey;
} = {}) {
  // ✅ Use existing abstraction layer!
  const {
    data: transactions,
    isLoading,
    error,
  } = useTransactionData({
    service,
    queryKey: queryKey ?? queryKeys.transactions.lists(),
  });

  // Process transactions into due date items
  const dueDateItems = useMemo<DueDateItem[]>(() => {
    if (!transactions) {
      return [];
    }
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
