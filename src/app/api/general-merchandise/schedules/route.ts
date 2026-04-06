import { prisma } from '@/lib/db';
import {
  createScheduleRoutes,
  scheduleOrderBy,
  scheduleSelect,
} from '@/modules/shared/employees/api/scheduleRouteFactory';

const { GET, POST, PATCH, DELETE } = createScheduleRoutes({
  scheduleModel: {
    findAll: () =>
      prisma.generalMerchandiseSchedule.findMany({
        where: { deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findByIds: (ids) =>
      prisma.generalMerchandiseSchedule.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: scheduleSelect,
        orderBy: [...scheduleOrderBy],
      }),
    findExistingConflicts: (pairs) =>
      prisma.generalMerchandiseSchedule.findMany({
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
      prisma.generalMerchandiseSchedule.findFirst({
        where: { id, deletedAt: null },
      }),
    findOtherByEmployeeAndDate: (id, employeeId, date) =>
      prisma.generalMerchandiseSchedule.findFirst({
        where: {
          id: { not: id },
          employeeId,
          date,
          deletedAt: null,
        },
        select: { id: true },
      }),
    createMany: (records) =>
      prisma.generalMerchandiseSchedule.createMany({
        data: records,
        skipDuplicates: true,
      }),
    update: (id, data) =>
      prisma.generalMerchandiseSchedule.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.generalMerchandiseSchedule.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: async (employeeIds) => {
      const records = await prisma.generalMerchandiseEmployee.findMany({
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
    created: 'GM schedules created',
    updated: 'GM schedule updated',
    deleted: 'GM schedule deleted',
  },
});

const PUT = PATCH;

export { GET, POST, PUT, PATCH, DELETE };
