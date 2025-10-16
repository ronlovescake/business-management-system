export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on-leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  date: string; // ISO date string
  timeIn: string; // 24-hour time string e.g. "08:00"
  timeOut: string; // 24-hour time string e.g. "17:00"
  break1Start?: string; // First 15-min break start time
  break1End?: string; // First 15-min break end time
  lunchStart?: string; // 1-hour lunch break start time
  lunchEnd?: string; // 1-hour lunch break end time
  break2Start?: string; // Second 15-min break start time
  break2End?: string; // Second 15-min break end time
  totalHours: number;
  status: AttendanceStatus;
  details?: string;
  notes?: string;
}
