import type { ShiftType } from '../types';

export const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const SHIFT_CONFIG: Record<
  ShiftType,
  { start: string; end: string; label: string }
> = {
  morning: {
    start: '08:00',
    end: '17:00',
    label: 'Morning (8:00 AM - 5:00 PM)',
  },
  afternoon: {
    start: '15:00',
    end: '00:00',
    label: 'Afternoon (3:00 PM - 12:00 AM)',
  },
  night: { start: '00:00', end: '09:00', label: 'Night (12:00 AM - 9:00 AM)' },
  'full-day': {
    start: '04:00',
    end: '17:00',
    label: 'Full Day (4:00 AM - 5:00 PM)',
  },
};

export const MINUTES_IN_DAY = 24 * 60;

export const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const parseDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
