import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  createScheduleRoutes,
  scheduleOrderBy,
  scheduleSelect,
  type ScheduleRouteFactoryConfig,
} from '@/modules/shared/employees/api/scheduleRouteFactory';

function createScheduleStore(
  client: Prisma.TransactionClient = prisma
): ScheduleRouteFactoryConfig {
  return {
    scheduleModel: {
      findAll: () =>
        client.schedule.findMany({
          where: { deletedAt: null },
          select: scheduleSelect,
          orderBy: [...scheduleOrderBy],
        }),
      findByIds: (ids) =>
        client.schedule.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: scheduleSelect,
          orderBy: [...scheduleOrderBy],
        }),
      findExistingConflicts: (pairs) =>
        client.schedule.findMany({
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
        client.schedule.findFirst({
          where: { id, deletedAt: null },
        }),
      findOtherByEmployeeAndDate: (id, employeeId, date) =>
        client.schedule.findFirst({
          where: {
            id: { not: id },
            employeeId,
            date,
            deletedAt: null,
          },
          select: { id: true },
        }),
      createMany: (records) =>
        client.schedule.createMany({
          data: records,
          skipDuplicates: true,
        }),
      update: (id, data) =>
        client.schedule.update({
          where: { id, deletedAt: null },
          data,
        }),
      softDelete: (id) =>
        client.schedule.update({
          where: { id, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
    },
    employeeModel: {
      findExistingIds: async (employeeIds) => {
        const records = await client.employee.findMany({
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
  };
}

const { GET, POST, PATCH, DELETE } = createScheduleRoutes({
  ...createScheduleStore(),
  withTransaction: (operation) =>
    prisma.$transaction((client) => operation(createScheduleStore(client)), {
      isolationLevel: 'Serializable',
      timeout: 30000,
    }),
});

export { GET, POST, PATCH, DELETE };
