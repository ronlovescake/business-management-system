export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full-day';

export interface Schedule {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  position: string;
  department: string;
  status: ScheduleStatus;
  notes?: string;
}
