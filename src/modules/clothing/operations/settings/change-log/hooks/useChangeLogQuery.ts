import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { unwrapApiData } from '@/lib/api/normalize';
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

function isApiResponse<T>(payload: unknown): payload is ApiResponse<T> {
  return (
    !!payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'success' in payload
  );
}

async function fetchChangeLogs(
  params: ChangeLogQueryParams,
  apiBasePath?: string
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

  const basePath = apiBasePath ?? '/api/clothing';
  const payload = await api.get<
    ApiResponse<ChangeLogQueryResponse> | ChangeLogQueryResponse
  >(
    `${buildApiPath(basePath, '/operations/settings/change-log')}?${query.toString()}`
  );

  if (isApiResponse<ChangeLogQueryResponse>(payload) && !payload.success) {
    const errorMessage =
      payload.error || payload.message || 'Failed to fetch change log entries';
    logger.error('Change log API request failed', {
      params,
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }

  const data = unwrapApiData<ChangeLogQueryResponse>(payload);

  if (!data) {
    const errorMessage = 'Change log API returned an empty payload';
    logger.error('Change log API request failed', {
      params,
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }

  return data;
}

export function useChangeLogQuery(
  params: ChangeLogQueryParams,
  options?: { enabled?: boolean },
  apiBasePath?: string
) {
  return useQuery({
    queryKey: ['change-log', apiBasePath ?? 'default', params],
    queryFn: () => fetchChangeLogs(params, apiBasePath),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}
