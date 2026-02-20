import type { AttendanceFormValues } from '../types';
import { getCurrentDateISO } from '@/utils/date';

export const AUTO_RECORD_LOOKBACK_DAYS: number = 15;

export const getAutoRecordDateRange = () =>
  Array.from({ length: AUTO_RECORD_LOOKBACK_DAYS }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().split('T')[0];
  });

export const calculateTotalHours = (timeIn: string, timeOut: string) => {
  if (!timeIn || !timeOut) {
    return null;
  }

  const [inHours, inMinutes] = timeIn.split(':').map(Number);
  const [outHours, outMinutes] = timeOut.split(':').map(Number);

  if (
    [inHours, inMinutes, outHours, outMinutes].some((value) =>
      Number.isNaN(value)
    )
  ) {
    return null;
  }

  const start = inHours * 60 + inMinutes;
  const end = outHours * 60 + outMinutes;
  const diff = end - start;

  if (diff <= 0) {
    return null;
  }

  return diff / 60;
};

export const createEmptyFormValues = (): AttendanceFormValues => ({
  employeeId: '',
  employeeName: '',
  department: '',
  position: '',
  date: getCurrentDateISO(),
  timeIn: '',
  timeOut: '',
  break1Start: '',
  break1End: '',
  lunchStart: '',
  lunchEnd: '',
  break2Start: '',
  break2End: '',
  totalHours: '',
  status: 'present',
  details: '',
  notes: '',
});
