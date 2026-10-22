import { dayjs } from '@/utils/date';

const LEAVE_TIMEZONE = 'Asia/Manila';
const PAID_LEAVE_ENTITLEMENT = 7;

type LeaveAllocationRequest = {
  employeeId: string;
  paymentStatus: 'paid' | 'unpaid' | 'not-applicable';
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
};

function createScheduleSet(scheduleDates: string[]): Set<string> {
  return new Set(
    scheduleDates.map((date) =>
      dayjs(date).tz(LEAVE_TIMEZONE).format('YYYY-MM-DD')
    )
  );
}

export function calculateScheduledLeaveDays(
  startDate: string,
  endDate: string,
  scheduleDates: string[]
): number {
  const start = dayjs(startDate).tz(LEAVE_TIMEZONE).startOf('day');
  const end = dayjs(endDate).tz(LEAVE_TIMEZONE).startOf('day');

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return 0;
  }

  const totalDays = end.diff(start, 'day') + 1;
  if (scheduleDates.length === 0) {
    return totalDays;
  }

  const scheduleSet = createScheduleSet(scheduleDates);
  let countedDays = 0;
  for (let offset = 0; offset < totalDays; offset += 1) {
    if (scheduleSet.has(start.add(offset, 'day').format('YYYY-MM-DD'))) {
      countedDays += 1;
    }
  }

  return countedDays;
}

export function allocateLeaveRequest<T extends LeaveAllocationRequest>(
  request: T,
  remainingAllocation: number,
  scheduleDates: string[]
): T[] {
  const requestedDays = calculateScheduledLeaveDays(
    request.startDate,
    request.endDate,
    scheduleDates
  );
  if (requestedDays <= 0) {
    return [];
  }

  const scheduleSet = createScheduleSet(scheduleDates);
  const isScheduledDay = (date: string) =>
    scheduleSet.size === 0 || scheduleSet.has(date);

  if (requestedDays > remainingAllocation && remainingAllocation > 0) {
    const parsedStart = dayjs(request.startDate)
      .tz(LEAVE_TIMEZONE)
      .startOf('day');
    let daysCounter = 0;
    let splitDate = '';

    for (let offset = 0; offset < 365; offset += 1) {
      const currentDate = parsedStart.add(offset, 'day').format('YYYY-MM-DD');
      if (!isScheduledDay(currentDate)) {
        continue;
      }

      daysCounter += 1;
      if (daysCounter === remainingAllocation) {
        splitDate = currentDate;
        break;
      }
    }

    if (!splitDate) {
      return [];
    }

    let unpaidStartDate = '';
    for (let offset = 1; offset < 365; offset += 1) {
      const candidateDate = dayjs(splitDate)
        .tz(LEAVE_TIMEZONE)
        .add(offset, 'day')
        .format('YYYY-MM-DD');
      if (isScheduledDay(candidateDate)) {
        unpaidStartDate = candidateDate;
        break;
      }
    }

    if (!unpaidStartDate) {
      unpaidStartDate = dayjs(splitDate)
        .tz(LEAVE_TIMEZONE)
        .add(1, 'day')
        .format('YYYY-MM-DD');
    }

    const paidRequest = {
      ...request,
      paymentStatus: 'paid' as const,
      endDate: splitDate,
      numberOfDays: calculateScheduledLeaveDays(
        request.startDate,
        splitDate,
        scheduleDates
      ),
      reason: `${request.reason} (Paid portion - uses leave allocation)`,
    };
    const unpaidRequest = {
      ...request,
      paymentStatus: 'unpaid' as const,
      startDate: unpaidStartDate,
      numberOfDays: calculateScheduledLeaveDays(
        unpaidStartDate,
        request.endDate,
        scheduleDates
      ),
      reason: `${request.reason} (Unpaid portion - exceeds allocation)`,
    };

    return [paidRequest, unpaidRequest] as T[];
  }

  return [
    {
      ...request,
      paymentStatus: requestedDays <= remainingAllocation ? 'paid' : 'unpaid',
      numberOfDays: requestedDays,
    },
  ];
}

export function calculateRemainingPaidLeaveDays(
  employeeId: string,
  requests: Array<{
    employeeId: string | null;
    status: string;
    paymentStatus: string;
    numberOfDays: number;
  }>
): number {
  const usedPaidLeaveDays = requests
    .filter(
      (leave) =>
        leave.employeeId === employeeId &&
        leave.status === 'approved' &&
        leave.paymentStatus === 'paid'
    )
    .reduce((total, leave) => total + leave.numberOfDays, 0);

  return Math.max(PAID_LEAVE_ENTITLEMENT - usedPaidLeaveDays, 0);
}
