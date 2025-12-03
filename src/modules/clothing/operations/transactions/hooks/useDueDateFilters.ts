'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DUE_DATE_FILTER_OPTIONS,
  filterDueDatesBySelection,
  type DueDateGridRow,
} from '@/lib/transactions';

interface UseDueDateFiltersParams {
  initialFilters?: Set<string>;
}

interface UseDueDateFiltersResult {
  dueDateFilters: Set<string>;
  filteredDueDatesData: DueDateGridRow[];
  handleDueDateFilter: (filter: string) => void;
}

export function useDueDateFilters(
  dueDatesData: DueDateGridRow[],
  { initialFilters }: UseDueDateFiltersParams = {}
): UseDueDateFiltersResult {
  const [dueDateFilters, setDueDateFilters] = useState<Set<string>>(
    () => initialFilters ?? new Set(DUE_DATE_FILTER_OPTIONS)
  );

  const handleDueDateFilter = useCallback((filter: string) => {
    setDueDateFilters((prev) => {
      const next = new Set(prev);

      if (filter === 'Show All') {
        if (next.has('Show All')) {
          return new Set();
        }
        return new Set(DUE_DATE_FILTER_OPTIONS);
      }

      next.delete('Show All');
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }

      const areAllIndividualSelected = DUE_DATE_FILTER_OPTIONS.slice(1).every(
        (option) => next.has(option)
      );

      if (areAllIndividualSelected) {
        return new Set(DUE_DATE_FILTER_OPTIONS);
      }

      return next;
    });
  }, []);

  const filteredDueDatesData = useMemo(() => {
    return filterDueDatesBySelection(dueDatesData, dueDateFilters);
  }, [dueDateFilters, dueDatesData]);

  return {
    dueDateFilters,
    filteredDueDatesData,
    handleDueDateFilter,
  };
}
