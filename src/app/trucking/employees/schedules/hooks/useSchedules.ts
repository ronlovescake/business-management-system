import { useSchedules as useSchedulesBase } from '@/app/clothing/employees/schedules/hooks/useSchedules';

export function useSchedules() {
  return useSchedulesBase('/api/trucking');
}
