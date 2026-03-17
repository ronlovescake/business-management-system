type LeaveRequestCandidate = {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type ScheduleLeaveInfo = {
  leaveType: string;
  status: string;
  employeeName: string;
};

const normalizeEmployeeId = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const getEmployeeLeaveForDate = (
  leaveRequests: LeaveRequestCandidate[],
  employeeId: string,
  date: string
): ScheduleLeaveInfo | null => {
  const normalizedScheduleId = normalizeEmployeeId(employeeId);

  const leave = leaveRequests.find((request) => {
    if (normalizeEmployeeId(request.employeeId) !== normalizedScheduleId) {
      return false;
    }

    if (request.status !== 'approved') {
      return false;
    }

    return date >= request.startDate && date <= request.endDate;
  });

  return leave
    ? {
        leaveType: leave.leaveType,
        status: leave.status,
        employeeName: leave.employeeName,
      }
    : null;
};
