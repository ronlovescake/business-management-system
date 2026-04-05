import { prisma } from '@/lib/db';
import {
  getDefaultTruckingEmployeeAutomationSettings,
  getTruckingEmployeeAutomationSettings,
} from '@/lib/settings/truckingEmployeeAutomation';
import { logger } from '@/lib/logger';
import { dayjs } from '@/utils/date';
import { getDueStayInAutomationTarget } from '@/modules/shared/employees/automation/scheduling';
import { runSharedStayInAutoPresence } from '@/modules/shared/employees/automation/stayInAutoPresenceRunner';

export interface TruckingStayInAutomationResult {
  processed: number;
  inserted: number;
  skipped: number;
  targetDate: string;
  message: string;
}

export async function runTruckingStayInAutoPresenceAutomation(options?: {
  settings?: ReturnType<typeof getDefaultTruckingEmployeeAutomationSettings>;
  targetDate?: string;
  runTimestamp?: string;
}): Promise<TruckingStayInAutomationResult> {
  let settings =
    options?.settings ?? getDefaultTruckingEmployeeAutomationSettings();

  if (!options?.settings) {
    try {
      settings = await getTruckingEmployeeAutomationSettings();
    } catch (error) {
      logger.warn(
        'Failed to get trucking automation settings, using defaults',
        error
      );
    }
  }

  if (!settings.stayInAutoPresenceEnabled) {
    return {
      processed: 0,
      inserted: 0,
      skipped: 0,
      targetDate: dayjs().format('YYYY-MM-DD'),
      message: 'Automation disabled. No records generated.',
    };
  }

  const timezone = settings.stayInAutoPresenceTimezone || 'Asia/Manila';
  const targetDate =
    options?.targetDate ??
    getDueStayInAutomationTarget({
      scheduleTime: settings.stayInAutoPresenceTime,
      timezone,
      graceMinutes: settings.stayInAutoPresenceGraceMinutes,
    }).targetDate;
  const runTimestamp =
    options?.runTimestamp ?? dayjs().tz(timezone).format('YYYY-MM-DD HH:mm');

  const result = await runSharedStayInAutoPresence({
    clients: {
      async loadEmployees() {
        const employees = await prisma.truckingEmployee.findMany({
          where: {
            deletedAt: null,
            status: 'active',
            employeeType: 'stay-in',
          },
          select: {
            employeeId: true,
            name: true,
            department: true,
            position: true,
          },
        });

        return employees
          .filter((employee) => Boolean(employee.employeeId && employee.name))
          .map((employee) => ({
            employeeId: employee.employeeId,
            employeeName: employee.name,
            department: employee.department,
            position: employee.position,
          }));
      },
      async loadExistingAttendance(employeeIds, dueTargetDate) {
        const records = await prisma.truckingAttendance.findMany({
          where: {
            deletedAt: null,
            date: dueTargetDate,
            employeeId: { in: employeeIds },
          },
          select: { employeeId: true },
        });

        return records.map((record) => record.employeeId);
      },
      async loadScheduleSnapshots(employeeIds, dueTargetDate) {
        return prisma.truckingSchedule.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: dueTargetDate,
            deletedAt: null,
          },
          select: {
            employeeId: true,
            startTime: true,
            endTime: true,
            department: true,
            position: true,
          },
        });
      },
      async loadApprovedLeaves(employeeIds, dueTargetDate) {
        const records = await prisma.truckingLeaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: 'approved',
            startDate: { lte: dueTargetDate },
            endDate: { gte: dueTargetDate },
          },
          select: { employeeId: true },
        });

        return records
          .map((record) => record.employeeId)
          .filter(Boolean) as string[];
      },
      async createAttendanceRecords(payloads) {
        const created = payloads.length
          ? await prisma.$transaction(
              payloads.map((payload) =>
                prisma.truckingAttendance.create({
                  data: payload,
                })
              )
            )
          : [];

        return created.length;
      },
    },
    targetDate,
    runTimestamp,
    timezone,
    defaultTime: settings.stayInAutoPresenceTime,
  });

  return {
    processed: result.processed ?? 0,
    inserted: result.inserted ?? 0,
    skipped: result.skipped ?? 0,
    targetDate: result.targetDate ?? targetDate,
    message: result.message,
  };
}
