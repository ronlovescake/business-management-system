import { useCallback } from 'react';
import { buildApiPath, DEFAULT_API_BASE } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import type { PayrollFilters } from '@/hooks/usePayrollBase';

export function usePayrollDomainConfig(
  apiBasePath?: string,
  fallbackApiBasePath: string = DEFAULT_API_BASE
) {
  const effectiveApiBasePath = apiBasePath ?? fallbackApiBasePath;

  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(effectiveApiBasePath, path),
    [effectiveApiBasePath]
  );

  const createPayrollQueryKey = useCallback(
    (filters: PayrollFilters) => [
      ...queryKeys.payroll.lists(),
      { filters, apiBasePath: effectiveApiBasePath },
    ],
    [effectiveApiBasePath]
  );

  return {
    effectiveApiBasePath,
    resolveApiPath,
    createPayrollQueryKey,
  };
}
