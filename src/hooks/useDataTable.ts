'use client';

import { useState, useCallback, useMemo } from 'react';
import { GridCellKind } from '@glideapps/glide-data-grid';
import type { GridCell, Item } from '@glideapps/glide-data-grid';

export interface UseDataTableProps<T> {
  data: T[];
  searchFields: (keyof T)[];
  initialSearchQuery?: string;
  searchMode?: 'contains' | 'terms-all';
}

export function useDataTable<T>({
  data,
  searchFields,
  initialSearchQuery = '',
  searchMode = 'contains',
}: UseDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);

  // Search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const searchTerm = searchQuery.toLowerCase().trim();
    const searchTerms = searchTerm
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    return data.filter((item) => {
      if (searchMode === 'terms-all') {
        const haystack = searchFields
          .map((field) => {
            const value = item[field];
            return value === null || value === undefined
              ? ''
              : value.toString().toLowerCase();
          })
          .join(' ');

        return searchTerms.every((term) => haystack.includes(term));
      }

      return searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) {
          return false;
        }
        return value.toString().toLowerCase().includes(searchTerm);
      });
    });
  }, [data, searchFields, searchMode, searchQuery]);

  // Default cell content getter
  const getCellContent = useCallback(
    (
      cell: Item,
      columns: Array<{ id: string }>,
      idToKey: Record<string, keyof T>
    ): GridCell => {
      const [col, row] = cell;
      const item = filteredData[row];
      const column = columns[col];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      const key = idToKey[column.id as string];
      const value = item[key];

      // Handle different data types
      if (typeof value === 'number') {
        return {
          kind: GridCellKind.Number,
          data: value,
          displayData: value.toLocaleString(),
          allowOverlay: false,
        };
      }

      return {
        kind: GridCellKind.Text,
        data: value?.toString() || '',
        displayData: value?.toString() || '',
        allowOverlay: false,
      };
    },
    [filteredData]
  );

  // Basic stats calculation
  const stats = useMemo(() => {
    return {
      total: data.length,
      filtered: filteredData.length,
    };
  }, [data.length, filteredData.length]);

  return {
    searchQuery,
    filteredData,
    handleSearch,
    getCellContent,
    stats,
  };
}

export default useDataTable;
