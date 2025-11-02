'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { InventoryRecord } from '../types';
import { InventoryService } from '../services/InventoryService';

export function useInventoryData() {
  const query = useQuery<InventoryRecord[]>({
    queryKey: queryKeys.products.lists(),
    queryFn: InventoryService.loadInventoryRecords,
    staleTime: 30 * 1000,
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
