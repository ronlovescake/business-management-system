import { prisma } from '@/lib/db';
import { createLeaveRequestRoutes } from '@/modules/shared/employees/api/leaveRequestRouteFactory';

const { GET_BY_ID, DELETE_BY_ID } = createLeaveRequestRoutes({
  leaveRequestModel: {
    findMany: (args) => prisma.truckingLeaveRequest.findMany(args),
    findActiveById: (id) =>
      prisma.truckingLeaveRequest.findFirst({
        where: { id, deletedAt: null },
      }),
    createMany: (data) => prisma.truckingLeaveRequest.createMany({ data }),
    update: (id, data) =>
      prisma.truckingLeaveRequest.update({
        where: { id },
        data,
      }),
    softDelete: (id) =>
      prisma.truckingLeaveRequest.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    softDeleteAll: () =>
      prisma.truckingLeaveRequest.updateMany({
        where: { deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: (employeeIds) =>
      prisma.truckingEmployee.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
        },
        select: { employeeId: true },
      }),
  },
});

export { GET_BY_ID as GET, DELETE_BY_ID as DELETE };
