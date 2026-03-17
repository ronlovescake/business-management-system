import type { ScheduleStatus } from '../types';
import { MINUTES_IN_DAY } from './scheduleHookUtils';

export type ScheduleOverlapCandidate = {
  id?: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: ScheduleStatus;
};

export const timeStringToMinutes = (value: string): number | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

export const getTimeRange = (startTime: string, endTime: string) => {
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);

  if (start === null || end === null) {
    return null;
  }

  const adjustedEnd = end <= start ? end + MINUTES_IN_DAY : end;

  return { start, end: adjustedEnd };
};

export const rangesOverlap = (
  candidateStart: number,
  candidateEnd: number,
  existingStart: number,
  existingEnd: number
) => candidateStart < existingEnd && existingStart < candidateEnd;

export const calculateDuration = (
  startTime: string,
  endTime: string,
  hasLunch?: boolean
): number => {
  if (!startTime || !endTime) {
    return 0;
  }

  const range = getTimeRange(startTime, endTime);
  if (!range) {
    return 0;
  }

  const totalHours = (range.end - range.start) / 60;
  const workingHours = hasLunch ? totalHours - 1 : totalHours;

  return Math.max(0, workingHours);
};

export const hasScheduleOverlap = (
  schedules: ScheduleOverlapCandidate[],
  employeeId: string,
  date: string,
  startTime: string,
  endTime: string,
  ignoreScheduleId?: string,
  additional: ScheduleOverlapCandidate[] = []
): boolean => {
  if (!employeeId || !date) {
    return false;
  }

  const candidateRange = getTimeRange(startTime, endTime);
  if (!candidateRange) {
    return false;
  }

  const overlapPool: ScheduleOverlapCandidate[] = [
    ...schedules,
    ...additional,
  ].map((schedule) => ({
    id: schedule.id,
    employeeId: schedule.employeeId,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    status: schedule.status,
  }));

  return overlapPool.some((schedule) => {
    if (schedule.employeeId !== employeeId || schedule.date !== date) {
      return false;
    }

    if (ignoreScheduleId && schedule.id === ignoreScheduleId) {
      return false;
    }

    if ((schedule.status ?? 'scheduled') === 'cancelled') {
      return false;
    }

    const existingRange = getTimeRange(schedule.startTime, schedule.endTime);
    if (!existingRange) {
      return false;
    }

    return rangesOverlap(
      candidateRange.start,
      candidateRange.end,
      existingRange.start,
      existingRange.end
    );
  });
};
