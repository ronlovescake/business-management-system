/**
 * Installed Modules Hook - Utility Functions Tests
 *
 * Comprehensive tests for installed modules hook utilities:
 * - Module filtering (search, status, source)
 * - Module sorting
 * - Filter state management
 *
 * @group unit
 * @group settings
 */

import { describe, it, expect } from 'vitest';

// ==========================================================================
// MODULE FILTERING
// ==========================================================================

describe('Module Filtering', () => {
  interface ModulePackage {
    id: string;
    name: string;
    enabled: boolean;
    source: 'local' | 'marketplace' | 'npm' | 'git';
    metadata?: {
      description?: string;
    };
  }

  const mockModules: ModulePackage[] = [
    {
      id: 'transactions',
      name: 'Transactions Module',
      enabled: true,
      source: 'local',
      metadata: { description: 'Manage sales transactions' },
    },
    {
      id: 'customers',
      name: 'Customers Module',
      enabled: true,
      source: 'local',
      metadata: { description: 'Customer relationship management' },
    },
    {
      id: 'inventory',
      name: 'Inventory Module',
      enabled: false,
      source: 'marketplace',
      metadata: { description: 'Track inventory and stock levels' },
    },
    {
      id: 'reports',
      name: 'Reports Module',
      enabled: true,
      source: 'npm',
      metadata: { description: 'Generate business reports' },
    },
    {
      id: 'analytics',
      name: 'Analytics Module',
      enabled: false,
      source: 'git',
      metadata: { description: 'Business analytics and insights' },
    },
  ];

  const filterModules = (
    modules: ModulePackage[],
    searchQuery: string,
    status: 'all' | 'enabled' | 'disabled',
    source: 'all' | 'local' | 'marketplace' | 'npm' | 'git'
  ): ModulePackage[] => {
    let filtered = [...modules];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
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
    if (status !== 'all') {
      const enabled = status === 'enabled';
      filtered = filtered.filter((module) => module.enabled === enabled);
    }

    // Apply source filter
    if (source !== 'all') {
      filtered = filtered.filter((module) => module.source === source);
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  };

  describe('Search Filtering', () => {
    it('should filter by module name', () => {
      const result = filterModules(mockModules, 'transactions', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('transactions');
    });

    it('should filter by module ID', () => {
      const result = filterModules(mockModules, 'customers', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('customers');
    });

    it('should filter by description', () => {
      const result = filterModules(mockModules, 'inventory', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inventory');
    });

    it('should be case-insensitive', () => {
      const result = filterModules(mockModules, 'TRANSACTIONS', 'all', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('transactions');
    });

    it('should return all modules with empty search', () => {
      const result = filterModules(mockModules, '', 'all', 'all');
      expect(result).toHaveLength(5);
    });

    it('should match partial text', () => {
      const result = filterModules(mockModules, 'module', 'all', 'all');
      expect(result.length).toBeGreaterThan(1); // Multiple modules contain "module"
    });

    it('should return empty array for no matches', () => {
      const result = filterModules(mockModules, 'nonexistent', 'all', 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('Status Filtering', () => {
    it('should filter enabled modules', () => {
      const result = filterModules(mockModules, '', 'enabled', 'all');
      expect(result).toHaveLength(3);
      expect(result.every((m) => m.enabled === true)).toBe(true);
    });

    it('should filter disabled modules', () => {
      const result = filterModules(mockModules, '', 'disabled', 'all');
      expect(result).toHaveLength(2);
      expect(result.every((m) => m.enabled === false)).toBe(true);
    });

    it('should return all modules with "all" status', () => {
      const result = filterModules(mockModules, '', 'all', 'all');
      expect(result).toHaveLength(5);
    });
  });

  describe('Source Filtering', () => {
    it('should filter local modules', () => {
      const result = filterModules(mockModules, '', 'all', 'local');
      expect(result).toHaveLength(2);
      expect(result.every((m) => m.source === 'local')).toBe(true);
    });

    it('should filter marketplace modules', () => {
      const result = filterModules(mockModules, '', 'all', 'marketplace');
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('marketplace');
    });

    it('should filter npm modules', () => {
      const result = filterModules(mockModules, '', 'all', 'npm');
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('npm');
    });

    it('should filter git modules', () => {
      const result = filterModules(mockModules, '', 'all', 'git');
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('git');
    });

    it('should return all modules with "all" source', () => {
      const result = filterModules(mockModules, '', 'all', 'all');
      expect(result).toHaveLength(5);
    });
  });

  describe('Combined Filtering', () => {
    it('should combine search and status filters', () => {
      const result = filterModules(mockModules, 'module', 'enabled', 'all');
      const enabledCount = result.filter((m) => m.enabled).length;
      expect(enabledCount).toBe(result.length);
    });

    it('should combine search and source filters', () => {
      const result = filterModules(mockModules, 'module', 'all', 'local');
      const localCount = result.filter((m) => m.source === 'local').length;
      expect(localCount).toBe(result.length);
    });

    it('should combine all three filters', () => {
      const result = filterModules(mockModules, 'customers', 'enabled', 'local');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('customers');
      expect(result[0].enabled).toBe(true);
      expect(result[0].source).toBe('local');
    });

    it('should return empty for conflicting filters', () => {
      // Search for inventory (disabled, marketplace) but filter for enabled
      const result = filterModules(mockModules, 'inventory', 'enabled', 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('Sorting', () => {
    it('should sort modules alphabetically by name', () => {
      const result = filterModules(mockModules, '', 'all', 'all');
      const names = result.map((m) => m.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should maintain sort after filtering', () => {
      const result = filterModules(mockModules, '', 'enabled', 'all');
      const names = result.map((m) => m.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });
  });
});

// ==========================================================================
// FILTER STATE MANAGEMENT
// ==========================================================================

describe('Filter State Management', () => {
  interface InstalledModuleFilter {
    searchQuery: string;
    status: 'all' | 'enabled' | 'disabled';
    source: 'all' | 'local' | 'marketplace' | 'npm' | 'git';
  }

  const createInitialFilter = (): InstalledModuleFilter => ({
    searchQuery: '',
    status: 'all',
    source: 'all',
  });

  const updateSearchQuery = (
    filter: InstalledModuleFilter,
    query: string
  ): InstalledModuleFilter => ({
    ...filter,
    searchQuery: query,
  });

  const updateStatus = (
    filter: InstalledModuleFilter,
    status: 'all' | 'enabled' | 'disabled'
  ): InstalledModuleFilter => ({
    ...filter,
    status,
  });

  const updateSource = (
    filter: InstalledModuleFilter,
    source: 'all' | 'local' | 'marketplace' | 'npm' | 'git'
  ): InstalledModuleFilter => ({
    ...filter,
    source,
  });

  it('should create initial filter with defaults', () => {
    const filter = createInitialFilter();
    expect(filter).toEqual({
      searchQuery: '',
      status: 'all',
      source: 'all',
    });
  });

  it('should update search query', () => {
    const filter = createInitialFilter();
    const updated = updateSearchQuery(filter, 'transactions');
    expect(updated.searchQuery).toBe('transactions');
    expect(updated.status).toBe('all'); // Other fields unchanged
    expect(updated.source).toBe('all');
  });

  it('should update status', () => {
    const filter = createInitialFilter();
    const updated = updateStatus(filter, 'enabled');
    expect(updated.status).toBe('enabled');
    expect(updated.searchQuery).toBe(''); // Other fields unchanged
    expect(updated.source).toBe('all');
  });

  it('should update source', () => {
    const filter = createInitialFilter();
    const updated = updateSource(filter, 'local');
    expect(updated.source).toBe('local');
    expect(updated.searchQuery).toBe(''); // Other fields unchanged
    expect(updated.status).toBe('all');
  });

  it('should handle multiple updates', () => {
    let filter = createInitialFilter();
    filter = updateSearchQuery(filter, 'test');
    filter = updateStatus(filter, 'enabled');
    filter = updateSource(filter, 'marketplace');

    expect(filter).toEqual({
      searchQuery: 'test',
      status: 'enabled',
      source: 'marketplace',
    });
  });

  it('should not mutate original filter', () => {
    const original = createInitialFilter();
    const updated = updateSearchQuery(original, 'test');
    expect(original.searchQuery).toBe(''); // Original unchanged
    expect(updated.searchQuery).toBe('test');
  });
});
