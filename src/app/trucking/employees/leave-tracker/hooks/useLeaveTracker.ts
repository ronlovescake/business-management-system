import useLeaveTrackerBase, {
  employeeKeys,
  leaveKeys,
  scheduleKeys,
} from '@/app/clothing/employees/leave-tracker/hooks/useLeaveTracker';

export { employeeKeys, leaveKeys, scheduleKeys };

export default function useLeaveTracker() {
  return useLeaveTrackerBase('/api/trucking');
}
