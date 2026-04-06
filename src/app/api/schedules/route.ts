import { prisma } from '@/lib/db';
import {
  createScheduleRoutes,
  scheduleOrderBy,
  scheduleSelect,
} from '@/modules/shared/employees/api/scheduleRouteFactory';

const { GET, POST, PATCH, DELETE } = createScheduleRoutes({
  scheduleModel: {
    findAll: () =>
      prisma.schedule.findMany({
        where: { deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findByIds: (ids) =>
      prisma.schedule.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findExistingConflicts: (pairs) =>
      prisma.schedule.findMany({
        where: {
          deletedAt: null,
          OR: pairs.map((pair) => ({
            employeeId: pair.employeeId,
            date: pair.date,
          })),
        },
        select: { employeeId: true, date: true },
      }),
    findById: (id) =>
      prisma.schedule.findFirst({
        where: { id, deletedAt: null },
      }),
    findOtherByEmployeeAndDate: (id, employeeId, date) =>
      prisma.schedule.findFirst({
        where: {
          id: { not: id },
          employeeId,
          date,
          deletedAt: null,
        },
        select: { id: true },
      }),
    createMany: (records) =>
      prisma.schedule.createMany({
        data: records,
        skipDuplicates: true,
      }),
    update: (id, data) =>
      prisma.schedule.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.schedule.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: async (employeeIds) => {
      const records = await prisma.employee.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
        },
        select: { employeeId: true },
      });

      return records.map((record) => record.employeeId);
    },
  },
  logMessages: {
    created: 'Schedules created',
    updated: 'Schedule updated',
    deleted: 'Schedule soft deleted',
  },
});

export { GET, POST, PATCH, DELETE };
