'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { createOptimisticUpdateHandlers } from '@/lib/react-query/optimistic';
import type {
  PriceData,
  PriceStats,
  PriceWithSearchIndex,
} from '../types/price.types';
import { PriceService } from '../services/PriceService';

/**
 * Custom hook for managing prices data, search, and statistics
 */
export function usePricesData(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const pricesQueryKey = useMemo(
    () => [...queryKeys.prices.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  // State
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Load prices using React Query
   */
  const {
    data: prices = [],
    isLoading,
    error: queryError,
    refetch: reloadPrices,
  } = useQuery({
    queryKey: pricesQueryKey,
    queryFn: async () => {
      try {
        return await PriceService.loadPrices(apiBasePath);
      } catch (error) {
        logger.error('Error loading prices:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000,
  });

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load prices'
    : null;

  // Filtered prices based on search
  const filteredPrices = useMemo(() => {
    if (!searchQuery.trim()) {
      return prices;
    }
    return PriceService.searchPrices(prices, searchQuery);
  }, [prices, searchQuery]);

  // Debounced search for performance (300ms delay)
  const [debouncedFilteredPrices] = useDebouncedValue(filteredPrices, 300);

  /**
   * Handle search query change
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Add price mutation
   */
  const addPriceOptimistic = createOptimisticUpdateHandlers<
    PriceData,
    PriceData
  >({
    queryClient,
    queryKey: pricesQueryKey,
    updater: (previousPrices, newPrice) =>
      previousPrices ? [...previousPrices, newPrice] : previousPrices,
  });

  const addPriceMutation = useMutation({
    mutationFn: async (price: PriceData) => {
      const success = await PriceService.addPrice(price, apiBasePath);
      if (!success) {
        throw new Error('Failed to save price');
      }
      return success;
    },
    onMutate: addPriceOptimistic.onMutate,
    onError: (error, variables, context) => {
      addPriceOptimistic.onError(error, variables, context);
      logger.error('Error adding price:', error);
    },
    onSettled: addPriceOptimistic.onSettled,
  });

  /**
   * Bulk update prices mutation
   */
  const bulkUpdatePricesOptimistic = createOptimisticUpdateHandlers<
    PriceData,
    PriceData[]
  >({
    queryClient,
    queryKey: pricesQueryKey,
    updater: (_previousPrices, updatedPrices) => updatedPrices,
  });

  const bulkUpdatePricesMutation = useMutation({
    mutationFn: async (updatedPrices: PriceData[]) => {
      const success = await PriceService.bulkUpdatePrices(
        updatedPrices,
        apiBasePath
      );
      if (!success) {
        throw new Error('Failed to update prices');
      }
      return success;
    },
    onMutate: bulkUpdatePricesOptimistic.onMutate,
    onError: (error, variables, context) => {
      bulkUpdatePricesOptimistic.onError(error, variables, context);
      logger.error('Error updating prices:', error);
    },
    onSettled: bulkUpdatePricesOptimistic.onSettled,
  });

  /**
   * Replace all prices mutation
   */
  const replaceAllPricesOptimistic = createOptimisticUpdateHandlers<
    PriceData,
    PriceData[]
  >({
    queryClient,
    queryKey: [pricesQueryKey, queryKeys.prices.lists()],
    updater: (_previousPrices, newPrices) => newPrices,
  });

  const replaceAllPricesMutation = useMutation({
    mutationFn: async (newPrices: PriceData[]) => {
      return await PriceService.replaceAllPrices(newPrices, apiBasePath);
    },
    onMutate: replaceAllPricesOptimistic.onMutate,
    onError: (error, variables, context) => {
      replaceAllPricesOptimistic.onError(error, variables, context);
      logger.error('Error replacing prices:', error);
    },
    onSettled: replaceAllPricesOptimistic.onSettled,
  });

  // Wrapper functions to maintain API compatibility
  const addPrice = useCallback(
    async (price: PriceData) => {
      try {
        await addPriceMutation.mutateAsync(price);
        return true;
      } catch {
        return false;
      }
    },
    [addPriceMutation]
  );

  const bulkUpdatePrices = useCallback(
    async (updatedPrices: PriceData[]) => {
      try {
        await bulkUpdatePricesMutation.mutateAsync(updatedPrices);
        return true;
      } catch {
        return false;
      }
    },
    [bulkUpdatePricesMutation]
  );

  const replaceAllPrices = useCallback(
    async (newPrices: PriceData[]): Promise<number> => {
      try {
        return await replaceAllPricesMutation.mutateAsync(newPrices);
      } catch (err) {
        logger.error('Error replacing prices:', err);
        throw err;
      }
    },
    [replaceAllPricesMutation]
  );

  /**
   * Prices with search index (for performance)
   */
  const pricesWithSearchIndex = useMemo<PriceWithSearchIndex[]>(() => {
    return prices.map((price) => ({
      ...price,
      _searchIndex: PriceService.createSearchIndex(price),
    }));
  }, [prices]);

  /**
   * Calculate statistics
   */
  const stats = useMemo<PriceStats>(() => {
    return PriceService.calculateStats(prices, filteredPrices);
  }, [prices, filteredPrices]);

  return {
    // Data
    prices,
    filteredPrices,
    debouncedFilteredPrices,
    pricesWithSearchIndex,

    // Search
    searchQuery,
    handleSearch,

    // Statistics
    stats,

    // Loading state
    isLoading,
    error,

    // Actions
    addPrice,
    bulkUpdatePrices,
    replaceAllPrices,
    reloadPrices,
  };
}
