'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import {
  DATE_FILTER_OPTIONS,
  type DateFilterType,
} from '@/lib/analytics/periodComparison';
import { HouseholdDashboardService } from '@/services/HouseholdDashboardService';

export function usePersonalDashboard() {
  const [range, setRange] = useState<DateFilterType>('ytd');
  const query = useQuery({
    queryKey: queryKeys.household.dashboard.summary(range),
    queryFn: () => HouseholdDashboardService.getSummary(range),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return {
    range,
    setRange,
    rangeOptions: DATE_FILTER_OPTIONS,
    summary: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
