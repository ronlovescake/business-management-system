export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'paid' | 'unpaid' | 'not-applicable';
export type LeaveType =
  | 'Sick Leave'
  | 'Vacation Leave'
  | 'Emergency Leave'
  | 'Maternity Leave'
  | 'Paternity Leave'
  | 'Bereavement Leave'
  | 'Other';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  paymentStatus: PaymentStatus;
  appliedDate: string;
  approvedBy?: string;
  notes?: string;
}

export interface MonthlyBreakdownItem {
  month: string;
  [key: string]: number | string;
}
