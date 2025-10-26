'use client';

/**
 * useInstalledModules Hook
 *
 * Manages installed modules data and filtering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api/client';
import type { ModulePackage, InstalledModuleFilter } from '../types';
import { logger } from '@/lib/logger';

interface UseInstalledModulesReturn {
  modules: ModulePackage[];
  filteredModules: ModulePackage[];
  loading: boolean;
  error: string | null;
  filter: InstalledModuleFilter;
  setSearchQuery: (query: string) => void;
  setStatus: (status: 'all' | 'enabled' | 'disabled') => void;
  setSource: (source: 'all' | 'local' | 'marketplace' | 'npm' | 'git') => void;
  refreshModules: () => Promise<void>;
}

export function useInstalledModules(): UseInstalledModulesReturn {
  const [modules, setModules] = useState<ModulePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InstalledModuleFilter>({
    searchQuery: '',
    status: 'all',
    source: 'all',
  });

  /**
   * Fetch installed modules
   */
  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.get<ModulePackage[]>('/api/modules/config');
      setModules(data);
    } catch (err) {
      setError((err as Error).message);
      logger.error('Error fetching installed modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load modules on mount
   */
  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  /**
   * Filter modules client-side
   */
  const filteredModules = useMemo(() => {
    let filtered = [...modules];

    // Apply search filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter((module) => {
        const nameMatch = module.name.toLowerCase().includes(query);
        const idMatch = module.id.toLowerCase().includes(query);
        const descMatch = module.metadata?.description
          ?.toLowerCase()
          .includes(query);
        return nameMatch || idMatch || descMatch;
      });
    }

    // Apply status filter
    if (filter.status !== 'all') {
      const enabled = filter.status === 'enabled';
      filtered = filtered.filter((module) => module.enabled === enabled);
    }

    // Apply source filter
    if (filter.source !== 'all') {
      filtered = filtered.filter((module) => module.source === filter.source);
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [modules, filter]);

  /**
   * Update search query
   */
  const setSearchQuery = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  /**
   * Update status filter
   */
  const setStatus = useCallback((status: 'all' | 'enabled' | 'disabled') => {
    setFilter((prev) => ({ ...prev, status }));
  }, []);

  /**
   * Update source filter
   */
  const setSource = useCallback(
    (source: 'all' | 'local' | 'marketplace' | 'npm' | 'git') => {
      setFilter((prev) => ({ ...prev, source }));
    },
    []
  );

  /**
   * Refresh modules data
   */
  const refreshModules = useCallback(async () => {
    await fetchModules();
  }, [fetchModules]);

  return {
    modules,
    filteredModules,
    loading,
    error,
    filter,
    setSearchQuery,
    setStatus,
    setSource,
    refreshModules,
  };
}
