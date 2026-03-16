import { useAttendance as useAttendanceBase } from '@/app/clothing/employees/attendance/hooks/useAttendance';

export function useAttendance() {
  return useAttendanceBase('/api/trucking');
}
