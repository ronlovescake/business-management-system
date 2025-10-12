'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  PriceData,
  PriceStats,
  PriceWithSearchIndex,
} from '../types/price.types';
import { PriceService } from '../services/PriceService';

/**
 * Custom hook for managing prices data, search, and statistics
 */
export function usePricesData() {
  // State
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [filteredPrices, setFilteredPrices] = useState<PriceData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced search for performance (300ms delay)
  const [debouncedFilteredPrices] = useDebouncedValue(filteredPrices, 300);

  // Load prices on mount
  useEffect(() => {
    loadPrices();
  }, []);

  /**
   * Load prices from API
   */
  const loadPrices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await PriceService.loadPrices();
      setPrices(data);
      setFilteredPrices(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load prices';
      setError(message);
      console.error('Error loading prices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle search query change
   */
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setFilteredPrices(prices);
        return;
      }

      const filtered = PriceService.searchPrices(prices, query);
      setFilteredPrices(filtered);
    },
    [prices]
  );

  /**
   * Add a new price (optimistic update)
   */
  const addPrice = useCallback(
    async (price: PriceData) => {
      try {
        // Save to database
        const success = await PriceService.addPrice(price);
        if (!success) {
          throw new Error('Failed to save price');
        }

        // Optimistic update
        const updatedPrices = [...prices, price];
        setPrices(updatedPrices);

        // Update filtered prices based on current search
        if (!searchQuery.trim()) {
          setFilteredPrices(updatedPrices);
        } else {
          const filtered = PriceService.searchPrices(
            updatedPrices,
            searchQuery
          );
          setFilteredPrices(filtered);
        }

        return true;
      } catch (err) {
        console.error('Error adding price:', err);
        return false;
      }
    },
    [prices, searchQuery]
  );

  /**
   * Bulk update prices
   */
  const bulkUpdatePrices = useCallback(async (updatedPrices: PriceData[]) => {
    try {
      const success = await PriceService.bulkUpdatePrices(updatedPrices);
      if (!success) {
        throw new Error('Failed to update prices');
      }

      // Update local state
      setPrices(updatedPrices);
      setFilteredPrices(updatedPrices);
      return true;
    } catch (err) {
      console.error('Error updating prices:', err);
      return false;
    }
  }, []);

  /**
   * Replace all prices (used after CSV import)
   */
  const replaceAllPrices = useCallback(
    async (newPrices: PriceData[]): Promise<number> => {
      try {
        const count = await PriceService.replaceAllPrices(newPrices);

        // Update local state
        setPrices(newPrices);
        setFilteredPrices(newPrices);

        return count;
      } catch (err) {
        console.error('Error replacing prices:', err);
        throw err;
      }
    },
    []
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
    reloadPrices: loadPrices,
  };
}
