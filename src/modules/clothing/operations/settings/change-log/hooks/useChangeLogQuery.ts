import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types/api';

export interface ChangeLogRecord {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  source: string | null;
  metadata: unknown;
}

export interface ChangeLogFiltersResponse {
  entityTypes: string[];
  actions: string[];
  sources: string[];
}

export interface ChangeLogQueryResponse {
  logs: ChangeLogRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: ChangeLogFiltersResponse | null;
}

export interface ChangeLogQueryParams {
  page: number;
  limit: number;
  search?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  includeFilters?: boolean;
}

async function fetchChangeLogs(
  params: ChangeLogQueryParams
): Promise<ChangeLogQueryResponse> {
  const query = new URLSearchParams();

  query.set('page', params.page.toString());
  query.set('limit', params.limit.toString());

  if (params.search) {
    query.set('search', params.search);
  }
  if (params.entityType) {
    query.set('entityType', params.entityType);
  }
  if (params.entityId) {
    query.set('entityId', params.entityId);
  }
  if (params.userId) {
    query.set('userId', params.userId);
  }
  if (params.action) {
    query.set('action', params.action);
  }
  if (params.source) {
    query.set('source', params.source);
  }
  if (params.startDate) {
    query.set('startDate', params.startDate);
  }
  if (params.endDate) {
    query.set('endDate', params.endDate);
  }
  if (params.includeFilters === false) {
    query.set('includeFilters', 'false');
  }

  const response = await api.get<ApiResponse<ChangeLogQueryResponse>>(
    `/api/clothing/operations/settings/change-log?${query.toString()}`
  );

  if (!response?.success || !response.data) {
    const errorMessage =
      (response && 'error' in response && response.error) ||
      'Failed to fetch change log entries';
    logger.error('Change log API request failed', {
      params,
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }

  return response.data;
}

export function useChangeLogQuery(
  params: ChangeLogQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['change-log', params],
    queryFn: () => fetchChangeLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}
