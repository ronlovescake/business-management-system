import { useCallback } from 'react';
import { showNotification } from '@mantine/notifications';
import {
  useEmployeeDetail as useSharedEmployeeDetail,
  type EmployeeDetailErrorHandler,
  type EmployeePayrollRecord,
  type EmployeeThirteenthMonthRecord,
} from '@/app/clothing/employees/team/hooks/useEmployeeDetail';

const useTruckingEmployeeDetailErrorHandler = (): EmployeeDetailErrorHandler =>
  useCallback((error, fallback) => {
    const status =
      (error as { status?: number })?.status ??
      (error as { response?: { status?: number } })?.response?.status;
    const data =
      (error as { data?: unknown })?.data ??
      (error as { response?: { data?: unknown } })?.response?.data ??
      {};
    const details = (data as { details?: string })?.details;
    const field = (data as { field?: string })?.field;

    if (status === 409) {
      showNotification({
        title: 'Duplicate entry',
        message:
          details ||
          (field
            ? `Another employee already uses this ${field}.`
            : 'Another employee already uses these details.'),
        color: 'red',
      });
      return;
    }

    showNotification({
      title: 'Update failed',
      message: details || fallback,
      color: 'red',
    });
  }, []);

export type { EmployeePayrollRecord, EmployeeThirteenthMonthRecord };

export function useEmployeeDetail(employeeId: string, apiBasePath?: string) {
  const handleApiError = useTruckingEmployeeDetailErrorHandler();

  return useSharedEmployeeDetail(employeeId, apiBasePath, handleApiError);
}
