export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full-day';

export interface Schedule {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shiftType: ShiftType;
  startTime: string;
  break1?: string;
  lunch?: string;
  break2?: string;
  endTime: string;
  position: string;
  department: string;
  status: ScheduleStatus;
  notes?: string;
  source?: 'manual' | 'template' | 'recurrence';
  templateId?: string;
  recurrenceId?: string;
  isOverride?: boolean;
}

export interface RecurringRule {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  shiftType: ShiftType;
  daysOfWeek: number[]; // 0 = Sunday
  startDate: string;
  endDate?: string;
  break1?: string;
  lunch?: string;
  break2?: string;
  notes?: string;
  isStayIn?: boolean;
}

export interface EmployeeSummary {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  employeeType?: string;
}
