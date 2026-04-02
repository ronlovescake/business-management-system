import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Shared hook that fetches all employees and provides a lookup
 * for employment status by employee name or employee ID.
 */
export function useEmployeeStatusMap(apiBasePath?: string) {
  const resolvedPath = buildApiPath(apiBasePath, '/employees');

  const { data: statusMap = new Map<string, string>() } = useQuery({
    queryKey: [...queryKeys.employees.lists(), 'status-map', apiBasePath],
    queryFn: async () => {
      const employees = await api.get<
        Array<{
          employeeId?: string;
          name?: string;
          firstName?: string;
          lastName?: string;
          status?: string;
        }>
      >(resolvedPath);

      const map = new Map<string, string>();
      employees.forEach((emp) => {
        const status = emp.status || 'Unknown';
        const id = (emp.employeeId || '').trim().toLowerCase();
        const name = (
          emp.name || `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim()
        ).toLowerCase();

        if (id) {
          map.set(id, status);
        }
        if (name) {
          map.set(name, status);
        }
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const getStatus = (
    employeeName?: string,
    employeeId?: string
  ): string | undefined => {
    if (employeeId) {
      const byId = statusMap.get(employeeId.trim().toLowerCase());
      if (byId) {
        return byId;
      }
    }
    if (employeeName) {
      const byName = statusMap.get(employeeName.trim().toLowerCase());
      if (byName) {
        return byName;
      }
    }
    return undefined;
  };

  return { getStatus, statusMap };
}
