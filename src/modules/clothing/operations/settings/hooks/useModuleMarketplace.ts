'use client';

/**
 * useModuleMarketplace Hook
 *
 * Manages marketplace module data and filtering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModulePackage, MarketplaceFilter, SortOption } from '../types';
import { logger } from '@/lib/logger';

interface UseModuleMarketplaceReturn {
  modules: ModulePackage[];
  filteredModules: ModulePackage[];
  loading: boolean;
  error: string | null;
  filter: MarketplaceFilter;
  setSearchQuery: (query: string) => void;
  setCategory: (category: string | null) => void;
  setSortBy: (sortBy: SortOption) => void;
  refreshMarketplace: () => Promise<void>;
}

export function useModuleMarketplace(): UseModuleMarketplaceReturn {
  const [modules, setModules] = useState<ModulePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketplaceFilter>({
    searchQuery: '',
    category: null,
    sortBy: 'downloads',
  });

  /**
   * Fetch marketplace modules
   */
  const fetchMarketplace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filter.searchQuery) {
        params.set('search', filter.searchQuery);
      }
      if (filter.category) {
        params.set('category', filter.category);
      }
      if (filter.sortBy) {
        params.set('sort', filter.sortBy);
      }

      const response = await fetch(
        `/api/marketplace/modules?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch marketplace: ${response.statusText}`);
      }

      const data = await response.json();
      setModules(data.modules || []);
    } catch (err) {
      setError((err as Error).message);
      logger.error('Error fetching marketplace:', err);
    } finally {
      setLoading(false);
    }
  }, [filter.searchQuery, filter.category, filter.sortBy]);

  /**
   * Load marketplace on mount and when filters change
   */
  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  /**
   * Filter and sort modules client-side for better UX
   */
  const filteredModules = useMemo(() => {
    let filtered = [...modules];

    // Apply search filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter((module) => {
        const nameMatch = module.name.toLowerCase().includes(query);
        const descMatch = module.metadata?.description
          ?.toLowerCase()
          .includes(query);
        const tagMatch = module.metadata?.tags?.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        const keywordMatch = module.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(query)
        );
        return nameMatch || descMatch || tagMatch || keywordMatch;
      });
    }

    // Apply category filter
    if (filter.category) {
      filtered = filtered.filter((module) =>
        module.keywords?.includes(filter.category ?? '')
      );
    }

    // Sort modules
    filtered.sort((a, b) => {
      switch (filter.sortBy) {
        case 'downloads':
          return (b.downloads || 0) - (a.downloads || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          // Assuming newer modules have higher IDs or use metadata
          return b.id.localeCompare(a.id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [modules, filter]);

  /**
   * Update search query
   */
  const setSearchQuery = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  /**
   * Update category filter
   */
  const setCategory = useCallback((category: string | null) => {
    setFilter((prev) => ({ ...prev, category }));
  }, []);

  /**
   * Update sort option
   */
  const setSortBy = useCallback((sortBy: SortOption) => {
    setFilter((prev) => ({ ...prev, sortBy }));
  }, []);

  /**
   * Refresh marketplace data
   */
  const refreshMarketplace = useCallback(async () => {
    await fetchMarketplace();
  }, [fetchMarketplace]);

  return {
    modules,
    filteredModules,
    loading,
    error,
    filter,
    setSearchQuery,
    setCategory,
    setSortBy,
    refreshMarketplace,
  };
}
