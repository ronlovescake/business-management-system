'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
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
  const addPriceMutation = useMutation({
    mutationFn: async (price: PriceData) => {
      const success = await PriceService.addPrice(price, apiBasePath);
      if (!success) {
        throw new Error('Failed to save price');
      }
      return success;
    },
    onMutate: async (newPrice) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: pricesQueryKey });

      // Snapshot previous value
      const previousPrices =
        queryClient.getQueryData<PriceData[]>(pricesQueryKey);

      // Optimistically update
      if (previousPrices) {
        queryClient.setQueryData<PriceData[]>(pricesQueryKey, [
          ...previousPrices,
          newPrice,
        ]);
      }

      return { previousPrices };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousPrices) {
        queryClient.setQueryData(pricesQueryKey, context.previousPrices);
      }
      logger.error('Error adding price:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: pricesQueryKey });
    },
  });

  /**
   * Bulk update prices mutation
   */
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
    onMutate: async (updatedPrices) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: pricesQueryKey });

      // Snapshot previous value
      const previousPrices =
        queryClient.getQueryData<PriceData[]>(pricesQueryKey);

      // Optimistically update
      queryClient.setQueryData<PriceData[]>(pricesQueryKey, updatedPrices);

      return { previousPrices };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousPrices) {
        queryClient.setQueryData(pricesQueryKey, context.previousPrices);
      }
      logger.error('Error updating prices:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: pricesQueryKey });
    },
  });

  /**
   * Replace all prices mutation
   */
  const replaceAllPricesMutation = useMutation({
    mutationFn: async (newPrices: PriceData[]) => {
      return await PriceService.replaceAllPrices(newPrices, apiBasePath);
    },
    onMutate: async (newPrices) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.prices.lists() });

      // Snapshot previous value
      const previousPrices = queryClient.getQueryData<PriceData[]>(
        queryKeys.prices.lists()
      );

      // Optimistically update
      queryClient.setQueryData<PriceData[]>(
        queryKeys.prices.lists(),
        newPrices
      );

      return { previousPrices };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousPrices) {
        queryClient.setQueryData(
          queryKeys.prices.lists(),
          context.previousPrices
        );
      }
      logger.error('Error replacing prices:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.prices.lists() });
    },
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
