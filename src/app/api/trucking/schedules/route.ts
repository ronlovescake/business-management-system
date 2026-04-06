import { prisma } from '@/lib/db';
import {
  createScheduleRoutes,
  scheduleOrderBy,
  scheduleSelect,
} from '@/modules/shared/employees/api/scheduleRouteFactory';

const { GET, POST, PATCH, DELETE } = createScheduleRoutes({
  scheduleModel: {
    findAll: () =>
      prisma.truckingSchedule.findMany({
        where: { deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findByIds: (ids) =>
      prisma.truckingSchedule.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findExistingConflicts: (pairs) =>
      prisma.truckingSchedule.findMany({
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
      prisma.truckingSchedule.findFirst({
        where: { id, deletedAt: null },
      }),
    findOtherByEmployeeAndDate: (id, employeeId, date) =>
      prisma.truckingSchedule.findFirst({
        where: {
          id: { not: id },
          employeeId,
          date,
          deletedAt: null,
        },
        select: { id: true },
      }),
    createMany: (records) =>
      prisma.truckingSchedule.createMany({
        data: records,
        skipDuplicates: true,
      }),
    update: (id, data) =>
      prisma.truckingSchedule.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.truckingSchedule.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: async (employeeIds) => {
      const records = await prisma.truckingEmployee.findMany({
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
    created: 'Trucking schedules created',
    updated: 'Trucking schedule updated',
    deleted: 'Trucking schedule deleted',
  },
});

export { GET, POST, PATCH, DELETE };
