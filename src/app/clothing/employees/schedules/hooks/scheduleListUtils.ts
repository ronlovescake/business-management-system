import { toISODate } from '@/utils/date';
import type { Schedule } from '../types';

type ScheduleFilters = {
  searchQuery: string;
  filterShiftType: string | null;
  filterStatus: string | null;
  yearFilter?: string | null;
};

type ScheduleFilterCandidate = Pick<
  Schedule,
  | 'employeeName'
  | 'employeeId'
  | 'position'
  | 'department'
  | 'shiftType'
  | 'status'
  | 'date'
>;

type ScheduleSortCandidate = Pick<Schedule, 'date' | 'startTime'>;
type ScheduleStatsCandidate = Pick<Schedule, 'status'>;

export const filterSchedules = <T extends ScheduleFilterCandidate>(
  schedules: T[],
  { searchQuery, filterShiftType, filterStatus, yearFilter }: ScheduleFilters
) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return schedules.filter((schedule) => {
    const matchesSearch =
      !normalizedQuery ||
      schedule.employeeName.toLowerCase().includes(normalizedQuery) ||
      schedule.employeeId.toLowerCase().includes(normalizedQuery) ||
      schedule.position.toLowerCase().includes(normalizedQuery) ||
      schedule.department.toLowerCase().includes(normalizedQuery);

    const matchesShiftType =
      !filterShiftType || schedule.shiftType === filterShiftType;

    const matchesStatus = !filterStatus || schedule.status === filterStatus;

    const matchesYear =
      !yearFilter ||
      new Date(schedule.date).getFullYear().toString() === yearFilter;

    return matchesSearch && matchesShiftType && matchesStatus && matchesYear;
  });
};

export const sortSchedules = <T extends ScheduleSortCandidate>(
  schedules: T[]
) => {
  return [...schedules].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (dateA === dateB) {
      return a.startTime.localeCompare(b.startTime);
    }

    return dateB - dateA;
  });
};

export const calculateScheduleStats = (
  schedules: ScheduleStatsCandidate[]
) => ({
  total: schedules.length,
  scheduled: schedules.filter((schedule) => schedule.status === 'scheduled')
    .length,
  completed: schedules.filter((schedule) => schedule.status === 'completed')
    .length,
  cancelled: schedules.filter((schedule) => schedule.status === 'cancelled')
    .length,
});

export const calculateWeeklyBreakdown = (
  schedules: Pick<Schedule, 'date'>[]
) => {
  const breakdown: Record<string, number> = {};

  schedules.forEach((schedule) => {
    const date = new Date(schedule.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = toISODate(weekStart) || '';

    breakdown[weekKey] = (breakdown[weekKey] || 0) + 1;
  });

  return Object.entries(breakdown).map(([week, count]) => ({
    week,
    count,
  }));
};
