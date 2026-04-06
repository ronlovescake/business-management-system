import { prisma } from '@/lib/db';
import { createLeaveRequestRoutes } from '@/modules/shared/employees/api/leaveRequestRouteFactory';

const { GET, POST, PUT, PATCH, DELETE } = createLeaveRequestRoutes({
  leaveRequestModel: {
    findMany: (args) => prisma.leaveRequest.findMany(args),
    findActiveById: (id) =>
      prisma.leaveRequest.findFirst({
        where: { id, deletedAt: null },
      }),
    createMany: (data) => prisma.leaveRequest.createMany({ data }),
    update: (id, data) =>
      prisma.leaveRequest.update({
        where: { id },
        data,
      }),
    softDelete: (id) =>
      prisma.leaveRequest.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    softDeleteAll: () =>
      prisma.leaveRequest.updateMany({
        where: { deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: (employeeIds) =>
      prisma.employee.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
        },
        select: { employeeId: true },
      }),
  },
});

export { GET, POST, PUT, PATCH, DELETE };
