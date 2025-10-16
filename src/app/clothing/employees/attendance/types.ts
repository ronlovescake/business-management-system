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
  totalHours: number;
  status: AttendanceStatus;
  details?: string;
  notes?: string;
}
