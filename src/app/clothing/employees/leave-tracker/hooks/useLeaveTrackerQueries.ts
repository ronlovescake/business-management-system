import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { LeaveRequest } from '../types';
import type { Schedule } from '../../schedules/types';
import {
  buildEmployeeScheduleIndex,
  employeeKeys,
  leaveKeys,
  scheduleKeys,
} from './leaveTrackerUtils';

export function useLeaveTrackerQueries(
  apiBasePath: string | undefined,
  resolveApiPath: (path: string) => string
) {
  const [employeeScheduleIndex, setEmployeeScheduleIndex] = useState<
    Record<string, Set<string>>
  >({});

  const leaveRequestsQueryKey = useMemo(
    () => [...leaveKeys.lists(), apiBasePath],
    [apiBasePath]
  );
  const schedulesQueryKey = useMemo(
    () => [...scheduleKeys.lists(), apiBasePath],
    [apiBasePath]
  );
  const employeesQueryKey = useMemo(
    () => [...employeeKeys.lists(), apiBasePath],
    [apiBasePath]
  );

  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: leaveRequestsQueryKey,
    queryFn: async () => {
      const data = await api.get<LeaveRequest[]>(
        resolveApiPath('/leave-requests')
      );
      return data;
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: schedulesQueryKey,
    queryFn: async () => {
      const data = await api.get<Schedule[]>(resolveApiPath('/schedules'));
      return data;
    },
  });

  const { data: employeeOptions = [], isLoading: isLoadingEmployees } =
    useQuery({
      queryKey: employeesQueryKey,
      queryFn: async () => {
        const data = await api.get<
          Array<{
            employeeId: string;
            firstName: string;
            lastName: string;
            status?: string | null;
          }>
        >(resolveApiPath('/employees'));
        return data
          .filter((emp) => {
            const normalizedStatus = (emp.status || '').toLowerCase();
            return !['terminated', 'resigned'].includes(normalizedStatus);
          })
          .map((emp) => ({
            value: emp.employeeId,
            label: `${emp.firstName} ${emp.lastName}`,
          }));
      },
    });

  useEffect(() => {
    if (schedules.length > 0) {
      setEmployeeScheduleIndex(buildEmployeeScheduleIndex(schedules));
    }
  }, [schedules]);

  return {
    leaveRequests,
    schedules,
    employeeOptions,
    employeeScheduleIndex,
    isLoading,
    isLoadingEmployees,
    leaveRequestsQueryKey,
    schedulesQueryKey,
    employeesQueryKey,
  };
}
