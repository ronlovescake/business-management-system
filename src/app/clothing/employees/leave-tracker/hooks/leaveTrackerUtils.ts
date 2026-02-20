import { dayjs } from '@/utils/date';
import type { Schedule } from '../../schedules/types';

export const TIMEZONE = 'Asia/Manila';

export const leaveKeys = {
  all: ['leaveRequests'] as const,
  lists: () => [...leaveKeys.all, 'list'] as const,
  list: (filters: {
    searchQuery?: string;
    leaveType?: string;
    status?: string;
  }) => [...leaveKeys.lists(), filters] as const,
};

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
};

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
};

export const buildEmployeeScheduleIndex = (schedules: Schedule[]) => {
  const mapped: Record<string, Set<string>> = {};

  schedules.forEach((schedule) => {
    const date = dayjs(schedule.date).tz(TIMEZONE).format('YYYY-MM-DD');
    const normalizedEmployeeId = schedule.employeeId.trim();

    if (!mapped[normalizedEmployeeId]) {
      mapped[normalizedEmployeeId] = new Set();
    }
    mapped[normalizedEmployeeId].add(date);
  });

  return mapped;
};
